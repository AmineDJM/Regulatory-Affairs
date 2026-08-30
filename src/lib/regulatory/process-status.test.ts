import { describe, it, expect } from "vitest";
import { deriveStatus, statusFromWorkflow, hasBlockedStep, explainStatus, statusRank } from "./process-status";
import type { RegWorkflowState } from "@/lib/regulatory-workflow";

/** Un état de processus : les clés passées sont « Fait », plus l'avis de présoumission. */
const wf = (keys: string[], outcome: "FAVORABLE" | "DEFAVORABLE" | "EN_ATTENTE" | null = "FAVORABLE"): RegWorkflowState => {
  const state: RegWorkflowState = {};
  for (const k of keys) state[k] = { status: "DONE" };
  if (outcome) state.presub_ans = { status: outcome === "FAVORABLE" ? "DONE" : outcome === "DEFAVORABLE" ? "BLOCKED" : "DOING", outcome };
  return state;
};

describe("le niveau de process se LIT dans les étapes", () => {
  it("un dossier tout neuf est en pré-soumission", () => {
    expect(statusFromWorkflow(null)).toBe("PRE_SUBMISSION");
    expect(statusFromWorkflow({})).toBe("PRE_SUBMISSION");
  });

  it("déposé → « Déposé » ; évalué → « Attente ANPP » ; réserves → « Réponse aux réserves »", () => {
    expect(statusFromWorkflow(wf(["ctd", "depot"]))).toBe("SUBMITTED");
    expect(statusFromWorkflow(wf(["ctd", "depot", "evaluation"]))).toBe("AWAITING_ANPP");
    expect(statusFromWorkflow(wf(["ctd", "depot", "evaluation", "reserves_recv"]))).toBe("RESPONDING_TO_QUERIES");
    expect(statusFromWorkflow(wf(["ctd", "depot", "reponses_depot"]))).toBe("RESPONDING_TO_QUERIES");
  });

  it("le passage en commission remet le dossier en attente de l'agence", () => {
    expect(statusFromWorkflow(wf(["reponses_depot", "commission"]))).toBe("AWAITING_ANPP");
  });

  it("la décision obtenue est le sommet de l'échelle", () => {
    expect(statusFromWorkflow(wf(["depot", "commission", "decision"]))).toBe("DECISION_OBTAINED");
  });

  it("un BV demandé et non payé DIT qu'on attend le paiement — pas plus tard", () => {
    expect(statusFromWorkflow(wf(["ctd", "bv25_req"]))).toBe("AWAITING_BV_PAYMENT");
    // Une fois payé, le BV ne retient plus rien : le dossier revient au niveau que le reste
    // du processus raconte (ici, l'avis favorable de présoumission = en préparation).
    expect(statusFromWorkflow(wf(["ctd", "bv25_req", "bv25_pay"]))).toBe("IN_PREPARATION");
    // Et sans avis de présoumission, le verrou l'emporte sur le BV impayé.
    expect(statusFromWorkflow(wf(["ctd", "bv25_req"], null))).toBe("PRE_SUBMISSION");
    // Et un dossier déjà déposé n'attend plus son BV : il attend l'agence.
    expect(statusFromWorkflow(wf(["bv75_req", "depot"]))).toBe("SUBMITTED");
  });

  it("l'étude des modules 3-4-5 fait entrer le dossier en préparation", () => {
    expect(statusFromWorkflow(wf(["ctd", "modules345"]))).toBe("IN_PREPARATION");
  });
});

describe("les deux jugements humains l'emportent", () => {
  it("une étape bloquée bloque le dossier, quoi qu'il ait été fait avant", () => {
    const state = wf(["ctd", "depot", "evaluation"]);
    state.rdv = { status: "BLOCKED" };
    expect(hasBlockedStep(state)).toBe(true);
    expect(statusFromWorkflow(state)).toBe("BLOCKED");
    expect(deriveStatus(state, "AWAITING_ANPP")).toMatchObject({ status: "BLOCKED", changed: true });
  });

  it("un avis de présoumission défavorable bloque, un avis en attente retient à la réception", () => {
    expect(statusFromWorkflow(wf(["ctd", "depot"], "DEFAVORABLE"))).toBe("BLOCKED");
    expect(statusFromWorkflow(wf(["ctd", "depot"], "EN_ATTENTE"))).toBe("PRE_SUBMISSION");
    // Sans avis du tout : le dossier n'est pas engagé, même si des cases sont cochées plus loin.
    expect(statusFromWorkflow(wf(["ctd", "depot", "evaluation"], null))).toBe("PRE_SUBMISSION");
  });

  it("un dossier clôturé le reste — la clôture ne se recalcule pas", () => {
    const d = deriveStatus(wf(["ctd"]), "CLOSED");
    expect(d).toMatchObject({ status: "CLOSED", changed: false });
    expect(explainStatus(d)).toMatch(/clôturé/i);
  });

  it("plus rien de bloqué : le processus reprend la main", () => {
    expect(deriveStatus(wf(["ctd", "depot"]), "BLOCKED")).toMatchObject({ status: "SUBMITTED", changed: true });
  });
});

describe("on n'efface jamais un passé déjà écrit", () => {
  it("un dossier saisi « Déposé » sans aucune étape cochée reste Déposé", () => {
    const d = deriveStatus(null, "SUBMITTED");
    expect(d).toMatchObject({ status: "SUBMITTED", fromWorkflow: "PRE_SUBMISSION", changed: false, kept: true });
    expect(explainStatus(d)).toMatch(/avant le suivi par étapes/i);
  });

  it("dès que les étapes dépassent le niveau enregistré, elles reprennent la main", () => {
    const d = deriveStatus(wf(["ctd", "depot", "evaluation"]), "SUBMITTED");
    expect(d).toMatchObject({ status: "AWAITING_ANPP", changed: true, kept: false });
    expect(explainStatus(d)).toMatch(/déduit des étapes/i);
  });

  it("l'échelle est ordonnée du moins avancé au plus avancé", () => {
    expect(statusRank("PRE_SUBMISSION")).toBeLessThan(statusRank("SUBMITTED"));
    expect(statusRank("SUBMITTED")).toBeLessThan(statusRank("DECISION_OBTAINED"));
    expect(statusRank("BLOCKED")).toBe(-1); // hors échelle : c'est un état, pas un rang
  });
});
