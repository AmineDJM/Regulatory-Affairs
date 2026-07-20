/**
 * Test différentiel / shadow (§32). Exécute la MÊME batterie sur le run candidat (commit courant)
 * et la compare au run de référence précédent (baseline). Chaque écart est classé :
 * attendu | régression | amélioration | ambigu.
 */

export type DiffClass = "expected" | "regression" | "improvement" | "ambiguous";

export interface Metrics {
  score: number | null;
  criticalCount: number;
  findingsCount: number;
  blockingFailures: number;
  transitionCoverage: number | null;
  businessObjectCoverage: number | null;
  mutationKillRate: number | null;
}

export interface Diff { metric: string; before: number | null; after: number | null; classification: DiffClass; note: string }

export interface DifferentialReport {
  baselineRunId: string | null;
  baselineCommit: string | null;
  candidateCommit: string | null;
  diffs: Diff[];
  regressions: number;
  improvements: number;
}

// Pour chaque métrique : sens « mieux » (+1 si plus grand = mieux, -1 si plus petit = mieux).
const BETTER: Record<keyof Metrics, 1 | -1> = {
  score: 1, criticalCount: -1, findingsCount: -1, blockingFailures: -1,
  transitionCoverage: 1, businessObjectCoverage: 1, mutationKillRate: 1,
};
const LABEL: Record<keyof Metrics, string> = {
  score: "Score santé", criticalCount: "Constats critiques", findingsCount: "Constats",
  blockingFailures: "Échecs bloquants", transitionCoverage: "Couverture transitions",
  businessObjectCoverage: "Couverture objets métier", mutationKillRate: "Taux de destruction des mutations",
};

function classify(metric: keyof Metrics, before: number | null, after: number | null): { classification: DiffClass; note: string } {
  if (before === null || after === null) return { classification: "ambiguous", note: "métrique absente d'un des runs" };
  const delta = after - before;
  if (Math.abs(delta) < 1e-9) return { classification: "expected", note: "identique" };
  const improved = (delta > 0 ? 1 : -1) === BETTER[metric];
  return { classification: improved ? "improvement" : "regression", note: `${before} → ${after}` };
}

export function differential(candidate: Metrics, baseline: Metrics | null, meta: { baselineRunId: string | null; baselineCommit: string | null; candidateCommit: string | null }): DifferentialReport {
  if (!baseline) {
    return { ...meta, diffs: [], regressions: 0, improvements: 0 };
  }
  const diffs: Diff[] = (Object.keys(BETTER) as (keyof Metrics)[]).map((k) => {
    const { classification, note } = classify(k, baseline[k], candidate[k]);
    return { metric: LABEL[k], before: baseline[k], after: candidate[k], classification, note };
  });
  return {
    ...meta,
    diffs,
    regressions: diffs.filter((d) => d.classification === "regression").length,
    improvements: diffs.filter((d) => d.classification === "improvement").length,
  };
}
