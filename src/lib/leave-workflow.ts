/**
 * CIRCUIT DE VALIDATION D'UN CONGÉ — trois marches successives : **N+1 → RH → DG**.
 *
 * Chacune répond à une question que les autres ne savent pas trancher : le responsable direct
 * connaît la charge de l'équipe et l'absence tolérable, les RH le solde acquis et le droit
 * applicable, la direction générale l'arbitrage final. Une seule signature ne pouvait pas
 * porter les trois.
 *
 * Un REFUS arrête tout : inutile de faire monter au DG ce que le responsable a déjà écarté —
 * et cruel de laisser espérer l'employé pendant deux étapes de plus.
 *
 * Module PUR (aucun accès base, aucun import lourd) : importable côté client comme serveur.
 */

export type LeaveStage = "MANAGER" | "HR" | "DG" | "DONE";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const LEAVE_STAGE_LABELS: Record<LeaveStage, string> = {
  MANAGER: "En attente du responsable (N+1)",
  HR: "En attente des ressources humaines",
  DG: "En attente de la direction générale",
  DONE: "Circuit terminé",
};

/** L'étape qui suit, quand la marche courante approuve. */
export function nextStage(stage: LeaveStage): LeaveStage {
  switch (stage) {
    case "MANAGER": return "HR";
    case "HR": return "DG";
    default: return "DONE";
  }
}

export interface LeaveDecider {
  id: string;
  /** Est-il le responsable hiérarchique (N+1) résolu pour cette demande ? */
  isManager: boolean;
  /** Porte-t-il la fonction RH (droit de valider sur le module RH) ? */
  isHr: boolean;
  /** Direction générale / vue globale / Super Admin. */
  isDg: boolean;
}

export interface LeaveState {
  status: LeaveStatus;
  stage: LeaveStage;
  /** Le demandeur — personne ne valide son propre congé. */
  requesterUserId?: string | null;
}

/**
 * Cette personne peut-elle trancher MAINTENANT ?
 *
 * Trois refus possibles, et ils ne disent pas la même chose : la demande est close, ce n'est pas
 * (encore) son tour, ou c'est sa propre demande. Le message doit le dire — « non autorisé » ne
 * permet à personne de comprendre quoi faire.
 */
export function canDecideLeave(state: LeaveState, decider: LeaveDecider): { ok: boolean; reason?: string } {
  if (state.status !== "PENDING" || state.stage === "DONE") {
    return { ok: false, reason: "Cette demande a déjà été traitée." };
  }
  if (state.requesterUserId && state.requesterUserId === decider.id && !decider.isDg) {
    // Le DG garde la main (il est parfois le seul au-dessus) ; personne d'autre ne s'auto-valide.
    return { ok: false, reason: "On ne valide pas sa propre demande de congé." };
  }
  switch (state.stage) {
    case "MANAGER":
      // Le DG peut trancher à toute étape : sans cela, un congé resterait bloqué quand le
      // responsable est absent — précisément la période où les congés se décident.
      if (decider.isManager || decider.isDg) return { ok: true };
      return { ok: false, reason: "En attente du responsable hiérarchique (N+1)." };
    case "HR":
      if (decider.isHr || decider.isDg) return { ok: true };
      return { ok: false, reason: "En attente des ressources humaines." };
    case "DG":
      if (decider.isDg) return { ok: true };
      return { ok: false, reason: "En attente de la direction générale." };
    default:
      return { ok: false, reason: "Circuit terminé." };
  }
}

export interface LeaveTransition {
  stage: LeaveStage;
  status: LeaveStatus;
  /** Le congé est-il DÉFINITIVEMENT accordé (dernière marche franchie) ? */
  granted: boolean;
}

/**
 * L'état APRÈS une décision. Approuver fait monter d'une marche ; la dernière (DG) accorde
 * définitivement. Refuser clôt le circuit sur-le-champ, quelle que soit la marche.
 * Fonction PURE — testée.
 */
export function applyLeaveDecision(stage: LeaveStage, decision: "APPROVED" | "REJECTED"): LeaveTransition {
  if (decision === "REJECTED") return { stage: "DONE", status: "REJECTED", granted: false };
  const next = nextStage(stage);
  if (next === "DONE") return { stage: "DONE", status: "APPROVED", granted: true };
  return { stage: next, status: "PENDING", granted: false };
}

/** Qui doit être prévenu de l'arrivée d'une demande à cette étape (rôles de repli). */
export function stageNotifyRoles(stage: LeaveStage): string[] {
  switch (stage) {
    case "HR": return ["RH_MANAGER", "SUPER_ADMIN"];
    case "DG": return ["DIRECTION", "SUPER_ADMIN"];
    default: return [];
  }
}
