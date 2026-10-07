/**
 * LES SECTEURS DE LA BU, vus par la segmentation (Direction, 07/10) — module PUR : la règle qui range un praticien dans
 * un secteur, testée sans base. Le chargement vit dans `service.ts`.
 */

/** UN SECTEUR DE LA BU, tel que la segmentation le lit : ce qu'il couvre, sa ville pivot, ses KAM. */
export interface SecteurBu {
  id: string;
  nom: string;
  actif: boolean;
  ville: string | null;
  /** La wilaya de la ville pivot (In / Out), null = secteur multi-villes. */
  pivot: string | null;
  kams: { id: string; nom: string }[];
  etablissements: { institutionId: string; tous: boolean; services: string[] }[];
}

/**
 * LE SECTEUR QUI COUVRE UN PRATICIEN — la règle du panel (`clausePanelDuKam`) lue dans l'autre sens : son
 * établissement entier, ou son service choisi ; à défaut, le secteur de son KAM de rattachement. Plusieurs : le premier
 * par nom (la fiche peut le fixer à la main). Aucun : sans secteur — jamais deviné. Un secteur inactif ne couvre rien.
 */
export function secteurDuPraticien(d: { institutionId: string | null; serviceId: string | null; delegateId: string | null }, secteurs: readonly SecteurBu[]): SecteurBu | null {
  const actifs = secteurs.filter((s) => s.actif);
  const parLieu = actifs.find((s) => s.etablissements.some((e) => e.institutionId === d.institutionId && (e.tous || (!!d.serviceId && e.services.includes(d.serviceId)))));
  if (parLieu) return parLieu;
  return d.delegateId ? actifs.find((s) => s.kams.some((k) => k.id === d.delegateId)) ?? null : null;
}
