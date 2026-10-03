/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN GESTIONNAIRE POSE À LA MAIN SUR UNE DEMANDE AU SECRÉTARIAT — ET CE QUI A SON GESTE
 * (§118.191 — audit 360°, R12).
 *
 * Mesuré par l'audit : un menu « Changer le statut » offrait les neuf statuts, sans condition.
 *
 *   • « Terminée » par le menu contournait `finishRequest` — la facture d'un achat, l'imputation aux
 *     moyens généraux. Et c'était le SEUL chemin qui archivait la demande dans le Drive : la porte
 *     gardée ne le faisait pas, la porte qui contournait les gardes, si ;
 *   • « Annulée » par le menu contournait l'annulation commune : la validation, l'approbation et
 *     l'ordre de dépense en attente survivaient à la demande (§118.187) ;
 *   • une demande ANNULÉE se « rouvrait » en choisissant « En cours » — ressuscitée sans les
 *     validations et les paiements que l'annulation venait de retirer ;
 *   • « Bloquée » partait sans motif, et le demandeur recevait l'énumération brute (« BLOCKED »).
 *
 * Ce qui reste manuel est ce qui n'a pas d'autre geste : dire qu'on attend un tiers ou un document,
 * qu'on est bloqué (et pourquoi), et reprendre. Le reste a sa porte : commencer, demander une
 * validation, une approbation, terminer, annuler, rouvrir.
 *
 * Module PUR — l'action et l'écran lisent la même règle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les statuts qu'un gestionnaire pose à la main. */
export const STATUTS_MANUELS = ["IN_PROGRESS", "AWAITING_EXTERNAL", "AWAITING_DOCUMENT", "BLOCKED"] as const;
export type StatutManuel = (typeof STATUTS_MANUELS)[number];

/** Les statuts d'où l'on part à la main : une demande qui se traite, et qu'aucune décision n'attend. */
const DEPARTS = new Set(["NEW", "IN_PROGRESS", "AWAITING_EXTERNAL", "AWAITING_DOCUMENT", "BLOCKED"]);

export function estStatutManuel(s: string): s is StatutManuel {
  return (STATUTS_MANUELS as readonly string[]).includes(s);
}

/**
 * Pourquoi ce changement de statut n'est PAS posable à la main — `null` s'il l'est.
 * L'état de la demande d'abord (§118.18), puis la cible, puis le motif.
 */
export function refusDuStatutManuel(input: { courant: string; cible: string; motif: string | null }): string | null {
  const { courant, cible, motif } = input;
  if (courant === "CANCELLED") return "Cette demande est annulée : elle ne se rouvre pas — déposez-en une nouvelle.";
  if (courant === "DONE") return "Cette demande est terminée : elle se rouvre par « Rouvrir », avec son motif.";
  if (courant === "AWAITING_VALIDATION") return "Cette demande attend une validation : elle reprend quand la décision tombe.";
  if (courant === "AWAITING_PAYMENT") return "Cette demande attend une approbation de paiement : elle reprend quand la décision tombe.";
  if (cible === "DONE") return "La fin d'une demande passe par « Fin de la demande » : c'est elle qui vérifie la facture d'un achat et son imputation.";
  if (cible === "CANCELLED") return "Annuler une demande passe par « Annuler la demande », avec son motif : elle retire aussi les validations et les paiements qui en dépendent.";
  if (!estStatutManuel(cible)) return "Ce statut découle d'un geste (commencer, demander une validation, une approbation) : il ne se pose pas à la main.";
  if (courant === "NEW" && cible === "IN_PROGRESS") return "Une demande neuve se prend en charge par « Commencer le traitement ».";
  if (!DEPARTS.has(courant)) return "Cette demande ne change pas de statut à la main.";
  if (courant === cible) return "La demande est déjà dans cet état.";
  if (cible === "BLOCKED" && motif === null) return "Dites ce qui bloque : c'est ce que lira le demandeur.";
  return null;
}

/** Pourquoi la demande ne se ROUVRE pas — `null` si elle le peut. */
export function refusDeReouverture(input: { courant: string; motif: string | null }): string | null {
  if (input.courant === "CANCELLED") return "Une demande annulée ne se rouvre pas : ce qui en dépendait a été retiré avec elle. Déposez-en une nouvelle.";
  if (input.courant !== "DONE") return "Seule une demande terminée se rouvre.";
  if (input.motif === null) return "Dites pourquoi vous la rouvrez : c'est ce que lira le demandeur.";
  return null;
}
