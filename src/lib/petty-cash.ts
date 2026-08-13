/**
 * CAISSE D'AVANCE — l'argent qu'on a EN MAIN, distinct du budget qu'on a le DROIT de dépenser.
 *
 * Chaque mois, l'entreprise remet une somme à celle qui achète au quotidien. Elle confirme
 * l'avoir reçue — sans cette confirmation, on ne sait pas si l'argent a changé de mains — puis
 * chaque dépense en est déduite, justificatif à l'appui, jusqu'à épuisement. Quand le fond
 * s'épuise, elle demande une rallonge.
 *
 * Le budget et la caisse répondent à deux questions différentes : « ai-je le droit ? » et
 * « me reste-t-il de quoi payer ? ». Les confondre, c'est ne plus savoir combien il y a dans
 * le tiroir. Ce module ne calcule que la seconde.
 *
 * Module PUR — testé.
 */

export type PettyCashStatus = "ALLOTTED" | "RECEIVED" | "CLOSED";

export const PETTY_CASH_STATUS_LABEL: Record<PettyCashStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  ALLOTTED: { label: "Remise à confirmer", tone: "warning" },
  RECEIVED: { label: "Reçue — caisse ouverte", tone: "success" },
  CLOSED: { label: "Caisse soldée", tone: "neutral" },
};

export interface PettyCashLine {
  id: string;
  label: string;
  amount: number;
  date: string;
}

export interface PettyCashState {
  id: string;
  period: string;
  amount: number;
  status: PettyCashStatus;
}

export interface PettyCashBalance {
  /** Ce qui a été remis (0 tant que la réception n'est pas confirmée : rien n'est en main). */
  received: number;
  spent: number;
  remaining: number;
  /** Part consommée, bornée à 100 % — le dépassement se dit par le signe du solde. */
  usedPercent: number;
  /** Le fond est-il presque épuisé ? Seuil bas : on demande une rallonge AVANT d'être à sec. */
  lowOnCash: boolean;
  /** A-t-on dépensé plus que ce qui a été remis ? Anomalie à corriger, pas un état normal. */
  overspent: boolean;
}

/** En dessous, on prévient : demander une rallonge une fois à zéro, c'est déjà trop tard. */
export const LOW_CASH_RATIO = 0.2;

/**
 * Le solde de la caisse. Tant que la réception n'est pas confirmée, `received` vaut 0 — la
 * somme est *décidée*, pas *détenue*, et afficher un solde disponible avant d'avoir l'argent
 * conduit à engager des dépenses qu'on ne peut pas payer.
 */
export function pettyCashBalance(allotment: PettyCashState | null, lines: PettyCashLine[]): PettyCashBalance {
  const received = allotment && allotment.status !== "ALLOTTED" ? allotment.amount : 0;
  const spent = lines.reduce((a, l) => a + l.amount, 0);
  const remaining = received - spent;
  const usedPercent = received > 0 ? Math.min(100, Math.round((spent / received) * 100)) : 0;
  return {
    received,
    spent,
    remaining,
    usedPercent,
    lowOnCash: received > 0 && remaining > 0 && remaining <= received * LOW_CASH_RATIO,
    overspent: remaining < 0,
  };
}

/**
 * Le solde de la caisse EN METTANT DE CÔTÉ une dépense — celle qu'on est en train de corriger.
 *
 * Sans cette mise à l'écart, corriger une dépense de 8 000 DZD sur un fond de 10 000 comparerait
 * le nouveau montant à un solde qui compte encore l'ancien : une simple correction de libellé
 * serait refusée « faute d'argent », alors que la place existe — elle est occupée par la ligne
 * qu'on modifie.
 */
export function pettyCashBalanceExcluding(
  allotment: PettyCashState | null,
  lines: PettyCashLine[],
  excludeId: string,
): PettyCashBalance {
  return pettyCashBalance(allotment, lines.filter((l) => l.id !== excludeId));
}

/**
 * Peut-on imputer une dépense sur cette caisse ?
 *
 * Trois refus, et ils ne disent pas la même chose : pas de caisse ouverte, argent pas encore
 * reçu, ou fond insuffisant. Le message doit le dire — « impossible » n'indique à personne
 * quoi faire ensuite.
 */
export function canSpendFromPettyCash(
  allotment: PettyCashState | null,
  balance: PettyCashBalance,
  amount: number,
): { ok: boolean; reason?: string } {
  if (!allotment) return { ok: false, reason: "Aucune caisse d'avance ouverte pour cette période." };
  if (allotment.status === "ALLOTTED") {
    return { ok: false, reason: "Confirmez d'abord la réception de la somme : on ne dépense pas un argent qu'on n'a pas encore." };
  }
  if (allotment.status === "CLOSED") return { ok: false, reason: "Cette caisse est soldée." };
  if (!(amount > 0)) return { ok: false, reason: "Indiquez le montant de la dépense." };
  if (amount > balance.remaining) {
    return {
      ok: false,
      reason: `Il ne reste que ${Math.max(0, balance.remaining)} DZD dans la caisse : demandez une rallonge avant d'engager cette dépense.`,
    };
  }
  return { ok: true };
}

/** Le mois courant au format « AAAA-MM » — la clé d'une caisse. */
export function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 2026-08 » → « août 2026 ». Un mois se lit en toutes lettres, pas en code. */
export function periodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return period;
  return `${MONTHS_FR[month - 1]} ${m[1]}`;
}

// ─────────────────── Réglage mensuel et rappel des 48 heures ───────────────────

/**
 * Le rechargement se fait un JOUR FIXE du mois, réglé par les ressources humaines. On borne à
 * 28 : le 30 ou le 31 n'existent pas tous les mois, et « le 31 février » se traduirait en
 * silence par une date que personne n'attend.
 */
export const MAX_RECHARGE_DAY = 28;

/** Normalise le jour de rechargement saisi. Hors bornes = 1er du mois, jamais une date fantôme. */
export function normalizeRechargeDay(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_RECHARGE_DAY) return 1;
  return n;
}

/**
 * La PROCHAINE date de rechargement, à partir d'un instant donné.
 *
 * Le jour du mois lui-même compte encore : tant que la journée n'est pas passée, le
 * rechargement du mois en cours est « à venir ». Sinon, le rappel du dernier jour sauterait
 * directement au mois suivant.
 */
export function nextRechargeDate(day: number, now: Date): Date {
  const d = normalizeRechargeDay(day);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), d, 9, 0, 0, 0);
  if (thisMonth >= startOfDay(now)) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, d, 9, 0, 0, 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Deux jours pleins : de quoi préparer la somme, pas de quoi l'oublier. */
export const REMINDER_LEAD_HOURS = 48;

/**
 * Faut-il prévenir les ressources humaines MAINTENANT du prochain rechargement ?
 *
 * Trois conditions, et la troisième porte tout : on entre dans la fenêtre des 48 h, le plan est
 * actif, et **le rappel de cette échéance n'est pas déjà parti**. Sans cette dernière, le
 * battement du planificateur — qui repasse toutes les minutes — enverrait la même alerte des
 * centaines de fois. `lastReminderPeriod` retient l'échéance déjà annoncée, pas la date d'envoi :
 * c'est ce qui rend la règle idempotente même après un redémarrage.
 *
 * Fonction PURE — testée.
 */
export function shouldRemindRecharge(
  plan: { rechargeDay: number; isActive: boolean; lastReminderPeriod: string | null },
  now: Date,
): { due: boolean; period: string; at: Date } {
  const at = nextRechargeDate(plan.rechargeDay, now);
  const period = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
  if (!plan.isActive) return { due: false, period, at };
  if (plan.lastReminderPeriod === period) return { due: false, period, at };
  const hoursAway = (at.getTime() - now.getTime()) / 3_600_000;
  return { due: hoursAway >= 0 && hoursAway <= REMINDER_LEAD_HOURS, period, at };
}

/**
 * DÉCISION DES RH sur une rallonge : accordée (au montant QU'ELLES écrivent), ou refusée.
 *
 * Le montant accordé est rarement celui demandé — c'est même l'intérêt de la décision. On
 * retient donc ce que les RH ont écrit ; à défaut seulement, le montant demandé.
 */
export function grantedTopUpAmount(
  request: { amountRequested: number },
  writtenAmount: number | null | undefined,
): number {
  return writtenAmount != null && writtenAmount >= 0 ? writtenAmount : request.amountRequested;
}
