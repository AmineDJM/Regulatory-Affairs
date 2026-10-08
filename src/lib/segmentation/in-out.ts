import { canonicalWilaya, wilayaInText } from "@/lib/medical/wilaya";
import type { InOut } from "./regles";

/**
 * IN / OUT (Direction, 06/10) — « In veut dire dans sa wilaya pivot désignée, et Out veut dire le reste des wilayas ».
 *
 * La wilaya PIVOT d'un KAM est celle qu'on choisit sur la ligne de son territoire propre (Business Units › Secteurs,
 * menu des 58 wilayas — `SalesSector.wilayaPivot`) ; à défaut, celle de sa VILLE PIVOT (`city`, la donnée du plan de
 * tournée). Un praticien est IN si sa wilaya est la
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

/**
 * LA WILAYA PIVOT D'UN SECTEUR (Direction, 08/10 : « la wilaya pivot avec un menu déroulant ») : celle qui a été CHOISIE dans
 * la liste des 58 wilayas sur la ligne du KAM ; à défaut, celle que la ville pivot (`city`) nomme — la lecture d'avant.
 */
export function pivotDuSecteur(s: { wilayaPivot?: string | null; city?: string | null }): string | null {
  return canonicalWilaya(s.wilayaPivot) ?? wilayaPivot(s.city);
}

/**
 * LA WILAYA D'UN PRATICIEN pour In / Out : la sienne ; à défaut, celle de son établissement (fiche de l'annuaire des
 * établissements, puis le nom même de l'établissement — « CHU d'Oran » → Oran). `null` quand rien ne la dit.
 */
export function wilayaDuPraticien(d: { wilaya?: string | null; wilayaEtablissement?: string | null; etablissement?: string | null }): string | null {
  return canonicalWilaya(d.wilaya) ?? canonicalWilaya(d.wilayaEtablissement)
    ?? (d.etablissement?.trim() ? wilayaInText(d.etablissement) : null);
}

export function inOutDe(wilayaDuPraticien: string | null | undefined, pivotsDesKams: readonly (string | null)[]): InOut | null {
  const w = canonicalWilaya(wilayaDuPraticien);
  const pivots = pivotsDesKams.filter((p): p is string => !!p);
  if (!w || pivots.length === 0) return null;
  return pivots.includes(w) ? "IN" : "OUT";
}
