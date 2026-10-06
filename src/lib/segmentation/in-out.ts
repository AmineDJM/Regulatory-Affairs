import { canonicalWilaya, wilayaInText } from "@/lib/medical/wilaya";
import type { InOut } from "./regles";

/**
 * IN / OUT (Direction, 06/10) — « In veut dire dans sa wilaya pivot désignée, et Out veut dire le reste des wilayas ».
 *
 * La wilaya PIVOT d'un KAM est celle de la VILLE PIVOT de son territoire propre (Force de vente › Business Units, son
 * secteur) — la même donnée que le plan de tournée, jamais un second champ. Un praticien est IN si sa wilaya est la
 * wilaya pivot d'un KAM qui le couvre ; OUT si les KAM qui le couvrent ont une wilaya pivot, et qu'aucune n'est la
 * sienne ; INCONNU (null) sinon — et rien n'est deviné : la fréquence générale s'applique.
 *
 * Module PUR — testé sans base.
 */

/** La wilaya d'une ville pivot (« Oran » → Oran ; « Bab Ezzouar » → Alger quand le texte la nomme), ou `null`. */
export function wilayaPivot(ville: string | null | undefined): string | null {
  if (!ville?.trim()) return null;
  return canonicalWilaya(ville) ?? wilayaInText(ville);
}

export function inOutDe(wilayaDuPraticien: string | null | undefined, pivotsDesKams: readonly (string | null)[]): InOut | null {
  const w = canonicalWilaya(wilayaDuPraticien);
  const pivots = pivotsDesKams.filter((p): p is string => !!p);
  if (!w || pivots.length === 0) return null;
  return pivots.includes(w) ? "IN" : "OUT";
}
