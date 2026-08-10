import type { ChainStage } from "@/lib/approval-chain";

/**
 * FORMATION — deux origines, un seul objet, deux points de départ dans le circuit.
 *
 * Un salarié qui DEMANDE une formation la fait monter comme un congé : son responsable
 * (charge de l'équipe), les RH (droit et budget), la direction (arbitrage). Les RH qui en
 * ORGANISENT une n'ont, elles, personne à consulter en amont — elles SONT l'étape RH, et
 * leur demande part directement à la direction. Faire passer les RH par elles-mêmes serait
 * une signature vide, et faire passer une formation d'équipe par le N+1 d'un organisateur
 * n'aurait pas de sens : ce n'est pas son équipe.
 *
 * Module PUR — testé.
 */

export type TrainingOrigin = "EMPLOYEE" | "HR";
export type TrainingStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "DONE";
export type TrainingAttendance = "MANDATORY" | "VOLUNTARY";
export type TrainingParticipantState = "INVITED" | "ACCEPTED" | "DECLINED";

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "info" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  PENDING: { label: "En validation", tone: "warning" },
  APPROVED: { label: "Accordée", tone: "success" },
  REJECTED: { label: "Refusée", tone: "danger" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
  DONE: { label: "Réalisée", tone: "info" },
};

export const ATTENDANCE_LABELS: Record<TrainingAttendance, string> = {
  MANDATORY: "Obligatoire",
  VOLUNTARY: "Sur la base du volontariat",
};

export const PARTICIPANT_STATE_LABELS: Record<TrainingParticipantState, { label: string; tone: "neutral" | "success" | "danger" }> = {
  INVITED: { label: "Invité", tone: "neutral" },
  ACCEPTED: { label: "Accepte", tone: "success" },
  DECLINED: { label: "Décline", tone: "danger" },
};

/**
 * L'étape de DÉPART du circuit, selon l'origine.
 *
 * Sans responsable résolu, une demande de salarié entre directement à l'étape RH plutôt que
 * d'attendre dans le vide une signature que personne ne peut donner.
 */
export function initialTrainingStage(origin: TrainingOrigin, hasManager: boolean): ChainStage {
  if (origin === "HR") return "DG";
  return hasManager ? "MANAGER" : "HR";
}

/**
 * Une invitation OBLIGATOIRE n'attend pas de réponse : convoquer puis demander l'accord
 * viderait le mot « obligatoire » de son sens. On enregistre donc directement la présence.
 */
export function initialParticipantState(attendance: TrainingAttendance): TrainingParticipantState {
  return attendance === "MANDATORY" ? "ACCEPTED" : "INVITED";
}

/** Le participant peut-il répondre ? Seulement s'il a le CHOIX, et une seule fois. */
export function canRespondToInvitation(
  participant: { attendance: TrainingAttendance; state: TrainingParticipantState },
): { ok: boolean; reason?: string } {
  if (participant.attendance === "MANDATORY") {
    return { ok: false, reason: "Cette formation est obligatoire : votre présence est attendue." };
  }
  if (participant.state !== "INVITED") {
    return { ok: false, reason: "Vous avez déjà répondu à cette invitation." };
  }
  return { ok: true };
}

export interface ParticipantCounts {
  total: number;
  mandatory: number;
  accepted: number;
  declined: number;
  awaiting: number;
  /** Effectif à prévoir : les convoqués plus ceux qui ont dit oui. Ce qui sert au traiteur. */
  expected: number;
}

/**
 * Le décompte qui sert vraiment : combien de personnes prévoir. « 12 invités » ne dit rien au
 * traiteur ni au loueur de salle — ce qu'il faut, c'est les convoqués plus ceux qui ont
 * accepté, et le nombre de réponses encore attendues.
 */
export function countParticipants(
  list: { attendance: TrainingAttendance; state: TrainingParticipantState }[],
): ParticipantCounts {
  let mandatory = 0, accepted = 0, declined = 0, awaiting = 0;
  for (const p of list) {
    if (p.attendance === "MANDATORY") mandatory += 1;
    if (p.state === "ACCEPTED") accepted += 1;
    else if (p.state === "DECLINED") declined += 1;
    else awaiting += 1;
  }
  return { total: list.length, mandatory, accepted, declined, awaiting, expected: accepted };
}

/**
 * Peut-on encore MODIFIER la formation ? Ce qui a fondé une décision ne se réécrit pas :
 * changer le montant après un accord transformerait la décision en autre chose que ce qui a
 * été signé.
 */
export function canEditTraining(
  training: { status: TrainingStatus; requesterId: string | null },
  viewer: { id: string; isHr: boolean; isDg: boolean },
): boolean {
  if (viewer.isDg) return true;
  if (training.status !== "DRAFT" && training.status !== "PENDING") return false;
  return training.requesterId === viewer.id || viewer.isHr;
}

/** Une formation accordée mais non chiffrée n'engage rien : le budget attend un montant. */
export function grantedAmount(training: { amount: number; amountGranted: number | null }): number {
  return training.amountGranted ?? training.amount;
}
