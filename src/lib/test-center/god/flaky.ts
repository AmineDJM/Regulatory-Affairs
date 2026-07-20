import type { FindingInput } from "../types";
import { runProperties } from "./properties";
import { runMetamorphic } from "./metamorphic";
import { runMutationTesting } from "./mutation";

/**
 * Détection des tests instables (§27). À graine FIXE, un moteur déterministe doit produire le
 * MÊME résultat à chaque exécution. On relance chaque moteur N fois et on compte les signatures
 * distinctes : >1 = instabilité (non-déterminisme caché dans NOTRE outil). Le taux de
 * reproductibilité = part de moteurs stables.
 */

export interface FlakyReport {
  checks: { id: string; runs: number; distinct: number; flaky: boolean }[];
  flakyCount: number;
  reproducibility: number;
  findings: FindingInput[];
}

export function runFlakyDetection(runs = 6, seed = 20260720): FlakyReport {
  const engines: { id: string; sig: () => string }[] = [
    { id: "properties", sig: () => JSON.stringify(runProperties(seed).props.map((p) => [p.id, p.result.ok])) },
    { id: "metamorphic", sig: () => JSON.stringify(runMetamorphic(seed).relations.map((r) => [r.id, r.result.ok])) },
    { id: "mutation", sig: () => JSON.stringify(runMutationTesting(seed).perOp.map((o) => [o.id, o.detected, o.survived])) },
  ];

  const checks = engines.map((e) => {
    const sigs = new Set<string>();
    for (let i = 0; i < runs; i++) sigs.add(e.sig());
    return { id: e.id, runs, distinct: sigs.size, flaky: sigs.size > 1 };
  });

  const flakyCount = checks.filter((c) => c.flaky).length;
  const findings: FindingInput[] = [];
  if (flakyCount > 0) {
    findings.push({
      severity: "HIGH", category: "flaky", module: "ADMIN",
      title: `Instabilité détectée dans le testeur (${flakyCount})`,
      detail: `À graine fixe, ${flakyCount} moteur(s) rendent des résultats variables : ${checks.filter((c) => c.flaky).map((c) => c.id).join(", ")}. Le testeur lui-même est non déterministe.`,
      evidence: checks,
      suggestion: "Retirer toute source d'aléa non semé (Date.now, Math.random) des moteurs concernés.",
      confidence: "high",
    });
  }
  return { checks, flakyCount, reproducibility: checks.length ? (checks.length - flakyCount) / checks.length : 1, findings };
}
