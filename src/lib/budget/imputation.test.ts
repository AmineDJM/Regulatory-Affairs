import { describe, it, expect } from "vitest";
import { imputationsOf, consumptionByCategory, unclassifiedTotal, isFullyClassified } from "./imputation";

const sum = (l: { amount: number }[]) => Math.round(l.reduce((a, i) => a + i.amount, 0) * 100) / 100;

describe("Un ticket se répartit sans jamais perdre ni doubler un dinar", () => {
  it("classé article par article : chaque article dans sa catégorie", () => {
    const imps = imputationsOf({
      amount: 10_000,
      lines: [
        { amount: 6_000, budgetCategoryId: "papeterie" },
        { amount: 4_000, budgetCategoryId: "entretien" },
      ],
    });
    expect(imps).toHaveLength(2);
    expect(imps.find((i) => i.categoryId === "papeterie")?.amount).toBe(6_000);
    expect(imps.find((i) => i.categoryId === "entretien")?.amount).toBe(4_000);
  });

  it("deux articles de la MÊME catégorie font une seule imputation", () => {
    const imps = imputationsOf({
      amount: 900,
      lines: [
        { amount: 500, budgetCategoryId: "papeterie" },
        { amount: 400, budgetCategoryId: "papeterie" },
      ],
    });
    expect(imps).toEqual([{ categoryId: "papeterie", amount: 900 }]);
  });

  it("le RESTE non classé tombe dans la catégorie du ticket", () => {
    const imps = imputationsOf({
      amount: 10_000,
      budgetCategoryId: "divers",
      lines: [{ amount: 6_000, budgetCategoryId: "papeterie" }, { amount: 4_000 }],
    });
    expect(imps.find((i) => i.categoryId === "divers")?.amount).toBe(4_000);
    expect(sum(imps)).toBe(10_000);
  });

  it("le reste rejoint la catégorie du ticket quand elle est DÉJÀ servie par un article", () => {
    // Sinon la même catégorie apparaîtrait deux fois et l'écran afficherait deux lignes
    // identiques qu'il faudrait ré-additionner de tête.
    const imps = imputationsOf({
      amount: 1_000,
      budgetCategoryId: "papeterie",
      lines: [{ amount: 600, budgetCategoryId: "papeterie" }],
    });
    expect(imps).toEqual([{ categoryId: "papeterie", amount: 1_000 }]);
  });

  it("sans aucune catégorie, tout est « à classer » — jamais rangé au hasard", () => {
    const imps = imputationsOf({ amount: 3_200, lines: [{ amount: 3_200 }] });
    expect(imps).toEqual([{ categoryId: null, amount: 3_200 }]);
  });

  it("ticket sans détail, classé d'un bloc : une imputation du total", () => {
    expect(imputationsOf({ amount: 7_500, budgetCategoryId: "taxi" }))
      .toEqual([{ categoryId: "taxi", amount: 7_500 }]);
  });

  it("LA PROPRIÉTÉ QUI COMPTE : la somme des imputations = le montant de la dépense", () => {
    const cases = [
      { amount: 10_000, budgetCategoryId: "a", lines: [{ amount: 3_000, budgetCategoryId: "b" }, { amount: 2_000 }] },
      { amount: 999.99, lines: [{ amount: 0.99, budgetCategoryId: "b" }] },
      { amount: 500, budgetCategoryId: null, lines: [] },
      { amount: 1_234.56, budgetCategoryId: "c", lines: [{ amount: 1_234.56, budgetCategoryId: "c" }] },
    ];
    for (const c of cases) expect(sum(imputationsOf(c))).toBe(Math.round(c.amount * 100) / 100);
  });

  it("un détail qui DÉPASSE le justificatif ne consomme jamais plus que le payé", () => {
    // Saisie incohérente (correction en cours) : le budget reste borné au montant réel, sinon
    // une enveloppe se viderait pour de l'argent qui n'est jamais sorti.
    const imps = imputationsOf({
      amount: 1_000,
      budgetCategoryId: "divers",
      lines: [{ amount: 1_500, budgetCategoryId: "papeterie" }],
    });
    expect(imps).toEqual([{ categoryId: "papeterie", amount: 1_000 }]);
    expect(sum(imps)).toBe(1_000);
  });

  it("ignore une ligne à zéro ou négative plutôt que de fabriquer une imputation vide", () => {
    const imps = imputationsOf({
      amount: 800,
      budgetCategoryId: "divers",
      lines: [{ amount: 0, budgetCategoryId: "papeterie" }, { amount: -50, budgetCategoryId: "entretien" }],
    });
    expect(imps).toEqual([{ categoryId: "divers", amount: 800 }]);
  });
});

describe("Ce que la page Budgets additionne", () => {
  const expenses = [
    { amount: 10_000, budgetCategoryId: "divers", lines: [{ amount: 6_000, budgetCategoryId: "papeterie" }] },
    { amount: 5_000, budgetCategoryId: "papeterie" },
    { amount: 2_000 }, // pas classée du tout
  ];

  it("la consommation regroupe toutes les dépenses par catégorie", () => {
    const c = consumptionByCategory(expenses);
    expect(c.get("papeterie")).toBe(11_000);
    expect(c.get("divers")).toBe(4_000);
  });

  it("le non-classé n'entre dans AUCUNE enveloppe", () => {
    const c = consumptionByCategory(expenses);
    expect(c.has("")).toBe(false);
    expect([...c.values()].reduce((a, v) => a + v, 0)).toBe(15_000);
  });

  it("mais il est compté à part, pour qu'on le voie", () => {
    expect(unclassifiedTotal(expenses)).toBe(2_000);
  });

  it("dit dépense par dépense laquelle reste à classer", () => {
    expect(isFullyClassified(expenses[0])).toBe(true);
    expect(isFullyClassified(expenses[2])).toBe(false);
  });
});
