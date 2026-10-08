/**
 * QUI FAIT QUOI SUR LES KPI — la règle, PURE (aucun import), testée sans base.
 *
 * Encadrer n'est pas un rôle : c'est un FAIT de l'organigramme. Un manager agit sur SON arbre (le même que Mon équipe,
 * `subtreeOf`) — le Directeur des opérations sur les KAM de son arbre, un superviseur sur les siens. Le Super Admin
 * agit partout et tient le catalogue (modèles par rôle). Une personne voit SON bilan, et rien d'autre.
 *
 * Le module « KPI & bilans » (console d'accès) ouvre ou ferme les GESTES : Voir (son bilan, celui de son équipe),
 * Créer (déclarer, proposer, créer un KPI pour son équipe), Valider (noter, valider une déclaration, signer une revue).
 */
export interface FaitsKpi {
  superAdmin: boolean;
  moi: string;
  /** Les comptes de mon arbre (N-1, N-2, …). */
  equipe: ReadonlySet<string>;
  gestes: { voir: boolean; creer: boolean; valider: boolean };
}

export function peutVoirBilan(f: FaitsKpi, cible: string): boolean {
  if (f.superAdmin) return true;
  if (!f.gestes.voir) return false;
  return cible === f.moi || f.equipe.has(cible);
}

/** Noter un KPI évalué, valider une déclaration, signer une revue — sur quelqu'un de MON arbre, jamais sur moi. */
export function peutGererPersonne(f: FaitsKpi, cible: string): boolean {
  if (cible === f.moi && !f.superAdmin) return false;
  if (f.superAdmin) return true;
  return f.gestes.valider && f.equipe.has(cible);
}

/** Créer un KPI pour son équipe (ou une personne de son équipe). */
export function peutCreerPourEquipe(f: FaitsKpi): boolean {
  return f.superAdmin || (f.gestes.creer && f.equipe.size > 0);
}

/** Déclarer une valeur (avec sa pièce) : pour SOI seulement. */
export function peutDeclarer(f: FaitsKpi, cible: string): boolean {
  return cible === f.moi && (f.superAdmin || f.gestes.creer);
}

/** Le catalogue et les modèles par rôle : le Super Admin seul. */
export function peutGererCatalogue(f: Pick<FaitsKpi, "superAdmin">): boolean {
  return f.superAdmin;
}

/** Retoucher une définition : son auteur (si elle est d'équipe) ou le Super Admin. */
export function peutModifierDefinition(f: FaitsKpi, def: { portee: string; createdById: string | null }): boolean {
  if (f.superAdmin) return true;
  return def.portee === "EQUIPE" && def.createdById === f.moi && f.gestes.creer;
}
