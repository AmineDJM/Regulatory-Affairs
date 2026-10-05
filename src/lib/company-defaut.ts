/**
 * ENTITÉ PAR DÉFAUT = ADVENTUM (Direction, 06/10).
 *
 * Certains écrans (Finances › Banque & paiements, demandes de paiement des salariés) n'ont plus de
 * vue « Toutes les entités » : tout ce qui existait est rattaché à Adventum, et c'est Adventum qui
 * s'ouvre. Fonctions PURES : aucune lecture en base, donc testables sans serveur.
 */

/** Identifiant de l'entité Adventum, posé par la migration `companies_multi_entity`. */
export const ADVENTUM_COMPANY_ID = "company_adventum";

type Societe = { id: string; name?: string; shortName?: string | null };

/** Adventum parmi des sociétés : par identifiant, à défaut par nom (instance restaurée à la main). */
export function trouverAdventum<S extends Societe>(societes: S[]): S | null {
  return (
    societes.find((s) => s.id === ADVENTUM_COMPANY_ID) ??
    societes.find((s) => /adventum/i.test(`${s.name ?? ""} ${s.shortName ?? ""}`)) ??
    null
  );
}

/**
 * L'entité à ouvrir : celle demandée si la personne la voit (on n'ouvre pas une société par son
 * identifiant), sinon Adventum si elle la voit, sinon sa première société. `null` seulement si elle
 * ne voit aucune société.
 */
export function entiteParDefaut(societes: Societe[], demandee: string | null | undefined): string | null {
  if (demandee && societes.some((s) => s.id === demandee)) return demandee;
  return trouverAdventum(societes)?.id ?? societes[0]?.id ?? null;
}
