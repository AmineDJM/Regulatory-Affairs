import { describe, it, expect } from "vitest";
import { assessVersion, evaluateRule, type LoadedRule, type TwinDoc } from "./engine";
import { runRuleTests, parseRuleTests } from "./rule-engine";

const doc = (section: string | null): TwinDoc => ({
  id: section ?? "x", originalFilename: `${section ?? "x"}.pdf`, ctdSection: section, ctdModule: null,
  securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", classificationMethod: "TEST",
});

const sectionRule = (code: string, blocker: boolean): LoadedRule => ({
  code: `SEC-${code}`, kind: blocker ? "SECTION_REQUIRED" : "SECTION_EXPECTED", sectionCode: code, factKey: null,
  severity: blocker ? "CRITICAL" : "MAJOR", blocker, title: `Section ${code}`, detail: null, remediation: null, citation: null,
});

const factRule = (key: string): LoadedRule => ({
  code: `FACT-${key}`, kind: "FACT_REQUIRED", sectionCode: null, factKey: key,
  severity: "MAJOR", blocker: false, title: `Fait ${key}`, detail: null, remediation: null, citation: null,
});

describe("evaluateRule — logique déterministe des règles", () => {
  it("SECTION_REQUIRED : présente → aucun constat ; absente → constat bloquant", () => {
    const rule = sectionRule("3.2.P.8", true);
    expect(evaluateRule(rule, { storableDocs: [doc("3.2.P.8")], factKeys: new Set() })).toBeNull();
    const miss = evaluateRule(rule, { storableDocs: [doc("1.0")], factKeys: new Set() });
    expect(miss).not.toBeNull();
    expect(miss!.blocker).toBe(true);
    expect(miss!.severity).toBe("CRITICAL");
  });

  it("couvre une sous-section (3.2.P couvre 3.2.P.8 ? non ; 3.2.P.8 couvre 3.2.P.8.1 ? oui)", () => {
    // Un document en 3.2.P.8.1 couvre la règle sur 3.2.P.8 (préfixe).
    expect(evaluateRule(sectionRule("3.2.P.8", true), { storableDocs: [doc("3.2.P.8.1")], factKeys: new Set() })).toBeNull();
    // Un document en 3.2.P NE couvre PAS une règle sur 3.2.P.8 (plus spécifique).
    expect(evaluateRule(sectionRule("3.2.P.8", true), { storableDocs: [doc("3.2.P")], factKeys: new Set() })).not.toBeNull();
  });

  it("FACT_REQUIRED : présent → aucun constat ; absent → constat", () => {
    const rule = factRule("INN");
    expect(evaluateRule(rule, { storableDocs: [], factKeys: new Set(["INN"]) })).toBeNull();
    expect(evaluateRule(rule, { storableDocs: [], factKeys: new Set() })).not.toBeNull();
  });

  it("CUSTOM : jamais exécuté (réservé) → aucun constat", () => {
    const rule: LoadedRule = { ...factRule("X"), kind: "CUSTOM" };
    expect(evaluateRule(rule, { storableDocs: [], factKeys: new Set() })).toBeNull();
  });
});

describe("assessVersion — pilotage par règles vs repli déterministe", () => {
  it("avec règles ACTIVES : complétude et bloqueurs dérivés des règles", () => {
    const rules = [sectionRule("1.0", true), sectionRule("3.2.P.8", true), sectionRule("2.1", false)];
    const r = assessVersion({
      procedureType: "INITIAL_REGISTRATION",
      documents: [doc("1.0"), doc("2.1")], // manque 3.2.P.8 (bloqueur)
      rules,
    });
    expect(r.summary.requiredTotal).toBe(2);
    expect(r.summary.requiredPresent).toBe(1);
    expect(r.summary.expectedTotal).toBe(1);
    expect(r.summary.expectedPresent).toBe(1);
    expect(r.summary.blockers).toBe(1); // 3.2.P.8 manquant
    expect(r.summary.conforme).toBe(false);
    expect(r.findings.some((f) => f.code === "SEC-3.2.P.8")).toBe(true);
  });

  it("sans règles : repli sur les profils codés (comportement historique préservé)", () => {
    // PRESUBMISSION historique : required=["1.2"], expected=["1.3"].
    const r = assessVersion({ procedureType: "PRESUBMISSION", documents: [doc("1.2"), doc("1.3")] });
    expect(r.summary.conforme).toBe(true);
    expect(r.summary.requiredTotal).toBe(1);
    expect(r.findings.some((f) => f.code === "MISSING_REQUIRED_SECTION")).toBe(false);
  });

  it("règles FACT_REQUIRED intégrées au bilan (non bloquantes ici)", () => {
    const rules = [sectionRule("1.0", true), factRule("INN")];
    const withFact = assessVersion({ procedureType: "GENERIC", documents: [doc("1.0")], rules, factKeys: new Set(["INN"]) });
    expect(withFact.findings.some((f) => f.code === "FACT-INN")).toBe(false);
    const noFact = assessVersion({ procedureType: "GENERIC", documents: [doc("1.0")], rules, factKeys: new Set() });
    expect(noFact.findings.some((f) => f.code === "FACT-INN")).toBe(true);
  });
});

describe("runRuleTests — cas golden par règle", () => {
  it("exécute les cas et détecte conformité/écart", () => {
    const rule = sectionRule("3.2.P.8", true);
    const cases = parseRuleTests([
      { name: "présente", sections: ["3.2.P.8"], expectPass: true },
      { name: "absente", sections: [], expectPass: false },
    ]);
    const res = runRuleTests(rule, cases);
    expect(res).toHaveLength(2);
    expect(res.every((r) => r.ok)).toBe(true);
  });

  it("parseRuleTests ignore les entrées malformées", () => {
    expect(parseRuleTests([{ bad: true }, { name: "ok", expectPass: true }])).toHaveLength(1);
    expect(parseRuleTests(null)).toHaveLength(0);
  });
});
