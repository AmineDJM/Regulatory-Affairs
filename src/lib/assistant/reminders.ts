import { prisma } from "@/lib/prisma";
import { notifyUser, notifyRoles, broadcastNotification } from "@/lib/notify";
import type { UserRole } from "@prisma/client";

/**
 * LES RAPPELS DU CHIEF OF STAFF — la planification en langage naturel devient un vrai job.
 *
 * « Rappelle-moi mardi à 10 h de vérifier ça », « tous les dimanches relance Regulatory » : le
 * modèle traduit la phrase en un enregistrement (`AssistantReminder`), et le BALAYAGE — branché
 * dans `lib/scheduled.ts`, comme toutes les tâches planifiées de la plateforme — fait le reste.
 * Pas de cron externe, pas de worker à déployer : le même mécanisme qui envoie déjà les rappels
 * d'échéance Legal et les relances de caisse.
 *
 * Deux effets à l'échéance :
 *   • le PROPRIÉTAIRE est prévenu en POP-UP (un rappel qu'on a demandé mérite d'interrompre) ;
 *   • si le rappel porte un `targetRole`, ce rôle est RELANCÉ avec la note — c'est le
 *     « demande à Regulatory où en sont les dossiers » du dimanche.
 *
 * Un rappel simple s'éteint après son tir ; une récurrence avance son échéance et continue.
 */

export const REMINDER_RECURRENCES = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "MONTHLY_WEEKDAY"] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

export const RECURRENCE_LABEL: Record<ReminderRecurrence, string> = {
  NONE: "une seule fois",
  DAILY: "tous les jours",
  WEEKLY: "toutes les semaines",
  MONTHLY: "tous les mois (même quantième)",
  MONTHLY_WEEKDAY: "tous les mois (même Nième jour de semaine)",
};

/**
 * L'échéance SUIVANTE d'une récurrence, STRICTEMENT après `after`.
 *
 * On avance depuis l'échéance courante — jamais depuis « maintenant » : un rappel hebdomadaire du
 * dimanche 10 h doit retomber un dimanche 10 h, même si le serveur l'a tiré avec vingt minutes de
 * retard. La boucle rattrape un serveur resté éteint plusieurs périodes (bornée : pas de gel).
 */
export function nextOccurrence(current: Date, recurrence: string, after: Date): Date | null {
  if (recurrence === "NONE") return null;
  if (recurrence === "MONTHLY_WEEKDAY") return nextMonthlyWeekday(current, after);
  const next = new Date(current.getTime());
  for (let i = 0; i < 400; i += 1) {
    if (recurrence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
    else if (recurrence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
    else if (recurrence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
    else return null;
    if (next.getTime() > after.getTime()) return new Date(next.getTime());
  }
  return null;
}

/**
 * « CHAQUE PREMIER LUNDI DU MOIS » — le Nième jour de semaine du mois, pas le quantième.
 *
 * Le rang (1er…5e) et le jour (lundi…) se LISENT sur l'échéance courante, en HEURE D'ALGER :
 * un rappel posé le lundi 6 (2e lundi) retombe chaque 2e lundi, à la même heure. Un mois sans
 * 5e occurrence retombe sur la DERNIÈRE (le « 5e lundi » d'un mois qui n'en a que 4 devient le
 * 4e) — annuler le rappel un mois sur deux serait pire que le décaler d'une semaine.
 */
function nextMonthlyWeekday(current: Date, after: Date): Date | null {
  const alg = new Date(current.getTime() + 3_600_000); // heure d'Alger (UTC+1, sans été)
  const weekday = alg.getUTCDay();
  const nth = Math.ceil(alg.getUTCDate() / 7);
  const hours = alg.getUTCHours();
  const minutes = alg.getUTCMinutes();

  let year = alg.getUTCFullYear();
  let month = alg.getUTCMonth();
  for (let i = 0; i < 60; i += 1) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    // Premier jour du mois → premier `weekday` du mois → avance de (nth−1) semaines, borné au mois.
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const firstMatch = 1 + ((weekday - firstDow + 7) % 7);
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let day = firstMatch + (nth - 1) * 7;
    while (day > daysInMonth) day -= 7;
    const candidate = new Date(Date.UTC(year, month, day, hours, minutes) - 3_600_000); // retour en UTC
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}

/**
 * « mardi à 10 h », heure d'Alger, en instant UTC. L'Algérie vit en UTC+1 SANS changement
 * d'heure : la conversion est une soustraction, pas une table de fuseaux.
 */
export function algiersToUtc(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim() || "09:00");
  if (!m || !t) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]) - 1, Number(t[2]));
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** L'échéance, relue en heure d'Alger pour l'affichage. */
export function formatAlgiersDue(d: Date): string {
  const alg = new Date(d.getTime() + 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(alg.getUTCDate())}/${p(alg.getUTCMonth() + 1)}/${alg.getUTCFullYear()} à ${p(alg.getUTCHours())}h${p(alg.getUTCMinutes())}`;
}

const SWEEP_LIMIT = 50;

/**
 * LE BALAYAGE — tire les rappels échus. Idempotent par construction : un rappel simple passe
 * `active=false` dans la MÊME écriture qui précède les notifications ; une récurrence avance son
 * `dueAt` de même. Deux passages concurrents peuvent au pire notifier deux fois — jamais dériver.
 */
export async function runAssistantReminders(now: Date = new Date()): Promise<void> {
  const due = await prisma.assistantReminder.findMany({
    where: { active: true, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: SWEEP_LIMIT,
  });

  for (const r of due) {
    const next = nextOccurrence(r.dueAt, r.recurrence, now);
    // L'état d'abord, les notifications ensuite : si l'envoi échoue, on préfère un rappel
    // silencieux à un rappel qui hurle toutes les minutes.
    await prisma.assistantReminder.update({
      where: { id: r.id },
      data: next ? { dueAt: next, lastFiredAt: now } : { active: false, lastFiredAt: now },
    });

    // Le pop-up passe par la diffusion ciblée (`broadcastNotification`), la seule porte qui
    // sache l'afficher en plein écran : un rappel qu'on a demandé mérite d'interrompre.
    await broadcastNotification({
      audience: "USERS",
      userIds: [r.userId],
      title: `Rappel — ${r.title}`,
      body: r.note ?? (r.recurrence !== "NONE" ? `Rappel ${RECURRENCE_LABEL[r.recurrence as ReminderRecurrence] ?? ""}.` : undefined),
      link: r.link ?? "/chief-of-staff",
      popup: true,
    }).catch((e) => console.error("[reminders] notify owner failed", e));

    // La RELANCE d'un rôle : « Regulatory, où en êtes-vous ? » — envoyée au nom du demandeur.
    if (r.targetRole) {
      await notifyRoles([r.targetRole as UserRole], {
        type: "GENERIC",
        title: `Relance — ${r.title}`,
        body: r.note ?? "Un point d'avancement est attendu.",
        link: r.link ?? undefined,
      }).catch((e) => console.error("[reminders] notify role failed", e));
    }

    // La RELANCE d'une PERSONNE NOMMÉE : « tous les dimanches relance Nesrine ». Se cumule avec
    // le rôle — l'un, l'autre, ou les deux.
    if (r.targetUserId) {
      await notifyUser({
        userId: r.targetUserId,
        type: "GENERIC",
        title: `Relance — ${r.title}`,
        body: r.note ?? "Un point d'avancement est attendu.",
        link: r.link ?? undefined,
      }).catch((e) => console.error("[reminders] notify person failed", e));
    }
  }
}
