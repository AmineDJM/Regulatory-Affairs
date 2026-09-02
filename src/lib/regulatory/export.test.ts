import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  buildRegulatoryWorkbook, exportRowValues, EXPORT_COLUMNS, PRIORITY_FILL,
  frDate, dosageLabel, regulatoryExportFilename, type RegulatoryExportRow,
} from "./export";

const row = (over: Partial<RegulatoryExportRow> = {}): RegulatoryExportRow => ({
  reference: "REG-2026-001",
  dci: "FINGOLIMOD",
  dossierReceived: false,
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

describe("Les colonnes voulues par le métier — et elles seules", () => {
  it("porte exactement les neuf colonnes demandées, dans l'ordre", () => {
    expect([...EXPORT_COLUMNS]).toEqual([
      "DCI", "Dosage", "Forme", "Laboratoire partenaire",
      "Statut de fabrication", "Niveau de process", "Priorité", "Chargé du dossier", "Dossier reçu",
    ]);
  });

  it("« DOSSIER REÇU » SORT AUSSI AU CLASSEUR — Yes / No, jamais vide", () => {
    // Sans elle, on exportait pour envoyer la liste, puis on renvoyait un message pour dire
    // lesquels manquaient encore.
    const i = EXPORT_COLUMNS.indexOf("Dossier reçu");
    expect(exportRowValues(row({ dossierReceived: true }))[i]).toBe("Yes");
    expect(exportRowValues(row({ dossierReceived: false }))[i]).toBe("No");
  });

  it("traduit les codes en libellés lisibles — un classeur sort de l'outil", () => {
    const v = exportRowValues(row());
    expect(v[EXPORT_COLUMNS.indexOf("DCI")]).toBe("FINGOLIMOD");
    expect(v[EXPORT_COLUMNS.indexOf("Dosage")]).toBe("0.5 mg");
    expect(v[EXPORT_COLUMNS.indexOf("Forme")]).toBe("Gélule");
    expect(v[EXPORT_COLUMNS.indexOf("Priorité")]).toBe("Critique");
    expect(v[EXPORT_COLUMNS.indexOf("Chargé du dossier")]).toBe("Amina B.");
    expect(v).not.toContain("COMPRIME_PELLICULE");
  });

  it("ne confond pas « statut de fabrication » et « niveau de process »", () => {
    // Deux notions différentes : la profondeur industrielle d'un côté, l'avancement de la
    // procédure de l'autre. Les intitulés avaient déjà été inversés une fois.
    const v = exportRowValues(row());
    expect(v[EXPORT_COLUMNS.indexOf("Statut de fabrication")]).toBe("Full Process");
    expect(v[EXPORT_COLUMNS.indexOf("Niveau de process")]).toBe("Pré-soumission");
  });

  it("écrit une chaîne vide, jamais « null », pour un champ absent", () => {
    expect(exportRowValues(row()).filter((v) => /null|undefined/.test(v))).toEqual([]);
  });

  it("rend autant de valeurs que de colonnes — sinon tout le tableau se décale", () => {
    expect(exportRowValues(row())).toHaveLength(EXPORT_COLUMNS.length);
  });
});

describe("buildRegulatoryWorkbook", () => {
  /** Relit le classeur produit — la seule façon de vérifier ce qui sort vraiment. */
  const reopen = async (rows: RegulatoryExportRow[]) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildRegulatoryWorkbook(rows));
    return wb.getWorksheet("Dossiers")!;
  };

  it("produit un classeur relisible, en-tête compris", async () => {
    const ws = await reopen([row(), row({ dci: "CLADRIBINE" })]);
    expect(ws.getRow(1).values).toEqual([undefined, ...EXPORT_COLUMNS]);
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(3).getCell(1).value).toBe("CLADRIBINE");
  });

  it("PEINT la priorité — sur soixante-neuf lignes, « Critique » en noir ne se voit pas", async () => {
    const ws = await reopen([row({ priority: "CRITICAL" }), row({ priority: "LOW" })]);
    const col = EXPORT_COLUMNS.indexOf("Priorité") + 1;

    const critical = ws.getRow(2).getCell(col);
    expect((critical.fill as ExcelJS.FillPattern).fgColor?.argb).toBe(PRIORITY_FILL.CRITICAL.bg);
    expect((critical.font as ExcelJS.Font).color?.argb).toBe(PRIORITY_FILL.CRITICAL.fg);

    // Chaque priorité a SA couleur : deux priorités qui se ressemblent ne trient rien.
    const low = ws.getRow(3).getCell(col);
    expect((low.fill as ExcelJS.FillPattern).fgColor?.argb).toBe(PRIORITY_FILL.LOW.bg);
    expect((low.fill as ExcelJS.FillPattern).fgColor?.argb)
      .not.toBe((critical.fill as ExcelJS.FillPattern).fgColor?.argb);
  });

  it("donne une couleur distincte aux quatre priorités", () => {
    const backgrounds = Object.values(PRIORITY_FILL).map((p) => p.bg);
    expect(new Set(backgrounds).size).toBe(4);
  });

  it("pose un filtre et fige l'en-tête — un tableau de 69 lignes se lit autrement", async () => {
    const ws = await reopen([row()]);
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("accepte une liste vide : un export sans résultat reste un fichier valide", async () => {
    const ws = await reopen([]);
    expect(ws.rowCount).toBe(1);
    expect(ws.getRow(1).values).toEqual([undefined, ...EXPORT_COLUMNS]);
  });
});

describe("regulatoryExportFilename", () => {
  it("date le fichier pour ne pas écraser celui de la veille", () => {
    expect(regulatoryExportFilename(new Date(2026, 7, 12))).toBe("regulatory-2026-08-12.xlsx");
  });
});
