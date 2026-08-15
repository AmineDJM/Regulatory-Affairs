import { describe, it, expect } from "vitest";
import {
  parseAmount, parseQuantity, normalizeLines, receiptTotal,
  validateReceipt, receiptLabel, parseLinesField,
} from "./receipt";

describe("parseAmount", () => {
  it("lit ce qu'un humain tape : virgule décimale, espaces de milliers", () => {
    expect(parseAmount("1 250,50")).toBe(1250.5);
    expect(parseAmount("12000")).toBe(12000);
    expect(parseAmount(340)).toBe(340);
  });

  it("rend null plutôt que NaN — un NaN contamine le total en silence", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe("parseQuantity", () => {
  it("retombe sur 1 : un achat sans quantité reste un achat", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("")).toBe(1);
    expect(parseQuantity("0")).toBe(1);
    expect(parseQuantity("-2")).toBe(1);
  });
});

describe("normalizeLines", () => {
  it("garde l'article, la quantité et le montant", () => {
    expect(normalizeLines([{ articleId: "a1", label: "Ramette A4", quantity: "5", amount: "3 500" }])).toEqual([
      { articleId: "a1", label: "Ramette A4", quantity: 5, amount: 3500, budgetCategoryId: null },
    ]);
  });

  it("laisse tomber la ligne vide — c'est du bruit de formulaire, pas une erreur à signaler", () => {
    const lines = normalizeLines([
      { label: "Café", amount: "1200" },
      { label: "   ", amount: "" },
      { articleId: null, label: "", quantity: "2" },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe("Café");
  });

  it("retient une ligne NOMMÉE même à zéro dinar — un article offert figure sur le ticket", () => {
    expect(normalizeLines([{ label: "Échantillon offert", amount: "0" }])).toHaveLength(1);
  });

  it("refuse un montant négatif — un ticket ne rembourse pas", () => {
    expect(normalizeLines([{ label: "X", amount: "-500" }])[0].amount).toBe(0);
  });

  it("accepte un article du catalogue sans libellé saisi (le nom viendra du catalogue)", () => {
    expect(normalizeLines([{ articleId: "a1", label: "", amount: "100" }])).toHaveLength(1);
  });
});

describe("receiptTotal", () => {
  it("additionne les lignes — c'est la SEULE source du montant de la dépense", () => {
    const lines = normalizeLines([
      { label: "Ramette A4", quantity: "5", amount: "3500" },
      { label: "Toner", quantity: "1", amount: "8900" },
      { label: "Café", quantity: "2", amount: "1200" },
    ]);
    expect(receiptTotal(lines)).toBe(13600);
  });

  it("arrondit au centime plutôt que de traîner des flottants", () => {
    expect(receiptTotal(normalizeLines([{ label: "a", amount: "0.1" }, { label: "b", amount: "0.2" }]))).toBe(0.3);
  });

  it("vaut zéro sans ligne, pas NaN", () => {
    expect(receiptTotal([])).toBe(0);
  });
});

describe("validateReceipt", () => {
  it("refuse un ticket sans article, en disant quoi faire", () => {
    const r = validateReceipt([]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/au moins un article/i);
  });

  it("refuse une ligne SANS DÉSIGNATION et dit LAQUELLE", () => {
    const r = validateReceipt([
      { articleId: null, label: "Café", quantity: 1, amount: 500, budgetCategoryId: null },
      { articleId: null, label: "", quantity: 1, amount: 2300, budgetCategoryId: null },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Ligne 2/);
  });

  it("refuse un total nul : une dépense de 0 DZD fausse la lecture du budget", () => {
    const r = validateReceipt(normalizeLines([{ label: "Échantillon", amount: "0" }]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/total du ticket est nul/i);
  });

  it("accepte un ticket nommé et chiffré", () => {
    expect(validateReceipt(normalizeLines([{ label: "Café", amount: "1200" }])).ok).toBe(true);
  });
});

describe("receiptLabel", () => {
  const lines = normalizeLines([
    { label: "Ramette A4", amount: "3500" },
    { label: "Toner", amount: "8900" },
    { label: "Café", amount: "1200" },
    { label: "Sucre", amount: "400" },
  ]);

  it("respecte le libellé écrit à la main", () => {
    expect(receiptLabel(lines, "Courses du 12 août")).toBe("Courses du 12 août");
  });

  it("résume le ticket quand rien n'est écrit, et abrège au-delà de trois articles", () => {
    expect(receiptLabel(lines)).toBe("Ramette A4, Toner, Café +1 autre");
    expect(receiptLabel(lines.slice(0, 2))).toBe("Ramette A4, Toner");
  });

  it("ne rend jamais une chaîne vide — une dépense sans nom est illisible dans un budget", () => {
    expect(receiptLabel([], "   ")).toBe("Dépense");
  });
});

describe("parseLinesField", () => {
  it("décode le champ JSON du formulaire", () => {
    const lines = parseLinesField(JSON.stringify([{ articleId: "a1", label: "Café", quantity: 2, amount: 1200 }]));
    expect(lines).toEqual([{ articleId: "a1", label: "Café", quantity: 2, amount: 1200, budgetCategoryId: null }]);
  });

  it("rend un tableau vide sur une saisie illisible — la validation dira mieux qu'un défaut de format", () => {
    expect(parseLinesField("{pas du json")).toEqual([]);
    expect(parseLinesField('{"pas":"un tableau"}')).toEqual([]);
    expect(parseLinesField("")).toEqual([]);
    expect(parseLinesField(null)).toEqual([]);
  });
});
