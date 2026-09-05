import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { comparerClasseurs } from "@/lib/artifact/sheets/diff";
import { lireClasseur } from "@/lib/artifact/sheets/reader";

/**
 * LA COMPARAISON — sur deux versions d'un même classeur, où la seconde INSÈRE une ligne au milieu
 * (ce qui décale toutes les formules en dessous), modifie une valeur, écrase une formule, change
 * une formule, ajoute une feuille et déplace un nom défini. Ce qu'on exige : les décalages sont
 * INVISIBLES, et chacune des six vraies modifications est trouvée, une fois, à sa place.
 */
async function version(n: 1 | 2): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const v = wb.addWorksheet("Ventes");
  v.addRow(["Produit", "Qté", "PU", "Total"]);
  const lignes: (string | number)[][] = [["A", 2, 100], ["B", 3, 50], ["C", 4, 25], ["D", 5, 10], ["E", 6, 5]];
  if (n === 2) lignes.splice(2, 0, ["Nouveau", 7, 30]); // insérée en ligne 4
  lignes.forEach((l, i) => {
    const r = i + 2;
    const [nom, q, pu] = l;
    let qte = q as number;
    if (n === 2 && nom === "D") qte = 55; // valeur modifiée
    const total = n === 2 && nom === "E" ? 30 : { formula: `B${r}*C${r}`, result: qte * (pu as number) }; // E : formule écrasée
    v.addRow([nom, qte, pu, total]);
  });
  const fin = lignes.length + 2;
  v.getCell(`D${fin}`).value = { formula: n === 1 ? `SUM(D2:D${fin - 1})` : `SUM(D2:D${fin - 1})*1.19`, result: 0 }; // formule modifiée
  if (n === 2) wb.addWorksheet("Synthèse").addRow(["Total", { formula: "Ventes!D9", result: 0 }]);
  const p = wb.addWorksheet("Param");
  p.addRow(["TVA", 0.19]);
  p.addRow(["TVA réduite", 0.09]);
  wb.definedNames.add(n === 1 ? "Param!$B$1" : "Param!$B$2", "TauxTVA");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("la comparaison sémantique de classeurs", () => {
  it("voit la ligne insérée et les vraies modifications, pas les décalages", async () => {
    const a = await lireClasseur(await version(1));
    const b = await lireClasseur(await version(2));
    const c = comparerClasseurs(a, b);
    const ou = (g: string) => c.changements.filter((x) => x.genre === g).map((x) => `${x.feuille}!${x.cellule}`);
    expect(ou("LIGNE_INSEREE")).toEqual(["Ventes!4:4"]);
    expect(ou("LIGNE_SUPPRIMEE")).toEqual([]);
    expect(ou("VALEUR_MODIFIEE")).toEqual(["Ventes!B6"]);
    expect(ou("FORMULE_ECRASEE")).toEqual(["Ventes!D7"]);
    expect(ou("FORMULE_MODIFIEE")).toEqual(["Ventes!D8"]);
    expect(ou("FEUILLE_AJOUTEE")).toEqual(["Synthèse!null"]);
    expect(ou("NOM_MODIFIE")).toEqual(["—!TauxTVA"]);
    // Le total de la ligne D (qté 5 → 55) change de résultat sans changer de formule.
    expect(ou("RESULTAT_MODIFIE")).toEqual(["Ventes!D6"]);
    expect(c.parGenre).toEqual({ LIGNE_INSEREE: 1, VALEUR_MODIFIEE: 1, FORMULE_ECRASEE: 1, FORMULE_MODIFIEE: 1, FEUILLE_AJOUTEE: 1, NOM_MODIFIE: 1, RESULTAT_MODIFIE: 1 });
    expect(c.changements[0].genre).toBe("FORMULE_ECRASEE"); // le plus grave d'abord
    expect(c.changements[0]).toMatchObject({ avant: "=B6*C6", apres: "30" });
    expect(c.resume).toMatch(/^7 changement\(s\) sur Ventes : 1 formule écrasée par une valeur ; 1 formule modifiée ; 1 ligne insérée/);
  });

  it("dit « aucune différence » entre un classeur et lui-même", async () => {
    const a = await lireClasseur(await version(1));
    const c = comparerClasseurs(a, a);
    expect(c.total).toBe(0);
    expect(c.resume).toMatch(/^Aucune différence/);
  });

  it("voit une ligne supprimée et plafonne les détails sans perdre le compte", async () => {
    const a = await lireClasseur(await version(2));
    const b = await lireClasseur(await version(1));
    const c = comparerClasseurs(a, b, { maxDetails: 3 });
    expect(c.parGenre.LIGNE_SUPPRIMEE).toBe(1);
    expect(c.parGenre.FEUILLE_SUPPRIMEE).toBe(1);
    expect(c.changements).toHaveLength(3);
    expect(c.total).toBe(7);
    expect(c.limites[0]).toMatch(/4 changement\(s\) non détaillé/);
  });
});
