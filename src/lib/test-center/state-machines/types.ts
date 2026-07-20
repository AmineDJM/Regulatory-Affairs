/**
 * Machines à états métier (§29). On **déclare explicitement** la machine de chaque objet
 * métier majeur : états, transitions autorisées, états initiaux (le routage intelligent Ad & Pro
 * permet plusieurs points d'entrée) et états terminaux. L'explorateur (`explorer.ts`) confronte
 * ces déclarations aux données réelles (transitions réellement observées via le journal d'audit)
 * et mesure la **couverture des transitions métier**.
 *
 * `coupling` : invariant structurel PROUVABLE reliant l'état à un autre champ (ex. une instance de
 * workflow IN_PROGRESS a forcément une étape courante ; un objet terminal n'en a plus). Sert à
 * détecter des états « illégaux » dans les données vivantes, sans dépendre de la complétude de la
 * déclaration des transitions.
 */

export interface CouplingCheck {
  /** Champ couplé à l'état (pour la lisibilité du constat). */
  field: string;
  /** Vrai si l'enregistrement `{ status, ...rest }` respecte le couplage. */
  holds: (row: Record<string, unknown>) => boolean;
  /** Explication de l'attendu (preuve). */
  expect: string;
}

export interface StateMachine {
  id: string; // "expenseOrder"
  label: string;
  module: string; // module RBAC pour le rattachement des constats
  model: string; // modèle Prisma
  statusField: string; // "status"
  states: string[]; // TOUS les états connus (enum complet) — évite les faux « états inconnus »
  initial: string[]; // points d'entrée possibles (routage intelligent → plusieurs)
  terminal: string[]; // états absorbants
  transitions: [string, string][]; // transitions AUTORISÉES [depuis, vers]
  coupling?: CouplingCheck; // invariant structurel état ↔ champ
}

/** Une transition est-elle déclarée valide ? (les auto-boucles ne le sont que si déclarées). */
export function isValidTransition(m: StateMachine, from: string, to: string): boolean {
  return m.transitions.some(([f, t]) => f === from && t === to);
}

/** Ensemble des transitions déclarées, dédupliqué, sous forme « from→to ». */
export function declaredTransitionKeys(m: StateMachine): string[] {
  return [...new Set(m.transitions.map(([f, t]) => `${f}→${t}`))];
}
