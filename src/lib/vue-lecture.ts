import { AsyncLocalStorage } from "node:async_hooks";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE ACTION SERVEUR QUI NE FAIT QUE LIRE POUR L'ÉCRAN LE DÉCLARE — `enLecture(requireUser)`.
 *
 * « Quand je vois l'écran de Leila, je dois voir vraiment SON interface, tout » (Direction, 06/10). Le corps
 * d'une action serveur part au nom du Super Admin (§118.184 : une vue n'est pas une usurpation) — juste pour
 * une écriture, faux pour une action qui CHARGE un panneau : ses collègues à qui partager, son équipe, ses
 * dossiers liables, les partages d'un fichier… arrivaient ceux de l'ADMINISTRATEUR dans l'écran de Leila.
 *
 * `enLecture` marque la résolution d'identité qu'elle enveloppe (et elle seule : le reste de l'action n'est
 * pas concerné) ; `session.ts` y honore la vue. Le module est à part, sans dépendance, pour que les bancs
 * qui remplacent `@/lib/session` par un acteur fixe gardent leur substitut tel quel.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const lecture = new AsyncLocalStorage<true>();

/** Résout l'utilisateur À L'ÉCRAN (la personne visualisée en Vue exacte). Jamais pour une action qui écrit. */
export function enLecture<T>(resoudre: () => Promise<T>): Promise<T> {
  return lecture.run(true, resoudre);
}

/** Vrai pendant une résolution d'identité déclarée « lecture ». Lu par `session.ts`. */
export function lectureDeclaree(): boolean {
  return lecture.getStore() === true;
}
