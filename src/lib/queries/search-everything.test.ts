import { describe, it, expect } from "vitest";
import { strip, parseTerms, matchOf } from "./search-everything";

describe("search_everything — découpage et tolérance aux accents", () => {
  it("découpe en mots saillants (≥ 2 caractères, 6 au plus)", () => {
    expect(parseTerms("  la facture   de   1028 ")).toEqual(["la", "facture", "de", "1028"]);
    expect(parseTerms("a b c")).toEqual([]);
    expect(parseTerms("un deux trois quatre cinq six sept huit")).toHaveLength(6);
  });

  it("strip retire les accents sans toucher au reste", () => {
    expect(strip("Ténofovir")).toBe("Tenofovir");
    expect(strip("fontaine d'eau")).toBe("fontaine d'eau");
    expect(strip("Évènement Č")).toBe("Evenement C");
  });

  it("un terme accentué est cherché AVEC et SANS ses accents", () => {
    const clauses = matchOf(["ténofovir"], ["dci"]);
    expect(clauses).toHaveLength(1);
    const or = (clauses[0] as { OR: { dci: { contains: string } }[] }).OR;
    expect(or.map((c) => c.dci.contains)).toEqual(["ténofovir", "tenofovir"]);
  });

  it("un terme sans accent ne double pas ses clauses", () => {
    const clauses = matchOf(["pembro"], ["dci", "brandName"]);
    const or = (clauses[0] as { OR: unknown[] }).OR;
    // 2 champs × 1 variante — pas de doublon inutile qui gonflerait la requête.
    expect(or).toHaveLength(2);
  });

  it("chaque mot doit correspondre (ET des mots), chacun où il peut (OU des champs)", () => {
    const clauses = matchOf(["fontaine", "eau"], ["title", "reference"]);
    expect(clauses).toHaveLength(2);
    for (const c of clauses) expect((c as { OR: unknown[] }).OR).toHaveLength(2);
  });
});
