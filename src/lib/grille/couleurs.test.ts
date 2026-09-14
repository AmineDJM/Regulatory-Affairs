import { describe, it, expect } from "vitest";
import { COULEURS_CELLULE, estCouleurCellule, libelleCouleur, cleCellule, lireCleCellule } from "./couleurs";

describe("La palette d'une cellule — un vocabulaire fermé", () => {
  it("n'accepte que ses clés, jamais un code libre", () => {
    expect(estCouleurCellule("jaune")).toBe(true);
    expect(estCouleurCellule("#ffff00")).toBe(false);
    expect(estCouleurCellule("bg-yellow-200")).toBe(false);
    expect(estCouleurCellule("")).toBe(false);
    expect(estCouleurCellule(null)).toBe(false);
  });

  it("chaque clé est unique et porte un libellé lisible", () => {
    const cles = COULEURS_CELLULE.map((c) => c.cle);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of COULEURS_CELLULE) expect(libelleCouleur(c.cle).length).toBeGreaterThan(0);
  });

  it("la clé d'une cellule nomme la ligne et le champ", () => {
    expect(cleCellule("d1", "wilaya")).toBe("d1:wilaya");
  });
});

describe("cleCellule / lireCleCellule — joindre et couper au même endroit", () => {
  it("lire(joindre(x)) rend x, colonne à deux points comprise", () => {
    expect(lireCleCellule(cleCellule("cmt123", "wilaya"))).toEqual({ id: "cmt123", field: "wilaya" });
    // La colonne est TOUT ce qui suit le premier séparateur : une clé de colonne sur mesure peut en porter.
    expect(lireCleCellule(cleCellule("cmt123", "c_a:b"))).toEqual({ id: "cmt123", field: "c_a:b" });
  });

  it("rend null sur tout ce qui n'a pas la forme <ligne>:<colonne> — on ne devine pas une ligne", () => {
    expect(lireCleCellule("cmt123")).toBeNull();
    expect(lireCleCellule(":wilaya")).toBeNull();
    expect(lireCleCellule("cmt123:")).toBeNull();
    expect(lireCleCellule("  :  ")).toBeNull();
    expect(lireCleCellule("")).toBeNull();
  });
});
