import type { ExternalRegulatoryStatus, RegulatoryStatus } from "@prisma/client";

/**
 * Mapping SUGGÉRÉ statut interne → statut externe simplifié. L'équipe Regulatory
 * reste libre de surcharger explicitement le statut externe : ce mapping ne sert
 * qu'à proposer une valeur par défaut. Le fournisseur ne voit JAMAIS le statut
 * interne, uniquement le statut externe choisi.
 */
export const INTERNAL_TO_EXTERNAL: Record<RegulatoryStatus, ExternalRegulatoryStatus> = {
  PRE_SUBMISSION: "IN_PREPARATION",
  IN_PREPARATION: "IN_PREPARATION",
  SUBMITTED: "SUBMITTED",
  AWAITING_BV_PAYMENT: "UNDER_REVIEW",
  AWAITING_ANPP: "UNDER_REVIEW",
  RESPONDING_TO_QUERIES: "INFO_REQUESTED",
  DECISION_OBTAINED: "APPROVED",
  BLOCKED: "ON_HOLD",
  CLOSED: "CLOSED",
};

export function suggestedExternalStatus(internal: RegulatoryStatus): ExternalRegulatoryStatus {
  return INTERNAL_TO_EXTERNAL[internal] ?? "IN_PREPARATION";
}
