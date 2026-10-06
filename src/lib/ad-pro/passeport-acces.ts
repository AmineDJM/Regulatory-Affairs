import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PASSEPORT D'UN VOYAGEUR, POUR QUI RÉSERVE SON BILLET (§118.185 — audit 360°, I10).
 *
 * Le sujet de réservation annonce « passeport joint » ; le passeport est une pièce du POSTE de
 * billetterie (désignée par le voyageur, `stepKey`), et l'accès à un poste suit son opération —
 * congrès, sponsoring, événement — que l'assistante de direction n'a pas. Elle recevait donc un
 * refus au téléchargement de la pièce même qu'on lui demandait d'utiliser, et réservait un billet
 * international en redemandant le passeport hors de la plateforme.
 *
 * La porte est ÉTROITE, et c'est la moitié qui compte : elle ne s'ouvre qu'au responsable et aux
 * participants du SUJET DE RÉSERVATION de ce poste, et seulement pour une pièce qui désigne un
 * VOYAGEUR de ce poste. Les autres pièces du poste (devis, factures) restent derrière la porte de
 * l'opération : réserver un billet n'ouvre pas la comptabilité de la demande.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function peutLirePasseportDuSujet(
  userId: string,
  doc: { entityType: string; entityId: string; stepKey: string | null },
): Promise<boolean> {
  if (doc.entityType !== "AD_PRO_ITEM" || !doc.stepKey) return false;
  const poste = await prisma.adProItem.findUnique({
    where: { id: doc.entityId },
    select: { reservationDossier: { select: { assignedToId: true, participantIds: true } } },
  });
  const sujet = poste?.reservationDossier;
  if (!sujet) return false;
  const membre = sujet.assignedToId === userId || sujet.participantIds.includes(userId);
  if (!membre) return false;
  // La pièce désigne-t-elle un VOYAGEUR — ou une FICHE HÔTELLERIE (Direction, 06/10) — de ce poste ?
  // Sinon ce n'est pas une pièce d'identité de personne prise en charge.
  const [voyageur, hebergement] = await Promise.all([
    prisma.adProVoyageur.count({ where: { id: doc.stepKey, itemId: doc.entityId } }),
    prisma.adProHebergement.count({ where: { id: doc.stepKey, itemId: doc.entityId } }),
  ]);
  return voyageur + hebergement > 0;
}
