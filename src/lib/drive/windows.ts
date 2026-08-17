/**
 * DES FENÊTRES, COMME SUR UN POSTE DE TRAVAIL.
 *
 * Comparer deux versions d'une notice, recopier un tableau d'un classeur dans un autre, relire un
 * devis en rédigeant le courrier qui l'accompagne : ce sont des gestes de tous les jours, et ils
 * supposent d'avoir **deux documents sous les yeux en même temps**. Des onglets ne le permettent
 * pas — ils montrent l'un OU l'autre, et l'on retombe sur des allers-retours de mémoire.
 *
 * Ce module porte la géométrie : où s'ouvre une fenêtre, comment elle reste attrapable, qui passe
 * devant qui, et comment les ranger côte à côte. Trois règles gouvernent tout :
 *
 *   1. **une nouvelle fenêtre ne se cache jamais derrière la précédente** — elle se décale ;
 *   2. **une fenêtre ne sort jamais entièrement de l'écran** : on garde toujours sa barre de
 *      titre à portée, sinon elle est perdue sans moyen de la rattraper ;
 *   3. **la fenêtre qu'on touche passe devant**, et le reste garde son ordre relatif.
 *
 * Module PUR — testé. Aucune dimension n'est lue ici : les bornes viennent de l'écran réel.
 */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Bounds { w: number; h: number }

export interface WinState {
  id: string;
  rect: Rect;
  /** Rang d'empilement : le plus grand est devant. */
  z: number;
  minimized: boolean;
  /** Position mémorisée avant l'agrandissement, pour pouvoir revenir exactement là. */
  restore: Rect | null;
}

/** En dessous, une fenêtre n'affiche plus rien d'utile — seulement ses propres bordures. */
export const MIN_W = 320;
export const MIN_H = 200;

/** Décalage entre deux fenêtres ouvertes à la suite. */
const STEP = 28;
/** Part de la barre de titre qui doit rester visible pour qu'on puisse rattraper la fenêtre. */
const GRIP = 56;

/**
 * L'ouverture en CASCADE : chaque fenêtre se décale de la précédente.
 *
 * Le décalage revient à zéro avant de sortir de l'écran — sans cela, la sixième fenêtre s'ouvre
 * hors du cadre et donne l'impression que « le clic n'a rien fait ».
 */
export function cascade(index: number, bounds: Bounds): Rect {
  const w = Math.max(MIN_W, Math.min(920, Math.round(bounds.w * 0.62)));
  const h = Math.max(MIN_H, Math.min(760, Math.round(bounds.h * 0.78)));
  const room = Math.max(0, Math.min(bounds.w - w, bounds.h - h));
  const laps = room > 0 ? Math.max(1, Math.floor(room / STEP)) : 1;
  const off = (index % laps) * STEP;
  return { x: off, y: off, w, h };
}

/**
 * Ramène une fenêtre dans le cadre — assez pour qu'on puisse toujours l'attraper.
 *
 * On ne la recentre pas : quelqu'un qui pousse volontairement une fenêtre à moitié hors champ
 * pour dégager la place a le droit de le faire. On garantit seulement qu'il en reste de quoi
 * saisir la barre de titre.
 */
export function clampToBounds(rect: Rect, bounds: Bounds): Rect {
  const w = Math.max(MIN_W, Math.min(rect.w, Math.max(MIN_W, bounds.w)));
  const h = Math.max(MIN_H, Math.min(rect.h, Math.max(MIN_H, bounds.h)));
  const grip = Math.min(GRIP, w);
  return {
    w, h,
    x: Math.max(grip - w, Math.min(rect.x, bounds.w - grip)),
    // Vers le haut, jamais au-delà du bord : une barre de titre passée sous l'en-tête de la page
    // ne se rattrape plus du tout.
    y: Math.max(0, Math.min(rect.y, Math.max(0, bounds.h - 32))),
  };
}

export function topZ(wins: readonly WinState[]): number {
  return wins.reduce((m, w) => Math.max(m, w.z), 0);
}

/** La fenêtre touchée passe devant ; les autres gardent leur ordre relatif. */
export function focus(wins: readonly WinState[], id: string): WinState[] {
  const current = wins.find((w) => w.id === id);
  if (!current) return [...wins];
  // Déjà devant ET déjà déployée : rien à changer — on évite un rendu pour rien.
  if (current.z === topZ(wins) && !current.minimized) return [...wins];
  const z = topZ(wins) + 1;
  return wins.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
}

/** Agrandir / restaurer. La position d'avant est mémorisée, donc restituée à l'identique. */
export function toggleMaximize(win: WinState, bounds: Bounds): WinState {
  if (win.restore) return { ...win, rect: clampToBounds(win.restore, bounds), restore: null };
  return { ...win, restore: win.rect, rect: { x: 0, y: 0, w: bounds.w, h: bounds.h } };
}

/**
 * LA MOSAÏQUE — toutes les fenêtres côte à côte, sans recouvrement.
 *
 * C'est le geste qui répond à la raison d'être de l'écran : voir deux documents à la fois sans
 * les déplacer un par un. La grille reste la plus carrée possible ; à deux fenêtres, elle donne
 * naturellement deux colonnes — la comparaison qu'on venait chercher.
 */
export function tileRects(count: number, bounds: Bounds): Rect[] {
  if (count <= 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const w = Math.floor(bounds.w / cols);
  const h = Math.floor(bounds.h / rows);
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * w,
    y: Math.floor(i / cols) * h,
    w: Math.max(MIN_W, w),
    h: Math.max(MIN_H, h),
  }));
}

/** Déplacement pendant un glisser, borné au cadre. */
export function moveBy(rect: Rect, dx: number, dy: number, bounds: Bounds): Rect {
  return clampToBounds({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
}

/**
 * Redimensionnement par le coin bas-droit.
 *
 * Deux bornes, et pas une de plus : jamais sous le minimum lisible, jamais plus grand que le
 * bureau. On n'empêche pas une fenêtre de dépasser à droite — c'est parfois voulu pour lire une
 * ligne longue, et la barre de titre reste attrapable de toute façon.
 */
export function resizeTo(rect: Rect, w: number, h: number, bounds: Bounds): Rect {
  return {
    ...rect,
    w: Math.max(MIN_W, Math.min(w, Math.max(MIN_W, bounds.w))),
    h: Math.max(MIN_H, Math.min(h, Math.max(MIN_H, bounds.h))),
  };
}
