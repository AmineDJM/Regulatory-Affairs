import { describe, it, expect } from "vitest";
import {
  companyIdsFromRanges, restrictingRangeIds, productRangeWhere, canSeeProduct,
  buildRangeTree, describeAttachment, type RangeBearer,
} from "./product-ranges";

const ADV = "adventum";
const PHG = "pharmagene";

const bearer = (over: Partial<RangeBearer> = {}): RangeBearer => ({
  wholeGroup: false,
  fullCompanyIds: [],
  rangeGrants: [],
  ...over,
});

describe("companyIdsFromRanges", () => {
  it("remonte l'entité de chaque gamme, sans doublon et dans l'ordre rencontré", () => {
    expect(companyIdsFromRanges([
      { rangeId: "r1", companyId: ADV },
      { rangeId: "r2", companyId: ADV },
      { rangeId: "r3", companyId: PHG },
    ])).toEqual([ADV, PHG]);
  });

  it("ignore une gamme sans entité plutôt que de rendre une chaîne vide", () => {
    expect(companyIdsFromRanges([{ rangeId: "r1", companyId: "" }])).toEqual([]);
  });
});

describe("restrictingRangeIds — règle 2 : on ne retire pas un droit donné plus haut", () => {
  it("une gamme dont l'entité est ouverte EN ENTIER ne restreint rien", () => {
    const b = bearer({ fullCompanyIds: [ADV], rangeGrants: [{ rangeId: "cardio", companyId: ADV }] });
    expect(restrictingRangeIds(b)).toEqual([]);
  });

  it("une gamme d'une entité qu'on n'a PAS en entier restreint bien", () => {
    const b = bearer({ fullCompanyIds: [ADV], rangeGrants: [{ rangeId: "hosp", companyId: PHG }] });
    expect(restrictingRangeIds(b)).toEqual(["hosp"]);
  });

  it("le Super Admin n'est jamais restreint", () => {
    const b = bearer({ wholeGroup: true, rangeGrants: [{ rangeId: "hosp", companyId: PHG }] });
    expect(restrictingRangeIds(b)).toEqual([]);
  });
});

describe("productRangeWhere", () => {
  it("ne filtre rien sans rattachement par gamme", () => {
    expect(productRangeWhere(bearer({ fullCompanyIds: [ADV] }))).toBeNull();
  });

  it("filtre sur les gammes ET laisse entières les sociétés ouvertes en entier", () => {
    const b = bearer({ fullCompanyIds: [ADV], rangeGrants: [{ rangeId: "hosp", companyId: PHG }] });
    expect(productRangeWhere(b)).toEqual({
      OR: [{ rangeId: { in: ["hosp"] } }, { companyId: { in: [ADV] } }],
    });
  });

  it("sans aucune entité entière, il ne reste QUE les gammes", () => {
    const b = bearer({ rangeGrants: [{ rangeId: "hosp", companyId: PHG }, { rangeId: "cardio", companyId: ADV }] });
    expect(productRangeWhere(b)).toEqual({ OR: [{ rangeId: { in: ["hosp", "cardio"] } }] });
  });
});

describe("canSeeProduct — la même règle, côté mémoire", () => {
  const b = bearer({ fullCompanyIds: [ADV], rangeGrants: [{ rangeId: "hosp", companyId: PHG }] });

  it("voit un produit de sa gamme", () => {
    expect(canSeeProduct(b, { companyId: PHG, rangeId: "hosp" })).toBe(true);
  });

  it("ne voit PAS un autre produit de la même société", () => {
    expect(canSeeProduct(b, { companyId: PHG, rangeId: "cardio" })).toBe(false);
  });

  it("ne voit pas un produit de la société où sa seule porte est une gamme, s'il n'a pas de gamme", () => {
    expect(canSeeProduct(b, { companyId: PHG, rangeId: null })).toBe(false);
  });

  it("voit tout de la société qu'il a en entier, gamme ou pas", () => {
    expect(canSeeProduct(b, { companyId: ADV, rangeId: null })).toBe(true);
    expect(canSeeProduct(b, { companyId: ADV, rangeId: "autre" })).toBe(true);
  });

  it("sans rattachement par gamme, l'entité décide seule", () => {
    expect(canSeeProduct(bearer({ fullCompanyIds: [ADV] }), { companyId: ADV, rangeId: null })).toBe(true);
  });

  it("le Super Admin voit tout, y compris un produit sans entité", () => {
    expect(canSeeProduct(bearer({ wholeGroup: true }), { companyId: null, rangeId: null })).toBe(true);
  });
});

describe("buildRangeTree", () => {
  const companies = [
    { id: ADV, label: "Adventum", color: "#111" },
    { id: PHG, label: "Pharmagène", color: null },
  ];
  const ranges = [
    { id: "r2", name: "Hôpital", companyId: ADV, color: null, isActive: true, productCount: 2, memberCount: 1 },
    { id: "r1", name: "Cardiologie", companyId: ADV, color: null, isActive: true, productCount: 5, memberCount: 3 },
  ];

  it("range les gammes sous leur entité, triées par nom", () => {
    const tree = buildRangeTree(companies, ranges, { [ADV]: 4 });
    expect(tree[0].ranges.map((r) => r.name)).toEqual(["Cardiologie", "Hôpital"]);
    expect(tree[0].unranged).toBe(4);
  });

  it("garde une entité SANS gamme : c'est là qu'on vient lui en créer une", () => {
    const tree = buildRangeTree(companies, ranges, {});
    expect(tree).toHaveLength(2);
    expect(tree[1].companyLabel).toBe("Pharmagène");
    expect(tree[1].ranges).toEqual([]);
    expect(tree[1].unranged).toBe(0);
  });
});

describe("describeAttachment", () => {
  it("nomme la société seule quand elle est ouverte en entier", () => {
    expect(describeAttachment("Adventum")).toBe("Adventum");
  });

  it("nomme « Entité › Gamme » — deux sociétés peuvent avoir une gamme du même nom", () => {
    expect(describeAttachment("Pharmagène", "Cardiologie")).toBe("Pharmagène › Cardiologie");
  });
});
