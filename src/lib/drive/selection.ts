/**
 * LA SÉLECTION D'UN EXPLORATEUR — clic, Ctrl+clic, Maj+clic.
 *
 * Trois gestes que personne n'a appris et que tout le monde connaît :
 *   • **clic** : je sélectionne CELUI-LÀ, et rien d'autre ;
 *   • **Ctrl+clic** (⌘ sur Mac) : j'ajoute ou je retire, sans perdre le reste ;
 *   • **Maj+clic** : je prends TOUT ce qui va du dernier cliqué jusqu'à celui-ci.
 *
 * La subtilité qui trahit une imitation approximative est l'**ancre**. Maj+clic ne part pas du
 * premier élément de la liste ni du haut de la sélection : il part du dernier élément cliqué
 * SANS Maj. C'est ce qui permet d'étendre une plage, de changer d'avis, de l'étendre dans l'autre
 * sens — et une implémentation qui déplace l'ancre à chaque Maj+clic donne une sélection qui
 * « glisse » sous la souris, exactement le défaut qu'on remarque sans savoir le nommer.
 *
 * Module PUR — testé.
 */

export interface SelectionState {
  /** Identifiants sélectionnés. */
  ids: readonly string[];
  /** Dernier élément cliqué SANS Maj — origine des plages. `null` = aucune ancre. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { ids: [], anchor: null };

export interface ClickModifiers {
  /** `Ctrl` sous Windows/Linux, `⌘` sous macOS — les deux font la même chose. */
  toggle?: boolean;
  /** `Maj` : étend depuis l'ancre. */
  range?: boolean;
}

/**
 * L'état de sélection après un clic sur `id`, dans une liste `order` (l'ordre AFFICHÉ, tri
 * compris — étendre une plage doit suivre ce qu'on voit, pas l'ordre de la base).
 */
export function clickSelect(
  state: SelectionState,
  id: string,
  order: readonly string[],
  mods: ClickModifiers = {},
): SelectionState {
  if (mods.range && state.anchor && order.includes(state.anchor) && order.includes(id)) {
    const a = order.indexOf(state.anchor);
    const b = order.indexOf(id);
    const [from, to] = a <= b ? [a, b] : [b, a];
    // L'ancre NE BOUGE PAS : on peut réduire ou inverser la plage sans qu'elle glisse.
    return { ids: order.slice(from, to + 1), anchor: state.anchor };
  }
  if (mods.toggle) {
    const has = state.ids.includes(id);
    return {
      ids: has ? state.ids.filter((x) => x !== id) : [...state.ids, id],
      // Ctrl+clic repose l'ancre : la plage suivante part d'ici, comme dans un explorateur.
      anchor: id,
    };
  }
  return { ids: [id], anchor: id };
}

/** Tout sélectionner / tout désélectionner (Ctrl+A, ou la case d'en-tête). */
export function selectAll(order: readonly string[], selected: boolean): SelectionState {
  return selected ? { ids: [...order], anchor: order[order.length - 1] ?? null } : EMPTY_SELECTION;
}

/**
 * Nettoie une sélection dont la liste a changé (navigation, suppression, filtre).
 *
 * Sans cela, supprimer trois fichiers laisserait « 3 éléments sélectionnés » dans la barre
 * d'actions, et le bouton suivant agirait sur des identifiants qui n'existent plus.
 */
export function pruneSelection(state: SelectionState, order: readonly string[]): SelectionState {
  const live = new Set(order);
  const ids = state.ids.filter((id) => live.has(id));
  if (ids.length === state.ids.length && (state.anchor === null || live.has(state.anchor))) return state;
  return { ids, anchor: state.anchor && live.has(state.anchor) ? state.anchor : null };
}

export function isSelected(state: SelectionState, id: string): boolean {
  return state.ids.includes(id);
}

/** Toute la liste est-elle sélectionnée ? (case d'en-tête à trois états.) */
export function allSelected(state: SelectionState, order: readonly string[]): boolean {
  return order.length > 0 && order.every((id) => state.ids.includes(id));
}
