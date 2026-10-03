/**
 * RENVOYER UN DOSSIER DE MATÉRIEL PROMOTIONNEL POUR CORRECTION (audit 360°, lot C4b, R05).
 *
 * Tout refus était terminal : pour une quantité mal saisie ou un devis trop cher, le validateur
 * choisissait entre laisser passer un dossier faux et le TUER, et le demandeur recommençait tout.
 * Le renvoi est la troisième issue, et il suit la règle du moteur Ad & Pro (§118.186) : ouvert là
 * où le refus l'est, motif exigé, la balle chez le demandeur.
 *
 * OÙ REPART LE DOSSIER — et c'est ce qui le rend utile plutôt que décoratif :
 *   - la VALIDATION DE LA DEMANDE (étape 0 du circuit 2) se corrige SUR PLACE : le dossier reste à
 *     cette étape, marqué « à corriger » ; le demandeur corrige ses articles, puis le RESOUMET, et
 *     la même personne juge la correction ;
 *   - une validation du CHOIX (Direction Marketing, Directeur Général, et au circuit 1 la direction
 *     et l'information médicale) renvoie au CHOIX DU DEMANDEUR : c'est là que « retenez plutôt le
 *     devis B » ou « trop cher, cherchez d'autres agences » se corrige — et revalider ce choix
 *     repasse par toutes les validations, puisqu'un accord ne couvre pas plus que ce qu'il a vu.
 *
 * Le demandeur ne se renvoie pas sa propre étape : au choix des lignes, ses gestes sont « Redemander
 * des devis » et « Demander une correction de la retranscription », et pour abandonner, annuler le
 * dossier — un « Refuser » qui tue sa propre demande était l'impasse que l'audit nommait.
 *
 * Module PUR — testé, sans base de données.
 */

import type { PromoState } from "./circuit";

/** Les étapes qu'un validateur AUTRE que le demandeur tranche : là, et là seulement, on renvoie. */
const RENVOYABLES: ReadonlySet<PromoState> = new Set<PromoState>([
  "REVIEW_REQUEST", "REVIEW_MANAGER", "REVIEW_DG", "REVIEW_EXECUTIVE", "REVIEW_MEDICAL_INFO",
]);

export function renvoiPossible(state: PromoState): boolean {
  return RENVOYABLES.has(state);
}

/** Où repart un dossier renvoyé depuis `state` — `null` si l'étape ne se renvoie pas. */
export function etatApresRenvoi(state: PromoState): "REVIEW_REQUEST" | "REVIEW_REQUESTER" | null {
  if (!renvoiPossible(state)) return null;
  return state === "REVIEW_REQUEST" ? "REVIEW_REQUEST" : "REVIEW_REQUESTER";
}

/**
 * LE DOSSIER EST-IL CHEZ SON DEMANDEUR, POUR CORRECTION ?
 *
 * À l'étape 0, le renvoi ne change pas l'étape : c'est la marque du renvoi qui dit que la balle a
 * changé de camp. Au choix des lignes, l'étape est déjà celle du demandeur ; la marque y porte le
 * motif, jusqu'à ce qu'il revalide son choix. Ailleurs, une marque restée posée ne dit rien.
 */
export function attendSaCorrection(pm: { circuitState: string | null; returnedAt: Date | string | null }): boolean {
  if (!pm.returnedAt) return false;
  return pm.circuitState === "REVIEW_REQUEST" || pm.circuitState === "REVIEW_REQUESTER";
}

/** La phrase qu'un validateur reçoit quand le dossier est chez son demandeur (§118.186, la même que le moteur). */
export const REFUS_EN_CORRECTION =
  "Le dossier est chez son demandeur, pour correction : il reviendra à cette étape quand il l'aura resoumis.";

/**
 * Le demandeur ne REFUSE pas sa propre demande — il l'annule, ou demande d'autres devis. Rend la
 * phrase qui le dit, ou `null` quand le refus est celui d'un validateur.
 */
export function refusParLeDemandeur(
  user: { id: string },
  pm: { circuitState: string | null; requesterId: string | null; circuitVersion: number },
): string | null {
  if (pm.circuitState !== "REVIEW_REQUESTER" || !pm.requesterId || user.id !== pm.requesterId) return null;
  return pm.circuitVersion === 2
    ? "C'est votre propre demande : pour d'autres prix, « Redemander des devis » ; pour l'abandonner, annulez le dossier."
    : "C'est votre propre demande : pour l'abandonner, annulez le dossier.";
}
