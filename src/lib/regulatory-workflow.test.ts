import { describe, it, expect } from "vitest";
import {
  REG_PHASES, REG_STEPS, REG_CHECKLIST,
  regProgress, regChecklistProgress, regStepStatus,
  isRegStepKey, isRegChecklistKey, isRegStepState,
  type RegWorkflowState, type RegChecklistState,
} from "./regulatory-workflow";

describe("regulatory ANPP workflow", () => {
  it("définit 22 étapes réparties sur 5 phases, clés uniques", () => {
    expect(REG_STEPS).toHaveLength(22);
    expect(REG_PHASES).toHaveLength(5);
    const keys = REG_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(22);
    // chaque étape pointe vers une phase connue
    const phaseKeys = new Set(REG_PHASES.map((p) => p.key));
    for (const s of REG_STEPS) expect(phaseKeys.has(s.phase)).toBe(true);
    // numéros 1..22 dans l'ordre
    expect(REG_STEPS.map((s) => s.n)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
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
    expect(p.total).toBe(22);
    expect(p.pct).toBe(0);
    expect(p.current?.n).toBe(1);
  });

  it("regProgress : étapes faites comptées, courante = 1re non terminée", () => {
    const wf: RegWorkflowState = { ctd: { status: "DONE" }, sample: { status: "DONE" }, bv25_req: { status: "DOING" } };
    const p = regProgress(wf);
    expect(p.done).toBe(2);
    expect(p.current?.key).toBe("bv25_req"); // 1re non-DONE
    expect(regStepStatus(wf, "bv25_req")).toBe("DOING");
    expect(regStepStatus(wf, "decision")).toBe("TODO");
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
});
