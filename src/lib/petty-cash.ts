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
 * le tiroir.
 *
 * ── OÙ EST PASSÉ LE SOLDE ? ─────────────────────────────────────────────────────────────────
 *
 * Il vivait ici, calculé PAR MOIS. La caisse est devenue CONTINUE : une remise ne clôt plus le
 * mois précédent, et le solde se lit sur le fond entier — voir `general-means/continuous-cash.ts`,
 * désormais seul calculateur. Garder les deux aurait laissé deux arithmétiques qui se
 * contredisent dès la deuxième remise. Ce module garde ce qui n'a pas changé : le vocabulaire
 * des états, la lecture d'une période, et le RÉGLAGE MENSUEL du rechargement — qui, lui, reste
 * mensuel : c'est une échéance d'agenda, pas un cloisonnement de l'argent.
 *
 * Module PUR — testé.
 */

export type PettyCashStatus = "ALLOTTED" | "RECEIVED" | "CLOSED";

export const PETTY_CASH_STATUS_LABEL: Record<PettyCashStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  ALLOTTED: { label: "Remise à confirmer", tone: "warning" },
  RECEIVED: { label: "Reçue — caisse ouverte", tone: "success" },
  CLOSED: { label: "Caisse soldée", tone: "neutral" },
};

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
