/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ANNULER SA DEMANDE TANT QUE L'AUTRE NE L'A PAS EXÉCUTÉE (décision de la Direction, 04/10).
 *
 * « Si quelqu'un a demandé un BC, un paiement, une action, un devis, etc., il peut annuler sa
 * demande tant qu'elle n'a pas été exécutée par l'autre. » Chaque circuit dit ce qu'« exécutée »
 * veut dire pour lui ; ce module le dit pour ceux qui n'avaient AUCUN geste d'annulation (ou une
 * suppression physique qui effaçait la demande sous les yeux de celui qui la traitait).
 *
 * Module PUR, zéro import : l'action et le bouton lisent la même règle (§118.83). Chaque fonction
 * rend la RAISON du refus, ou `null` quand l'annulation est possible — la raison nomme l'exécution.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Demande RH (document, note de frais, entrevue…) : exécutée quand elle est prête, remise, accordée ou refusée. */
export const STATUTS_RH_ANNULABLES = ["PENDING", "IN_PROGRESS"] as const;

export function refusAnnulationDemandeRh(status: string): string | null {
  if ((STATUTS_RH_ANNULABLES as readonly string[]).includes(status)) return null;
  if (status === "CANCELLED") return "Cette demande est déjà annulée.";
  return "Les RH ont déjà traité cette demande : elle ne s'annule plus.";
}

/** Formation demandée : exécutée quand elle est réalisée. Accordée mais pas encore suivie, elle s'annule. */
export const STATUTS_FORMATION_ANNULABLES = ["PENDING", "APPROVED"] as const;

export function refusAnnulationFormation(status: string): string | null {
  if ((STATUTS_FORMATION_ANNULABLES as readonly string[]).includes(status)) return null;
  if (status === "CANCELLED") return "Cette formation est déjà retirée.";
  if (status === "DONE") return "Cette formation a eu lieu : elle ne s'annule plus.";
  if (status === "REJECTED") return "Cette formation a été refusée : il n'y a plus rien à annuler.";
  return "Cette formation n'est pas encore soumise : elle se modifie ou se supprime depuis sa fiche.";
}

/** Rallonge (budget de département, caisse) : exécutée dès qu'elle est tranchée. */
export function refusAnnulationRallonge(status: string): string | null {
  if (status === "PENDING") return null;
  if (status === "CANCELLED") return "Cette demande de rallonge est déjà retirée.";
  return "Cette demande de rallonge a déjà été tranchée : elle ne se retire plus.";
}

/** Ordre de mission : exécuté quand le responsable l'a émis. */
export function refusRetraitOrdreMission(orderStatus: string): string | null {
  if (orderStatus === "REQUESTED") return null;
  if (orderStatus === "ISSUED") return "L'ordre de mission a déjà été émis : il ne se retire plus d'ici.";
  return "Aucun ordre de mission n'est demandé.";
}

/**
 * Pièce demandée par l'information médicale : exécutée quand la personne sollicitée l'a DÉPOSÉE.
 * Annulable par celui qui l'a demandée — pas seulement par un gestionnaire du module.
 */
export function refusAnnulationPieceInfoMed(
  r: { status: string; requestedById: string | null },
  e: { userId: string; gestionnaire: boolean },
): string | null {
  if (r.status === "FULFILLED") return "La pièce est déjà déposée : la demande ne s'annule plus.";
  if (!e.gestionnaire && r.requestedById !== e.userId) return "Seule la personne qui a demandé cette pièce (ou un gestionnaire du module) l'annule.";
  return null;
}
