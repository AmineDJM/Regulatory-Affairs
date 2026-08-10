/**
 * SUPERVISION DES VALIDATIONS — la vue de la Direction.
 *
 * La page listait « toutes les demandes en cours » : cent cartes de même taille, dans l'ordre
 * de création, sans dire laquelle attend depuis trois semaines ni QUI la retient. Or c'est la
 * seule question que se pose un directeur devant cette liste : **qu'est-ce qui est coincé, et
 * chez qui ?** L'ordre chronologique y répond par hasard.
 *
 * Ce module classe, compte et filtre. Il est PUR — pas d'accès base, pas de date implicite
 * (`now` est toujours passé) : c'est ce qui permet de tester « en retard de deux jours » sans
 * attendre deux jours.
 */

export type Urgency = "OVERDUE" | "DUE_SOON" | "STALLED" | "NORMAL";

export interface SupervisedRow {
  id: string;
  reference: string;
  title: string;
  module: string;
  requester: string;
  amount: number | null;
  priority: string;
  createdAt: string;
  deadline: string | null;
  /** Le validateur dont on attend la décision — la réponse à « chez qui ça bloque ? ». */
  blockingValidator: string | null;
  blockingStepId: string | null;
  blockingOrder: number | null;
}

/** Jours entiers écoulés depuis une date ISO (négatif si elle est à venir). */
export function daysSince(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Jours restants avant une échéance ISO (négatif = dépassée). */
export function daysLeft(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.ceil((t - now.getTime()) / 86_400_000);
}

/** Au-delà, une demande n'est plus « en cours » : elle est oubliée. */
export const STALLED_DAYS = 7;

/**
 * L'urgence d'une demande, dans l'ordre où elle compte :
 *   • **échéance dépassée** — la promesse est déjà rompue ;
 *   • **échéance sous 3 jours** — encore rattrapable, c'est maintenant qu'on agit ;
 *   • **enlisée** — pas d'échéance, mais sept jours sans décision ; personne ne la réclamera ;
 *   • normale.
 *
 * L'ordre n'est pas discutable : une demande en retard passe devant une demande urgente, qui
 * passe devant une demande oubliée. Fonction PURE — testée.
 */
export function urgencyOf(row: SupervisedRow, now: Date): Urgency {
  if (row.deadline) {
    const left = daysLeft(row.deadline, now);
    if (left < 0) return "OVERDUE";
    if (left <= 3) return "DUE_SOON";
  }
  if (daysSince(row.createdAt, now) >= STALLED_DAYS) return "STALLED";
  return "NORMAL";
}

const URGENCY_RANK: Record<Urgency, number> = { OVERDUE: 0, DUE_SOON: 1, STALLED: 2, NORMAL: 3 };

export const URGENCY_LABEL: Record<Urgency, string> = {
  OVERDUE: "En retard",
  DUE_SOON: "Échéance proche",
  STALLED: `Sans décision depuis ${STALLED_DAYS} j`,
  NORMAL: "En cours",
};

export const URGENCY_TONE: Record<Urgency, "danger" | "warning" | "info" | "neutral"> = {
  OVERDUE: "danger",
  DUE_SOON: "warning",
  STALLED: "info",
  NORMAL: "neutral",
};

/**
 * Trie par urgence, puis par ancienneté DÉCROISSANTE d'attente : à urgence égale, la plus
 * vieille passe devant. Trier par date de création « la plus récente d'abord », comme le
 * faisait la page, mettait au contraire les nouvelles en tête — exactement à l'envers de ce
 * qu'on cherche.
 */
export function sortByUrgency<T extends SupervisedRow>(rows: T[], now: Date): T[] {
  return [...rows].sort((a, b) => {
    const d = URGENCY_RANK[urgencyOf(a, now)] - URGENCY_RANK[urgencyOf(b, now)];
    if (d !== 0) return d;
    return daysSince(b.createdAt, now) - daysSince(a.createdAt, now);
  });
}

export interface SupervisionCounters {
  total: number;
  overdue: number;
  dueSoon: number;
  stalled: number;
  /** Montant cumulé engagé par les demandes en attente — l'argent immobilisé par une signature. */
  amountPending: number;
}

/** Ce qui se lit en haut de l'écran, avant toute liste. */
export function supervisionCounters(rows: SupervisedRow[], now: Date): SupervisionCounters {
  let overdue = 0, dueSoon = 0, stalled = 0, amountPending = 0;
  for (const r of rows) {
    const u = urgencyOf(r, now);
    if (u === "OVERDUE") overdue += 1;
    else if (u === "DUE_SOON") dueSoon += 1;
    else if (u === "STALLED") stalled += 1;
    amountPending += r.amount ?? 0;
  }
  return { total: rows.length, overdue, dueSoon, stalled, amountPending };
}

export type SupervisionFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "STALLED";

/**
 * Filtre par urgence et par texte libre. La recherche porte sur ce qu'on tape réellement :
 * une référence, un objet, un module, le demandeur — et **le validateur qui bloque**, parce
 * que « qu'est-ce qui attend Karim ? » est une question qu'on pose tous les jours.
 */
export function filterSupervised<T extends SupervisedRow>(
  rows: T[], now: Date, filter: SupervisionFilter, query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter !== "ALL" && urgencyOf(r, now) !== filter) return false;
    if (!q) return true;
    return [r.reference, r.title, r.module, r.requester, r.blockingValidator ?? ""]
      .some((v) => v.toLowerCase().includes(q));
  });
}
