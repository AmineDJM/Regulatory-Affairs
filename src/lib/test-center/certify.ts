/**
 * Verdict de certification (§36). Aucune exécution incomplète n'est présentée comme réussie :
 * - INCONCLUSIVE : l'instrument n'est pas fiable (auto-validation en échec) ou des vérifications
 *   clés n'ont pas pu s'exécuter (migrations non vérifiées, invariants ignorés).
 * - BLOCKED : nettoyage incomplet, constat critique, ou échec bloquant.
 * - CERTIFIED_WITH_RESERVATIONS : rien de bloquant, mais des constats non bloquants subsistent.
 * - CERTIFIED : aucun constat bloquant, instrument fiable, nettoyage vérifié.
 */

export type Certification = "CERTIFIED" | "CERTIFIED_WITH_RESERVATIONS" | "BLOCKED" | "INCONCLUSIVE";

export interface CertificationInput {
  criticalCount: number;
  blockingFailures: number;
  cleanupStatus: string;
  selfValidationOk: boolean;
  invariantsSkipped: number;
  migrationsChecked: boolean;
  findingCounts: { critical: number; high: number; medium: number; low: number; info: number };
}

export interface CertificationResult { status: Certification; reasons: string[] }

export function computeCertification(i: CertificationInput): CertificationResult {
  const reasons: string[] = [];

  // 1) L'instrument doit être fiable, sinon on ne conclut pas.
  if (!i.selfValidationOk) {
    reasons.push("Auto-validation du testeur en échec — verdict non fiable.");
    return { status: "INCONCLUSIVE", reasons };
  }

  // 2) Bloquants → BLOCKED.
  if (i.cleanupStatus === "INCOMPLETE") reasons.push("Nettoyage incomplet.");
  if (i.criticalCount > 0) reasons.push(`${i.criticalCount} constat(s) critique(s).`);
  if (i.blockingFailures > 0) reasons.push(`${i.blockingFailures} échec(s) bloquant(s).`);
  if (i.cleanupStatus === "INCOMPLETE" || i.criticalCount > 0 || i.blockingFailures > 0) {
    return { status: "BLOCKED", reasons };
  }

  // 3) Vérifications clés manquantes → on ne présente pas un run incomplet comme réussi.
  if (!i.migrationsChecked) reasons.push("Migrations non vérifiées dans cet environnement.");
  if (i.invariantsSkipped > 0) reasons.push(`${i.invariantsSkipped} invariant(s) non vérifiable(s).`);
  if (!i.migrationsChecked || i.invariantsSkipped > 0) {
    return { status: "INCONCLUSIVE", reasons };
  }

  // 4) Réserves si des constats non bloquants subsistent.
  const nonBlocking = i.findingCounts.high + i.findingCounts.medium + i.findingCounts.low;
  if (nonBlocking > 0) {
    reasons.push(`${nonBlocking} constat(s) non bloquant(s) à traiter.`);
    return { status: "CERTIFIED_WITH_RESERVATIONS", reasons };
  }

  reasons.push("Aucun constat bloquant, instrument fiable, nettoyage vérifié.");
  return { status: "CERTIFIED", reasons };
}
