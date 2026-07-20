import crypto from "node:crypto";
import { aiModel, aiConfigured, sttConfigured } from "@/lib/ai";

/**
 * Paquet de preuves de release (§36) — **immuable** : chaque certification produit un bundle
 * (commit, environnement, config, couverture, exclusions, résultats, manifeste, nettoyage,
 * versions des modèles IA, empreinte des artefacts) puis un **hash sha256** déterministe qui le
 * scelle. Le hash est recalculable pour prouver que le paquet n'a pas été altéré.
 */

export interface EvidenceInput {
  runId: string;
  mode: string;
  environment: string;
  commit: string | null;
  branch: string | null;
  config: unknown;
  coverage: unknown;
  results: unknown; // findingsBySeverity, invariants, oracles, selfValidation…
  manifest: { created: number; deleted: number; cleanupStatus: string; artifacts: number };
  certification: string;
  certificationReasons: string[];
  exclusions: string[];
  findingsFingerprint: string; // empreinte des constats (voir fingerprintFindings)
}

export interface EvidencePackage extends Omit<EvidenceInput, "findingsFingerprint"> {
  version: 1;
  generatedAt: string;
  aiModelVersions: { model: string; aiConfigured: boolean; sttConfigured: boolean };
  findingsFingerprint: string;
  hash: string;
}

/** Stringify déterministe (clés triées) — indispensable pour un hash stable. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

/** Empreinte stable des constats (titres+sévérités triés) — résume « ce qui a été trouvé ». */
export function fingerprintFindings(findings: { severity: string; title: string; category: string }[]): string {
  const norm = findings.map((f) => `${f.severity}|${f.category}|${f.title}`).sort();
  return crypto.createHash("sha256").update(norm.join("\n")).digest("hex").slice(0, 32);
}

export function buildEvidence(i: EvidenceInput): EvidencePackage {
  const pkg = {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    runId: i.runId, mode: i.mode, environment: i.environment,
    commit: i.commit, branch: i.branch,
    config: i.config, coverage: i.coverage, results: i.results,
    manifest: i.manifest,
    exclusions: i.exclusions,
    aiModelVersions: { model: aiModel(), aiConfigured: aiConfigured(), sttConfigured: sttConfigured() },
    certification: i.certification, certificationReasons: i.certificationReasons,
    findingsFingerprint: i.findingsFingerprint,
  };
  const hash = crypto.createHash("sha256").update(stable(pkg)).digest("hex");
  return { ...pkg, hash };
}

/** Recalcule le hash d'un paquet pour prouver son intégrité (immuabilité). */
export function verifyEvidence(pkg: EvidencePackage): boolean {
  const { hash, ...rest } = pkg;
  return crypto.createHash("sha256").update(stable(rest)).digest("hex") === hash;
}
