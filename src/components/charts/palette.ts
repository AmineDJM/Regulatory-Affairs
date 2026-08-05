/**
 * PALETTE DES GRAPHIQUES — une seule source, pour que tous les modules se ressemblent.
 *
 * L'ordre des teintes n'est pas décoratif : c'est lui qui garantit que deux séries voisines
 * restent distinguables, y compris par une personne daltonienne. Il a été VÉRIFIÉ par
 * l'outil de validation (écart CVD ≥ 8 sur toutes les paires voisines, écart en vision
 * normale ≥ 15, sur fond blanc `#ffffff` — le fond réel de nos cartes).
 *
 * ⚠️ Ne pas réordonner et ne pas « ajouter une 9ᵉ couleur » : au-delà de 8 séries, on replie
 * la queue dans « Autres ». Une teinte inventée est indistinguable d'une existante en CVD.
 *
 * Trois de ces teintes passent sous le rapport de contraste 3:1 sur blanc : d'où la règle
 * appliquée partout ici — **jamais la couleur seule**. Chaque graphique porte des étiquettes
 * lisibles et une légende chiffrée (qui vaut vue tabulaire).
 */

/** Teintes catégorielles, dans l'ordre validé. On sert toujours à partir du slot 1. */
export const SERIES = [
  "#2a78d6", // 1 bleu
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 jaune
  "#e87ba4", // 5 magenta
  "#008300", // 6 vert
  "#4a3aa7", // 7 violet
  "#e34948", // 8 rouge
] as const;

/** Au-delà de 8 catégories, la queue est repliée sous cette couleur neutre. */
export const OTHER_COLOR = "#898781";

export const seriesColor = (i: number): string => (i < SERIES.length ? SERIES[i] : OTHER_COLOR);

/** Encre et chrome — repris des jetons de l'application (gris bleuté). */
export const INK = {
  grid: "hsl(214 32% 90%)",
  axis: "hsl(214 32% 82%)",
  muted: "hsl(214 16% 46%)",
  surface: "#ffffff",
} as const;

/** Statuts — réservés à l'état d'un budget, jamais utilisés comme « série n° 4 ». */
export const STATUS = {
  good: "hsl(150 64% 40%)",
  warning: "hsl(33 96% 48%)",
  critical: "hsl(358 75% 55%)",
} as const;

/**
 * Replie une liste de parts en **au plus `max` tranches** + « Autres ».
 * C'est la seule façon correcte de traiter « trop de catégories » : jamais en inventant
 * des couleurs supplémentaires.
 */
export function foldTail<T extends { label: string; value: number }>(
  rows: T[], max = 6,
): { label: string; value: number; color: string }[] {
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted.map((r, i) => ({ label: r.label, value: r.value, color: seriesColor(i) }));
  const head = sorted.slice(0, max - 1).map((r, i) => ({ label: r.label, value: r.value, color: seriesColor(i) }));
  const rest = sorted.slice(max - 1).reduce((s, r) => s + r.value, 0);
  return [...head, { label: `Autres (${sorted.length - (max - 1)})`, value: rest, color: OTHER_COLOR }];
}
