import * as XLSX from "xlsx";
import { DOCTOR_TITLE, MEDICAL_SECTOR, SEGMENT_LEVEL } from "@/lib/labels";
import { DIRECTORY_COLUMNS, directoryHeaderRow, type DirectoryField } from "./directory-sheet";

/**
 * LE CLASSEUR DE L'ANNUAIRE.
 *
 * Il est écrit EN CLAIR — « Professeur », « Hôpital / Public », « Très haut » — parce qu'un
 * annuaire sort de l'outil : il part par mail, il se corrige à trois dans un tableur, il se
 * relit sur un téléphone. Personne, dehors, ne sait ce que veut dire `MAITRE_CONFERENCES`.
 *
 * Et parce que ces libellés sont exactement ceux que la reconnaissance à l'import sait relire,
 * le fichier exporté se RÉIMPORTE tel quel : c'est ce qui fait du tableur un outil de correction
 * en masse, et non une impasse.
 */

export interface DirectoryExportRow {
  name: string;
  title: string;
  specialty: string | null;
  sector: string;
  institution: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  influence: string;
  potential: string;
  affinity: string;
  targetProducts: string | null;
  delegate: string | null;
  comments: string | null;
}

const label = (map: Record<string, unknown>, value: string | null): string => {
  if (!value) return "";
  const entry = map[value];
  if (typeof entry === "string") return entry;
  return (entry as { label?: string } | undefined)?.label ?? value;
};

/** La valeur d'une colonne pour une fiche — un seul endroit décide, export comme aperçu. */
export function directoryCell(row: DirectoryExportRow, field: DirectoryField): string {
  switch (field) {
    case "name": return row.name;
    case "title": return label(DOCTOR_TITLE, row.title);
    case "specialty": return row.specialty ?? "";
    case "sector": return label(MEDICAL_SECTOR, row.sector);
    case "institution": return row.institution ?? "";
    case "city": return row.city ?? "";
    case "region": return row.region ?? "";
    case "phone": return row.phone ?? "";
    case "email": return row.email ?? "";
    case "influence": return label(SEGMENT_LEVEL, row.influence);
    case "potential": return label(SEGMENT_LEVEL, row.potential);
    case "affinity": return label(SEGMENT_LEVEL, row.affinity);
    case "targetProducts": return row.targetProducts ?? "";
    case "delegate": return row.delegate ?? "";
    case "comments": return row.comments ?? "";
  }
}

/** Largeurs de colonnes : un classeur qu'il faut élargir à la main avant de le lire agace. */
const WIDTHS: Partial<Record<DirectoryField, number>> = {
  name: 28, title: 20, specialty: 22, sector: 18, institution: 26, city: 16, region: 14,
  phone: 18, email: 26, targetProducts: 24, delegate: 20, comments: 40,
};

export function buildDirectoryWorkbook(rows: readonly DirectoryExportRow[]): Buffer {
  const aoa: unknown[][] = [directoryHeaderRow()];
  for (const r of rows) aoa.push(DIRECTORY_COLUMNS.map((c) => directoryCell(r, c.key)));
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = DIRECTORY_COLUMNS.map((c) => ({ wch: WIDTHS[c.key] ?? 14 }));
  // Fige la ligne d'en-tête : sur 400 praticiens, on ne sait plus quelle colonne on lit.
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Annuaire");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Lit un classeur téléversé en lignes brutes (première feuille), en-tête compris. */
export function readDirectoryWorkbook(buffer: Buffer): unknown[][] {
  const book = XLSX.read(buffer, { type: "buffer" });
  const first = book.SheetNames[0];
  if (!first) return [];
  // `defval: ""` garde les cellules vides à leur place : sans lui, une ligne à trous décale
  // toutes les colonnes suivantes et l'import range les téléphones dans la ville.
  return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[first], { header: 1, defval: "", raw: false });
}
