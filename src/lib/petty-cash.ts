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
