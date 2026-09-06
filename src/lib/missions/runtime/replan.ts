/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUAND UNE MISSION MÉRITE UN PLAN DE PLUS — deux constantes, une seule définition.
 *
 * Elles étaient écrites dans `platform/in-process/missions/runtime.ts`, donc invisibles au
 * BATTEMENT, qui vit ailleurs. Le résultat mesuré : la requête du battement ne sélectionnait
 * que les missions portant une étape PENDING ou FAILED, et une mission dont TOUTES les étapes
 * ont abouti mais que le juge a refusée n'en porte aucune. Elle n'était donc jamais candidate,
 * jamais conduite, jamais replanifiée — alors que le code de replanification prévoit
 * explicitement ce cas (`objectifManque`) et qu'il est le cas CENTRAL de la famille
 * COMPOSITION : le plan a oublié la primitive, tout est vert, l'objectif n'est pas atteint.
 *
 * `PLANS_MAX` figure aussi dans la requête : sans lui, une mission définitivement bloquée
 * redeviendrait candidate à chaque battement pour se faire refuser un cinquième plan. Avec lui,
 * la boucle s'arrête d'elle-même — la fin est une propriété de la requête, pas une discipline.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les états d'où une replanification a un sens. Ailleurs, il n'y a rien à replanifier. */
export const ETATS_REPLANIFIABLES = ["FAILED", "BLOCKED", "PARTIAL"] as const;
export type EtatReplanifiable = (typeof ETATS_REPLANIFIABLES)[number];

export const estReplanifiable = (statut: string): boolean =>
  (ETATS_REPLANIFIABLES as readonly string[]).includes(statut);

/**
 * COMBIEN DE PLANS AVANT DE S'ARRÊTER.
 *
 * §9 dit qu'on ne s'arrête jamais à la première difficulté — il dit aussi que l'échelle de
 * recours a des barreaux, et qu'on peut les épuiser. Sans plafond, une mission qui échoue pour
 * une raison que le planificateur ne peut pas voir (un service tiers en panne, un droit retiré)
 * se réécrirait indéfiniment, en payant un appel de modèle à chaque tour de battement.
 *
 * Quatre plans, c'est trois corrections. Au-delà, ce n'est plus le plan qui est en cause, et la
 * bonne réponse est de le DIRE à la personne plutôt que de continuer à essayer sans elle.
 */
export const PLANS_MAX = 4;
