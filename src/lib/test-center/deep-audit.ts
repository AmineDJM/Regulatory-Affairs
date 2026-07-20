import type { FindingInput } from "./types";
import { runInvariants, type InvariantsReport } from "./invariants/engine";
import { exploreStateMachines, type StateExploreResult } from "./state-machines/explorer";
import { rbacCoverage, businessObjectCoverage, type RbacCoverage, type BusinessObjectCoverage } from "./coverage";

/**
 * Audit approfondi (phase 2) : invariants métier (§28) + exploration des machines à états (§29)
 * + couverture RBAC / objets métier. Lecture seule, sur données réelles. Agrège constats,
 * échecs bloquants et métriques de couverture pour la certification (§36).
 */

export interface DeepAuditResult {
  invariants: InvariantsReport;
  stateMachines: StateExploreResult;
  coverage: {
    rbac: RbacCoverage;
    business: BusinessObjectCoverage;
    transition: number;
  };
  findings: FindingInput[];
  blockingFailures: number;
}

export async function deepAudit(): Promise<DeepAuditResult> {
  const [invariants, stateMachines, rbac, business] = await Promise.all([
    runInvariants(),
    exploreStateMachines(),
    Promise.resolve(rbacCoverage()),
    businessObjectCoverage(),
  ]);

  const findings = [...invariants.findings, ...stateMachines.findings];
  // Un couplage d'état rompu est aussi grave qu'un invariant bloquant : on le comptabilise.
  const couplingBlocking = stateMachines.machines.filter((m) => m.couplingViolations > 0).length;

  return {
    invariants,
    stateMachines,
    coverage: { rbac, business, transition: stateMachines.overallTransitionCoverage },
    findings,
    blockingFailures: invariants.blockingFailures + couplingBlocking,
  };
}
