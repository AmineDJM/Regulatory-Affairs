import type { CouleurCellule } from "@/lib/grille/couleurs";

/**
 * LA TRADUCTION D'UNE CLÉ DE PALETTE EN CLASSES — dans la couche composants, et pas au socle.
 *
 * `src/lib/**` n'est pas balayé par Tailwind : une classe écrite là-bas n'existerait pas dans la
 * feuille compilée, et la cellule resterait blanche sans qu'aucune erreur ne le dise. Le
 * `Record<CouleurCellule, …>` est EXHAUSTIF : une couleur ajoutée à la palette sans sa classe ne
 * compile pas.
 *
 * Les teintes sont volontairement PÂLES en fond de cellule (le texte reste lisible dessus, dans
 * les deux thèmes) et FRANCHES en pastille de la barre d'outils (c'est ce qu'on choisit).
 */
export const CLASSES_COULEUR: Record<CouleurCellule, { cellule: string; pastille: string }> = {
  jaune: { cellule: "bg-yellow-100 dark:bg-yellow-400/20", pastille: "bg-yellow-400" },
  vert: { cellule: "bg-emerald-100 dark:bg-emerald-400/20", pastille: "bg-emerald-500" },
  bleu: { cellule: "bg-sky-100 dark:bg-sky-400/20", pastille: "bg-sky-500" },
  orange: { cellule: "bg-orange-100 dark:bg-orange-400/20", pastille: "bg-orange-500" },
  rose: { cellule: "bg-pink-100 dark:bg-pink-400/20", pastille: "bg-pink-500" },
  violet: { cellule: "bg-violet-100 dark:bg-violet-400/20", pastille: "bg-violet-500" },
  rouge: { cellule: "bg-red-100 dark:bg-red-400/25", pastille: "bg-red-500" },
  gris: { cellule: "bg-zinc-200 dark:bg-zinc-500/30", pastille: "bg-zinc-400" },
};
