/**
 * L'ONGLET « TÂCHES » DE MON ESPACE — où range-t-on chaque tâche, et comment se lit-elle.
 *
 * Il y avait cinq listes dispersées dans « Mon espace » (demandées, mes tâches, où je participe, en
 * lecture, que j'ai demandées, déléguées) : on ne savait jamais laquelle ouvrir. Un seul endroit,
 * quatre vues (Direction, 07/10) :
 *
 *   • À ACCEPTER — on me demande quelque chose : j'accepte ou je refuse, en haut, avant tout ;
 *   • À FAIRE    — ce qui est chez moi : demandes acceptées, mes to-do, tâches créées par la plateforme ;
 *   • DEMANDÉES  — ce que j'attends des autres, avec « chez qui » et le seul geste utile ;
 *   • PARTAGÉES  — je participe ou je lis ;
 *   • TERMINÉES  — les 30 derniers jours (lue à part, paginée).
 *
 * Module PUR — sans base, sans import lourd : la page serveur et le composant client le lisent, et le
 * banc le rejoue (`onglet-taches.test.ts`).
 */
import { algiersYmd, ALGIERS_TZ } from "@/lib/calendar-tz";
import { isRequest, type TaskLike } from "@/lib/tasks/request-flow";

export const ONGLET_TACHES_HREF = "/mon-espace/taches";

export type VueTaches = "a-faire" | "demandees" | "partagees" | "terminees";

export const VUES_TACHES: { cle: VueTaches; libelle: string }[] = [
  { cle: "a-faire", libelle: "À faire" },
  { cle: "demandees", libelle: "Demandées" },
  { cle: "partagees", libelle: "Partagées" },
  { cle: "terminees", libelle: "Terminées" },
];

/** Le paramètre d'URL `?vue=` lu sans confiance : tout ce qui n'est pas une vue connue → « À faire ». */
export function lireVue(v: string | string[] | undefined | null): VueTaches {
  const s = Array.isArray(v) ? v[0] : v;
  return VUES_TACHES.some((x) => x.cle === s) ? (s as VueTaches) : "a-faire";
}

/** Une demande rendue reste « à vérifier » chez son demandeur une semaine, puis rejoint « Terminées ». */
export const A_VERIFIER_JOURS = 7;
/** Un refus reste sous les yeux du demandeur un mois : il doit réattribuer, ou renoncer. */
export const REFUS_VISIBLE_JOURS = 30;
/** « Terminées » remonte un mois. */
export const TERMINEES_JOURS = 30;
export const TERMINEES_PAR_PAGE = 25;

const JOUR_MS = 86_400_000;

export interface TacheRangeable extends TaskLike {
  dueDate?: string | Date | null;
  completedAt?: string | Date | null;
  respondedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export type Rangement = "a-accepter" | "a-faire" | "demandees" | "partagees" | null;

const ms = (d: string | Date | null | undefined): number | null => {
  if (!d) return null;
  const n = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(n) ? n : null;
};

const OUVERTS = ["TODO", "IN_PROGRESS"];

/**
 * OÙ VA CETTE TÂCHE, POUR CETTE PERSONNE — une seule place, ou aucune (terminée : lue à part).
 *
 * L'ordre des questions compte : d'abord ce qu'on me demande (j'en suis le destinataire), puis ce qui
 * est chez moi, puis ce que j'ai demandé à d'autres, enfin ce qu'on m'a partagé.
 */
export function rangerTache(t: TacheRangeable, userId: string, now: number = Date.now()): Rangement {
  const chezMoi = t.assignedToId === userId || (!t.assignedToId && t.createdById === userId);
  if (t.status === "REQUESTED" && t.assignedToId === userId) return "a-accepter";
  if (chezMoi) return OUVERTS.includes(t.status) ? "a-faire" : null;

  if (t.createdById === userId && t.assignedToId) {
    if (t.status === "REQUESTED" || OUVERTS.includes(t.status)) return "demandees";
    if (t.status === "DECLINED") {
      const quand = ms(t.respondedAt) ?? ms(t.updatedAt);
      return quand !== null && now - quand <= REFUS_VISIBLE_JOURS * JOUR_MS ? "demandees" : null;
    }
    if (t.status === "DONE" && isRequest(t)) {
      const quand = ms(t.completedAt);
      return quand !== null && now - quand <= A_VERIFIER_JOURS * JOUR_MS ? "demandees" : null;
    }
    return null;
  }

  const partagee = (t.participantIds ?? []).includes(userId) || (t.readerIds ?? []).includes(userId);
  if (partagee && (t.status === "REQUESTED" || OUVERTS.includes(t.status))) return "partagees";
  return null;
}

export interface CompteursTaches { aAccepter: number; aFaire: number; demandees: number; partagees: number }

export function compterVues(taches: TacheRangeable[], userId: string, now: number = Date.now()): CompteursTaches {
  const c: CompteursTaches = { aAccepter: 0, aFaire: 0, demandees: 0, partagees: 0 };
  for (const t of taches) {
    const r = rangerTache(t, userId, now);
    if (r === "a-accepter") c.aAccepter++;
    else if (r === "a-faire") c.aFaire++;
    else if (r === "demandees") c.demandees++;
    else if (r === "partagees") c.partagees++;
  }
  return c;
}

/** Le chiffre de l'onglet : ce qui m'attend, MOI — à accepter et à faire. Pas ce que j'attends des autres. */
export function compteOnglet(c: Pick<CompteursTaches, "aAccepter" | "aFaire">): number {
  return c.aAccepter + c.aFaire;
}

const POIDS_PRIORITE: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Tri par échéance — la plus proche d'abord, les tâches sans échéance à la fin ; puis la priorité. */
export function trierParEcheance<T extends { dueDate?: string | Date | null; priority?: string | null; createdAt?: string | Date | null }>(liste: T[]): T[] {
  return [...liste].sort((a, b) => {
    const da = ms(a.dueDate), db = ms(b.dueDate);
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    const pa = POIDS_PRIORITE[a.priority ?? "MEDIUM"] ?? 2, pb = POIDS_PRIORITE[b.priority ?? "MEDIUM"] ?? 2;
    if (pa !== pb) return pa - pb;
    return (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0);
  });
}

/** Écart en jours CIVILS d'Alger entre aujourd'hui et une date (négatif = passée). */
export function joursAvant(date: string | Date, now: Date = new Date()): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const jour = (x: Date) => Date.parse(`${algiersYmd(x)}T00:00:00.000Z`) / JOUR_MS;
  return Math.round(jour(d) - jour(now));
}

export type TonEcheance = "retard" | "aujourdhui" | null;

/**
 * L'ÉCHÉANCE COMME ON LA DIT — « hier », « aujourd'hui », « demain », « vendredi », puis « 3 nov. ».
 * En retard : rouge ; aujourd'hui : orange. Une tâche close n'est plus « en retard ».
 */
export function echeanceLisible(
  due: string | Date | null | undefined,
  now: Date = new Date(),
  close = false,
): { texte: string; ton: TonEcheance } {
  if (!due) return { texte: "—", ton: null };
  const d = typeof due === "string" ? new Date(due) : due;
  if (Number.isNaN(d.getTime())) return { texte: "—", ton: null };
  const n = joursAvant(d, now);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: ALGIERS_TZ, ...o }).format(d);
  const memeAnnee = algiersYmd(d).slice(0, 4) === algiersYmd(now).slice(0, 4);
  const date = fmt(memeAnnee ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const texte = n === -1 ? "hier" : n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n >= 2 && n <= 6 ? fmt({ weekday: "long" }) : date;
  if (close) return { texte, ton: null };
  return { texte, ton: n < 0 ? "retard" : n === 0 ? "aujourdhui" : null };
}

/** « Brahim Rahmoune » → « Brahim R. » — la colonne « De » tient sur une ligne. */
export function nomCourt(nom: string | null | undefined): string {
  const parts = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** Qui l'a demandée : « Automatique » (créée par un circuit), « moi », ou la personne. */
export function deQui(t: Pick<TaskLike, "createdById">, userId: string, nomCreateur: string | null | undefined): string {
  if (!t.createdById) return "Automatique";
  if (t.createdById === userId) return "moi";
  return nomCourt(nomCreateur);
}

export type TonEtat = "neutral" | "info" | "success" | "warning" | "danger";
export type GesteDemande = "relancer" | "verifier" | "reattribuer" | null;

/** Jours civils écoulés depuis un instant — jamais négatif. */
function joursDepuis(d: string | Date | null | undefined, now: Date): number | null {
  const n = ms(d);
  if (n === null) return null;
  return Math.max(0, -joursAvant(new Date(n), now));
}

const ilYA = (n: number | null): string => (n === null ? "" : n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`);

/**
 * OÙ EN EST CE QUE J'AI DEMANDÉ — et le SEUL geste utile.
 *
 * pas encore acceptée (n j) → Relancer · en cours → rien (Relancer si l'échéance est passée) ·
 * à vérifier (rendu hier) → Vérifier · refusée (« motif ») → Réattribuer.
 */
export function etatDemande(t: TacheRangeable & { declineReason?: string | null }, now: Date = new Date()): { libelle: string; ton: TonEtat; geste: GesteDemande } {
  const demande = isRequest(t);
  if (t.status === "REQUESTED") {
    const n = joursDepuis(t.requestedAt ?? t.createdAt, now);
    return { libelle: n ? `pas encore acceptée — ${n} j` : "pas encore acceptée", ton: "warning", geste: "relancer" };
  }
  if (t.status === "DECLINED") {
    const motif = (t.declineReason ?? "").trim();
    return { libelle: motif ? `refusée — « ${motif} »` : "refusée", ton: "danger", geste: "reattribuer" };
  }
  if (t.status === "DONE") {
    return { libelle: demande ? `à vérifier — rendu ${ilYA(joursDepuis(t.completedAt, now))}`.trim() : "terminée", ton: "success", geste: demande ? "verifier" : null };
  }
  if (t.status === "CANCELLED") return { libelle: "annulée", ton: "neutral", geste: null };
  const enRetard = t.dueDate ? joursAvant(t.dueDate, now) < 0 : false;
  const libelle = t.status === "TODO" ? "à faire" : "en cours";
  return { libelle: enRetard ? `${libelle} — en retard` : libelle, ton: enRetard ? "danger" : "info", geste: demande && enRetard ? "relancer" : null };
}

/** L'état court d'une tâche, sans « chez qui » — la petite ligne sous le titre. */
export function etatCourt(status: string): string {
  switch (status) {
    case "REQUESTED": return "à accepter";
    case "TODO": return "à faire";
    case "IN_PROGRESS": return "en cours";
    case "DONE": return "terminée";
    case "DECLINED": return "refusée";
    case "CANCELLED": return "annulée";
    default: return status.toLowerCase();
  }
}

/**
 * « ÉTAT — CHEZ QUI » : où est la balle. Une demande en attente est chez son destinataire ; rendue ou
 * refusée, elle revient chez son demandeur (vérifier, réattribuer) ; close, elle n'est plus chez personne.
 */
export function etatChezQui(
  t: TacheRangeable,
  userId: string,
  noms: { assigne?: string | null; createur?: string | null },
): string {
  const qui = (id: string | null | undefined, nom: string | null | undefined) =>
    !id ? null : id === userId ? "moi" : nomCourt(nom);
  const assigne = qui(t.assignedToId, noms.assigne);
  const createur = qui(t.createdById, noms.createur);
  const avec = (etat: string, chez: string | null) => (chez ? `${etat} — chez ${chez}` : etat);
  switch (t.status) {
    case "REQUESTED": return avec("à accepter", assigne);
    case "TODO": return avec("à faire", assigne);
    case "IN_PROGRESS": return avec("en cours", assigne);
    case "DECLINED": return avec("refusée", createur);
    case "DONE": return isRequest(t) && t.createdById !== t.assignedToId ? avec("rendue", createur) : "terminée";
    case "CANCELLED": return "annulée";
    default: return etatCourt(t.status);
  }
}
