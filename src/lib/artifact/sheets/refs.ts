/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÉFÉRENCES EXCEL — A1 ↔ (ligne, colonne), plages, clés numériques.
 *
 * Pur : ni Drive, ni Prisma, ni fichier. Tout le sous-module `sheets/` s'appuie sur ces quelques
 * fonctions, et c'est ici que vivent les deux constantes que Excel impose (1 048 576 lignes,
 * 16 384 colonnes) — une plage « A:A » ou « 3:3 » est bornée par elles, jamais par une devinette.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const LIGNES_MAX = 1_048_576;
export const COLONNES_MAX = 16_384;

/** « A » → 1, « Z » → 26, « AA » → 27. */
export function colonneDepuisLettres(lettres: string): number {
  let n = 0;
  for (const ch of lettres.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) throw new Error(`colonne illisible : « ${lettres} »`);
    n = n * 26 + (code - 64);
  }
  return n;
}

/** 1 → « A », 27 → « AA ». */
export function lettresDeColonne(col: number): string {
  if (!Number.isInteger(col) || col < 1) throw new Error(`colonne invalide : ${col}`);
  let n = col;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export interface Coord { row: number; col: number }

const A1 = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;

/** « B7 » → { row: 7, col: 2 }. Les `$` sont ignorés ici : ils n'existent que dans les formules. */
export function coordDeA1(ref: string): Coord | null {
  const m = A1.exec(ref.trim());
  if (!m) return null;
  const col = colonneDepuisLettres(m[1]);
  const row = Number(m[2]);
  if (row < 1 || row > LIGNES_MAX || col > COLONNES_MAX) return null;
  return { row, col };
}

export function a1DeCoord(row: number, col: number): string {
  return `${lettresDeColonne(col)}${row}`;
}

export interface Plage { r1: number; c1: number; r2: number; c2: number }

/** « B4:D20 », « B4 », « A:A », « 3:5 » → plage normalisée (coin haut-gauche puis bas-droit). */
export function plageDeA1(texte: string): Plage | null {
  const t = texte.trim().replace(/\$/g, "");
  const parts = t.split(":");
  if (parts.length === 1) {
    const c = coordDeA1(parts[0]);
    return c ? { r1: c.row, c1: c.col, r2: c.row, c2: c.col } : null;
  }
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (/^[A-Za-z]{1,3}$/.test(a) && /^[A-Za-z]{1,3}$/.test(b)) {
    const c1 = colonneDepuisLettres(a); const c2 = colonneDepuisLettres(b);
    return { r1: 1, c1: Math.min(c1, c2), r2: LIGNES_MAX, c2: Math.max(c1, c2) };
  }
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const r1 = Number(a); const r2 = Number(b);
    return { r1: Math.min(r1, r2), c1: 1, r2: Math.max(r1, r2), c2: COLONNES_MAX };
  }
  const ca = coordDeA1(a); const cb = coordDeA1(b);
  if (!ca || !cb) return null;
  return { r1: Math.min(ca.row, cb.row), c1: Math.min(ca.col, cb.col), r2: Math.max(ca.row, cb.row), c2: Math.max(ca.col, cb.col) };
}

export function a1DePlage(p: Plage): string {
  if (p.r1 === 1 && p.r2 === LIGNES_MAX) return `${lettresDeColonne(p.c1)}:${lettresDeColonne(p.c2)}`;
  if (p.c1 === 1 && p.c2 === COLONNES_MAX) return `${p.r1}:${p.r2}`;
  return p.r1 === p.r2 && p.c1 === p.c2 ? a1DeCoord(p.r1, p.c1) : `${a1DeCoord(p.r1, p.c1)}:${a1DeCoord(p.r2, p.c2)}`;
}

/** Une plage contient-elle une coordonnée ? */
export const contient = (p: Plage, row: number, col: number): boolean =>
  row >= p.r1 && row <= p.r2 && col >= p.c1 && col <= p.c2;

export const tailleDe = (p: Plage): number => (p.r2 - p.r1 + 1) * (p.c2 - p.c1 + 1);

/**
 * LA CLÉ NUMÉRIQUE d'une cellule — un entier sûr (ligne × 2^14 + colonne), moins cher qu'une
 * chaîne dans une Map de deux millions d'entrées. Réversible.
 */
export const cleDe = (row: number, col: number): number => row * COLONNES_MAX + col;
export const coordDeCle = (cle: number): Coord => ({ row: Math.floor(cle / COLONNES_MAX), col: cle % COLONNES_MAX });
