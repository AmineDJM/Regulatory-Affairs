import { prisma } from "@/lib/prisma";
import { portesDesBC } from "@/lib/bons-de-commande/aiguillage";
import { LIBELLE_CENTRE_BC, type PorteBC } from "@/lib/bons-de-commande/regle";
import {
  refusSuppressionFichiers, refusSuppressionPiece, type FaitsPieceASupprimer,
} from "@/lib/legal/suppression-piece";

/**
 * LES FAITS D'UNE PIÈCE LEGAL QUI DÉCIDENT DE SA SUPPRESSION — lus en LOT (§118.209).
 *
 * Une fiche de demande porte une dizaine de pièces : quatre lectures pour toute la liste, jamais quatre
 * par ligne (§118.102b). La décision, elle, est pure (`legal/suppression-piece.ts`) : cet écran, le
 * registre de suppression (`DELETE_REGISTRY.LEGAL_DOCUMENT.refuse`) et l'action de la demande lisent
 * la MÊME — un bouton offert que l'action refuserait ensuite fait chercher une panne qui n'existe pas
 * (§118.83).
 *
 * Module serveur ordinaire, pas un fichier `"use server"` : tout ce qu'un tel fichier exporte devient
 * un point d'entrée public, et ceci est une QUESTION posée par des actions qui ont déjà la session.
 */
export async function faitsDesPieces(ids: readonly string[]): Promise<Map<string, FaitsPieceASupprimer>> {
  const res = new Map<string, FaitsPieceASupprimer>();
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return res;

  const docs = await prisma.legalDocument.findMany({
    where: { id: { in: uniques } },
    select: {
      id: true, title: true, reference: true, kind: true, status: true,
      signedAt: true, signedById: true, paidDate: true, settlementTxId: true, expenseOrderId: true,
      renewals: { select: { title: true }, take: 1 },
    },
  });
  if (docs.length === 0) return res;

  const ordreIds = docs.map((d) => d.expenseOrderId).filter((x): x is string => Boolean(x));
  const bcIds = docs.filter((d) => d.kind === "PURCHASE_ORDER" && d.status !== "CANCELLED").map((d) => d.id);
  const [ordres, aval, postes, receptions, portes] = await Promise.all([
    ordreIds.length
      ? prisma.expenseOrder.findMany({ where: { id: { in: ordreIds } }, select: { id: true, reference: true, status: true } })
      : Promise.resolve([]),
    prisma.legalDocument.findMany({
      where: { chainFromId: { in: docs.map((d) => d.id) } },
      select: { chainFromId: true, kind: true, title: true, reference: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adProItemPiece.findMany({
      where: { legalDocumentId: { in: docs.map((d) => d.id) } },
      select: { legalDocumentId: true, item: { select: { label: true } } },
    }),
    prisma.promoFactureLigne.findMany({
      where: { quantiteRecue: { gt: 0 }, facture: { legalDocumentId: { in: docs.map((d) => d.id) } } },
      select: { facture: { select: { legalDocumentId: true } } },
    }),
    bcIds.length ? portesDesBC(bcIds) : Promise.resolve(new Map<string, PorteBC>()),
  ]);

  const ordreDe = new Map(ordres.map((o) => [o.id, o]));
  for (const d of docs) {
    const o = d.expenseOrderId ? ordreDe.get(d.expenseOrderId) ?? null : null;
    const porte = portes.get(d.id);
    res.set(d.id, {
      titre: d.title, reference: d.reference, kind: String(d.kind),
      signee: d.signedAt !== null || d.signedById !== null,
      reglee: d.paidDate !== null || d.settlementTxId !== null,
      ordre: o ? { reference: o.reference, statut: o.status } : null,
      aval: aval.filter((a) => a.chainFromId === d.id).map((a) => ({
        kind: String(a.kind), titre: a.title, reference: a.reference, annulee: a.status === "CANCELLED",
      })),
      renouvelePar: d.renewals[0]?.title ?? null,
      postes: postes.filter((p) => p.legalDocumentId === d.id).map((p) => p.item.label),
      // Un BC ANNULÉ n'engage plus personne : sa validation passée n'est plus un fait qui l'enferme.
      valideParLeCentre: porte && porte.etat === "VALIDE" ? LIBELLE_CENTRE_BC[porte.centre] : null,
      receptionsAuStock: receptions.filter((r) => r.facture.legalDocumentId === d.id).length,
    });
  }
  return res;
}

/** Ce qui interdit de supprimer la pièce, et ce qui interdit d'en retirer un fichier — par pièce. */
export interface RefusPiece { piece: string | null; fichiers: string | null }

export async function refusDesPieces(ids: readonly string[]): Promise<Map<string, RefusPiece>> {
  const faits = await faitsDesPieces(ids);
  const res = new Map<string, RefusPiece>();
  for (const [id, f] of faits) res.set(id, { piece: refusSuppressionPiece(f), fichiers: refusSuppressionFichiers(f) });
  return res;
}

/** Le refus d'UNE pièce — la forme que lit le registre de suppression. `null` : elle peut partir. */
export async function refusSuppressionDeLaPiece(id: string): Promise<string | null> {
  return (await refusDesPieces([id])).get(id)?.piece ?? null;
}
