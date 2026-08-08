import type { RegCaseOutcome } from "@prisma/client";

/**
 * Libellés des issues d'études de cas — module PUR (importable par les composants client sans
 * embarquer Prisma ni l'extraction ; cf. client-bundle-guard).
 */
export const OUTCOME_LABELS: Record<RegCaseOutcome, string> = {
  ACCEPTED: "ACCEPTÉ sans réserve",
  ACCEPTED_WITH_RESERVES: "ACCEPTÉ AVEC RÉSERVES",
  REJECTED: "REJETÉ",
  UNKNOWN: "issue non renseignée",
};

/** Ton visuel par issue (classes utilitaires). */
export const OUTCOME_TONES: Record<RegCaseOutcome, string> = {
  ACCEPTED: "bg-success/10 text-success",
  ACCEPTED_WITH_RESERVES: "bg-amber-500/10 text-amber-600",
  REJECTED: "bg-destructive/10 text-destructive",
  UNKNOWN: "bg-secondary text-muted-foreground",
};

export const OUTCOME_ORDER: RegCaseOutcome[] = ["ACCEPTED", "ACCEPTED_WITH_RESERVES", "REJECTED", "UNKNOWN"];
