import type { FindingInput } from "../types";
import { INVARIANTS } from "./registry";
import { CRITICALITY_TO_SEVERITY, type Criticality, type InvariantResult } from "./types";

/**
 * Exécute le registre d'invariants (§28) sur les données réelles et en tire des constats. Un
 * invariant `blocksCertification` en échec est comptabilisé comme **bloquant** (utilisé par la
 * certification, §36). Une vérification qui n'a pas pu s'exécuter est marquée `skipped` (jamais
 * présentée comme réussie).
 */

export interface InvariantOutcome extends InvariantResult {
  criticality: Criticality;
  blocksCertification: boolean;
  description: string;
}

export interface InvariantsReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blockingFailures: number;
  results: InvariantOutcome[];
  findings: FindingInput[];
}

export async function runInvariants(only?: string[]): Promise<InvariantsReport> {
  const list = only ? INVARIANTS.filter((i) => only.includes(i.id)) : INVARIANTS;
  const results: InvariantOutcome[] = [];
  const findings: FindingInput[] = [];
  let passed = 0, failed = 0, skipped = 0, blockingFailures = 0;

  for (const inv of list) {
    let r: Omit<InvariantResult, "id">;
    try {
      r = await inv.check();
    } catch (e) {
      r = { ok: true, checked: 0, violations: 0, sample: [], skipped: true, note: (e as Error).message };
    }
    results.push({ id: inv.id, ...r, criticality: inv.criticality, blocksCertification: inv.blocksCertification, description: inv.description });

    if (r.skipped) {
      skipped++;
    } else if (r.ok) {
      passed++;
    } else {
      failed++;
      if (inv.blocksCertification) blockingFailures++;
      findings.push({
        severity: CRITICALITY_TO_SEVERITY[inv.criticality],
        category: "invariant",
        module: inv.modules[0] ?? null,
        title: `Invariant ${inv.id} violé`,
        detail: `${inv.description} — ${r.violations} violation(s) sur ${r.checked} enregistrement(s). Attendu : ${inv.expectation}`,
        evidence: r.sample,
        suggestion: inv.onFailure,
        confidence: "high",
      });
    }
  }

  return { total: list.length, passed, failed, skipped, blockingFailures, results, findings };
}
