import { describe, it, expect } from "vitest";
import {
  REG_PHASES, REG_STEPS, REG_CHECKLIST,
  regProgress, regChecklistProgress, regStepStatus,
  isRegStepKey, isRegChecklistKey, isRegStepState,
  PRESUB_ANSWER_STEP, REG_PRESUB_OUTCOME, isRegPresubOutcome, presubOutcome, presubUnlocked,
  REG_STATUS_MILESTONE, completeStepsThrough,
  type RegWorkflowState, type RegChecklistState,
} from "./regulatory-workflow";

describe("regulatory ANPP workflow", () => {
  it("définit 23 étapes réparties sur 5 phases, clés uniques", () => {
    expect(REG_STEPS).toHaveLength(23);
    expect(REG_PHASES).toHaveLength(5);
    const keys = REG_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(23);
    // chaque étape pointe vers une phase connue
    const phaseKeys = new Set(REG_PHASES.map((p) => p.key));
    for (const s of REG_STEPS) expect(phaseKeys.has(s.phase)).toBe(true);
    // numéros 1..23 dans l'ordre
    expect(REG_STEPS.map((s) => s.n)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it("checklist : groupes non vides, clés uniques", () => {
    const items = REG_CHECKLIST.flatMap((g) => g.items.map((i) => i.key));
    expect(items.length).toBeGreaterThanOrEqual(20);
    expect(new Set(items).size).toBe(items.length);
    expect(REG_CHECKLIST.map((g) => g.key)).toEqual(["LEGALIZED", "ELECTRONIC", "PRESUBMISSION"]);
  });

  it("regProgress : vide → 0 fait, étape courante = la 1re", () => {
    const p = regProgress(null);
    expect(p.done).toBe(0);
    expect(p.total).toBe(23);
    expect(p.pct).toBe(0);
    expect(p.current?.n).toBe(1);
  });

  it("regProgress : étapes faites comptées, courante = 1re non terminée (présoumission favorable)", () => {
    const wf: RegWorkflowState = {
      ctd: { status: "DONE" }, sample: { status: "DONE" }, bv25_req: { status: "DOING" },
      [PRESUB_ANSWER_STEP]: { status: "DONE", outcome: "FAVORABLE" },
    };
    const p = regProgress(wf);
    expect(p.current?.key).toBe("bv25_req"); // 1re non-DONE
    expect(regStepStatus(wf, "bv25_req")).toBe("DOING");
    expect(regStepStatus(wf, "decision")).toBe("TODO");
  });

  it("SANS avis favorable, le dossier reste À L'ÉTAPE « Réception du CTD complet »", () => {
    // Le verrou de présoumission : cocher les étapes suivantes en attendant l'ANPP donnerait une
    // avance qui n'existe pas — et c'est ce chiffre-là qu'on regarde pour décider où mettre les gens.
    const base: RegWorkflowState = { ctd: { status: "DONE" }, sample: { status: "DONE" }, bv25_req: { status: "DOING" } };
    expect(regProgress(base).current?.key).toBe("ctd");
    expect(regProgress({ ...base, [PRESUB_ANSWER_STEP]: { status: "DONE", outcome: "EN_ATTENTE" } }).current?.key).toBe("ctd");
    expect(regProgress({ ...base, [PRESUB_ANSWER_STEP]: { status: "BLOCKED", outcome: "DEFAVORABLE" } }).current?.key).toBe("ctd");
  });

  it("le verrou ne MENT PAS sur le travail fait : le décompte reste intact", () => {
    // Plafonner le compteur reviendrait à effacer des étapes réellement franchies. On ne
    // déplace que l'étape OÙ SE TROUVE le dossier.
    const wf: RegWorkflowState = { ctd: { status: "DONE" }, sample: { status: "DONE" }, bv25_req: { status: "DONE" } };
    expect(regProgress(wf).done).toBe(3);
  });

  it("l'avis favorable rouvre la marche", () => {
    const wf: RegWorkflowState = {
      ctd: { status: "DONE" }, sample: { status: "DONE" },
      [PRESUB_ANSWER_STEP]: { status: "DONE", outcome: "FAVORABLE" },
    };
    expect(presubUnlocked(wf)).toBe(true);
    expect(presubUnlocked(null)).toBe(false);
    expect(regProgress(wf).current?.key).not.toBe("ctd");
  });

  it("regChecklistProgress compte les documents cochés", () => {
    const cl: RegChecklistState = { gmp_fp: { checked: true }, ml_fp: { checked: true }, cpp: { checked: false } };
    const p = regChecklistProgress(cl);
    expect(p.checked).toBe(2);
    expect(p.total).toBe(REG_CHECKLIST.flatMap((g) => g.items).length);
  });

  it("validateurs de clés / statut", () => {
    expect(isRegStepKey("decision")).toBe(true);
    expect(isRegStepKey("inconnu")).toBe(false);
    expect(isRegChecklistKey("cpp")).toBe(true);
    expect(isRegChecklistKey("xxx")).toBe(false);
    expect(isRegStepState("DONE")).toBe(true);
    expect(isRegStepState("MAYBE")).toBe(false);
  });

  it("avis de présoumission : favorable → le flux continue (DONE), défavorable → BLOCKED, en attente → DOING", () => {
    expect(PRESUB_ANSWER_STEP).toBe("presub_ans");
    expect(REG_PRESUB_OUTCOME.FAVORABLE.status).toBe("DONE");   // continue
    expect(REG_PRESUB_OUTCOME.DEFAVORABLE.status).toBe("BLOCKED");
    expect(REG_PRESUB_OUTCOME.EN_ATTENTE.status).toBe("DOING");
    expect(isRegPresubOutcome("FAVORABLE")).toBe(true);
    expect(isRegPresubOutcome("PEUT_ETRE")).toBe(false);

    // Un avis favorable rend l'étape « Fait » → comptée dans l'avancement.
    const favorable: RegWorkflowState = { [PRESUB_ANSWER_STEP]: { status: "DONE", outcome: "FAVORABLE" } };
    expect(presubOutcome(favorable)).toBe("FAVORABLE");
    expect(regStepStatus(favorable, PRESUB_ANSWER_STEP)).toBe("DONE");
    expect(presubOutcome(null)).toBeNull();
  });
});

describe("completeStepsThrough — un statut posé compte les étapes jusqu'à son jalon", () => {
  it("« Déposé » (SUBMITTED) → les étapes jusqu'au dépôt sont faites, les suivantes JAMAIS touchées", () => {
    // Le dépôt est l'étape 13 depuis l'ajout de « Étude des modules 3, 4 et 5 » : on le lit
    // dans REG_STEPS plutôt que d'écrire le nombre, pour que le test survive au prochain ajout.
    const depotN = REG_STEPS.find((s) => s.key === "depot")!.n;
    const { state, changed } = completeStepsThrough(null, REG_STATUS_MILESTONE.SUBMITTED);
    expect(changed).toBe(depotN);
    for (const s of REG_STEPS) {
      if (s.n <= depotN) expect(regStepStatus(state, s.key)).toBe("DONE");
      else expect(regStepStatus(state, s.key)).toBe("TODO");
    }
    expect(regProgress(state).done).toBe(depotN);
    // Chaque étape complétée reçoit une date (traçabilité).
    expect(state.depot?.date).toBeTruthy();
  });

  it("ne dé-coche RIEN, n'écrase pas une étape bloquée, et préserve dates/notes existantes", () => {
    const before: RegWorkflowState = {
      ctd: { status: "DONE", date: "2026-01-05", note: "reçu V2" },
      module1: { status: "BLOCKED", note: "CPP expiré" },
      rdv: { status: "DOING" },
    };
    const { state, changed } = completeStepsThrough(before, "depot");
    expect(state.ctd).toEqual({ status: "DONE", date: "2026-01-05", note: "reçu V2" }); // intact
    expect(regStepStatus(state, "module1")).toBe("BLOCKED"); // le blocage est un signal humain
    expect(regStepStatus(state, "rdv")).toBe("DONE"); // DOING → DONE (rattrapé), note absente OK
    expect(changed).toBe(11); // 13 jalons jusqu'au dépôt − ctd déjà fait − module1 bloqué
  });

  it("idempotent (rejouer ne change rien) et jalon inconnu = aucun effet", () => {
    const first = completeStepsThrough(null, "reserves_recv");
    expect(first.changed).toBe(REG_STEPS.find((s) => s.key === "reserves_recv")!.n);
    const second = completeStepsThrough(first.state, "reserves_recv");
    expect(second.changed).toBe(0);
    expect(completeStepsThrough(null, "inconnu").changed).toBe(0);
  });

  it("la carte statut → jalon couvre les statuts non ambigus, et eux seuls", () => {
    expect(REG_STATUS_MILESTONE.SUBMITTED).toBe("depot");
    expect(REG_STATUS_MILESTONE.RESPONDING_TO_QUERIES).toBe("reserves_recv");
    expect(REG_STATUS_MILESTONE.DECISION_OBTAINED).toBe("decision");
    expect(REG_STATUS_MILESTONE.PRE_SUBMISSION).toBeUndefined();
    expect(REG_STATUS_MILESTONE.BLOCKED).toBeUndefined();
  });

  // ── GOLDEN RÉGRESSION — le bug réel « 22/22 terminé mais prochaine étape : 1. Réception
  // du CTD complet ». Un processus COMPLET n'est à aucune étape, quel que soit l'état du
  // verrou de présoumission ; et compléter par JALON (Décision obtenue) implique l'avis
  // favorable — sans lui, le verrou renvoyait le dossier fini à l'étape 1.
  it("INVARIANT : toutes les étapes faites → 100 %, AUCUNE étape courante — jamais un retour à l'étape 1", () => {
    // Toutes DONE mais SANS avis de présoumission explicite (le cas du bug observé).
    const all: RegWorkflowState = {};
    for (const s of REG_STEPS) all[s.key] = { status: "DONE" };
    const p = regProgress(all);
    expect(p.done).toBe(p.total);
    expect(p.pct).toBe(100);
    expect(p.current).toBeNull(); // TERMINÉ — pas « Réception du CTD complet »
  });

  it("compléter par jalon AU-DELÀ de la présoumission pose l'avis FAVORABLE dérivé (on ne dépose pas sans lui)", () => {
    const { state } = completeStepsThrough(null, "decision");
    expect(state.presub_ans?.status).toBe("DONE");
    expect(state.presub_ans?.outcome).toBe("FAVORABLE");
    const p = regProgress(state);
    expect(p.done).toBe(p.total);
    expect(p.current).toBeNull();
    // Et un jalon intermédiaire (dépôt) donne bien l'étape suivante, pas l'étape 1.
    const depot = completeStepsThrough(null, "depot");
    const pd = regProgress(depot.state);
    expect(pd.current?.key).toBe("recevabilite"); // étape 13 — le verrou est levé par l'avis dérivé
  });

  it("un avis EXPLICITE déjà posé n'est JAMAIS réécrit par un jalon", () => {
    const before: RegWorkflowState = { presub_ans: { status: "DONE", outcome: "EN_ATTENTE" } };
    const { state } = completeStepsThrough(before, "depot");
    expect(state.presub_ans?.outcome).toBe("EN_ATTENTE"); // l'humain a dit « en attente » — respecté
    // Le verrou reste donc fermé : le dossier affiché reste à sa réception.
    expect(regProgress(state).current?.key).toBe("ctd");
  });
});
