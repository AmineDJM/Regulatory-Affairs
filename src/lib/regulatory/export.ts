import ExcelJS from "exceljs";
import { PHARMA_FORM, DOSAGE_UNIT, MANUFACTURING_STATUS, REGULATORY_STATUS, PRIORITY } from "@/lib/labels";
import { dossierReceivedLabel } from "@/lib/regulatory/dossier-received";

/**
 * EXPORT EXCEL DU TABLEAU REGULATORY.
 *
 * HUIT COLONNES, et huit seulement — celles que le métier relit vraiment : DCI, Dosage, Forme,
 * Laboratoire partenaire, Statut de fabrication, Niveau de process, Priorité, Chargé du dossier.
 * L'export portait trente et une colonnes ; on en masquait vingt à la main à chaque envoi, ce qui
 * revient à ne jamais l'envoyer.
 *
 * LA PRIORITÉ EST EN COULEUR. Sur soixante-neuf lignes, « Critique » écrit en noir au milieu de
 * « Moyenne » ne se voit pas : c'est la couleur qui fait remonter l'urgence d'un coup d'œil, et
 * c'est précisément pour trier par urgence qu'on ouvre ce classeur.
 *
 * Écrit avec ExcelJS et non SheetJS : l'édition communautaire de SheetJS ne SAIT PAS écrire un
 * fond de cellule — le classeur serait sorti en noir et blanc sans une erreur pour le signaler.
 *
 * Rappel des intitulés (ils avaient été inversés une fois) : « Statut de fabrication » =
 * importation / packaging / full process (la profondeur industrielle) ; « Niveau de process » =
 * pré-soumission / déposé / … (l'avancement de la procédure).
 */

export interface RegulatoryExportRow {
  reference: string;
  dci: string;
  molecules: string[] | null;
  brandName: string | null;
  dosage: string | null;
  dosageUnit: string | null;
  pharmaceuticalForm: string | null;
  packaging: string | null;
  therapeuticClass: string | null;
  category: string;
  channel: string;
  supplier: string | null;
  partnerLab: string | null;
  countryOfOrigin: string | null;
  manufacturingStatus: string;
  manufacturingSource: string;
  status: string;
  priority: string;
  responsible: string | null;
  assistant: string | null;
  company: string | null;
  targetSubmissionDate: string | null;
  targetDate: string | null;
  stepsDone: number;
  stepsTotal: number;
  deHolder: string | null;
  manufacturer: string | null;
  manufacturingVariation: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  /** Le dossier CTD a-t-il été reçu ? Constaté, jamais saisi — `regulatory/dossier-received.ts`. */
  dossierReceived: boolean;
}

/** Libellé d'un code, avec repli sur le code lui-même : on n'efface jamais une valeur inconnue. */
const label = (map: Record<string, unknown>, value: string | null): string => {
  if (!value) return "";
  const entry = map[value];
  if (typeof entry === "string") return entry;
  const asObj = entry as { label?: string } | undefined;
  return asObj?.label ?? value;
};

/** « 2026-08-12T… » → « 12/08/2026 ». Vide reste vide — pas de « 01/01/1970 ». */
export function frDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Dosage lisible : « 500 mg ». L'unité est un code en base, jamais dans un classeur. */
export function dosageLabel(dosage: string | null, unit: string | null): string {
  const u = unit ? DOSAGE_UNIT[unit] ?? unit : "";
  return [dosage, u].filter(Boolean).join(" ");
}

/**
 * L'en-tête du classeur — les colonnes voulues par le métier, dans cet ordre.
 *
 * « DOSSIER REÇU » y figure parce que c'est la première question qu'on pose en relisant la
 * liste, et parce qu'un classeur qui la porte évite l'aller-retour vers l'écran : sans elle, on
 * exportait pour envoyer, puis on renvoyait un message pour dire lesquels manquaient.
 */
export const EXPORT_COLUMNS = [
  "DCI", "Dosage", "Forme", "Laboratoire partenaire",
  "Statut de fabrication", "Niveau de process", "Priorité", "Chargé du dossier", "Dossier reçu",
] as const;

export function exportRowValues(r: RegulatoryExportRow): string[] {
  return [
    r.dci,
    dosageLabel(r.dosage, r.dosageUnit),
    label(PHARMA_FORM, r.pharmaceuticalForm),
    r.partnerLab ?? "",
    label(MANUFACTURING_STATUS, r.manufacturingStatus),
    label(REGULATORY_STATUS as Record<string, unknown>, r.status),
    label(PRIORITY as Record<string, unknown>, r.priority),
    r.responsible ?? "",
    dossierReceivedLabel(r.dossierReceived),
  ];
}

/**
 * LA COULEUR DE CHAQUE PRIORITÉ — fond et texte, en ARGB.
 *
 * Les teintes reprennent celles de l'écran (neutre / bleu / ambre / rouge) : quelqu'un qui passe
 * du tableau au classeur doit retrouver ses repères, pas réapprendre un code couleur. Le texte
 * est assombri plutôt que le fond saturé — un aplat vif rend une colonne illisible à l'impression.
 */
export const PRIORITY_FILL: Record<string, { bg: string; fg: string }> = {
  LOW: { bg: "FFEFF1F5", fg: "FF4A5568" },       // Basse — neutre
  MEDIUM: { bg: "FFDCEBFB", fg: "FF1B4F8A" },    // Moyenne — bleu
  HIGH: { bg: "FFFDEBCF", fg: "FF8A5200" },      // Haute — ambre
  CRITICAL: { bg: "FFFBD5D5", fg: "FF9B1C1C" },  // Critique — rouge
};

/** Largeurs — un classeur qu'il faut élargir à la main avant de le lire se referme aussitôt. */
const WIDTHS = [30, 14, 24, 24, 22, 22, 14, 22, 14];

export async function buildRegulatoryWorkbook(rows: RegulatoryExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Dossiers", {
    // Fige l'en-tête : sur soixante-neuf lignes, on ne sait plus quelle colonne on lit dès le
    // premier défilement.
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = EXPORT_COLUMNS.map((header, i) => ({ header, width: WIDTHS[i] }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FF1F2937" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  head.alignment = { vertical: "middle" };

  const priorityCol = EXPORT_COLUMNS.indexOf("Priorité") + 1; // ExcelJS compte à partir de 1
  for (const r of rows) {
    const row = ws.addRow(exportRowValues(r));
    const paint = PRIORITY_FILL[r.priority];
    if (paint) {
      const cell = row.getCell(priorityCol);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: paint.bg } };
      cell.font = { bold: true, color: { argb: paint.fg } };
      cell.alignment = { horizontal: "center" };
    }
  }

  // Le filtre automatique : c'est ce pour quoi on exporte — trier par priorité, isoler un labo.
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** « regulatory-2026-08-12.xlsx » — daté, pour ne pas écraser l'export de la veille. */
export function regulatoryExportFilename(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `regulatory-${d}.xlsx`;
}
