import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES BONS DE COMMANDE DÉJÀ ÉTABLIS DANS LEGAL POUR UN POSTE (§118.187 — audit 360°, R05/R06/R12).
 *
 * Le BC qu'une assistante établit pour un poste naît d'une demande de pièce (`DocumentRequest`,
 * `entityType = AD_PRO_ITEM`) et lit sa validation SUR LE POSTE (`portesDesBC`, `source: "POSTE"`).
 * Retirer la demande de BC, revoir la décision du poste ou le rendre à la Direction le laisserait
 * SANS porte — et la facture d'un BC sans porte part au règlement (`blocageParLeBC(null)`). Ces trois
 * gestes refusent donc tant qu'il en existe un, non annulé, et le refus le NOMME.
 *
 * Une lecture, deux lecteurs : les ACTIONS (qui refusent) et la CARTE du poste (qui ne propose pas un
 * geste que l'action refuserait, §118.83). Deux copies de « ce BC existe-t-il ? » finiraient par
 * répondre autrement, et le symptôme serait un bouton offert puis refusé (§118.5). La lecture se fait
 * en LOT : un écran montre vingt postes, et une requête par poste ferait vingt allers-retours
 * (§118.102b).
 *
 * Supprimer le poste, lui, n'a pas besoin de ce refus : le LOT de la corbeille emporte la demande de
 * pièce et le BC non signé avec lui, et les rend ensemble à la restauration ; un BC signé bloque la
 * suppression (`faitIrreversible`). Ce n'est pas la même question (§118.57).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function bcEtablisDesPostes(itemIds: readonly string[]): Promise<Map<string, string[]>> {
  const res = new Map<string, string[]>();
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (ids.length === 0) return res;
  // DEUX CHEMINS, UNE LECTURE (§118.204) : le BC classé depuis une demande de pièce ET le BC rattaché
  // au poste (`AdProItemPiece`) — celui que la carte montre. N'en lire qu'un ferait dire « pas de BC »
  // ici quand la carte en montre un.
  const [parDemande, parLien] = await Promise.all([
    prisma.documentRequest.findMany({
      where: { entityType: "AD_PRO_ITEM", entityId: { in: ids }, legalDocumentId: { not: null } },
      select: { entityId: true, legalDocumentId: true },
    }),
    prisma.adProItemPiece.findMany({
      where: { itemId: { in: ids }, nature: "BON_DE_COMMANDE" },
      select: { itemId: true, legalDocumentId: true },
    }),
  ]);
  const demandes = [...parDemande, ...parLien.map((l) => ({ entityId: l.itemId, legalDocumentId: l.legalDocumentId }))];
  const docIds = [...new Set(demandes.map((d) => d.legalDocumentId).filter((x): x is string => Boolean(x)))];
  if (docIds.length === 0) return res;
  const docs = await prisma.legalDocument.findMany({
    where: { id: { in: docIds }, kind: "PURCHASE_ORDER", status: { not: "CANCELLED" } },
    select: { id: true, reference: true, title: true },
  });
  const nomDe = new Map(docs.map((d) => [d.id, d.reference?.trim() || d.title]));
  for (const d of demandes) {
    const nom = d.legalDocumentId ? nomDe.get(d.legalDocumentId) : undefined;
    if (!nom) continue;
    const l = res.get(d.entityId) ?? [];
    if (!l.includes(nom)) l.push(nom);
    res.set(d.entityId, l);
  }
  return res;
}

export async function bcEtablisDuPoste(itemId: string): Promise<string[]> {
  return (await bcEtablisDesPostes([itemId])).get(itemId) ?? [];
}

/** Le refus, et le geste qui le lève — une rédaction pour les trois actions et pour la carte. */
export function refusBcEtabli(bcs: readonly string[], ensuite: string): string {
  return `Un bon de commande a déjà été établi pour ce poste (${bcs.join(", ")}) et il lit sa validation sur ce poste : `
    + `annulez-le d'abord dans Legal (« Annuler », motif à l'appui), puis ${ensuite}.`;
}
