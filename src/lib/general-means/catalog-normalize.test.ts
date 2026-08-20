import { describe, it, expect } from "vitest";
import {
  comparable, articleKey, normalizeArticleName, normalizeReference, normalizeSupplier,
  normalizeToCode, normalizeArticle, needsRewrite, describeRewrite,
  CATEGORY_ALIASES, UNIT_ALIASES,
} from "./catalog-normalize";
import { SUPPLY_CATEGORY, SUPPLY_UNIT } from "@/lib/labels";

const labels = { category: SUPPLY_CATEGORY, unit: SUPPLY_UNIT };

describe("normalizeArticleName — une seule façon d'écrire", () => {
  it("met une capitale en tête et le reste en minuscules", () => {
    expect(normalizeArticleName("STYLO BILLE BLEU")).toBe("Stylo bille bleu");
    expect(normalizeArticleName("stylo bille bleu")).toBe("Stylo bille bleu");
  });

  it("réduit les espaces multiples", () => {
    expect(normalizeArticleName("  Ramette   A4  ")).toBe("Ramette A4");
  });

  // « Cable hdmi » écrit « Câble Hdmi » serait pire que le désordre de départ : personne
  // n'écrit « Hdmi », et une liste qui invente une orthographe perd toute confiance.
  it("garde les SIGLES et les FORMATS en majuscules", () => {
    expect(normalizeArticleName("cable hdmi 2m")).toBe("Cable HDMI 2m");
    expect(normalizeArticleName("ramette a4 80g")).toBe("Ramette A4 80g");
    expect(normalizeArticleName("cle usb 32go")).toBe("Cle USB 32go");
    expect(normalizeArticleName("ecran lcd 24 pouces")).toBe("Ecran LCD 24 pouces");
  });

  it("ne capitalise pas les petits mots au milieu, mais bien en tête", () => {
    expect(normalizeArticleName("boite de trombones")).toBe("Boite de trombones");
    expect(normalizeArticleName("DE bureau")).toBe("De bureau");
  });

  it("normalise l'espacement autour des séparateurs", () => {
    expect(normalizeArticleName("Stylo bic-bleu")).toBe("Stylo bic - bleu");
    expect(normalizeArticleName("Stylo bic  -  bleu")).toBe("Stylo bic - bleu");
    expect(normalizeArticleName("Papier,carbone")).toBe("Papier, carbone");
  });

  it("laisse intacts les codes qui portent un chiffre", () => {
    expect(normalizeArticleName("Cartouche CF217A")).toBe("Cartouche CF217A");
  });

  // On NORMALISE, on ne TRADUIT pas : « Ramette » ne devient pas « Rame ». Décider du
  // vocabulaire à la place de celui qui a saisi transformerait un article en un autre.
  it("ne remplace JAMAIS un mot par un autre", () => {
    expect(normalizeArticleName("Ramette A4")).toBe("Ramette A4");
    expect(normalizeArticleName("Rame A4")).toBe("Rame A4");
  });

  it("une saisie vide reste vide, sans planter", () => {
    expect(normalizeArticleName("")).toBe("");
    expect(normalizeArticleName("   ")).toBe("");
  });
});

describe("articleKey — deux orthographes, un seul article", () => {
  it("rapproche ce qui ne diffère que par la casse, les accents et la ponctuation", () => {
    const k = articleKey("Ramette A4");
    expect(articleKey("RAMETTE  a4")).toBe(k);
    expect(articleKey("ramette-a4")).toBe(k);
    expect(articleKey("Ramette À4".replace("À", "A"))).toBe(k);
  });

  it("ne confond pas deux articles différents", () => {
    expect(articleKey("Ramette A4")).not.toBe(articleKey("Ramette A3"));
  });

  it("comparable retire accents, casse et ponctuation", () => {
    expect(comparable("Étiquettes (auto-collantes)")).toBe("etiquettes auto collantes");
  });
});

describe("normalizeReference — une référence est un CODE", () => {
  it("met en majuscules et colle les séparateurs", () => {
    expect(normalizeReference("hp - cf217a")).toBe("HP-CF217A");
    expect(normalizeReference("  hp cf217a ")).toBe("HP CF217A");
  });

  it("une référence absente reste absente", () => {
    expect(normalizeReference("")).toBeNull();
    expect(normalizeReference(null)).toBeNull();
  });
});

describe("normalizeToCode — ramener une saisie libre sur la liste fermée", () => {
  it("accepte le code, le libellé exact et les variantes usuelles", () => {
    expect(normalizeToCode("PAPETERIE", SUPPLY_CATEGORY, CATEGORY_ALIASES)).toBe("PAPETERIE");
    expect(normalizeToCode("papeterie", SUPPLY_CATEGORY, CATEGORY_ALIASES)).toBe("PAPETERIE");
    expect(normalizeToCode("Informatique & bureautique", SUPPLY_CATEGORY, CATEGORY_ALIASES)).toBe("INFORMATIQUE");
    expect(normalizeToCode("info", SUPPLY_CATEGORY, CATEGORY_ALIASES)).toBe("INFORMATIQUE");
    expect(normalizeToCode("pcs", SUPPLY_UNIT, UNIT_ALIASES)).toBe("PIECE");
    expect(normalizeToCode("Boîte", SUPPLY_UNIT, UNIT_ALIASES)).toBe("BOITE");
  });

  // Perdre une information parce qu'on ne sait pas la classer serait pire que la garder
  // imparfaite : l'inconnu est CONSERVÉ, pas écrasé.
  it("ce qui n'est pas reconnu est laissé tel quel", () => {
    expect(normalizeToCode("Matériel de laboratoire", SUPPLY_CATEGORY, CATEGORY_ALIASES))
      .toBe("Matériel de laboratoire");
  });

  it("une valeur absente reste absente", () => {
    expect(normalizeToCode("", SUPPLY_CATEGORY)).toBeNull();
    expect(normalizeToCode(null, SUPPLY_UNIT)).toBeNull();
  });
});

describe("normalizeArticle — l'article entier", () => {
  it("réécrit les cinq champs d'un coup", () => {
    expect(normalizeArticle(
      { name: "RAMETTE  a4 80g", category: "papeterie", unit: "ramette", reference: "xy - 12", supplierHint: "papeterie  du  centre" },
      labels,
    )).toEqual({
      name: "Ramette A4 80g",
      category: "PAPETERIE",
      unit: "RAME",
      reference: "XY-12",
      supplierHint: "Papeterie du centre",
    });
  });

  it("un article déjà propre ne change pas — et ne sera donc pas proposé", () => {
    const clean = { name: "Ramette A4", category: "PAPETERIE", unit: "RAME", reference: null, supplierHint: null };
    const after = normalizeArticle(clean, labels);
    expect(after).toEqual(clean);
    expect(needsRewrite(clean, after)).toBe(false);
  });

  it("needsRewrite repère le moindre écart", () => {
    const before = { name: "ramette a4", category: "PAPETERIE", unit: "RAME", reference: null, supplierHint: null };
    expect(needsRewrite(before, normalizeArticle(before, labels))).toBe(true);
  });
});

describe("describeRewrite — ce qu'on montre AVANT d'appliquer", () => {
  it("ne liste que les champs qui bougent, avec avant et après", () => {
    const before = { name: "ramette a4", category: "papeterie", unit: "RAME", reference: null, supplierHint: null };
    const lines = describeRewrite(before, normalizeArticle(before, labels));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("ramette a4 → Ramette A4");
    expect(lines[1]).toContain("papeterie → PAPETERIE");
  });

  it("un article déjà propre ne produit aucune ligne", () => {
    const clean = { name: "Ramette A4", category: "PAPETERIE", unit: "RAME", reference: null, supplierHint: null };
    expect(describeRewrite(clean, normalizeArticle(clean, labels))).toEqual([]);
  });
});

describe("normalizeSupplier", () => {
  it("écrit un fournisseur comme un libellé, sigles compris", () => {
    expect(normalizeSupplier("etablissements   HP algerie")).toBe("Etablissements HP algerie");
    expect(normalizeSupplier("")).toBeNull();
  });
});

describe("couverture — toute catégorie et toute unité de la plateforme se reconnaissent", () => {
  it("par leur code ET par leur libellé", () => {
    for (const [code, label] of Object.entries(SUPPLY_CATEGORY)) {
      expect(normalizeToCode(code, SUPPLY_CATEGORY, CATEGORY_ALIASES), code).toBe(code);
      expect(normalizeToCode(label, SUPPLY_CATEGORY, CATEGORY_ALIASES), label).toBe(code);
    }
    for (const [code, label] of Object.entries(SUPPLY_UNIT)) {
      expect(normalizeToCode(code, SUPPLY_UNIT, UNIT_ALIASES), code).toBe(code);
      expect(normalizeToCode(label, SUPPLY_UNIT, UNIT_ALIASES), label).toBe(code);
    }
  });
});
