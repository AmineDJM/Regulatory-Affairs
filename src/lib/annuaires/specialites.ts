/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SPÉCIALITÉ D'UN PRATICIEN — un LIEN vers le référentiel, pas un texte (§118.180).
 *
 * `MedicalSpecialty` est le référentiel canonique (nom unique). La feuille de l'annuaire, l'import
 * d'un classeur et l'ajout d'une ligne écrivaient la spécialité en TEXTE et EFFAÇAIENT le lien :
 * « Cardiologie » tapée dans une cellule rendait la fiche « sans spécialité » pour tout ce qui lit
 * le référentiel (le regroupement de l'annuaire, et demain la segmentation et les cibles des BU).
 *
 * Ce module dit, sans base, ce qu'un texte DÉSIGNE dans le référentiel : UNE spécialité à coup sûr
 * (casse, accents et espaces mis à part), PLUSIEURS (deux entrées du référentiel qui ne diffèrent
 * que par un accent — c'est un doublon du référentiel, à fusionner, pas un choix à faire à la place
 * d'un humain, §118.34), ou AUCUNE. Seul le premier cas relie ; les autres gardent le texte, et la
 * fiche reste « à rattacher » avec sa raison.
 *
 * Module PUR, zéro import : la feuille (composant client), les actions et l'import en ont besoin,
 * et aucun n'a le droit d'importer les autres.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface SpecialiteDuReferentiel {
  id: string;
  name: string;
}

/** La clé de comparaison — sans casse, sans accents, sans espaces superflus. */
export function cleDeSpecialite(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type Resolution =
  | { statut: "trouve"; specialite: SpecialiteDuReferentiel }
  | { statut: "ambigu"; candidates: SpecialiteDuReferentiel[] }
  | { statut: "inconnu" }
  | { statut: "vide" };

/** Un index du référentiel, construit une fois et interrogé autant de fois qu'il y a de lignes. */
export function indexerSpecialites(referentiel: readonly SpecialiteDuReferentiel[]): (texte: string | null | undefined) => Resolution {
  const parCle = new Map<string, SpecialiteDuReferentiel[]>();
  for (const s of referentiel) {
    const cle = cleDeSpecialite(s.name);
    if (!cle) continue;
    parCle.set(cle, [...(parCle.get(cle) ?? []), s]);
  }
  return (texte) => {
    const cle = cleDeSpecialite(String(texte ?? ""));
    if (!cle) return { statut: "vide" };
    const trouvees = parCle.get(cle) ?? [];
    if (trouvees.length === 1) return { statut: "trouve", specialite: trouvees[0] };
    if (trouvees.length > 1) return { statut: "ambigu", candidates: trouvees };
    return { statut: "inconnu" };
  };
}

/**
 * CE QU'ON ÉCRIT SUR LA FICHE pour un texte saisi : le lien et le NOM du référentiel quand le texte
 * le désigne à coup sûr (le libellé dénormalisé suit le lien, comme pour l'établissement) ; sinon
 * le texte tel quel, SANS lien — jamais un lien deviné.
 */
export function ecritureDeSpecialite(
  texte: string | null | undefined,
  resoudre: (texte: string | null | undefined) => Resolution,
): { specialtyId: string | null; specialty: string | null } {
  const propre = String(texte ?? "").replace(/\s+/g, " ").trim();
  if (!propre) return { specialtyId: null, specialty: null };
  const r = resoudre(propre);
  return r.statut === "trouve"
    ? { specialtyId: r.specialite.id, specialty: r.specialite.name }
    : { specialtyId: null, specialty: propre };
}

/**
 * UN LIEN NE VAUT QUE SI LE TEXTE LE DÉSIGNE.
 *
 * Le texte d'une fiche et son lien vers le référentiel disent normalement la même chose : les
 * écrivains d'aujourd'hui posent les deux ensemble, et un renommage du référentiel fait suivre le
 * texte. Une écriture d'AVANT les séparait : l'import d'un classeur remplaçait le TEXTE sans toucher
 * au LIEN (la cellule, elle, effaçait le lien ; les formulaires posaient le nom du référentiel). Une
 * fiche liée à « Cardiologie » dont le texte dit « Cardio interventionnelle » porte donc une saisie
 * PLUS RÉCENTE que son lien — afficher le nom du lien défairait l'import en silence, et compter la
 * fiche sous « Cardiologie » ferait de même dans chaque regroupement. Ce lien-là ne vaut plus : la
 * fiche se lit comme son texte, « à rattacher ».
 *
 * Un texte VIDE ne contredit rien : le lien vaut, et c'est le nom du référentiel qui s'affiche.
 */
export function lienDeSpecialiteValide(texte: string | null | undefined, nomDuLien: string | null | undefined): boolean {
  if (!nomDuLien) return false;
  const cle = cleDeSpecialite(String(texte ?? ""));
  return !cle || cle === cleDeSpecialite(nomDuLien);
}

/**
 * LES ÉCRANS QUI MONTENT LE RÉFÉRENTIEL (§118.209) — depuis le 07/10, Annuaires › Spécialités seul (les anciennes
 * portes du Marketing cockpit et de la Force de vente y redirigent). Une écriture revalide chaque écran de cette
 * liste : le jour où une seconde porte reviendrait, elle s'ajoute ICI et nulle part ailleurs.
 */
export const CHEMINS_SPECIALITES = ["/annuaires/specialites"] as const;
