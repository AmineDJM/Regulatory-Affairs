/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RATTACHER UN PRATICIEN À L'ANNUAIRE DES ÉTABLISSEMENTS — par un NOM, et à coup sûr (§118.172).
 *
 * Décision de la Direction (01/10) : « les annuaires des médecins et des pharmaciens doivent tous
 * posséder un lien avec [l'annuaire des établissements] pour la colonne établissement et la
 * colonne service ». La feuille choisit dans une liste — l'identifiant voyage, aucun nom n'est
 * interprété. Mais trois chemins n'ont qu'un NOM : l'import d'un fichier, le rattachement en lot
 * des fiches d'avant (« CHU Mustapha » tapé à la main, sans lien), et une phrase d'Adam.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE EST ÉTROITE ──────────────────────────────────────────────────
 *
 * Un nom rattache SI ET SEULEMENT SI, une fois la casse, les accents et les espaces mis de côté,
 * il est IDENTIQUE au nom d'UN SEUL établissement ACTIF de l'annuaire. Rien d'autre :
 *
 *   • pas de ressemblance — « C.H.U Mustapha » n'est pas « CHU Mustapha » pour ce module, la
 *     ponctuation reste un caractère ; joindre un praticien au mauvais hôpital est le faux succès
 *     le plus muet qui soit (§118.134 : « un champ de plus obtenu en devinant vaut moins qu'un
 *     champ de moins obtenu à coup sûr ») ;
 *   • pas de choix entre homonymes — deux « EPH Bordj » dans deux wilayas ne désignent personne,
 *     et le résultat le DIT avec les candidats (§118.34) ;
 *   • pas d'établissement DÉSACTIVÉ — on ne rattache pas un praticien à un hôpital que
 *     l'annuaire déclare fermé ; le résultat le dit, avec le geste (le réactiver).
 *
 * Ce qui ne se rattache pas reste ce qu'il était — un texte « à rattacher », visible comme tel
 * dans la feuille, et compté dans le message de l'import. Rien n'est perdu, rien n'est deviné.
 *
 * Module PUR, zéro import (socle) : l'import, le rattachement en lot et la cellule de la feuille
 * lisent la MÊME règle — trois lectures de « ce nom désigne-t-il cet hôpital ? » finiraient par
 * répondre trois choses (§118.5).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La clé de comparaison d'un nom d'établissement : sans casse, sans accents, espaces réduits. */
export function cleDEtablissement(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface EtablissementConnu {
  id: string;
  name: string;
  isActive: boolean;
  wilaya?: string | null;
}

export type Rattachement =
  | { statut: "trouve"; etablissement: EtablissementConnu }
  /** Plusieurs établissements ACTIFS portent ce nom : aucun n'est choisi. */
  | { statut: "ambigu"; candidats: EtablissementConnu[] }
  /** Le seul établissement de ce nom est désactivé. */
  | { statut: "inactif"; etablissement: EtablissementConnu }
  /** Aucun établissement de ce nom — ou un nom vide. */
  | { statut: "inconnu" };

/**
 * L'INDEX DES ÉTABLISSEMENTS PAR NOM — construit une fois, interrogé ligne par ligne (un import de
 * 400 lignes ne fait pas 400 requêtes).
 */
export function indexerEtablissements(etablissements: readonly EtablissementConnu[]): (nom: string | null | undefined) => Rattachement {
  const parCle = new Map<string, EtablissementConnu[]>();
  for (const e of etablissements) {
    const cle = cleDEtablissement(e.name);
    if (!cle) continue;
    (parCle.get(cle) ?? parCle.set(cle, []).get(cle)!).push(e);
  }
  return (nom) => {
    const cle = cleDEtablissement(String(nom ?? ""));
    if (!cle) return { statut: "inconnu" };
    const tous = parCle.get(cle) ?? [];
    const actifs = tous.filter((e) => e.isActive);
    if (actifs.length === 1) return { statut: "trouve", etablissement: actifs[0] };
    if (actifs.length > 1) return { statut: "ambigu", candidats: actifs };
    // Aucun actif : un seul désactivé se NOMME (le geste est de le réactiver) ; plusieurs
    // désactivés ne désignent pas plus que plusieurs actifs.
    if (tous.length === 1) return { statut: "inactif", etablissement: tous[0] };
    return { statut: "inconnu" };
  };
}

/** Le libellé d'un établissement dans un refus : « CHU Mustapha (Alger) ». */
export function libelleEtablissement(e: EtablissementConnu): string {
  return e.wilaya ? `${e.name} (${e.wilaya})` : e.name;
}

/**
 * LE SERVICE D'UN ÉTABLISSEMENT DÉSIGNÉ PAR SON NOM — la même clé que celle qui empêche deux
 * « Pédiatrie » dans le même hôpital (`annuaires/services.ts`), donc un nom ne peut en désigner
 * qu'un. Rendu `null` : on ne crée JAMAIS un service depuis un fichier — « Cardio » à côté de
 * « Cardiologie » ferait deux services pour un, et les praticiens se répartiraient au hasard.
 */
export function serviceParNom<S extends { id: string; name: string }>(
  services: readonly S[],
  nom: string | null | undefined,
  cle: (n: string) => string,
): S | null {
  const cherche = cle(String(nom ?? ""));
  if (!cherche) return null;
  return services.find((s) => cle(s.name) === cherche) ?? null;
}
