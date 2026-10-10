/**
 * OÙ MÈNE UNE NOTIFICATION DE FORMATION — la ligne de la formation, dépliée.
 *
 * Les formations se lisent toutes dans une liste dont chaque ligne se déplie sur place (pas de page
 * par formation) : l'adresse porte donc `?formation=<id>`, l'écran déplie cette ligne et la fait venir
 * sous les yeux (`ancreFormation`).
 *
 * Module PUR — aucune importation.
 */

export const CHEMIN_FORMATIONS = "/formations";

export function ancreFormation(trainingId: string): string {
  return `formation-${trainingId}`;
}

export function lienFormation(trainingId?: string | null): string {
  return trainingId ? `${CHEMIN_FORMATIONS}?formation=${encodeURIComponent(trainingId)}` : CHEMIN_FORMATIONS;
}
