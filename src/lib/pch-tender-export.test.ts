import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildTenderWorkbook, tenderExportFilename, boxesNeeded, concentrationLabel, type TenderExportLine } from "./pch-tender-export";

/**
 * Le tableau Excel EST le livrable de la réponse à un appel d'offres : c'est ce fichier que
 * l'on remplit et que l'on remet. S'il ment sur une quantité, sur le nombre de boîtes ou sur
 * l'unité demandée, l'offre est fausse. D'où ces tests.
 */

const line = (over: Partial<TenderExportLine> = {}): TenderExportLine => ({
  designation: "AMOXICILLINE 1G INJECTABLE", dci: "AMOXICILLINE", dosage: "1 g", form: "Injectable",
  unitLabel: "flacon", quantityUnits: 10_000, unitsPerBox: 50,
  refPriceDzd: 120, refPriceSource: "Réception PCH 2025 — AMOXICILLINE INJ 1G",
  haveProduct: true, ourProduct: "AMOXY 1G · REG-042", unitPriceDzd: 110,
  registeredNomenclature: true, registeredOurs: true, status: "PENDING",
  marketEstimateDzd: 292_291_177, competitorCount: 2, marketOrigin: "LOCAL",
  marketVillePct: 0, marketHopitalPct: 100, marketHhi: 9931,
  competitorsTop: "SAIDAL 99 % · ANNEXE ALGER 0 %", note: null,
  ...over,
});

const header = { reference: "AO-2026-014", title: "Anti-infectieux", buyer: "PCH", submissionDeadline: "2026-09-30T00:00:00.000Z" };

function sheet(buf: Buffer, name: string): unknown[][] {
  const wb = XLSX.read(buf, { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }) as unknown[][];
}

describe("Appel d'offres PCH — nombre de boîtes à fournir", () => {
  it("arrondit au SUPÉRIEUR : on ne livre pas une demi-boîte", () => {
    expect(boxesNeeded(10_000, 50)).toBe(200);
    expect(boxesNeeded(101, 50)).toBe(3);
    expect(boxesNeeded(1, 50)).toBe(1);
  });

  it("reste vide quand le conditionnement est inconnu — plutôt qu'un chiffre inventé", () => {
    expect(boxesNeeded(10_000, null)).toBe("");
    expect(boxesNeeded(10_000, 0)).toBe("");
    expect(boxesNeeded(0, 50)).toBe("");
  });
});

describe("Appel d'offres PCH — lecture de la concentration", () => {
  it("traduit l'indice en mot, car c'est le mot qui se lit", () => {
    expect(concentrationLabel(9931)).toBe("Concentré");
    expect(concentrationLabel(2000)).toBe("Modéré");
    expect(concentrationLabel(800)).toBe("Fragmenté");
    expect(concentrationLabel(null)).toBe("");
  });
});

describe("Appel d'offres PCH — le classeur Excel", () => {
  it("produit les deux feuilles attendues", () => {
    const wb = XLSX.read(buildTenderWorkbook(header, [line()]), { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Produits demandés", "Analyse de marché"]);
  });

  it("porte la NATURE de l'unité, la quantité et les boîtes à fournir", () => {
    const rows = sheet(buildTenderWorkbook(header, [line()]), "Produits demandés");
    const head = rows[4] as string[];
    const data = rows[5] as (string | number)[];
    expect(head).toContain("Unité demandée");
    expect(data[head.indexOf("Unité demandée")]).toBe("flacon");
    expect(data[head.indexOf("Quantité (unités)")]).toBe(10_000);
    expect(data[head.indexOf("Boîtes à fournir")]).toBe(200);
  });

  it("calcule la valeur du marché au prix de référence (prix × quantité)", () => {
    const rows = sheet(buildTenderWorkbook(header, [line()]), "Produits demandés");
    const head = rows[4] as string[];
    const data = rows[5] as (string | number)[];
    expect(data[head.indexOf("Valeur du marché au prix de réf. (DZD)")]).toBe(1_200_000);
  });

  it("n'invente pas de valeur quand le prix de référence manque", () => {
    const rows = sheet(buildTenderWorkbook(header, [line({ refPriceDzd: null })]), "Produits demandés");
    const head = rows[4] as string[];
    const data = rows[5] as (string | number)[];
    expect(data[head.indexOf("Valeur du marché au prix de réf. (DZD)")] ?? "").toBe("");
  });

  it("dit en clair si le marché est fabriqué localement ou importé", () => {
    const buf = buildTenderWorkbook(header, [line({ marketOrigin: "LOCAL" }), line({ marketOrigin: "IMPORT" }), line({ marketOrigin: "MIXTE" })]);
    const rows = sheet(buf, "Analyse de marché");
    const head = rows[0] as string[];
    const col = head.indexOf("Production");
    expect((rows[1] as string[])[col]).toBe("Fabriqué localement");
    expect((rows[2] as string[])[col]).toBe("Importé");
    expect((rows[3] as string[])[col]).toBe("Local et importé");
  });

  it("reporte le partage ville / hôpital et les principaux acteurs", () => {
    const rows = sheet(buildTenderWorkbook(header, [line()]), "Analyse de marché");
    const head = rows[0] as string[];
    const data = rows[1] as (string | number)[];
    expect(data[head.indexOf("Part hôpital (%)")]).toBe(100);
    expect(data[head.indexOf("Concentration")]).toBe("Concentré");
    expect(String(data[head.indexOf("Principaux acteurs")])).toContain("SAIDAL");
  });

  it("exporte un appel d'offres encore vide sans planter", () => {
    const wb = XLSX.read(buildTenderWorkbook(header, []), { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(2);
  });

  it("assainit le nom de fichier", () => {
    expect(tenderExportFilename("AO-2026-014")).toMatch(/^appel-offres-AO-2026-014-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(tenderExportFilename("AO/2026\\014 *?")).not.toMatch(/[/\\*?]/);
  });
});
