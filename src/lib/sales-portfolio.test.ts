import { describe, it, expect } from "vitest";
import { mergePortfolio, portfolioGammes, gammesLabel, byPosition, positionLabel, type PortfolioProduct } from "./sales-portfolio";

const p = (id: string, name: string, channel: PortfolioProduct["channel"], position = 1): PortfolioProduct => ({
  productId: id, name, code: null, channel, position, plannedVisits: 0, viaTeam: false,
});

/**
 * Ce portefeuille décide de ce qu'un délégué voit et peut sélectionner. Une erreur ici ne
 * plante rien : elle fait disparaître un produit qu'il porte, ou lui en propose un qui n'est
 * pas le sien.
 */

describe("mergePortfolio — le personnel prime sur l'équipe", () => {
  it("réunit les deux sources sans doublon", () => {
    const out = mergePortfolio([p("a", "Amoxil", "RETAIL")], [p("b", "Cardio", "HOSPITAL")]);
    expect(out.map((x) => x.productId).sort()).toEqual(["a", "b"]);
  });

  it("marque ce qui vient de l'équipe", () => {
    const out = mergePortfolio([p("a", "Amoxil", "RETAIL")], [p("b", "Cardio", "HOSPITAL")]);
    expect(out.find((x) => x.productId === "a")?.viaTeam).toBe(false);
    expect(out.find((x) => x.productId === "b")?.viaTeam).toBe(true);
  });

  it("un produit porté en propre ET par l'équipe reste PERSONNEL", () => {
    const out = mergePortfolio([p("a", "Amoxil", "RETAIL", 2)], [p("a", "Amoxil", "RETAIL", 2)]);
    expect(out).toHaveLength(1);
    expect(out[0].viaTeam).toBe(false);
  });

  it("ne rétrograde JAMAIS un produit en fusionnant — la meilleure priorité gagne", () => {
    const out = mergePortfolio([p("a", "Amoxil", "RETAIL", 3)], [p("a", "Amoxil", "RETAIL", 1)]);
    expect(out[0].position).toBe(1);
    expect(out[0].viaTeam).toBe(false);
  });

  it("une priorité d'équipe plus faible ne dégrade pas la priorité personnelle", () => {
    const out = mergePortfolio([p("a", "Amoxil", "RETAIL", 1)], [p("a", "Amoxil", "RETAIL", 3)]);
    expect(out[0].position).toBe(1);
  });

  it("trie par priorité puis par nom — l'ordre dans lequel on travaille", () => {
    const out = mergePortfolio(
      [p("c", "Zyrtec", "RETAIL", 2), p("a", "Amoxil", "RETAIL", 2), p("b", "Bactrim", "RETAIL", 1)],
      [],
    );
    expect(out.map((x) => x.name)).toEqual(["Bactrim", "Amoxil", "Zyrtec"]);
  });

  it("un portefeuille vide des deux côtés rend une liste vide, pas une erreur", () => {
    expect(mergePortfolio([], [])).toEqual([]);
  });
});

describe("portfolioGammes — un produit mixte couvre les DEUX", () => {
  it("déplie BOTH en ville et hôpital", () => {
    expect(portfolioGammes([{ channel: "BOTH" }])).toEqual(["RETAIL", "HOSPITAL"]);
  });

  it("ne rend que la gamme réellement portée", () => {
    expect(portfolioGammes([{ channel: "RETAIL" }])).toEqual(["RETAIL"]);
    expect(portfolioGammes([{ channel: "HOSPITAL" }])).toEqual(["HOSPITAL"]);
  });

  it("cumule les gammes de plusieurs produits", () => {
    expect(portfolioGammes([{ channel: "RETAIL" }, { channel: "HOSPITAL" }])).toEqual(["RETAIL", "HOSPITAL"]);
  });

  it("ordre stable : la ville d'abord", () => {
    expect(portfolioGammes([{ channel: "HOSPITAL" }, { channel: "RETAIL" }])).toEqual(["RETAIL", "HOSPITAL"]);
  });

  it("aucun produit : aucune gamme", () => {
    expect(portfolioGammes([])).toEqual([]);
    expect(gammesLabel([])).toBe("Aucune gamme");
  });

  it("libellés lisibles", () => {
    expect(gammesLabel([{ channel: "RETAIL" }])).toBe("Ville");
    expect(gammesLabel([{ channel: "HOSPITAL" }])).toBe("Hôpital");
    expect(gammesLabel([{ channel: "BOTH" }])).toBe("Ville et hôpital");
  });
});

describe("byPosition & positionLabel", () => {
  it("compte les produits par priorité, dans l'ordre", () => {
    expect(byPosition([p("a", "A", "RETAIL", 2), p("b", "B", "RETAIL", 1), p("c", "C", "RETAIL", 1)]))
      .toEqual([{ position: 1, count: 2 }, { position: 2, count: 1 }]);
  });

  it("borne les priorités aberrantes plutôt que d'afficher « P7 »", () => {
    expect(positionLabel(1)).toBe("P1");
    expect(positionLabel(3)).toBe("P3");
    expect(positionLabel(0)).toBe("P1");
    expect(positionLabel(9)).toBe("P3");
  });
});
