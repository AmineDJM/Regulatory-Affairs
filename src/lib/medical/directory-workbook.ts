import * as XLSX from "xlsx";
import { ANNUAIRE_COLUMNS, annuaireHeaderRow, annuaireCell, type AnnuaireRow } from "./directory-grid";

/**
 * LE CLASSEUR DE L'ANNUAIRE — lecture d'un fichier importé, écriture de l'export.
 *
 * L'export est écrit EN CLAIR — « Professeur », « Hôpital / Public », « Très haut » — parce qu'un
 * annuaire sort de l'outil : il part par mail, il se corrige à plusieurs dans un tableur, il se
 * relit sur un téléphone. Personne, dehors, ne sait ce que veut dire `MAITRE_CONFERENCES`.
 *
 * Il reprend EXACTEMENT les colonnes de l'écran, dans le même ordre : c'est le même module pur
 * (`directory-grid`) qui décide de la valeur d'une cellule à l'écran et ici — les deux ne peuvent
 * donc pas diverger.
 */

export function buildAnnuaireWorkbook(rows: readonly AnnuaireRow[]): Buffer {
  const aoa: unknown[][] = [annuaireHeaderRow()];
  for (const r of rows) aoa.push(ANNUAIRE_COLUMNS.map((c) => annuaireCell(r, c.field)));
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Largeurs de colonnes : un classeur qu'il faut élargir à la main avant de le lire agace.
  sheet["!cols"] = ANNUAIRE_COLUMNS.map((c) => ({ wch: c.width ?? 14 }));
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
