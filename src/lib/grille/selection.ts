/**
 * LA SÉLECTION D'UNE FEUILLE — des CELLULES, comme dans un tableur.
 *
 * ── POURQUOI UN MODULE PUR ──────────────────────────────────────────────────────────────────
 *
 * Deux annuaires (praticiens, établissements) et demain d'autres feuilles ont besoin du même
 * geste : cliquer une cellule, étendre au Maj-clic ou en glissant, ajouter au Ctrl-clic, se
 * déplacer au clavier, copier ce qui est sélectionné. Écrire cette arithmétique dans chaque
 * grille ferait deux sélections qui divergent au premier cas limite (§118.5) — et un cas
 * limite de sélection se paie en colorant la mauvaise ligne.
 *
 * Ici : AUCUN import, aucun DOM, aucun React. Le module reçoit des coordonnées et rend un état ;
 * la grille ne fait que le brancher sur ses événements. C'est ce qui le rend testable au cas
 * près, et c'est ce qui le rend partageable.
 *
 * ── LE MODÈLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Une sélection = des cellules FIGÉES (accumulées au Ctrl-clic) + une PLAGE COURANTE, tendue
 * entre une ANCRE (la cellule d'où l'on est parti) et un FOCUS (la cellule où l'on est). Les
 * cellules effectivement sélectionnées sont l'union des deux. C'est exactement la sémantique
 * d'Excel : Maj-clic déplace le focus et retend la plage depuis l'ancre ; Ctrl-clic fige la
 * plage courante et repart d'une nouvelle ancre ; une flèche sans Maj repart d'une seule
 * cellule ; avec Maj, elle étend.
 *
 * Les coordonnées sont des INDICES DE LIGNE ET DE COLONNE DANS LA GRILLE AFFICHÉE (0-indexés
 * ici, jamais montrés à une personne). Les identifiants de lignes — ce que le serveur connaît —
 * sont traduits par la grille au moment d'agir : la sélection ne sait pas ce qu'elle contient,
 * et c'est voulu.
 */

export interface Coord {
  r: number;
  c: number;
}

export interface Plage {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface Selection {
  /** Cellules figées par Ctrl-clic, sous forme de clés `r:c` (un Set n'est pas sérialisable). */
  readonly figees: readonly string[];
  readonly ancre: Coord | null;
  readonly focus: Coord | null;
}

export interface Modificateurs {
  shift?: boolean;
  ctrl?: boolean;
}

export interface Bornes {
  lignes: number;
  colonnes: number;
}

export type Direction = "haut" | "bas" | "gauche" | "droite";

export const SELECTION_VIDE: Selection = { figees: [], ancre: null, focus: null };

export const cle = (r: number, c: number): string => `${r}:${c}`;

export function deCle(k: string): Coord | null {
  const m = /^(\d+):(\d+)$/.exec(k);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}

/** Le rectangle tendu entre deux coins, quel que soit l'ordre dans lequel on les donne. */
export function plage(a: Coord, b: Coord): Plage {
  return {
    r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c),
  };
}

export function clesDePlage(p: Plage): string[] {
  const out: string[] = [];
  for (let r = p.r1; r <= p.r2; r++) for (let c = p.c1; c <= p.c2; c++) out.push(cle(r, c));
  return out;
}

/** Toutes les cellules sélectionnées — figées ∪ plage courante. */
export function clesSelection(sel: Selection): Set<string> {
  const out = new Set(sel.figees);
  if (sel.ancre && sel.focus) for (const k of clesDePlage(plage(sel.ancre, sel.focus))) out.add(k);
  return out;
}

export function estSelectionnee(sel: Selection, r: number, c: number): boolean {
  if (sel.figees.includes(cle(r, c))) return true;
  if (!sel.ancre || !sel.focus) return false;
  const p = plage(sel.ancre, sel.focus);
  return r >= p.r1 && r <= p.r2 && c >= p.c1 && c <= p.c2;
}

export function estVide(sel: Selection): boolean {
  return sel.figees.length === 0 && (!sel.ancre || !sel.focus);
}

export function taille(sel: Selection): number {
  return clesSelection(sel).size;
}

/**
 * UN CLIC sur une cellule.
 *
 *   - sans modificateur : on repart de cette seule cellule ;
 *   - Maj : l'ancre reste, le focus vient ici — la plage se retend ;
 *   - Ctrl : la plage courante est FIGÉE, puis cette cellule est ajoutée… ou retirée si elle
 *     était déjà sélectionnée (Ctrl-clic sur une cellule prise la libère, comme dans Excel).
 *     Après un retrait il n'y a plus d'ancre : la sélection, c'est ce qui reste figé.
 */
export function cliquer(sel: Selection, coord: Coord, mods: Modificateurs = {}): Selection {
  if (mods.shift) {
    // Les figées restent (c'est la plage courante qu'on retend) et l'ancre tient ; sans ancre
    // — premier geste de la feuille — la cellule devient l'ancre.
    return { figees: sel.figees, ancre: sel.ancre ?? coord, focus: coord };
  }
  if (mods.ctrl) {
    const figees = new Set(clesSelection(sel));
    const k = cle(coord.r, coord.c);
    if (figees.has(k)) {
      figees.delete(k);
      return { figees: [...figees], ancre: null, focus: null };
    }
    return { figees: [...figees], ancre: coord, focus: coord };
  }
  return { figees: [], ancre: coord, focus: coord };
}

/** Le pointeur passe sur une cellule, bouton enfoncé : le focus la suit, l'ancre tient. */
export function glisser(sel: Selection, coord: Coord): Selection {
  if (!sel.ancre) return { figees: sel.figees, ancre: coord, focus: coord };
  return { figees: sel.figees, ancre: sel.ancre, focus: coord };
}

function deplacerCoord(c: Coord, dir: Direction, bornes: Bornes): Coord {
  const maxR = Math.max(0, bornes.lignes - 1);
  const maxC = Math.max(0, bornes.colonnes - 1);
  switch (dir) {
    case "haut": return { r: Math.max(0, c.r - 1), c: c.c };
    case "bas": return { r: Math.min(maxR, c.r + 1), c: c.c };
    case "gauche": return { r: c.r, c: Math.max(0, c.c - 1) };
    case "droite": return { r: c.r, c: Math.min(maxC, c.c + 1) };
  }
}

/**
 * UNE FLÈCHE (ou Tab / Entrée traduits en direction par la grille).
 *
 * Sans Maj : on repart d'une seule cellule, la voisine. Avec Maj : l'ancre tient et le focus
 * se déplace — la plage s'étend ou se rétracte. Sans focus (sélection vide, ou vidée par un
 * Ctrl-clic), la première flèche prend la première cellule : une feuille qui ignore le clavier
 * tant qu'on n'a pas cliqué agace.
 */
export function deplacer(sel: Selection, dir: Direction, bornes: Bornes, mods: Modificateurs = {}): Selection {
  if (bornes.lignes <= 0 || bornes.colonnes <= 0) return sel;
  if (!sel.focus) {
    const depart = { r: 0, c: 0 };
    return { figees: [], ancre: depart, focus: depart };
  }
  const suivant = deplacerCoord(sel.focus, dir, bornes);
  if (mods.shift) return { figees: sel.figees, ancre: sel.ancre ?? sel.focus, focus: suivant };
  return { figees: [], ancre: suivant, focus: suivant };
}

/**
 * Une sélection dont les coordonnées débordent (la grille a été filtrée, une ligne supprimée)
 * est RAMENÉE dans les bornes plutôt que gardée telle quelle : une cellule sélectionnée qui
 * n'existe plus à l'écran ferait colorer, au prochain geste, une ligne que personne ne voit.
 */
export function borner(sel: Selection, bornes: Bornes): Selection {
  if (bornes.lignes <= 0 || bornes.colonnes <= 0) return SELECTION_VIDE;
  const dans = (c: Coord) => c.r < bornes.lignes && c.c < bornes.colonnes;
  const figees = sel.figees.filter((k) => { const c = deCle(k); return c !== null && dans(c); });
  const ancre = sel.ancre && dans(sel.ancre) ? sel.ancre : null;
  const focus = sel.focus && dans(sel.focus) ? sel.focus : null;
  if (!ancre || !focus) return { figees, ancre: null, focus: null };
  return { figees, ancre, focus };
}

/**
 * LE TEXTE QU'ON COPIE — tabulations entre colonnes, retours à la ligne entre lignes, sur le
 * rectangle englobant. Les cellules non sélectionnées à l'intérieur de ce rectangle sortent
 * VIDES : c'est ce qu'Excel colle, et c'est ce qui garde les colonnes alignées. Une tabulation
 * ou un retour à la ligne DANS une valeur est remplacé par une espace : sinon la cellule collée
 * éclate en deux.
 */
export function versTsv(sel: Selection, valeur: (r: number, c: number) => string): string {
  const cles = clesSelection(sel);
  if (cles.size === 0) return "";
  let r1 = Infinity, r2 = -Infinity, c1 = Infinity, c2 = -Infinity;
  for (const k of cles) {
    const co = deCle(k);
    if (!co) continue;
    r1 = Math.min(r1, co.r); r2 = Math.max(r2, co.r);
    c1 = Math.min(c1, co.c); c2 = Math.max(c2, co.c);
  }
  const lignes: string[] = [];
  for (let r = r1; r <= r2; r++) {
    const cellules: string[] = [];
    for (let c = c1; c <= c2; c++) {
      cellules.push(cles.has(cle(r, c)) ? valeur(r, c).replace(/[\t\r\n]+/g, " ") : "");
    }
    lignes.push(cellules.join("\t"));
  }
  return lignes.join("\n");
}

/** Les lignes touchées par la sélection, dans l'ordre — pour agir « sur les lignes sélectionnées ». */
export function lignesSelectionnees(sel: Selection): number[] {
  const out = new Set<number>();
  for (const k of clesSelection(sel)) { const c = deCle(k); if (c) out.add(c.r); }
  return [...out].sort((a, b) => a - b);
}
