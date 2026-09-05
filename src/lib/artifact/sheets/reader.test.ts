import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { lireClasseur, lireWorkbookXml } from "@/lib/artifact/sheets/reader";
import { feuilleParNom, lireCellule } from "@/lib/artifact/sheets/model";

async function classeurDeTest(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const v = wb.addWorksheet("Ventes");
  v.addRow(["Produit", "Qté", "PU", "Total"]);
  v.addRow(["A", 2, 100, { formula: "B2*C2", result: 200 }]);
  // Une formule PARTAGÉE : la maîtresse en D3, l'esclave en D4 (c'est ainsi qu'Excel écrit une recopie).
  v.addRow(["B", 3, 50, { formula: "B3*C3", result: 150 }]);
  v.addRow(["C", 4, 25, { sharedFormula: "D3", result: 100 }]);
  v.addRow(["Total", null, null, { formula: "SUM(D2:D4)", result: 450 }]);
  v.getCell("E2").value = new Date(Date.UTC(2026, 8, 5));
  v.getCell("E2").numFmt = "dd/mm/yyyy";
  v.getCell("F2").value = { error: "#DIV/0!" } as ExcelJS.CellErrorValue;
  const s = wb.addWorksheet("Synthèse");
  s.addRow(["Total ventes", { formula: "Ventes!D5", result: 450 }]);
  s.addRow(["Part TVA", { formula: "IFERROR(Ventes!D5*TauxTVA,0)", result: 85.5 }]);
  const cachee = wb.addWorksheet("Param");
  cachee.state = "hidden";
  cachee.addRow(["TVA", 0.19]);
  wb.definedNames.add("Param!$B$1", "TauxTVA");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("le lecteur à grande échelle", () => {
  it("lit valeurs, types, formules (partagées traduites), dates, erreurs, feuilles masquées et noms définis", async () => {
    const octets = await classeurDeTest();
    const c = await lireClasseur(octets);
    expect(c.feuilles.map((f) => f.nom)).toEqual(["Ventes", "Synthèse", "Param"]);
    const ventes = feuilleParNom(c, "Ventes")!;
    expect(lireCellule(ventes, 2, 4)).toMatchObject({ f: "B2*C2", v: 200, t: "n" });
    expect(lireCellule(ventes, 4, 4)).toMatchObject({ f: "B4*C4", v: 100 });
    expect(lireCellule(ventes, 5, 4)).toMatchObject({ f: "SUM(D2:D4)", v: 450 });
    expect(lireCellule(ventes, 1, 1)).toMatchObject({ v: "Produit", t: "s", f: null });
    expect(lireCellule(ventes, 2, 5)?.t).toBe("d");
    expect(lireCellule(ventes, 2, 6)).toMatchObject({ t: "e", v: "#DIV/0!" });
    expect(ventes.lignes).toBe(5);
    expect(ventes.colonnes).toBe(6);
    expect(feuilleParNom(c, "Param")?.masquee).toBe(true);
    expect(c.noms).toEqual([{ nom: "TauxTVA", refersTo: "Param!$B$1", feuille: null }]);
    expect(c.limites[0]).toMatch(/non lus/);
    const synth = feuilleParNom(c, "Synthèse")!;
    expect(lireCellule(synth, 2, 2)?.f).toBe("IFERROR(Ventes!D5*TauxTVA,0)");
  });

  it("relit l'en-tête du classeur : ordre des feuilles, masquées, noms", async () => {
    const e = lireWorkbookXml(await classeurDeTest());
    expect(e.feuilles).toEqual(["Ventes", "Synthèse", "Param"]);
    expect([...e.masquees]).toEqual(["Param"]);
    expect(e.noms[0].nom).toBe("TauxTVA");
  });

  it("s'arrête au plafond de cellules et le dit", async () => {
    const c = await lireClasseur(await classeurDeTest(), { maxCellules: 5 });
    expect(c.limites.some((l) => /arrêtée à 5 cellules/.test(l))).toBe(true);
  });
});

describe("la fidélité du lecteur natif — ce qu'ExcelJS perdait", () => {
  it("garde les résultats 0, « », FAUX et les erreurs des formules, les chaînes en ligne et le texte enrichi", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("F");
    ws.getCell("A1").value = { formula: "1-1", result: 0 };
    ws.getCell("A2").value = { formula: "\"\"", result: "" };
    ws.getCell("A3").value = { formula: "1>2", result: false };
    ws.getCell("A4").value = { formula: "1/0", result: { error: "#DIV/0!" } as ExcelJS.CellErrorValue };
    ws.getCell("A5").value = { formula: "Inconnue!A1", result: { error: "#REF!" } as ExcelJS.CellErrorValue };
    ws.getCell("A6").value = { richText: [{ text: "Gras", font: { bold: true } }, { text: " et normal" }] };
    ws.getCell("A7").value = true;
    ws.getCell("A8").value = "Sétif — Béjaïa « ok » & <fin>";
    ws.getCell("A9").value = { formula: "\"a\"&\"b\"", result: "ab" };
    const c = await lireClasseur(Buffer.from(await wb.xlsx.writeBuffer()));
    const f = c.feuilles[0];
    expect(lireCellule(f, 1, 1)).toMatchObject({ f: "1-1", v: 0, t: "n" });
    expect(lireCellule(f, 2, 1)).toMatchObject({ f: "\"\"", v: "", t: "s" });
    expect(lireCellule(f, 3, 1)).toMatchObject({ f: "1>2", v: false, t: "b" });
    expect(lireCellule(f, 4, 1)).toMatchObject({ f: "1/0", v: "#DIV/0!", t: "e" });
    expect(lireCellule(f, 5, 1)).toMatchObject({ f: "Inconnue!A1", v: "#REF!", t: "e" });
    expect(lireCellule(f, 6, 1)).toMatchObject({ v: "Gras et normal", t: "s" });
    expect(lireCellule(f, 7, 1)).toMatchObject({ v: true, t: "b" });
    expect(lireCellule(f, 8, 1)).toMatchObject({ v: "Sétif — Béjaïa « ok » & <fin>", t: "s" });
    expect(lireCellule(f, 9, 1)).toMatchObject({ f: "\"a\"&\"b\"", v: "ab", t: "s" });
  });

  it("ne coupe jamais un caractère accentué, même sur cent mille cellules en flux", async () => {
    // Des textes multi-octets à chaque cellule : n'importe quel découpage de tampon tombe au milieu
    // d'un « é » des centaines de fois. Le décodeur en flux doit rendre chaque texte intact.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Villes");
    const villes = ["Sétif", "Béjaïa", "Tébessa", "Tizi Ouzou — Kabylie", "Ghardaïa", "Aïn Témouchent"];
    for (let r = 1; r <= 20_000; r++) ws.addRow([r, villes[r % villes.length], `Réf n°${r} – été`]);
    const c = await lireClasseur(Buffer.from(await wb.xlsx.writeBuffer()));
    const f = c.feuilles[0];
    let abimes = 0;
    for (let r = 1; r <= 20_000; r++) {
      if (lireCellule(f, r, 2)?.v !== villes[r % villes.length]) abimes += 1;
      if (lireCellule(f, r, 3)?.v !== `Réf n°${r} – été`) abimes += 1;
    }
    expect(abimes).toBe(0);
    expect(f.cellules.size).toBe(60_000);
  });
});
