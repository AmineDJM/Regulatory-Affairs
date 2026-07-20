import { describe, expect, it } from "vitest";
import { computeCertification } from "./certify";
import { buildEvidence, verifyEvidence, fingerprintFindings } from "./evidence";
import { differential, type Metrics } from "./differential";

const base = {
  criticalCount: 0, blockingFailures: 0, cleanupStatus: "DONE",
  selfValidationOk: true, invariantsSkipped: 0, migrationsChecked: true,
  findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
};

describe("Test Center — certification (§36)", () => {
  it("CERTIFIED quand tout est propre", () => {
    expect(computeCertification(base).status).toBe("CERTIFIED");
  });
  it("INCONCLUSIVE quand l'auto-validation échoue (instrument non fiable)", () => {
    expect(computeCertification({ ...base, selfValidationOk: false }).status).toBe("INCONCLUSIVE");
  });
  it("BLOCKED sur critique, bloquant ou nettoyage incomplet", () => {
    expect(computeCertification({ ...base, criticalCount: 1, findingCounts: { ...base.findingCounts, critical: 1 } }).status).toBe("BLOCKED");
    expect(computeCertification({ ...base, blockingFailures: 2 }).status).toBe("BLOCKED");
    expect(computeCertification({ ...base, cleanupStatus: "INCOMPLETE" }).status).toBe("BLOCKED");
  });
  it("INCONCLUSIVE quand des vérifications clés manquent", () => {
    expect(computeCertification({ ...base, migrationsChecked: false }).status).toBe("INCONCLUSIVE");
    expect(computeCertification({ ...base, invariantsSkipped: 1 }).status).toBe("INCONCLUSIVE");
  });
  it("CERTIFIED_WITH_RESERVATIONS quand il reste des constats non bloquants", () => {
    expect(computeCertification({ ...base, findingCounts: { ...base.findingCounts, medium: 2 } }).status).toBe("CERTIFIED_WITH_RESERVATIONS");
  });
});

describe("Test Center — paquet de preuves (§36) : intégrité & immuabilité", () => {
  const input = {
    runId: "run1", mode: "SAFE_SYNTHETIC_TEST", environment: "development",
    commit: "abc123", branch: "main", config: { modules: ["RH"] }, coverage: { transition: 0.5 },
    results: { status: "PASSED" }, manifest: { created: 3, deleted: 3, cleanupStatus: "DONE", artifacts: 3 },
    certification: "CERTIFIED", certificationReasons: ["ok"], exclusions: ["prod"],
    findingsFingerprint: "deadbeef",
  };
  it("produit un hash sha256 vérifiable", () => {
    const pkg = buildEvidence(input);
    expect(pkg.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyEvidence(pkg)).toBe(true);
  });
  it("détecte toute altération (immuabilité)", () => {
    const pkg = buildEvidence(input);
    const tampered = { ...pkg, certification: "BLOCKED" };
    expect(verifyEvidence(tampered)).toBe(false);
  });
  it("l'empreinte des constats est indépendante de l'ordre", () => {
    const a = fingerprintFindings([{ severity: "HIGH", title: "x", category: "c1" }, { severity: "LOW", title: "y", category: "c2" }]);
    const b = fingerprintFindings([{ severity: "LOW", title: "y", category: "c2" }, { severity: "HIGH", title: "x", category: "c1" }]);
    expect(a).toBe(b);
  });
});

describe("Test Center — différentiel (§32)", () => {
  const baseline: Metrics = { score: 70, criticalCount: 2, findingsCount: 10, blockingFailures: 1, transitionCoverage: 0.4, businessObjectCoverage: 0.5, mutationKillRate: 1 };
  it("classe améliorations et régressions", () => {
    const better: Metrics = { score: 85, criticalCount: 0, findingsCount: 6, blockingFailures: 0, transitionCoverage: 0.6, businessObjectCoverage: 0.5, mutationKillRate: 1 };
    const d = differential(better, baseline, { baselineRunId: "b", baselineCommit: "aaa", candidateCommit: "bbb" });
    expect(d.improvements).toBeGreaterThan(0);
    expect(d.regressions).toBe(0);
    // couverture objets métier identique → stable.
    expect(d.diffs.find((x) => x.metric.includes("objets"))?.classification).toBe("expected");
  });
  it("détecte une régression (score en baisse, plus de critiques)", () => {
    const worse: Metrics = { ...baseline, score: 50, criticalCount: 5 };
    const d = differential(worse, baseline, { baselineRunId: "b", baselineCommit: "aaa", candidateCommit: "bbb" });
    expect(d.regressions).toBeGreaterThan(0);
  });
  it("sans baseline : aucun diff", () => {
    const d = differential(baseline, null, { baselineRunId: null, baselineCommit: null, candidateCommit: "bbb" });
    expect(d.diffs.length).toBe(0);
  });
});
