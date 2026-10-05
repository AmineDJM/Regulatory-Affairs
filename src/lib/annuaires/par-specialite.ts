/**
 * UN ANNUAIRE PAR SPÉCIALITÉ — la vue des médecins rangés par spécialité (Direction, 06/10).
 *
 * Pas de nouvelle table : une « spécialité » est déjà le référentiel auquel se rattache le médecin
 * (`MedicalDoctor.specialtyId`). Chaque spécialité qui compte au moins un médecin devient une entrée
 * de la barre, avec son compte ; « Sans spécialité » regroupe les fiches non rattachées. Fonctions
 * PURES, testées sans base.
 */

export interface AnnuaireSpecialite {
  id: string;
  name: string;
  count: number;
}

/** Le jeton d'adresse de la pastille « Sans spécialité » (`?specialite=sans`). */
export const SANS_SPECIALITE = "sans";

export function annuairesParSpecialite(
  groupes: { specialtyId: string | null; count: number }[],
  referentiel: { id: string; name: string }[],
): { specialites: AnnuaireSpecialite[]; sansSpecialite: number } {
  const noms = new Map(referentiel.map((s) => [s.id, s.name]));
  let sans = 0;
  const specialites: AnnuaireSpecialite[] = [];
  for (const g of groupes) {
    const nom = g.specialtyId ? noms.get(g.specialtyId) : undefined;
    if (!g.specialtyId || !nom) sans += g.count; // rattachement orphelin = non rattaché
    else if (g.count > 0) specialites.push({ id: g.specialtyId, name: nom, count: g.count });
  }
  specialites.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { specialites, sansSpecialite: sans };
}

/** La clause Prisma d'une spécialité ouverte : un identifiant, `sans`, ou rien (= tous). */
export function clauseSpecialite(ouverte: string | null | undefined): { specialtyId?: string | null } {
  if (!ouverte) return {};
  if (ouverte === SANS_SPECIALITE) return { specialtyId: null };
  return { specialtyId: ouverte };
}
