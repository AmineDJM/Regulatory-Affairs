import { describe, it, expect } from "vitest";
import { analyzeImpact } from "./impact";

describe("analyzeImpact — analyse d'impact déterministe (G12)", () => {
  it("modification de la substance (3.2.S) impacte le produit fini + faits", () => {
    const r = analyzeImpact(["3.2.S.2"]);
    expect(r.affectedSections).toContain("3.2.P");
    expect(r.affectedSections).toContain("3.2.P.8");
    expect(r.factsToReverify).toContain("INN");
    expect(r.factsToReverify).toContain("IMPURITIES");
  });

  it("modification de la stabilité (3.2.P.8) impacte durée de conservation + stockage", () => {
    const r = analyzeImpact(["3.2.P.8"]);
    expect(r.factsToReverify).toContain("SHELF_LIFE");
    expect(r.factsToReverify).toContain("STORAGE");
  });

  it("modification de l'info produit (1.3) impacte les faits d'étiquetage", () => {
    const r = analyzeImpact(["1.3.1"]);
    expect(r.factsToReverify).toEqual(expect.arrayContaining(["PRODUCT_NAME", "STRENGTH", "INDICATIONS"]));
  });

  it("les sections modifiées ne sont pas listées comme affectées", () => {
    const r = analyzeImpact(["3.2.P"]);
    expect(r.affectedSections).not.toContain("3.2.P");
    expect(r.affectedSections).toContain("3.2.P.8");
  });

  it("section sans dépendance connue → aucun impact déduit", () => {
    const r = analyzeImpact(["9.9"]);
    expect(r.affectedSections).toHaveLength(0);
    expect(r.factsToReverify).toHaveLength(0);
  });
});
