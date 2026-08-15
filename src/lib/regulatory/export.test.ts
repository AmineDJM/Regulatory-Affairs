import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRegulatoryWorkbook, exportRowValues, EXPORT_COLUMNS,
  frDate, dosageLabel, regulatoryExportFilename, type RegulatoryExportRow,
} from "./export";

const row = (over: Partial<RegulatoryExportRow> = {}): RegulatoryExportRow => ({
  reference: "REG-2026-001",
  dci: "FINGOLIMOD",
  molecules: null,
  brandName: null,
  dosage: "0.5",
  dosageUnit: "MG",
  pharmaceuticalForm: "GELULE",
  packaging: "B/28",
  therapeuticClass: "Neurologie",
  category: "MEDICINE",
  channel: "HOSPITAL",
  supplier: null,
  partnerLab: null,
  countryOfOrigin: null,
  manufacturingStatus: "FULL_PROCESS",
  manufacturingSource: "DECLARED",
  status: "PRE_SUBMISSION",
  priority: "CRITICAL",
  responsible: "Amina B.",
  assistant: null,
  company: "Adventum",
  targetSubmissionDate: null,
  targetDate: null,
  stepsDone: 3,
  stepsTotal: 17,
  deHolder: null,
  manufacturer: null,
  manufacturingVariation: null,
  comments: null,
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T10:00:00.000Z",
  ...over,
});

describe("frDate", () => {
  it("écrit la date à la française", () => {
    expect(frDate("2026-08-12T10:00:00.000Z")).toBe("12/08/2026");
  });

  it("laisse vide ce qui est vide — pas de 01/01/1970", () => {
    expect(frDate(null)).toBe("");
    expect(frDate("n'importe quoi")).toBe("");
  });
});

describe("dosageLabel", () => {
  it("écrit l'unité en clair", () => {
    expect(dosageLabel("500", "MG")).toBe("500 mg");
    expect(dosageLabel("20", "PERCENT")).toBe("20 %");
  });

  it("ne fabrique rien quand il n'y a rien", () => {
    expect(dosageLabel(null, null)).toBe("");
    expect(dosageLabel("0.4 mg + 5 mg", null)).toBe("0.4 mg + 5 mg");
  });
});

describe("exportRowValues", () => {
  it("traduit les codes en libellés lisibles — un classeur sort de l'outil", () => {
    const v = exportRowValues(row());
    expect(v[EXPORT_COLUMNS.indexOf("Forme")]).toBe("Gélule");
    expect(v[EXPORT_COLUMNS.indexOf("Catégorie")]).toBe("Médicament");
    expect(v[EXPORT_COLUMNS.indexOf("Priorité")]).toBe("Critique");
    expect(v).not.toContain("COMPRIME_PELLICULE");
  });

  it("dit si le statut de fabrication est DÉCLARÉ ou ACQUIS", () => {
    expect(exportRowValues(row())[EXPORT_COLUMNS.indexOf("Origine du statut")]).toBe("Déclaré sur la fiche");
    expect(exportRowValues(row({ manufacturingSource: "VARIATION" }))[EXPORT_COLUMNS.indexOf("Origine du statut")])
      .toBe("Variation obtenue");
  });

  it("recompose l'association de molécules", () => {
    const v = exportRowValues(row({ molecules: ["TAMSULOSINE", "TADALAFIL"] }));
    expect(v[EXPORT_COLUMNS.indexOf("Molécules")]).toBe("TAMSULOSINE + TADALAFIL");
  });

  it("rend l'avancement en ratio (mis en forme en % dans le classeur)", () => {
    expect(exportRowValues(row())[EXPORT_COLUMNS.indexOf("Avancement")]).toBe(0.18);
    expect(exportRowValues(row({ stepsDone: 0, stepsTotal: 0 }))[EXPORT_COLUMNS.indexOf("Avancement")]).toBe(0);
  });

  it("écrit une chaîne vide, jamais « null », pour un champ absent", () => {
    expect(exportRowValues(row()).filter((v) => typeof v === "string" && /null|undefined/.test(v))).toEqual([]);
  });

  it("rend autant de valeurs que de colonnes — sinon tout le tableau se décale", () => {
    expect(exportRowValues(row())).toHaveLength(EXPORT_COLUMNS.length);
  });
});

describe("buildRegulatoryWorkbook", () => {
  it("produit un classeur relisible, en-tête compris", () => {
    const buf = buildRegulatoryWorkbook([row(), row({ reference: "REG-2026-002", dci: "CLADRIBINE" })]);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Dossiers"]);
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Dossiers, { header: 1, raw: false });
    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(rows).toHaveLength(3);
    expect(rows[2][1]).toBe("CLADRIBINE");
  });

  it("pose un filtre et fige l'en-tête — un tableau de 69 lignes se lit autrement", () => {
    const buf = buildRegulatoryWorkbook([row()]);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.Sheets.Dossiers["!autofilter"]).toBeTruthy();
  });

  it("accepte une liste vide : un export sans résultat reste un fichier valide", () => {
    const wb = XLSX.read(buildRegulatoryWorkbook([]), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Dossiers, { header: 1, raw: false });
    expect(rows).toHaveLength(1);
  });
});

describe("regulatoryExportFilename", () => {
  it("date le fichier pour ne pas écraser celui de la veille", () => {
    expect(regulatoryExportFilename(new Date(2026, 7, 12))).toBe("regulatory-2026-08-12.xlsx");
  });
});
