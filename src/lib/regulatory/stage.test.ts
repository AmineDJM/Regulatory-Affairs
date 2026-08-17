import { describe, it, expect } from "vitest";
import { regStage, defaultStage, visibleStages, REG_STAGES } from "./stage";

describe("Le verrou EST le pipeline", () => {
  it("un dossier verrouillé est au pipeline — pas au travail", () => {
    expect(regStage({ isLocked: true, status: "IN_PREPARATION" })).toBe("pipeline");
    expect(regStage({ isLocked: true, status: "PRE_SUBMISSION" })).toBe("pipeline");
  });

  it("le déverrouiller le met « à traiter » : c'est l'acte qui ouvre le dossier", () => {
    expect(regStage({ isLocked: false, status: "IN_PREPARATION" })).toBe("todo");
  });

  it("le reverrouiller le renvoie au pipeline", () => {
    expect(regStage({ isLocked: true, status: "SUBMITTED" })).toBe("pipeline");
  });

  it("un dossier ouvert reste « à traiter » quel que soit son avancement réglementaire", () => {
    for (const status of ["PRE_SUBMISSION", "IN_PREPARATION", "SUBMITTED", "AWAITING_BV_PAYMENT", "AWAITING_ANPP", "RESPONDING_TO_QUERIES", "BLOCKED"]) {
      expect(regStage({ isLocked: false, status }), status).toBe("todo");
    }
  });
});

describe("Un dossier abouti reste abouti", () => {
  it("la décision obtenue le range en « terminé »", () => {
    expect(regStage({ isLocked: false, status: "DECISION_OBTAINED" })).toBe("done");
    expect(regStage({ isLocked: false, status: "CLOSED" })).toBe("done");
  });

  it("le reverrouiller ne le renvoie PAS au pipeline — il ne se re-traite pas", () => {
    // Sans cette priorité, ranger des dossiers clos ferait disparaître des décisions obtenues
    // de la colonne qui sert précisément à les retrouver.
    expect(regStage({ isLocked: true, status: "DECISION_OBTAINED" })).toBe("done");
  });
});

describe("Ce que chacun voit", () => {
  it("sans le verrou, la colonne Pipeline n'existe pas : elle serait toujours vide", () => {
    // Un dossier verrouillé est invisible de l'équipe — la portée le filtre en amont.
    expect(visibleStages(false).map((s) => s.key)).toEqual(["todo", "done"]);
  });

  it("le PIPELINE a quitté l'écran Regulatory — même pour le Super Admin", () => {
    // Un dossier verrouillé n'est pas un dossier réglementaire en cours : c'est un produit qu'on
    // ÉTUDIE. Cette question appartient au Business Development, pas à l'équipe qui instruit.
    expect(visibleStages(true).map((s) => s.key)).toEqual(["todo", "done"]);
    // Le rangement, lui, existe toujours : c'est l'écran qui change, pas la règle.
    expect(REG_STAGES).toHaveLength(3);
    expect(regStage({ isLocked: true, status: "IN_PREPARATION" })).toBe("pipeline");
  });

  it("on arrive toujours sur « À traiter »", () => {
    expect(defaultStage(false, 42)).toBe("todo");
    expect(defaultStage(true, 42)).toBe("todo");
    expect(defaultStage(true, 0)).toBe("todo");
  });

  it("les libellés disent l'état, pas une étape technique", () => {
    expect(REG_STAGES.map((s) => s.label)).toEqual(["Pipeline", "À traiter", "Traitement terminé"]);
  });
});
