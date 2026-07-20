import type { FindingInput } from "./types";
import { runOracles, type OracleReport } from "./oracles/consistency";
import { certifyMigrationsAndRecovery, type MigrationCert } from "./migration-cert";

/**
 * Contrôles d'infrastructure (phase 3) : cohérence multi-oracles (§30) + migrations & reprise (§35).
 * En lecture seule (`allowWrite=false`) : oracles + comparaison migrations disque/base uniquement.
 * En mode d'écriture : ajoute le roundtrip sauvegarde/restauration dans un schéma éphémère jetable.
 */

export interface InfraChecksResult {
  oracles: OracleReport;
  migration: MigrationCert;
  findings: FindingInput[];
  blockingFailures: number;
}

export async function infraChecks(runId: string, allowWrite: boolean): Promise<InfraChecksResult> {
  const [oracles, migration] = await Promise.all([
    runOracles(),
    certifyMigrationsAndRecovery(runId, allowWrite),
  ]);

  const findings = [...oracles.findings, ...migration.findings];
  let blockingFailures = oracles.findings.filter((f) => f.severity === "HIGH").length;
  if (migration.missing.length > 0) blockingFailures += 1;
  if (migration.backupRestore?.ran && !migration.backupRestore.ok) blockingFailures += 1;

  return { oracles, migration, findings, blockingFailures };
}
