import { describe, expect, it } from "vitest";
import { lotsParProduit, normaliserLot, partDeNosLots } from "./parts-lots";

describe("la part de nos lots", () => {
  const nos = lotsParProduit([
    { productId: "p1", batchNumber: "B-2307/A" },
    { productId: "p1", batchNumber: " c9 " },
    { productId: "p1", batchNumber: null },
    { productId: null, batchNumber: "ZZ9" },
  ]);

  it("un numéro de lot se compare sans la ponctuation ni la casse ; trop court, il ne compte pas", () => {
    expect(normaliserLot("B-2307/A")).toBe("B2307A");
    expect(normaliserLot("b 2307 a")).toBe("B2307A");
    expect(normaliserLot("x")).toBeNull();
    expect(normaliserLot(null)).toBeNull();
    expect([...(nos.get("p1") ?? [])].sort()).toEqual(["B2307A", "C9"]);
    expect(nos.size).toBe(1);
  });

  it("part = boîtes de nos lots ÷ boîtes dont le lot est renseigné (les lignes sans lot ne comptent pas)", () => {
    const [r] = partDeNosLots([
      { productId: "p1", lot: "b2307a", livre: 300 },
      { productId: "p1", lot: "OTHER1", livre: 100 },
      { productId: "p1", lot: null, livre: 600 },
      { productId: "p1", lot: "B-2307/A", livre: -50 }, // un retour n'est pas une livraison
    ], nos);
    expect(r).toMatchObject({ productId: "p1", livre: 1000, livreAvecLot: 400, livreNosLots: 300, part: 75, couvertureLot: 40, lotsConnus: 2, raison: null });
  });

  it("n/d honnête : aucun lot dans les fichiers de la PCH, ou aucun de nos lots connu", () => {
    const [sansLot] = partDeNosLots([{ productId: "p1", lot: null, livre: 200 }], nos);
    expect(sansLot).toMatchObject({ part: null, raison: "SANS_LOT_PCH", couvertureLot: 0 });
    const [inconnus] = partDeNosLots([{ productId: "p2", lot: "L123", livre: 200 }], nos);
    expect(inconnus).toMatchObject({ part: null, raison: "NOS_LOTS_INCONNUS", lotsConnus: 0 });
  });

  it("0 % est une vraie mesure quand nos lots sont connus et qu'aucun n'a été livré", () => {
    const [r] = partDeNosLots([{ productId: "p1", lot: "OTHER1", livre: 80 }], nos);
    expect(r.part).toBe(0);
    expect(r.raison).toBeNull();
  });

  it("trie par volume livré, du plus gros au plus petit", () => {
    const r = partDeNosLots([{ productId: "a", lot: "L1", livre: 5 }, { productId: "b", lot: "L2", livre: 50 }], new Map());
    expect(r.map((x) => x.productId)).toEqual(["b", "a"]);
  });
});
