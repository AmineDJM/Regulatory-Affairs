import { describe, expect, it } from "vitest";
import { codeDirection, DIRECTIONS_PAR_DEFAUT, lireLieu, stockDeLaChaine, valeurLieu } from "./pch-central";
import { lieuDeLOnglet, lireReleveFichier, quantiteDeCellule } from "./pch-releve-fichier";

describe("les lieux d'un relevé PCH", () => {
  it("le code d'une direction régionale s'écrit d'une seule façon", () => {
    expect(codeDirection(" DRBe ")).toBe("DRBE");
    expect(codeDirection("dr-a")).toBe("DRA");
    expect(codeDirection("DR")).toBeNull();
    expect(codeDirection("Hôpital")).toBeNull();
    expect(codeDirection(null)).toBeNull();
    expect(DIRECTIONS_PAR_DEFAUT).toEqual(["DRA", "DRB", "DRBE", "DRC", "DRO", "DRTAM"]);
  });

  it("un lieu se lit et s'écrit sans perte : PCH centrale, DR, annexe", () => {
    expect(lireLieu("")).toEqual({ type: "CENTRAL" });
    expect(lireLieu("dr:DRO")).toEqual({ type: "DR", code: "DRO" });
    expect(lireLieu("annex:abc")).toEqual({ type: "ANNEX", annexId: "abc" });
    expect(lireLieu("dr:n'importe quoi")).toBeNull();
    expect(lireLieu("zzz")).toBeNull();
    for (const v of ["", "dr:DRTAM", "annex:xyz"]) expect(valeurLieu(lireLieu(v)!)).toBe(v);
  });

  it("la chaîne = PCH central + directions + hôpitaux ; rien de connu → null (jamais 0)", () => {
    expect(stockDeLaChaine([300, 1540, 900])).toBe(2740);
    expect(stockDeLaChaine([null, 1540, undefined])).toBe(1540);
    expect(stockDeLaChaine([null, null, null])).toBeNull();
  });
});

describe("le relevé de stock PCH en fichier", () => {
  it("une ligne par produit et par lieu : code PCH, désignation, stock, colonne ANNEXE", () => {
    const l = lireReleveFichier([{
      nom: "Stock",
      lignes: [
        ["Relevé de stock au 30/09/2026"],
        ["CODE_PRO", "DESI_PRO", "ANNEXE", "STOCK"],
        [1203, "DARUNAVIR 600MG B/60", "DRO", 1540],
        [1203, "DARUNAVIR 600MG B/60", "DRBe", "2 100"],
        [1544, "RALTEGRAVIR 400MG B/60", "PCH", 300],
        [null, null, null, null],
      ],
    }]);
    expect(l).toHaveLength(3);
    expect(l[0]).toMatchObject({ poste: 1203, libelle: "DARUNAVIR 600MG B/60", quantite: 1540, lieu: "DRO" });
    expect(l[1]).toMatchObject({ quantite: 2100, lieu: "DRBE" });
    expect(l[2]).toMatchObject({ poste: 1544, quantite: 300, lieu: "CENTRAL" });
  });

  it("un tableau large : une colonne par lieu, les cases vides écartées", () => {
    const l = lireReleveFichier([{
      nom: "Feuil1",
      lignes: [["Désignation", "PCH", "DRA", "DRB", "DRTAM"], ["Darunavir 600 mg", 100, 20, null, 0]],
    }]);
    expect(l.map((x) => [x.lieu, x.quantite])).toEqual([["CENTRAL", 100], ["DRA", 20], ["DRTAM", 0]]);
  });

  it("un onglet par direction : son nom donne le lieu des lignes sans colonne de lieu", () => {
    expect(lieuDeLOnglet("DRO")).toBe("DRO");
    expect(lieuDeLOnglet("Stock DRTAM")).toBe("DRTAM");
    expect(lieuDeLOnglet("PCH")).toBe("CENTRAL");
    expect(lieuDeLOnglet("Feuil1")).toBeNull();
    const l = lireReleveFichier([
      { nom: "DRO", lignes: [["Produit", "Qté stock"], ["Darunavir", 50]] },
      { nom: "Feuil2", lignes: [["Produit", "Qté stock"], ["Darunavir", 70]] },
    ]);
    expect(l.map((x) => x.lieu)).toEqual(["DRO", null]);
  });

  it("une quantité illisible ou négative n'est pas un zéro : elle reste vide", () => {
    expect(quantiteDeCellule("1 540")).toBe(1540);
    expect(quantiteDeCellule(0)).toBe(0);
    expect(quantiteDeCellule(-4)).toBeNull();
    expect(quantiteDeCellule("n/d")).toBeNull();
    expect(quantiteDeCellule(null)).toBeNull();
  });

  it("un fichier sans en-tête reconnu ne donne aucune ligne", () => {
    expect(lireReleveFichier([{ nom: "x", lignes: [["a", "b"], [1, 2]] }])).toEqual([]);
  });
});
