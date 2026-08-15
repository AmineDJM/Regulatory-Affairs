import * as XLSX from "xlsx";
import { PHARMA_FORM, DOSAGE_UNIT, MANUFACTURING_STATUS, REGULATORY_STATUS, REGULATORY_CATEGORY, PRIORITY, PRODUCT_CHANNEL } from "@/lib/labels";

/**
 * EXPORT EXCEL DU TABLEAU REGULATORY.
 *
 * Le tableau à l'écran est fait pour être BALAYÉ ; un classeur est fait pour être TRIÉ, filtré,
 * recoupé et envoyé. Les deux ne montrent donc pas la même chose : l'export porte les champs
 * complets du dossier (molécules de l'association, laboratoire, pays, détenteur de DE,
 * fabricant, dates, commentaires), y compris ceux que l'écran masque faute de place.
 *
 * Les libellés sont écrits EN CLAIR — « Comprimé pelliculé », pas « COMPRIME_PELLICULE » : un
 * classeur qui sort de l'outil est lu par des gens qui n'y ont pas accès.
 *
 * Module PUR (aucun accès base) — testé.
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
  /** « DECLARED » (fiche) ou « VARIATION » (décision obtenue) — la nuance qui compte. */
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

const VARIATION_LABEL: Record<string, string> = {
  NONE: "Aucune",
  SECONDARY_PACKAGING: "Packaging secondaire",
  PRIMARY_PACKAGING: "Packaging primaire",
  FULL_PROCESS: "Full process",
};

/** L'en-tête du classeur, dans l'ordre où on lit un dossier. */
export const EXPORT_COLUMNS = [
  "Référence", "DCI", "Molécules", "Nom commercial", "Dosage", "Forme", "Conditionnement",
  "Classe thérapeutique", "Catégorie", "Canal", "Fournisseur", "Laboratoire partenaire",
  "Pays d'origine", "Statut de fabrication", "Origine du statut", "Niveau de process",
  "Priorité", "Chargé du dossier", "Assistant(e)", "Entité", "Date cible dépôt",
  "Date cible enregistrement", "Avancement", "Étapes faites", "Étapes totales",
  "Détenteur de DE", "Fabricant", "Variation d'enregistrement", "Commentaires",
  "Créé le", "Modifié le",
] as const;

export function exportRowValues(r: RegulatoryExportRow): (string | number)[] {
  return [
    r.reference,
    r.dci,
    (r.molecules ?? []).join(" + "),
    r.brandName ?? "",
    dosageLabel(r.dosage, r.dosageUnit),
    label(PHARMA_FORM, r.pharmaceuticalForm),
    r.packaging ?? "",
    r.therapeuticClass ?? "",
    label(REGULATORY_CATEGORY as Record<string, unknown>, r.category),
    label(PRODUCT_CHANNEL as Record<string, unknown>, r.channel),
    r.supplier ?? "",
    r.partnerLab ?? "",
    r.countryOfOrigin ?? "",
    label(MANUFACTURING_STATUS, r.manufacturingStatus),
    // « Déclaré » vs « variation obtenue » : sans cette colonne, un classeur laisserait croire
    // qu'une fabrication locale est acquise alors qu'elle n'est qu'annoncée sur la fiche.
    r.manufacturingSource === "VARIATION" ? "Variation obtenue" : "Déclaré sur la fiche",
    label(REGULATORY_STATUS as Record<string, unknown>, r.status),
    label(PRIORITY as Record<string, unknown>, r.priority),
    r.responsible ?? "",
    r.assistant ?? "",
    r.company ?? "",
    frDate(r.targetSubmissionDate),
    frDate(r.targetDate),
    r.stepsTotal > 0 ? Math.round((r.stepsDone / r.stepsTotal) * 100) / 100 : 0,
    r.stepsDone,
    r.stepsTotal,
    r.deHolder ?? "",
    r.manufacturer ?? "",
    r.manufacturingVariation ? VARIATION_LABEL[r.manufacturingVariation] ?? r.manufacturingVariation : "",
    r.comments ?? "",
    frDate(r.createdAt),
    frDate(r.updatedAt),
  ];
}

/** Largeurs de colonnes — un classeur illisible se referme aussitôt qu'il s'ouvre. */
const WIDTHS = [14, 26, 26, 18, 12, 22, 16, 20, 16, 14, 20, 20, 14, 20, 18, 20, 12, 20, 20, 14, 14, 16, 11, 12, 12, 22, 22, 22, 46, 12, 12];

export function buildRegulatoryWorkbook(rows: RegulatoryExportRow[]): Buffer {
  const data: (string | number)[][] = [[...EXPORT_COLUMNS], ...rows.map(exportRowValues)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = WIDTHS.map((wch) => ({ wch }));
  // Fige l'en-tête : sur 69 lignes on ne sait plus quelle colonne on lit dès le premier défilement.
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: EXPORT_COLUMNS.length - 1 } }) };
  // La colonne « Avancement » est un ratio : en pourcentage, pas en 0,42.
  const pct = EXPORT_COLUMNS.indexOf("Avancement");
  for (let r = 1; r < data.length; r += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: pct })];
    if (cell) cell.z = "0%";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dossiers");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** « regulatory-2026-08-12.xlsx » — daté, pour ne pas écraser l'export de la veille. */
export function regulatoryExportFilename(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `regulatory-${d}.xlsx`;
}
