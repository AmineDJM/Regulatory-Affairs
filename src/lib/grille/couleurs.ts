/**
 * LA PALETTE D'UNE CELLULE — un vocabulaire FERMÉ, au socle.
 *
 * Une couleur de cellule est une DONNÉE persistée (elle voyage d'un écran à l'autre, d'une
 * personne à l'autre) : elle se stocke sous une CLÉ, jamais sous une classe CSS ni un code hex
 * tapé à la main — sinon la première montée de version du thème rend illisibles les couleurs
 * posées avant, et un code arbitraire accepté par l'action serveur finit dans un attribut de
 * style. Le serveur VALIDE contre cette liste ; l'écran TRADUIT la clé en classes.
 *
 * Ce module ne porte AUCUNE classe CSS : `src/lib/**` n'est pas balayé par Tailwind, et une
 * classe écrite ici n'existerait pas dans la feuille compilée. La traduction vit dans la couche
 * composants (`components/grille/palette.ts`), et un test vérifie que chaque clé y a sa classe.
 */

export const COULEURS_CELLULE = [
  { cle: "jaune", label: "Jaune" },
  { cle: "vert", label: "Vert" },
  { cle: "bleu", label: "Bleu" },
  { cle: "orange", label: "Orange" },
  { cle: "rose", label: "Rose" },
  { cle: "violet", label: "Violet" },
  { cle: "rouge", label: "Rouge" },
  { cle: "gris", label: "Gris" },
] as const;

export type CouleurCellule = (typeof COULEURS_CELLULE)[number]["cle"];

const CLES = new Set<string>(COULEURS_CELLULE.map((c) => c.cle));

export function estCouleurCellule(x: unknown): x is CouleurCellule {
  return typeof x === "string" && CLES.has(x);
}

export function libelleCouleur(cle: CouleurCellule): string {
  return COULEURS_CELLULE.find((c) => c.cle === cle)?.label ?? cle;
}

/** La clé d'une cellule colorée, telle que l'écran et l'action la nomment : `<ligne>:<champ>`. */
export const cleCellule = (rowId: string, field: string): string => `${rowId}:${field}`;

export interface CibleCellule {
  id: string;
  field: string;
}

/**
 * Lire une clé de cellule `<ligne>:<colonne>` — l'inverse EXACT de `cleCellule`, et au même endroit :
 * deux découpes écrites à la main finissent par diverger sur le séparateur. `null` si la forme
 * n'est pas celle-là : on ne devine pas une ligne. La ligne n'a pas le droit de porter « : »
 * (un cuid n'en porte pas) ; la colonne, elle, est tout ce qui suit le PREMIER séparateur.
 *
 * Ce module est PUR et vit au socle : l'action serveur qui colore l'importe, parce qu'un fichier
 * `"use server"` n'a le droit d'exporter que des fonctions asynchrones — un `export function`
 * synchrone y compile au typecheck et fait tomber le build de production (« Server actions must
 * be async functions »), ce que ni `tsc` ni la suite de tests ne voient.
 */
export function lireCleCellule(cle: string): CibleCellule | null {
  const i = String(cle ?? "").indexOf(":");
  if (i <= 0) return null;
  const id = cle.slice(0, i).trim();
  const field = cle.slice(i + 1).trim();
  return id && field ? { id, field } : null;
}
