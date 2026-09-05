import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { auditerClasseur, resumerAudit, type CodeConstat } from "@/lib/artifact/sheets/audit";
import { construireGraphe } from "@/lib/artifact/sheets/graph";
import { recalculer } from "@/lib/artifact/sheets/evaluate";
import { lireClasseur } from "@/lib/artifact/sheets/reader";

/**
 * L'AUDIT, sur un classeur où l'on a PLANTÉ les défauts classiques d'un modèle financier — un par
 * un, à des adresses connues. Le test exige que chaque défaut soit trouvé À SON ADRESSE, et qu'un
 * classeur sain ne déclenche rien de grave : un audit qui crie partout n'est plus lu.
 */
async function classeur(opts: { sain?: boolean } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const v = wb.addWorksheet("Ventes");
  v.addRow(["Produit", "Qté", "PU", "Total", "Marge"]);
  for (let r = 2; r <= 10; r++) {
    const q = r * 3; const pu = 100 - r;
    const total = opts.sain || r !== 6 ? { formula: `B${r}*C${r}`, result: q * pu } : 999; // D6 : valeur en dur
    v.addRow([`P${r}`, q, pu, total]);
  }
  if (!opts.sain) {
    v.getCell("D3").value = { formula: "B3*C3", result: 777 }; // valeur enregistrée fausse
    v.getCell("D7").value = { formula: "B7*C7*1.19", result: 21 * 93 * 1.19 }; // incohérente + constante
    v.getCell("D11").value = { formula: "SUM(D2:D9)", result: 0 }; // oublie D10
    v.getCell("B12").value = "12"; // nombre en texte dans une colonne de nombres
    v.getCell("E2").value = { formula: "Inexistante!A1", result: { error: "#REF!" } as ExcelJS.CellErrorValue };
    v.getCell("F1").value = { formula: "F2+1", result: 1 };
    v.getCell("F2").value = { formula: "F1+1", result: 2 };
    v.getCell("G1").value = { formula: "TODAY()", result: 46270 };
    v.getCell("H1").value = { formula: "MACRO_MAISON(D2)", result: 5 };
    v.getCell("I1").value = { formula: "J1*2", result: 0 }; // J1 vide
  } else {
    let somme = 0;
    for (let r = 2; r <= 10; r++) somme += r * 3 * (100 - r);
    v.getCell("D11").value = { formula: "SUM(D2:D10)", result: somme }; // la VRAIE valeur : un 0 serait un écart réel
  }
  const p = wb.addWorksheet("Param");
  p.state = "hidden";
  p.addRow(["TVA", 0.19]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("l'audit d'un classeur", () => {
  it("trouve chaque défaut planté, à son adresse, avec sa preuve", async () => {
    const c = await lireClasseur(await classeur());
    const g = construireGraphe(c);
    const a = auditerClasseur(c, g, recalculer(c, g));
    const ou = (code: CodeConstat) => a.constats.filter((x) => x.code === code).map((x) => `${x.feuille}!${x.cellule}`);

    expect(ou("FORMULE_ECRASEE")).toEqual(["Ventes!D6"]);
    expect(ou("FORMULE_INCOHERENTE")).toEqual(["Ventes!D7"]);
    expect(ou("CONSTANTE_DANS_FORMULE")).toEqual(["Ventes!D7"]);
    expect(ou("PLAGE_TRONQUEE")).toEqual(["Ventes!D11"]);
    expect(ou("NOMBRE_EN_TEXTE")).toEqual(["Ventes!B12"]);
    expect(ou("FEUILLE_INCONNUE")).toEqual(["Ventes!E2"]);
    expect(ou("VALEUR_ERREUR")).toEqual(["Ventes!E2"]);
    expect(ou("REFERENCE_CIRCULAIRE")).toHaveLength(1);
    expect(ou("FONCTION_VOLATILE")).toEqual(["Ventes!G1"]);
    expect(ou("FONCTION_INCONNUE").length).toBeGreaterThanOrEqual(1);
    expect(ou("REFERENCE_VIDE")).toEqual(["Ventes!I1"]);
    expect(ou("FEUILLE_MASQUEE")).toEqual(["Param!—"]);
    // La valeur enregistrée fausse : D3 affiche 777, la formule donne 9×97 = 873. D6 (999 en dur)
    // n'est PAS un écart de recalcul : ce n'est pas une formule — c'est le constat FORMULE_ECRASEE.
    expect(ou("VALEUR_CACHEE_INCOHERENTE")).toContain("Ventes!D3");
    const d3 = a.constats.find((x) => x.code === "VALEUR_CACHEE_INCOHERENTE" && x.cellule === "D3")!;
    expect(d3.message).toBe("affiche 777, la formule donne 873");

    const ecrasee = a.constats.find((x) => x.code === "FORMULE_ECRASEE")!;
    expect(ecrasee.gravite).toBe("CRITIQUE");
    expect(ecrasee.suggestion).toContain("=B6*C6");
    const tronquee = a.constats.find((x) => x.code === "PLAGE_TRONQUEE")!;
    expect(tronquee.message).toContain("D10");
    expect(a.constats[0].gravite).toBe("CRITIQUE"); // trié par gravité
    expect(a.parGravite.CRITIQUE).toBe(2);
    expect(resumerAudit(a)).toMatch(/constat\(s\) — 2 critiques/);
  });

  it("ne crie pas sur un classeur sain : aucun constat critique ni haut", async () => {
    const c = await lireClasseur(await classeur({ sain: true }));
    const g = construireGraphe(c);
    const a = auditerClasseur(c, g, recalculer(c, g));
    expect(a.parGravite.CRITIQUE).toBe(0);
    expect(a.parGravite.HAUTE).toBe(0);
    // Seule reste la feuille masquée (information), et c'est voulu : elle existe.
    expect(Object.keys(a.parCode)).toEqual(["FEUILLE_MASQUEE"]);
  });

  it("plafonne les détails par code mais garde le compte exact", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("F");
    for (let r = 1; r <= 30; r++) ws.getCell(`A${r}`).value = { formula: `B${r}*1.19`, result: 0 };
    const c = await lireClasseur(Buffer.from(await wb.xlsx.writeBuffer()));
    const a = auditerClasseur(c, construireGraphe(c), null, { maxParCode: 5 });
    expect(a.parCode.CONSTANTE_DANS_FORMULE).toBe(30);
    expect(a.constats.filter((x) => x.code === "CONSTANTE_DANS_FORMULE")).toHaveLength(5);
    expect(a.total).toBeGreaterThanOrEqual(30);
  });
});
