import { regStage } from "./stage";

/**
 * LA RELANCE DE MISE À JOUR — « où en sont vos dossiers ? », posé d'en haut, à tout le monde.
 *
 * Le panneau de supervision d'une FICHE sait déjà demander un point sur UN dossier. Ce n'est pas
 * le même geste : ici on ne parle pas d'un dossier, on parle d'un PORTEFEUILLE. La direction
 * regarde un tableau qui n'a pas bougé depuis des semaines et veut que chaque pharmacien remette
 * les siens à jour — soit une personne en particulier, soit tout le monde d'un coup. Le faire
 * dossier par dossier, sur cent dossiers, personne ne le fait : c'est pour cela que rien n'était
 * relancé.
 *
 * ⚠️ RÉSERVÉ AU SUPER ADMIN ET AU DIRECTEUR GÉNÉRAL. Une relance n'est pas une notification de
 * plus : elle dit « la direction vous attend ». Entre les mains d'un pair, elle perd exactement
 * ce qui la rend efficace, et devient un moyen de pression latéral.
 *
 * Deux règles qui gouvernent QUELS dossiers comptent, et qui ne se devinent pas :
 *
 *   • un dossier VERROUILLÉ ne compte pas. Il est invisible de toute l'équipe — y compris de son
 *     propre responsable. Relancer quelqu'un sur un dossier qu'il ne peut pas ouvrir, c'est lui
 *     demander l'impossible, et lui révéler au passage qu'il existe ;
 *   • un dossier ABOUTI ne compte pas. La décision est tombée, il n'y a plus rien à mettre à jour.
 *
 * Ce qui reste — ce que `regStage` appelle « à traiter » — est très exactement ce sur quoi la
 * personne peut agir aujourd'hui.
 *
 * Module PUR — testé, sans base de données.
 */

/** Rôles autorisés à relancer. Le rôle SECONDAIRE compte autant que le principal. */
const REMINDER_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER"] as const;

/**
 * Au-delà de ce délai sans mouvement, un dossier est « en sommeil ».
 *
 * Trente jours, parce qu'un dossier réglementaire vit au rythme de l'ANPP : une semaine sans
 * mouvement n'a rien d'anormal, un mois oui. Ce seuil ne bloque rien — il ne fait que dire à la
 * direction où regarder d'abord, et à la personne relancée ce qu'on lui reproche vraiment.
 */
export const REMINDER_STALE_DAYS = 30;

/**
 * Délai en deçà duquel on signale qu'on vient déjà de relancer quelqu'un.
 *
 * On ne l'INTERDIT pas — il arrive qu'une relance doive être répétée, et un logiciel qui dit
 * « non » à un directeur général sur ce genre de geste se fait contourner par un e-mail. On le
 * SIGNALE, ce qui suffit : personne ne relance deux fois de suite en connaissance de cause.
 */
export const REMINDER_COOLDOWN_DAYS = 7;

export function canSendUpdateReminder(u: { role?: string | null; secondaryRole?: string | null }): boolean {
  const roles: readonly string[] = REMINDER_ROLES;
  return roles.includes(u.role ?? "") || roles.includes(u.secondaryRole ?? "");
}

/** Nombre de jours pleins écoulés depuis une date. Rend `null` si la date est absente ou invalide. */
export function daysSince(date: Date | string | null | undefined, now: Date): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Ce dossier dort-il depuis trop longtemps ? */
export function isStaleDossier(
  updatedAt: Date | string | null | undefined,
  now: Date,
  days: number = REMINDER_STALE_DAYS,
): boolean {
  const n = daysSince(updatedAt, now);
  return n !== null && n >= days;
}

/** Vient-on de relancer cette personne ? (signalé à l'écran, jamais bloquant) */
export function remindedRecently(
  lastAt: Date | string | null | undefined,
  now: Date,
  days: number = REMINDER_COOLDOWN_DAYS,
): boolean {
  const n = daysSince(lastAt, now);
  return n !== null && n < days;
}

/** Un dossier, tel que le tableau de relance a besoin de le connaître. */
export interface ReminderDossier {
  responsibleId: string | null;
  responsibleName: string | null;
  isLocked: boolean;
  status: string;
  updatedAt: Date | string | null;
}

/** Une personne relançable, avec de quoi décider si elle mérite de l'être. */
export interface ReminderTarget {
  userId: string;
  name: string;
  /** Dossiers à traiter qu'elle porte. */
  total: number;
  /** Parmi eux, ceux sans mouvement depuis `REMINDER_STALE_DAYS`. */
  stale: number;
  /** Dernière relance reçue — pour ne pas la harceler. */
  lastRemindedAt: Date | null;
}

export interface ReminderBoard {
  targets: ReminderTarget[];
  /**
   * Dossiers à traiter que PERSONNE ne porte. Ils ne sont relançables par définition — il n'y a
   * personne à relancer — mais les taire donnerait une somme fausse : la direction croirait
   * avoir couvert tout le tableau alors que ces dossiers-là n'ont même pas de destinataire.
   */
  unassigned: number;
}

/**
 * Regroupe les dossiers par personne qui les porte.
 *
 * L'ordre est celui de l'urgence : le plus de dossiers en sommeil d'abord, puis le plus gros
 * portefeuille, puis l'ordre alphabétique — pour que deux affichages identiques le restent.
 */
export function reminderTargets(
  dossiers: readonly ReminderDossier[],
  opts: { now: Date; lastRemindedAt?: ReadonlyMap<string, Date>; staleDays?: number } = { now: new Date() },
): ReminderBoard {
  const now = opts.now;
  const staleDays = opts.staleDays ?? REMINDER_STALE_DAYS;
  const by = new Map<string, ReminderTarget>();
  let unassigned = 0;

  for (const d of dossiers) {
    // Verrouillé ou abouti : hors sujet. C'est `regStage` qui tranche, pas une condition recopiée
    // ici — la règle de rangement du module doit rester une seule règle.
    if (regStage({ isLocked: d.isLocked, status: d.status }) !== "todo") continue;
    if (!d.responsibleId) { unassigned += 1; continue; }
    const cur = by.get(d.responsibleId) ?? {
      userId: d.responsibleId,
      name: d.responsibleName || "Sans nom",
      total: 0,
      stale: 0,
      lastRemindedAt: opts.lastRemindedAt?.get(d.responsibleId) ?? null,
    };
    cur.total += 1;
    if (isStaleDossier(d.updatedAt, now, staleDays)) cur.stale += 1;
    by.set(d.responsibleId, cur);
  }

  const targets = [...by.values()].sort(
    (a, b) => b.stale - a.stale || b.total - a.total || a.name.localeCompare(b.name),
  );
  return { targets, unassigned };
}

/** Le titre de la notification reçue par la personne relancée. */
export function reminderTitle(): string {
  return "Mise à jour de vos dossiers réglementaires demandée";
}

/**
 * Le corps de la notification — chiffré, et donc actionnable.
 *
 * « Merci de mettre à jour vos dossiers » ne dit ni combien, ni lesquels, ni pourquoi maintenant.
 * On donne le portefeuille et la part en sommeil : la personne sait par où commencer.
 */
export function reminderBody(t: Pick<ReminderTarget, "total" | "stale">, note?: string | null): string {
  const parts = [`${t.total} dossier${t.total > 1 ? "s" : ""} à traiter`];
  if (t.stale > 0) {
    parts.push(`dont ${t.stale} sans mouvement depuis plus de ${REMINDER_STALE_DAYS} jours`);
  }
  const head = parts.join(", ") + ".";
  const extra = (note ?? "").trim();
  return extra ? `${head} ${extra}` : head;
}

/** Ce qui est inscrit au journal du côté de celui qui relance. */
export function reminderAuditSummary(names: readonly string[], note?: string | null): string {
  const who = names.length === 0
    ? "aucun destinataire"
    : names.length <= 3
      ? names.join(", ")
      : `${names.slice(0, 3).join(", ")} et ${names.length - 3} autre${names.length - 3 > 1 ? "s" : ""}`;
  const extra = (note ?? "").trim();
  return `Relance de mise à jour des dossiers — ${who}${extra ? ` · « ${extra} »` : ""}`;
}

/** Le message rendu à l'écran après l'envoi. */
export function reminderResultMessage(count: number): string {
  if (count === 0) return "Personne à relancer : aucun dossier à traiter n'a de responsable.";
  return `Relance envoyée à ${count} personne${count > 1 ? "s" : ""}.`;
}
