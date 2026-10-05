/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SERVICES D'UN ÉTABLISSEMENT — leurs noms, et ce qu'un secteur en couvre (§118.172).
 *
 * Décision de la Direction (01/10) : « pour chaque établissement hospitalier, on doit pouvoir
 * renseigner les services qu'il a, ajouter ou supprimer ces services » ; « chaque Business Unit
 * aura son propre sectoring regroupant une liste d'établissements hospitaliers et un, certains ou
 * tous leurs services » ; et les annuaires des médecins et des pharmaciens se rattachent à cet
 * annuaire pour la colonne établissement ET la colonne service.
 *
 * Module PUR, zéro import (socle) : l'écran des établissements, ses actions, la feuille des
 * praticiens, la configuration des secteurs (un composant client) et le panel du plan de tournée
 * lisent les MÊMES règles — deux lectures de « ce service existe déjà » ou de « ce secteur couvre
 * ce praticien » finiraient par répondre différemment (§118.5).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un nom de service plus long ne se lit plus dans une cellule : c'est une phrase, pas un nom. */
export const LONGUEUR_MAX_SERVICE = 80;

/** Une saisie en lot (« Cardiologie, Oncologie, … ») au-delà de ce nombre est une erreur de collage. */
export const SERVICES_MAX_PAR_AJOUT = 60;

/** Le nom d'un service, mis au propre : espaces réduits, bords retirés. Vide → `null`. */
export function nomDeService(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const nom = brut.replace(/\s+/g, " ").trim();
  return nom ? nom : null;
}

/**
 * LA CLÉ DE COMPARAISON de deux noms — sans casse, sans accents, sans espaces superflus.
 * « Pédiatrie » et « pediatrie  » désignent le même service ; les laisser coexister ferait deux
 * lignes pour un seul service, et les praticiens se répartiraient au hasard entre elles.
 */
export function cleDeService(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface NomsLus {
  /** Les noms à créer, mis au propre, dans l'ordre de la saisie, sans doublon entre eux. */
  noms: string[];
  /** Les noms écartés parce que trop longs — dits, jamais coupés en silence. */
  tropLongs: string[];
  /** Les noms répétés DANS la saisie (le second est ignoré). */
  repetes: string[];
}

/**
 * UNE SAISIE DE PLUSIEURS SERVICES — une liste collée depuis un fichier ou tapée d'un trait :
 * séparée par des retours à la ligne, des virgules ou des points-virgules. On ne devine rien
 * d'autre : « Gynécologie-obstétrique » reste UN service, le tiret n'est pas un séparateur.
 */
export function lireNomsDeServices(texte: unknown): NomsLus {
  const brut = typeof texte === "string" ? texte : "";
  const vus = new Set<string>();
  const out: NomsLus = { noms: [], tropLongs: [], repetes: [] };
  for (const morceau of brut.split(/[\n\r,;]+/)) {
    const nom = nomDeService(morceau);
    if (!nom) continue;
    if (nom.length > LONGUEUR_MAX_SERVICE) { out.tropLongs.push(nom); continue; }
    const cle = cleDeService(nom);
    if (vus.has(cle)) { out.repetes.push(nom); continue; }
    vus.add(cle);
    out.noms.push(nom);
  }
  return out;
}

// ─────────────────────────────── LA COUVERTURE D'UN SECTEUR ───────────────────────────────

/** Un établissement dans un secteur : tous ses services, ou certains. */
export interface LienCouverture {
  institutionId: string;
  tousLesServices: boolean;
  /** Les services choisis — ignorés quand `tousLesServices` est vrai. */
  serviceIds: string[];
}

/**
 * LIRE LA COUVERTURE envoyée par l'écran des secteurs : `{ [établissement]: [services…] }`, et
 * seulement pour les établissements dont on n'a PAS gardé « tous les services ».
 *
 * `null` = le formulaire n'en dit rien (une op d'Adam écrite avant ce champ, un appel qui ne
 * touche qu'au nom du secteur) : l'appelant garde alors la couverture que chaque établissement a
 * DÉJÀ — un champ absent ne doit pas élargir en silence un territoire qu'on avait restreint
 * (§118.152c). Une liste VIDE est rendue TELLE QUELLE, et c'est l'action qui la refuse en
 * nommant l'établissement : « aucun service » n'est pas un choix qu'on fait exprès, c'est
 * « tous » qu'on a oublié de cocher ou un établissement qu'on voulait retirer — et ce module, qui
 * ne connaît pas les noms, ne saurait pas le dire.
 */
export function lireCouverture(
  brut: unknown,
): { ok: true; parEtablissement: Map<string, string[]> | null } | { ok: false; error: string } {
  if (brut === null || brut === undefined || (typeof brut === "string" && brut.trim() === "")) {
    return { ok: true, parEtablissement: null };
  }
  let valeur: unknown = brut;
  if (typeof brut === "string") {
    try { valeur = JSON.parse(brut); } catch {
      return { ok: false, error: "Le choix des services est illisible : rechargez l'écran et recommencez." };
    }
  }
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) {
    return { ok: false, error: "Le choix des services est illisible : rechargez l'écran et recommencez." };
  }
  const parEtablissement = new Map<string, string[]>();
  for (const [institutionId, services] of Object.entries(valeur as Record<string, unknown>)) {
    if (!institutionId.trim()) continue;
    if (!Array.isArray(services)) {
      return { ok: false, error: "Le choix des services est illisible : rechargez l'écran et recommencez." };
    }
    const ids = [...new Set(services.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()))];
    parEtablissement.set(institutionId.trim(), ids);
  }
  return { ok: true, parEtablissement };
}

/**
 * CE LIEN COUVRE-T-IL CE PRATICIEN ? — pour NOMMER le secteur qui amène un praticien du panel.
 *
 * L'APPARTENANCE au panel ne se décide pas ici : elle se lit dans `clausePanelDuKam` (`rbac.ts`,
 * §118.179), la seule écriture de la règle. Ce prédicat ne sert qu'au libellé, et il est plus
 * strict qu'elle sur un cas que les écritures empêchent (un service d'un AUTRE établissement que
 * celui de la fiche) : au pire, un praticien du panel s'affiche sans nom de secteur.
 */
export function lienCouvre(lien: LienCouverture, praticien: { institutionId: string | null; serviceId: string | null }): boolean {
  if (praticien.institutionId !== lien.institutionId) return false;
  if (lien.tousLesServices) return true;
  return praticien.serviceId !== null && lien.serviceIds.includes(praticien.serviceId);
}

/**
 * LE LIBELLÉ D'UN ÉTABLISSEMENT DANS UN SECTEUR — « CHU Mustapha (tous les services) »,
 * « CHU Mustapha (Cardiologie, Oncologie) ». Un lien restreint qui n'a plus AUCUN service (le
 * dernier a été supprimé de l'annuaire) le DIT : il ne s'élargit jamais tout seul.
 */
export function libelleCouverture(nomEtablissement: string, lien: LienCouverture, nomService: (id: string) => string | null): string {
  if (lien.tousLesServices) return `${nomEtablissement} (tous les services)`;
  const noms = lien.serviceIds.map(nomService).filter((n): n is string => Boolean(n));
  return noms.length > 0
    ? `${nomEtablissement} (${noms.join(", ")})`
    : `${nomEtablissement} (aucun service — le ou les services choisis ont été retirés de l'annuaire)`;
}
