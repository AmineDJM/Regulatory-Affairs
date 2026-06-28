import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

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
  } catch (err) {
    console.error("[scheduled] run failed", err);
  } finally {
    running = false;
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
