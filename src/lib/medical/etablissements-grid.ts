/**
 * LA FEUILLE DES ÉTABLISSEMENTS — ses colonnes, nommées UNE fois.
 *
 * Module PUR (zéro import) : l'écran des établissements et l'action qui colore ses cellules
 * lisent la même liste. Sans elle, l'action accepterait n'importe quel nom de colonne, et une
 * couleur posée sur « ville » — une colonne que la feuille n'a plus — vivrait en base sans
 * jamais s'afficher.
 *
 * Trois des colonnes ne s'éditent pas dans la cellule — les SERVICES (ils se tiennent dans leur
 * panneau, §118.172), les praticiens rattachés et les secteurs qui le couvrent (calculés). On
 * peut les colorer comme les autres — un tableur ne distingue pas une cellule saisie d'une
 * cellule calculée quand on la surligne.
 *
 * ── « LES SECTEURS NE SE RENSEIGNENT PAS DANS CET ANNUAIRE » (Direction, 01/10) ─────────────
 *
 * La fiche portait une case « Secteur » qui disait PUBLIC ou PRIVÉ — un attribut de
 * l'établissement, sans aucun rapport avec les secteurs commerciaux que chaque Business Unit
 * découpe. Le même mot pour deux choses : on croyait découper un territoire dans l'annuaire. La
 * case s'appelle désormais « Public / privé », et la colonne calculée « Secteurs BU » dit
 * combien de secteurs commerciaux le couvrent — elle ne se saisit pas ici, elle se lit.
 */

export type EtablissementField = "name" | "type" | "sector" | "wilaya" | "services" | "doctorCount" | "sectorCount";

export interface EtablissementColumn {
  field: EtablissementField;
  header: string;
  /** Une colonne calculée ne s'édite pas ; elle se colore et se copie comme les autres. */
  calculee?: boolean;
}

export const ETABLISSEMENT_COLUMNS: readonly EtablissementColumn[] = [
  { field: "name", header: "Établissement" },
  { field: "type", header: "Type" },
  { field: "sector", header: "Public / privé" },
  { field: "wilaya", header: "Wilaya" },
  { field: "services", header: "Services" },
  { field: "doctorCount", header: "Praticiens", calculee: true },
  { field: "sectorCount", header: "Secteurs BU", calculee: true },
];

const FIELDS = new Set<string>(ETABLISSEMENT_COLUMNS.map((c) => c.field));

/** Garde d'entrée de l'action serveur : ce texte est-il une colonne de la feuille ? */
export function isEtablissementField(x: unknown): x is EtablissementField {
  return typeof x === "string" && FIELDS.has(x);
}
