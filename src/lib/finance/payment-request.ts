/**
 * LA DEMANDE DE PAIEMENT — les règles d'un dossier qui fait des allers-retours.
 *
 * Une demande de paiement n'est pas une validation ordinaire. Une validation ordinaire se
 * tranche une fois : oui, non. Un dossier de paiement, lui, revient — parce qu'une facture est
 * illisible, parce que le bon de commande manque, parce que le montant ne correspond pas au
 * devis. Le modéliser comme un « oui/non » oblige à tout redéposer au moindre détail, et l'on
 * finit par contourner l'outil.
 *
 * D'où trois principes, qui gouvernent tout ce fichier :
 *
 *   1. **Le verdict se donne PIÈCE PAR PIÈCE.** Refuser un dossier entier parce qu'une facture
 *      est floue oblige à redéposer le bon de commande, le devis et le bon de livraison qui,
 *      eux, allaient très bien. On ne reprend que ce qui est en cause.
 *   2. **L'état du dossier se DÉDUIT de ses pièces.** Personne ne coche « à revoir » en même
 *      temps qu'il refuse une facture : c'est un travail de secrétariat, et un travail de
 *      secrétariat finit par être oublié. L'état suit les verdicts, mécaniquement.
 *   3. **« En attente » n'est pas « refusée ».** La première reviendra, la seconde non. Les
 *      confondre, c'est relancer les finances pour rien, ou laisser mourir un dossier qui
 *      attendait une simple trésorerie.
 *
 * Module PUR — testé.
 */

export type PaymentState =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ON_HOLD"
  | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export type PieceState = "PENDING" | "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED";

export type PaymentMove =
  /** Le demandeur envoie son dossier aux Finances. */
  | "SUBMIT"
  /** Les Finances ouvrent l'instruction. */
  | "REVIEW"
  /** Les Finances suspendent, avec un motif. */
  | "HOLD"
  /** On reprend une demande suspendue. */
  | "RESUME"
  /** Les Finances renvoient le dossier au demandeur. */
  | "REQUEST_CHANGES"
  /** Bon à payer. */
  | "APPROVE"
  /** Refus définitif. */
  | "REJECT"
  /** Le demandeur retire sa demande. */
  | "CANCEL";

const MOVES: Record<PaymentState, Partial<Record<PaymentMove, PaymentState>>> = {
  DRAFT: { SUBMIT: "SUBMITTED", CANCEL: "CANCELLED" },
  SUBMITTED: { REVIEW: "UNDER_REVIEW", HOLD: "ON_HOLD", REQUEST_CHANGES: "CHANGES_REQUESTED", APPROVE: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED" },
  UNDER_REVIEW: { HOLD: "ON_HOLD", REQUEST_CHANGES: "CHANGES_REQUESTED", APPROVE: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED" },
  // Une demande suspendue reprend là où elle en était, et peut aussi être tranchée directement :
  // la trésorerie débloquée n'oblige pas à refaire un tour d'instruction.
  ON_HOLD: { RESUME: "UNDER_REVIEW", APPROVE: "APPROVED", REJECT: "REJECTED", REQUEST_CHANGES: "CHANGES_REQUESTED", CANCEL: "CANCELLED" },
  // Renvoyée au demandeur : elle repart chez les Finances dès qu'il a corrigé — sur le MÊME
  // dossier. Créer une deuxième demande couperait le fil et perdrait l'historique des refus.
  CHANGES_REQUESTED: { SUBMIT: "SUBMITTED", CANCEL: "CANCELLED" },
  APPROVED: {},
  REJECTED: {},
  CANCELLED: {},
};

export function nextPaymentStatus(from: string, move: PaymentMove): PaymentState | null {
  const table = MOVES[from as PaymentState];
  return table ? table[move] ?? null : null;
}

/** Le dossier est-il encore entre les mains des Finances ? */
export function isWithFinance(status: string): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "ON_HOLD";
}

/** Le demandeur a-t-il la main — pour compléter, corriger, renvoyer ? */
export function isWithRequester(status: string): boolean {
  return status === "DRAFT" || status === "CHANGES_REQUESTED";
}

/** Un dossier clos ne bouge plus : ni pièce ajoutée, ni verdict changé. */
export function isClosed(status: string): boolean {
  return status === "APPROVED" || status === "REJECTED" || status === "CANCELLED";
}

export interface PieceLike { status: string }

export interface PieceTally {
  total: number;
  pending: number;
  accepted: number;
  toFix: number;
  rejected: number;
}

export function tallyPieces(pieces: readonly PieceLike[]): PieceTally {
  const t: PieceTally = { total: pieces.length, pending: 0, accepted: 0, toFix: 0, rejected: 0 };
  for (const p of pieces) {
    if (p.status === "ACCEPTED") t.accepted += 1;
    else if (p.status === "CHANGES_REQUESTED") t.toFix += 1;
    else if (p.status === "REJECTED") t.rejected += 1;
    else t.pending += 1;
  }
  return t;
}

/**
 * L'ÉTAT QUE LE DOSSIER DEVRAIT AVOIR, d'après ses pièces.
 *
 * Dès qu'une pièce est à revoir, la balle est dans le camp du demandeur — et l'écran doit le
 * dire sans attendre que quelqu'un pense à changer le statut à la main. `null` = les verdicts
 * ne dictent rien, on garde l'état courant (les Finances peuvent instruire pièce par pièce sans
 * que le dossier change de camp à chaque clic).
 */
export function statusFromPieces(current: string, pieces: readonly PieceLike[]): PaymentState | null {
  if (isClosed(current)) return null;
  const t = tallyPieces(pieces);
  if (t.toFix > 0 || t.rejected > 0) {
    return current === "CHANGES_REQUESTED" ? null : "CHANGES_REQUESTED";
  }
  // Plus rien à corriger et le dossier était renvoyé : il retourne aux Finances de lui-même.
  if (current === "CHANGES_REQUESTED" && t.total > 0 && t.pending + t.accepted === t.total) return "SUBMITTED";
  return null;
}

/**
 * Peut-on donner le bon à payer ?
 *
 * Un paiement autorisé alors qu'une pièce est refusée serait un paiement sans justificatif —
 * exactement ce que le dossier existe pour empêcher. On répond par un motif lisible plutôt que
 * par un bouton grisé sans explication.
 */
export function canApprove(request: { status: string; amount: number | null }, pieces: readonly PieceLike[]): { ok: boolean; reason?: string } {
  if (isClosed(request.status)) return { ok: false, reason: "Ce dossier est déjà clos." };
  if (request.amount == null || request.amount <= 0) return { ok: false, reason: "Le montant doit être renseigné." };
  if (pieces.length === 0) return { ok: false, reason: "Aucune pièce jointe : un paiement sans justificatif ne s'autorise pas." };
  const t = tallyPieces(pieces);
  if (t.rejected > 0) return { ok: false, reason: `${t.rejected} pièce(s) refusée(s) — le dossier ne peut pas être payé en l'état.` };
  if (t.toFix > 0) return { ok: false, reason: `${t.toFix} pièce(s) à revoir — attendez la reprise du demandeur.` };
  if (t.accepted === 0) return { ok: false, reason: "Aucune pièce validée pour l'instant." };
  return { ok: true };
}

/** Le demandeur peut-il renvoyer son dossier ? */
export function canResubmit(request: { status: string }, pieces: readonly PieceLike[]): { ok: boolean; reason?: string } {
  if (!isWithRequester(request.status)) return { ok: false, reason: "Le dossier est chez les Finances." };
  if (pieces.length === 0) return { ok: false, reason: "Joignez au moins une pièce — facture, bon de commande, devis…" };
  const t = tallyPieces(pieces);
  if (t.toFix > 0) return { ok: false, reason: `${t.toFix} pièce(s) restent à corriger.` };
  if (t.rejected > 0) return { ok: false, reason: `${t.rejected} pièce(s) refusée(s) : remplacez-les avant de renvoyer.` };
  return { ok: true };
}

/** Une pièce se remplace tant qu'elle est en cause — pas une fois acceptée. */
export function needsReplacement(status: string): boolean {
  return status === "CHANGES_REQUESTED" || status === "REJECTED";
}

// ───────────────────────── Priorité : la date, sinon l'urgence ─────────────────────────

/** Plus le rang est bas, plus c'est pressé. */
const URGENCY_RANK: Record<string, number> = { URGENT: 0, THIS_WEEK: 1, THIS_MONTH: 2, WHEN_POSSIBLE: 3 };

export function urgencyRank(urgency: string): number {
  return URGENCY_RANK[urgency] ?? 3;
}

/**
 * Ce que l'écran écrit dans la colonne « échéance ».
 *
 * Une demande sans date n'est pas une demande sans priorité : sans cette phrase, elle finit
 * systématiquement au bas de la pile parce que la colonne est vide.
 */
export function deadlineLabel(req: { dueDate: Date | string | null; urgency: string }, urgencyLabels: Record<string, string>): string {
  if (req.dueDate) {
    const d = req.dueDate instanceof Date ? req.dueDate : new Date(req.dueDate);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR");
  }
  return urgencyLabels[req.urgency] ?? "Dès que possible";
}

/** En retard : une échéance convenue, dépassée, sur un dossier encore ouvert. */
export function isOverdue(req: { status: string; dueDate: Date | string | null }, now: Date = new Date()): boolean {
  if (isClosed(req.status) || !req.dueDate) return false;
  const d = req.dueDate instanceof Date ? req.dueDate : new Date(req.dueDate);
  return !Number.isNaN(d.getTime()) && d < now;
}

export interface SortableRequest {
  status: string;
  dueDate: Date | string | null;
  urgency: string;
  createdAt: Date | string;
}

/**
 * L'ordre de la file des Finances : **ce qui presse d'abord**.
 *
 * Un tri par date de création enterre l'urgence de ce matin sous les dossiers du mois dernier.
 * On classe donc par échéance réelle — une date dépassée passe devant tout, puis les dates
 * proches, puis l'urgence déclarée, puis l'ancienneté.
 */
export function sortByPriority<T extends SortableRequest>(rows: readonly T[], now: Date = new Date()): T[] {
  const key = (r: T): [number, number, number, number] => {
    const overdue = isOverdue(r, now) ? 0 : 1;
    const due = r.dueDate ? new Date(r.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return [overdue, due, urgencyRank(r.urgency), new Date(r.createdAt).getTime()];
  };
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  });
}
