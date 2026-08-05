import { describe, expect, it } from "vitest";
import { effectiveStage, stageRank, type VariationLike } from "./manufacturing-stage";

/**
 * LA RÈGLE : une variation OBTENUE fait foi.
 *
 * Le niveau saisi sur la fiche produit n'est qu'une déclaration. Dès qu'une variation est
 * obtenue auprès de l'ANPP, c'est SA cible qui est le niveau réel — même si la fiche dit
 * autre chose (saisie à la main, import, correction). Ces tests interdisent la divergence.
 */

const v = (over: Partial<VariationLike> & { toStatus: VariationLike["toStatus"] }): VariationLike => ({
  status: "OBTENUE", decisionDate: "2026-03-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("Niveau de process — la variation obtenue fait foi", () => {
  it("sans variation, le niveau déclaré sur la fiche s'applique", () => {
    const s = effectiveStage("IMPORTATION", []);
    expect(s).toEqual({ status: "IMPORTATION", source: "DECLARED", decidedAt: null, pendingTo: null });
  });

  it("une variation OBTENUE l'emporte sur la déclaration de la fiche", () => {
    const s = effectiveStage("IMPORTATION", [v({ toStatus: "PRIMARY_PACKAGING" })]);
    expect(s.status).toBe("PRIMARY_PACKAGING");
    expect(s.source).toBe("VARIATION");
    expect(s.decidedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("elle l'emporte AUSSI quand la fiche a divergé — c'est tout l'intérêt de la calculer", () => {
    // Quelqu'un a repassé la fiche en « Importation » alors que la variation est obtenue.
    const s = effectiveStage("IMPORTATION", [v({ toStatus: "FULL_PROCESS" })]);
    expect(s.status).toBe("FULL_PROCESS");
  });

  it("une variation EN ATTENTE ne change RIEN — elle est seulement signalée", () => {
    const s = effectiveStage("IMPORTATION", [v({ toStatus: "FULL_PROCESS", status: "EN_ATTENTE" })]);
    expect(s.status).toBe("IMPORTATION");
    expect(s.source).toBe("DECLARED");
    expect(s.pendingTo).toBe("FULL_PROCESS");
  });

  it("une variation ANNULÉE est ignorée", () => {
    const s = effectiveStage("SECONDARY_PACKAGING", [v({ toStatus: "FULL_PROCESS", status: "ANNULE" })]);
    expect(s.status).toBe("SECONDARY_PACKAGING");
    expect(s.source).toBe("DECLARED");
    expect(s.pendingTo).toBeNull();
  });

  it("entre plusieurs variations obtenues, la plus RÉCENTE décide", () => {
    const s = effectiveStage("IMPORTATION", [
      v({ toStatus: "SECONDARY_PACKAGING", decisionDate: "2025-02-01T00:00:00.000Z" }),
      v({ toStatus: "FULL_PROCESS", decisionDate: "2026-06-01T00:00:00.000Z" }),
      v({ toStatus: "PRIMARY_PACKAGING", decisionDate: "2025-09-01T00:00:00.000Z" }),
    ]);
    expect(s.status).toBe("FULL_PROCESS");
    expect(s.decidedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("la plus récente décide MÊME si elle est moins avancée (une décision peut corriger)", () => {
    const s = effectiveStage("IMPORTATION", [
      v({ toStatus: "FULL_PROCESS", decisionDate: "2025-01-01T00:00:00.000Z" }),
      v({ toStatus: "SECONDARY_PACKAGING", decisionDate: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(s.status).toBe("SECONDARY_PACKAGING");
  });

  it("à date de décision identique, le niveau le plus avancé gagne — on ne fait pas reculer une industrialisation actée", () => {
    const s = effectiveStage("IMPORTATION", [
      v({ toStatus: "SECONDARY_PACKAGING", decisionDate: "2026-04-01T00:00:00.000Z" }),
      v({ toStatus: "FULL_PROCESS", decisionDate: "2026-04-01T00:00:00.000Z" }),
    ]);
    expect(s.status).toBe("FULL_PROCESS");
  });

  it("sans date de décision, on retombe sur la date de création", () => {
    const s = effectiveStage("IMPORTATION", [
      v({ toStatus: "SECONDARY_PACKAGING", decisionDate: null, createdAt: "2025-01-01T00:00:00.000Z" }),
      v({ toStatus: "PRIMARY_PACKAGING", decisionDate: null, createdAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(s.status).toBe("PRIMARY_PACKAGING");
  });

  it("une variation obtenue ET une autre en attente : la première fait foi, la seconde est annoncée", () => {
    const s = effectiveStage("IMPORTATION", [
      v({ toStatus: "SECONDARY_PACKAGING" }),
      v({ toStatus: "FULL_PROCESS", status: "EN_ATTENTE" }),
    ]);
    expect(s.status).toBe("SECONDARY_PACKAGING");
    expect(s.source).toBe("VARIATION");
    expect(s.pendingTo).toBe("FULL_PROCESS");
  });

  it("l'ordre d'industrialisation est celui du métier", () => {
    expect(stageRank("IMPORTATION")).toBeLessThan(stageRank("SECONDARY_PACKAGING"));
    expect(stageRank("SECONDARY_PACKAGING")).toBeLessThan(stageRank("PRIMARY_PACKAGING"));
    expect(stageRank("PRIMARY_PACKAGING")).toBeLessThan(stageRank("FULL_PROCESS"));
  });
});
