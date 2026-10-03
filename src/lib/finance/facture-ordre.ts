import type { EntityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUELS ORDRES DE DÉPENSE ONT LEUR FACTURE ? — une règle, trois lecteurs (§118.185 — audit 360°, I6).
 *
 * « Facture obligatoire » bloque le règlement d'une dépense événementielle tant que la facture n'est
 * pas là. La règle ne regardait que DEUX endroits — un fichier « Facture » joint à l'ordre, ou au
 * dossier source — pendant que la plateforme range les factures à QUATRE autres : au registre Legal
 * (la facture chaînée à son BC, ou rattachée à la fiche), sur le POSTE qui a émis l'ordre, sur le
 * DOSSIER compagnon que l'ordre ouvre en naissant, et parmi les PIÈCES de ce dossier. Un ordre de
 * poste, de congrès ou de sponsoring dont la facture était parfaitement rangée restait impayable —
 * « joignez la facture » à quelqu'un qui l'avait jointe, à l'endroit que l'écran lui proposait.
 *
 * Et elle était écrite trois fois, trois fois différemment : le règlement, la colonne « Facture » de
 * Règlements à effectuer, et le signal « justificatif manquant » de l'intelligence financière — qui
 * ne lisait, lui, que le registre. Deux lectures du même fait divergent toujours (§118.5) : le
 * symptôme était un ordre que l'écran disait « facture jointe » et que le règlement refusait.
 *
 * CE QUI COMPTE COMME LA FACTURE D'UN ORDRE :
 *   • un fichier de catégorie « Facture » sur l'ordre, sur son dossier source, sur le poste qui l'a
 *     émis, ou sur son dossier compagnon ;
 *   • une pièce « Facture » du dossier compagnon que les Finances n'ont pas refusée ;
 *   • une facture du registre Legal, non annulée, partie au règlement sur CET ordre, ou rattachée à
 *     la même fiche source — et qui porte au moins un fichier : une ligne de registre sans pièce
 *     n'est pas la preuve qu'on demande avant de payer.
 *
 * Les lectures sont EN LOT (une table de cent ordres = une poignée de requêtes, pas cent).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface OrdrePourFacture {
  id: string;
  sourceType: string | null;
  sourceId: string | null;
}

export async function ordresAvecFacture(ordres: readonly OrdrePourFacture[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (ordres.length === 0) return out;
  const ids = ordres.map((o) => o.id);
  const sources = ordres
    .filter((o) => o.sourceType && o.sourceId)
    .map((o) => ({ entityType: o.sourceType as EntityType, entityId: o.sourceId as string }));
  const cleSource = (t: string | null, i: string | null) => `${t ?? ""}:${i ?? ""}`;

  const [postes, dossiers] = await Promise.all([
    prisma.adProItem.findMany({ where: { expenseOrderId: { in: ids } }, select: { id: true, expenseOrderId: true } }),
    prisma.paymentRequest.findMany({ where: { expenseOrderId: { in: ids } }, select: { id: true, expenseOrderId: true } }),
  ]);
  const ordreDuPoste = new Map(postes.map((p) => [p.id, p.expenseOrderId as string]));
  const ordreDuDossier = new Map(dossiers.map((d) => [d.id, d.expenseOrderId as string]));

  const fichiersOu: Prisma.DocumentWhereInput[] = [
    { entityType: "EXPENSE_ORDER", entityId: { in: ids } },
    ...sources,
    ...(postes.length ? [{ entityType: "AD_PRO_ITEM" as const, entityId: { in: [...ordreDuPoste.keys()] } }] : []),
    ...(dossiers.length ? [{ entityType: "PAYMENT_REQUEST" as const, entityId: { in: [...ordreDuDossier.keys()] } }] : []),
  ];
  const [fichiers, pieces, factures] = await Promise.all([
    prisma.document.findMany({ where: { category: "INVOICE", OR: fichiersOu }, select: { entityType: true, entityId: true } }),
    dossiers.length
      ? prisma.paymentPiece.findMany({
          where: { requestId: { in: [...ordreDuDossier.keys()] }, kind: "INVOICE", status: { not: "REJECTED" } },
          select: { requestId: true },
        })
      : Promise.resolve([] as { requestId: string }[]),
    prisma.legalDocument.findMany({
      where: {
        kind: "INVOICE",
        status: { not: "CANCELLED" },
        OR: [
          { expenseOrderId: { in: ids } },
          ...sources.map((s) => ({ sourceType: s.entityType, sourceId: s.entityId })),
        ],
      },
      select: { id: true, expenseOrderId: true, sourceType: true, sourceId: true },
    }),
  ]);

  // Une facture du registre ne compte que si elle porte sa pièce.
  const avecPiece = factures.length
    ? new Set((await prisma.document.findMany({
        where: { entityType: "LEGAL_DOCUMENT", entityId: { in: factures.map((f) => f.id) } },
        select: { entityId: true },
      })).map((d) => d.entityId))
    : new Set<string>();

  const parSource = new Map<string, string[]>();
  for (const o of ordres) {
    if (!o.sourceType || !o.sourceId) continue;
    const k = cleSource(o.sourceType, o.sourceId);
    parSource.set(k, [...(parSource.get(k) ?? []), o.id]);
  }

  for (const f of fichiers) {
    if (f.entityType === "EXPENSE_ORDER") out.add(f.entityId);
    else if (f.entityType === "AD_PRO_ITEM") { const o = ordreDuPoste.get(f.entityId); if (o) out.add(o); }
    else if (f.entityType === "PAYMENT_REQUEST" && ordreDuDossier.has(f.entityId)) out.add(ordreDuDossier.get(f.entityId) as string);
    // Un fichier sur la fiche source vaut pour chaque ordre de cette fiche (règle d'avant, gardée).
    for (const o of parSource.get(cleSource(f.entityType, f.entityId)) ?? []) out.add(o);
  }
  for (const p of pieces) { const o = ordreDuDossier.get(p.requestId); if (o) out.add(o); }
  for (const f of factures) {
    if (!avecPiece.has(f.id)) continue;
    if (f.expenseOrderId && ids.includes(f.expenseOrderId)) out.add(f.expenseOrderId);
    for (const o of parSource.get(cleSource(f.sourceType, f.sourceId)) ?? []) out.add(o);
  }
  return out;
}

/** La même règle, pour un ordre. */
export async function ordreAFacture(ordre: OrdrePourFacture): Promise<boolean> {
  return (await ordresAvecFacture([ordre])).has(ordre.id);
}
