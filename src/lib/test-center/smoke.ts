import { runDiagnostic, type Severity } from "@/lib/platform-audit/engine";
import type { FindingInput } from "./types";

/**
 * Smoke tests (phase 1) : on réutilise le **Diagnostic** déjà vérifié (santé base/IA/
 * stockage, cohérence RBAC ↔ navigation, formats d'upload, ergonomie, files bloquées…)
 * et on le traduit en constats de test + une mesure de couverture observée.
 */

const SEV: Record<Severity, FindingInput["severity"]> = { critical: "CRITICAL", warning: "MEDIUM", info: "INFO", ok: "LOW" };

export interface SmokeResult { findings: FindingInput[]; score: number; coverage: Record<string, number> }

export async function smokeFindings(): Promise<SmokeResult> {
  const d = await runDiagnostic();
  const findings: FindingInput[] = d.findings.map((f) => ({
    severity: SEV[f.severity],
    category: "health",
    module: f.area,
    title: f.title,
    detail: f.detail,
    suggestion: f.suggestion ?? null,
    confidence: "high",
    evidence: { area: f.area },
  }));
  const coverage = {
    routesDiscovered: d.counts.pages,
    rolesAnalyzed: d.counts.roles,
    modules: d.counts.modules,
    uploadSurfaces: d.uploads.length,
    probes: d.probes.length,
  };
  return { findings, score: d.healthScore, coverage };
}
