import { DOCTOR_TITLE, MEDICAL_SECTOR, SEGMENT_LEVEL, ALGERIA_WILAYAS } from "@/lib/labels";

/**
 * L'ANNUAIRE ÉDITABLE — les colonnes exactes du terrain, et leur éditeur.
 *
 * L'écran de l'annuaire est une FEUILLE que l'on corrige à la main, cellule par cellule. Les
 * colonnes sont celles que la promotion médicale emploie réellement — Nom, Prénom, Adresse,
 * Ville, Wilaya, Potentiel, Code postal, Téléphone, Spécialité, Grade, Mail, Privé/Public — et
 * chaque colonne sait comment elle s'édite : au clavier (texte) ou dans une liste fermée (menu
 * déroulant). Les listes fermées — wilaya, grade, secteur, potentiel — évitent qu'« Alger » et
 * « ALGER », « Pr » et « Professeur » se comptent séparément : c'est précisément le comptage
 * qu'un annuaire vient chercher.
 *
 * Module PUR — aucune base, aucune lecture de fichier. Il décrit les colonnes et VALIDE une
 * valeur avant écriture ; il est testé, et il est partagé tel quel par la grille (client) et par
 * l'export (serveur). Un seul endroit décide de ce qu'est une colonne valide.
 */

/** Un champ éditable de l'annuaire — chacun correspond à une colonne de `MedicalDoctor`. */
export type AnnuaireField =
  | "lastName" | "firstName" | "address" | "city" | "wilaya" | "potential"
  | "postalCode" | "phone" | "specialty" | "title" | "email" | "sector";

export type CellEditor = "text" | "select";

export interface AnnuaireColumn {
  field: AnnuaireField;
  /** En-tête exact, à l'écran comme dans le classeur exporté. */
  header: string;
  editor: CellEditor;
  /** Pour un menu déroulant : les seules valeurs acceptées, déjà en clair. */
  options?: { value: string; label: string }[];
  /** Une colonne texte peut proposer une saisie assistée (spécialités connues). */
  suggest?: boolean;
  /** Largeur indicative (rem) — un annuaire qu'il faut élargir à la main agace. */
  width?: number;
}

const fromMap = (map: Record<string, unknown>): { value: string; label: string }[] =>
  Object.entries(map).map(([value, entry]) => ({
    value,
    label: typeof entry === "string" ? entry : ((entry as { label?: string })?.label ?? value),
  }));

/** Les options d'une wilaya : la valeur EST le libellé (on ne stocke que le nom). */
const WILAYA_OPTIONS = ALGERIA_WILAYAS.map((w) => ({ value: w, label: w }));

/**
 * LES COLONNES, DANS L'ORDRE DEMANDÉ. C'est cette liste — et elle seule — qui gouverne l'écran
 * ET l'export : les deux ne peuvent donc pas diverger.
 */
export const ANNUAIRE_COLUMNS: AnnuaireColumn[] = [
  { field: "lastName", header: "Nom", editor: "text", width: 14 },
  { field: "firstName", header: "Prénom", editor: "text", width: 12 },
  { field: "address", header: "Adresse", editor: "text", width: 20 },
  { field: "city", header: "Ville", editor: "text", width: 12 },
  { field: "wilaya", header: "Wilaya", editor: "select", options: WILAYA_OPTIONS, width: 14 },
  { field: "potential", header: "Potentiel", editor: "select", options: fromMap(SEGMENT_LEVEL), width: 11 },
  { field: "postalCode", header: "Code postal", editor: "text", width: 10 },
  { field: "phone", header: "Numéro de téléphone", editor: "text", width: 15 },
  { field: "specialty", header: "Spécialité 1", editor: "text", suggest: true, width: 16 },
  { field: "title", header: "Grade", editor: "select", options: fromMap(DOCTOR_TITLE), width: 15 },
  { field: "email", header: "Mail", editor: "text", width: 18 },
  { field: "sector", header: "Privé/Public", editor: "select", options: fromMap(MEDICAL_SECTOR), width: 13 },
];

const BY_FIELD = new Map<string, AnnuaireColumn>(ANNUAIRE_COLUMNS.map((c) => [c.field, c]));

/** Ce texte est-il bien un champ éditable de l'annuaire ? Garde d'entrée de l'action serveur. */
export function isAnnuaireField(x: unknown): x is AnnuaireField {
  return typeof x === "string" && BY_FIELD.has(x);
}

/** Les valeurs enum stockées telles quelles (validées avant écriture). */
const SEGMENT_VALUES = Object.keys(SEGMENT_LEVEL);
const TITLE_VALUES = Object.keys(DOCTOR_TITLE);
const SECTOR_VALUES = Object.keys(MEDICAL_SECTOR);

/**
 * Valide et normalise une valeur avant écriture.
 *
 * Les menus déroulants n'acceptent QUE leurs options — une valeur hors liste est refusée, jamais
 * écrite en silence (sinon la wilaya « Algr » se glisse à côté d'« Alger » et casse le comptage).
 * Le texte est simplement mis au propre ; vide devient `null` — une cellule effacée n'est pas la
 * chaîne vide, c'est l'absence de valeur.
 */
export function validateAnnuaireValue(
  field: AnnuaireField,
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = String(raw ?? "").replace(/\s+/g, " ").trim();
  switch (field) {
    case "wilaya":
      if (!v) return { ok: true, value: null };
      return ALGERIA_WILAYAS.includes(v)
        ? { ok: true, value: v }
        : { ok: false, error: "Wilaya hors de la liste des 58 wilayas." };
    case "potential":
      return SEGMENT_VALUES.includes(v) ? { ok: true, value: v } : { ok: false, error: "Niveau invalide." };
    case "title":
      return TITLE_VALUES.includes(v) ? { ok: true, value: v } : { ok: false, error: "Grade invalide." };
    case "sector":
      return SECTOR_VALUES.includes(v) ? { ok: true, value: v } : { ok: false, error: "Secteur invalide." };
    default:
      // Champs texte : nom, prénom, adresse, ville, code postal, téléphone, spécialité, mail.
      return { ok: true, value: v || null };
  }
}

/** La fiche telle que la grille et l'export la lisent — valeurs brutes (enum non traduits). */
export interface AnnuaireRow {
  id: string;
  lastName: string | null;
  firstName: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  potential: string;
  postalCode: string | null;
  phone: string | null;
  specialty: string | null;
  title: string;
  email: string | null;
  sector: string;
}

const optionLabel = (col: AnnuaireColumn, value: string | null): string => {
  if (!value) return "";
  return col.options?.find((o) => o.value === value)?.label ?? value;
};

/** La valeur AFFICHÉE d'une cellule — un seul endroit décide, écran comme classeur. */
export function annuaireCell(row: AnnuaireRow, field: AnnuaireField): string {
  const col = BY_FIELD.get(field)!;
  const raw = row[field];
  if (col.editor === "select") return optionLabel(col, raw as string | null);
  return (raw as string | null) ?? "";
}

/** L'en-tête du classeur exporté — l'ordre exact des colonnes de l'annuaire. */
export function annuaireHeaderRow(): string[] {
  return ANNUAIRE_COLUMNS.map((c) => c.header);
}

/** Le nom d'affichage recomposé à partir du prénom et du nom (« Amina MOUFFOK »). */
export function composeDoctorName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ").trim();
}
