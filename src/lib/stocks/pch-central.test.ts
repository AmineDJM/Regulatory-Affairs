import { describe, it, expect } from "vitest";
import { ageEnJours, analyserCollage, cleReleve, couvertureEnMois, decouperLigne, estCleReleve, estPerime, lireNombre, reconnaitre } from "./pch-central";

const PRODUITS = [
  { id: "daru", noms: ["Darunavir 600 mg", "Darunavir", "PRZ-600"] },
  { id: "ralt", noms: ["Raltégravir 400 mg", "Raltegravir"] },
  { id: "dolu", noms: ["Dolutégravir 50 mg", "Dolutegravir"] },
];

describe("stock PCH central — le collage (Excel, mail)", () => {
  it("lit les nombres à la française et à l'anglaise, jamais une décimale", () => {
    expect(lireNombre("1 540")).toBe(1540);
    expect(lireNombre("1.540")).toBe(1540);
    expect(lireNombre("1,540")).toBe(1540);
    expect(lireNombre("300")).toBe(300);
    expect(lireNombre("12,5")).toBeNull();
    expect(lireNombre("abc")).toBeNull();
  });

  it("découpe une ligne Excel (tabulations) et une ligne de mail", () => {
    expect(decouperLigne("Darunavir 600 mg\tPRZ\t1 540")).toEqual({ libelle: "Darunavir 600 mg PRZ", quantite: 1540 });
    expect(decouperLigne("Raltégravir 400 mg ....... 2 100 boîtes")).toEqual({ libelle: "Raltégravir 400 mg", quantite: 2100 });
    expect(decouperLigne("Dolutégravir 50 mg ; 4200")).toEqual({ libelle: "Dolutégravir 50 mg", quantite: 4200 });
  });

  it("reconnaît nos produits sans accent ni casse ; deux candidats à égalité = la personne tranche", () => {
    expect(reconnaitre("RALTEGRAVIR 400 MG", PRODUITS)).toEqual({ productId: "ralt", qualite: "exact" });
    expect(reconnaitre("Darunavir 600 mg cp pell", PRODUITS)).toEqual({ productId: "daru", qualite: "approche" });
    expect(reconnaitre("Paracétamol", PRODUITS).qualite).toBe("aucun");
    expect(reconnaitre("x", [{ id: "a", noms: ["Abc 1"] }, { id: "b", noms: ["Abc 1"] }]).qualite).toBe("aucun");
    expect(reconnaitre("Abc 1", [{ id: "a", noms: ["Abc 1"] }, { id: "b", noms: ["abc 1"] }]).qualite).toBe("ambigu");
  });

  it("le collage écarte les en-têtes et les lignes vides", () => {
    const l = analyserCollage("Produit\tQuantité\n\nDarunavir 600 mg\t300\nInconnu\t12\n", PRODUITS);
    expect(l.map((x) => [x.productId, x.quantite])).toEqual([["daru", 300], [null, 12]]);
  });
});

describe("stock PCH central — relevés, fraîcheur, couverture", () => {
  it("un relevé est identifié par la date du mail", () => {
    expect(cleReleve("2026-10-08T00:00:00.000Z")).toBe("2026-10-08");
    expect(estCleReleve("2026-10-08")).toBe(true);
    expect(estCleReleve("../x")).toBe(false);
  });
  it("au-delà de 30 jours, un relevé vieillit", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(ageEnJours("2026-09-01T12:00:00Z", now)).toBe(37);
    expect(estPerime(37)).toBe(true);
    expect(estPerime(30)).toBe(false);
    expect(estPerime(null)).toBe(false);
  });
  it("la couverture attend la consommation : sans elle, « — »", () => {
    expect(couvertureEnMois(2740, null)).toBeNull();
    expect(couvertureEnMois(2740, 1080)).toBe(2.5);
  });
});
