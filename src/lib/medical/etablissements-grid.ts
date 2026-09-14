/**
 * LA FEUILLE DES ÉTABLISSEMENTS — ses colonnes, nommées UNE fois.
 *
 * Module PUR (zéro import) : l'écran des établissements et l'action qui colore ses cellules
 * lisent la même liste. Sans elle, l'action accepterait n'importe quel nom de colonne, et une
 * couleur posée sur « ville » — une colonne que la feuille n'a plus — vivrait en base sans
 * jamais s'afficher.
 *
 * Deux des colonnes sont CALCULÉES (praticiens rattachés, secteurs qui le couvrent) : on peut
 * les colorer comme les autres — un tableur ne distingue pas une cellule saisie d'une cellule
 * calculée quand on la surligne — mais elles ne s'éditent pas.
 */

export type EtablissementField = "name" | "type" | "sector" | "wilaya" | "doctorCount" | "sectorCount";

export interface EtablissementColumn {
  field: EtablissementField;
  header: string;
  /** Une colonne calculée ne s'édite pas ; elle se colore et se copie comme les autres. */
  calculee?: boolean;
}

export const ETABLISSEMENT_COLUMNS: readonly EtablissementColumn[] = [
  { field: "name", header: "Établissement" },
  { field: "type", header: "Type" },
  { field: "sector", header: "Secteur" },
  { field: "wilaya", header: "Wilaya" },
  { field: "doctorCount", header: "Praticiens", calculee: true },
  { field: "sectorCount", header: "Secteurs", calculee: true },
];

const FIELDS = new Set<string>(ETABLISSEMENT_COLUMNS.map((c) => c.field));

/** Garde d'entrée de l'action serveur : ce texte est-il une colonne de la feuille ? */
export function isEtablissementField(x: unknown): x is EtablissementField {
  return typeof x === "string" && FIELDS.has(x);
}
