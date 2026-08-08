import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { performAiHealthCheck } from "@/lib/ai-health";
import { runDueRegulatoryJobs } from "@/lib/regulatory/intelligence/jobs/runner";
import { catchUpMissingAiReviews, catchUpStalledPipelines } from "@/lib/regulatory/intelligence/jobs/catchup";
import { pruneStaleUploadSessions } from "@/lib/regulatory/intelligence/upload/session";
import { runAnppWatchIfDue } from "@/lib/regulatory/intelligence/corpus/watch-schedule";
import { pollAiBatches } from "@/lib/regulatory/intelligence/cost/batch-runner";
import { embedBacklog } from "@/lib/regulatory/intelligence/corpus/semantic";
import { runIntelligencePulse } from "@/lib/adventum/pulse";

/**
 * Tâches périodiques **sans cron externe** : déclenchées (au plus une fois par minute,
 * grâce à un verrou de débounce) depuis un point chaud déjà sollicité régulièrement par
 * les clients connectés (le polling de la messagerie). Tant qu'au moins un utilisateur est
 * actif, ces tâches tournent ; les rappels arrivent en cloche **et en push** (donc même
 * sur le téléphone d'un destinataire hors-ligne). Zéro configuration côté hébergeur.
 */

const DEBOUNCE_MS = 60_000;
let lastRun = 0;
let running = false;

/** Lance les tâches dues, au plus une fois par minute (process-wide). Ne lève jamais. */
export async function runScheduledJobs(): Promise<void> {
  const now = Date.now();
  if (running || now - lastRun < DEBOUNCE_MS) return;
  running = true;
  lastRun = now;
  try {
    await sendDueMeetingReminders();
    await sendDueReminders();
    await sendDuePayrollNotifications();
    await accrueMonthlyLeave().catch((e) => console.error("[scheduled] leave accrual failed", e)); // +2,5 j/mois (idempotent)
    await performAiHealthCheck().catch((e) => console.error("[scheduled] ai health check failed", e)); // test IA 1×/jour + alerte Super Admin
    await runDueRegulatoryJobs();
    await pruneStaleUploadSessions().catch(() => 0); // nettoyage des sessions d'upload incomplètes
    await runAnppWatchIfDue(); // veille ANPP 1×/jour : une ligne directrice ne doit pas changer sans qu'on le sache
    await pollAiBatches(); // analyses différées (moitié prix) : récupère les lots terminés
    // Rattrapage de l'EXISTANT : les dossiers déjà en base profitent des mêmes règles que les
    // nouveaux — revue de fond jamais livrée, ou pipeline arrêté en chemin. Bornés par passage.
    await catchUpStalledPipelines().catch(() => 0);
    await catchUpMissingAiReviews().catch(() => 0);
    await embedBacklog().catch(() => 0); // vecteurs sémantiques : un paquet par passage, jamais plus
    await runIntelligencePulse(); // Adventum Pulse : instantané horaire (Brain + Process Intelligence) + alerte proactive

  } catch (err) {
    console.error("[scheduled] run failed", err);
  } finally {
    running = false;
  }
}

/** Année-mois « YYYY-MM » à l'heure d'Alger (UTC+1, sans changement d'heure). */
export function algiersYm(at: number = Date.now()): string {
  const alg = new Date(at + 3_600_000);
  return `${alg.getUTCFullYear()}-${String(alg.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Nombre de mois entiers écoulés de `a` (exclu) à `b` (inclus) au format « YYYY-MM ». */
export function monthsBetweenYm(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (!ay || !am || !by || !bm) return 0;
  const diff = (by - ay) * 12 + (bm - am);
  return diff > 0 ? diff : 0;
}

/**
 * Logique **pure** d'acquisition (barème algérien : +2,5 j / mois). Source de vérité unique,
 * réutilisée par le job réel ci-dessous ET par le moteur « Time Travel » du Test Center pour
 * prouver l'idempotence (once-and-only-once). `marker` = dernier mois crédité (« YYYY-MM ») ou
 * null (amorçage sans rétro-crédit) ; renvoie le nouveau marqueur et le crédit à appliquer.
 */
export function accrualStep(marker: string | null, ym: string): { marker: string; credit: number } {
  if (!marker) return { marker: ym, credit: 0 }; // amorçage : on fixe le marqueur, pas de rétro-crédit
  const months = monthsBetweenYm(marker, ym);
  return months <= 0 ? { marker, credit: 0 } : { marker: ym, credit: 2.5 * months };
}

/**
 * Acquisition automatique des congés : **+2,5 j / mois** par employé actif (barème algérien
 * de 30 j/an). Idempotent grâce au marqueur `leaveAccruedThrough` (le dernier mois crédité) :
 * la fonction peut tourner à chaque tick, elle ne crédite qu'au passage d'un nouveau mois.
 * Amorçage sans rétro-crédit : au premier passage on fixe seulement le marqueur au mois courant
 * (le solde manuel existant est préservé), l'acquisition démarre le mois suivant.
 */
async function accrueMonthlyLeave(): Promise<void> {
  const ym = algiersYm();
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, leaveAccruedThrough: true },
  });
  for (const e of employees) {
    const { marker, credit } = accrualStep(e.leaveAccruedThrough, ym);
    if (credit === 0 && marker === e.leaveAccruedThrough) continue; // rien à faire (déjà à jour)
    await prisma.employee.update({
      where: { id: e.id },
      data: { leaveAccruedThrough: marker, ...(credit > 0 ? { leaveBalanceDays: { increment: credit } } : {}) },
    });
  }
}

/**
 * Rappels personnels « en un clic » échus : notifie le propriétaire (cloche + push) une seule fois,
 * puis passe le rappel en SENT (il reste dans « Mes rappels » jusqu'à ce que l'utilisateur le traite).
 */
async function sendDueReminders(): Promise<void> {
  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", remindAt: { lte: now } },
    select: { id: true, userId: true, title: true, link: true },
    take: 200,
  });
  for (const r of due) {
    // Verrou atomique : ne notifie qu'une fois même sous concurrence (PENDING → SENT).
    const claimed = await prisma.reminder.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "SENT", sentAt: now } });
    if (claimed.count === 0) continue;
    await notifyUser({ userId: r.userId, type: "GENERIC", title: "Rappel", body: r.title, link: r.link ?? "/mon-espace" }).catch(() => undefined);
  }
}

/**
 * Notifie chaque employé que sa paie a été versée — 24 h APRÈS le marquage « Payé »
 * par les RH (marge d'annulation en cas d'erreur). Une seule fois par bulletin.
 */
async function sendDuePayrollNotifications(): Promise<void> {
  const now = new Date();
  const due = await prisma.payrollEntry.findMany({
    where: { status: "PAID", employeeNotifiedAt: null, employeeNotifyAt: { not: null, lte: now } },
    include: { employee: { select: { userId: true, fullName: true } } },
    take: 100,
  });
  for (const e of due) {
    const claim = await prisma.payrollEntry.updateMany({
      where: { id: e.id, employeeNotifiedAt: null },
      data: { employeeNotifiedAt: now },
    });
    if (claim.count === 0 || !e.employee.userId) continue;
    await notifyUser({
      userId: e.employee.userId,
      type: "GENERIC",
      title: "Votre salaire a été versé",
      body: `Votre paie de ${String(e.month).padStart(2, "0")}/${e.year} a été versée. La fiche de paie est disponible dans Mon dossier RH.`,
      link: "/mon-dossier",
    }).catch(() => {});
  }
}

const REMINDER_LEAD_MS = 30 * 60_000; // 30 minutes avant le début

/**
 * Rappelle les réunions planifiées qui commencent dans ≤ 30 min (et pas encore passées),
 * une seule fois (reminderSentAt). Notifie l'organisateur + les participants.
 */
async function sendDueMeetingReminders(): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + REMINDER_LEAD_MS);

  const due = await prisma.meeting.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      scheduledAt: { not: null, gt: now, lte: horizon },
    },
    select: {
      id: true, title: true, scheduledAt: true, organizerId: true,
      participants: { select: { userId: true } },
    },
    take: 50,
  });
  if (due.length === 0) return;

  for (const m of due) {
    // Verrou anti-concurrence : seule la 1re mise à jour « gagne » le droit d'envoyer.
    const claim = await prisma.meeting.updateMany({
      where: { id: m.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) continue;

    const minutes = m.scheduledAt ? Math.max(1, Math.round((m.scheduledAt.getTime() - now.getTime()) / 60_000)) : 30;
    const recipients = [...new Set([m.organizerId, ...m.participants.map((p) => p.userId)])];
    await Promise.all(recipients.map((userId) =>
      notifyUser({
        userId, type: "DEADLINE_NEAR",
        title: `Réunion dans ${minutes} min`,
        body: m.title,
        link: `/meetings/${m.id}`,
      }),
    ));
  }
}
