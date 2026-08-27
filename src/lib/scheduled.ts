import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { performAiHealthCheck } from "@/lib/ai-health";
import { runDueRegulatoryJobs } from "@/lib/regulatory/intelligence/jobs/runner";
import { catchUpMissingAiReviews, catchUpStalledPipelines, expireStaleBatches } from "@/lib/regulatory/intelligence/jobs/catchup";
import { pruneStaleUploadSessions, purgeClosedSessionParts } from "@/lib/regulatory/intelligence/upload/session";
import { runAnppWatchIfDue } from "@/lib/regulatory/intelligence/corpus/watch-schedule";
import { pollAiBatches } from "@/lib/regulatory/intelligence/cost/batch-runner";
import { embedBacklog } from "@/lib/regulatory/intelligence/corpus/semantic";
import { runIntelligencePulse } from "@/lib/adventum/pulse";
import { runPettyCashRechargeReminders } from "@/lib/actions/petty-cash-actions";
import { runLegalExpirySweep } from "@/lib/legal/expiry-sweep";
import { runAssistantReminders } from "@/lib/assistant/reminders";
import { runDriveIngestionSweep } from "@/lib/assistant/drive-ingestion";
import { runKnowledgeSweep, enqueueDriveBacklog } from "@/lib/knowledge/worker";
import { runAdamInboxSweep } from "@/lib/google/gmail/reconcile";

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

/**
 * BATTEMENT AUTONOME — l'analyse ne s'arrête plus quand l'utilisateur quitte l'application.
 *
 * Ces tâches n'étaient déclenchées que par les requêtes des clients connectés (polling de la
 * messagerie, écran de progression). C'était un choix « zéro configuration côté hébergeur », mais
 * il avait une conséquence que personne n'accepterait en la connaissant : **fermer l'onglet
 * arrêtait l'analyse en cours**. Un dossier déposé le soir attendait qu'un navigateur veuille bien
 * rouvrir la page le lendemain.
 *
 * Le processus Node bat donc tout seul, armé au PREMIER chargement de ce module — c'est-à-dire à
 * la première requête servie après un démarrage. Ensuite, plus personne n'a besoin d'être là.
 * (L'armement au démarrage via `instrumentation.ts` serait plus direct, mais ce fichier est aussi
 * compilé pour le runtime Edge, où la chaîne serveur — IMAP, agents HTTP — ne se résout pas.)
 *
 * Le verrou de débounce ci-dessus reste seul juge : un battement qui tombe pendant qu'un passage
 * déclenché par un clic travaille encore ne fait rien. `unref()` garantit que le minuteur
 * n'empêche jamais un arrêt propre du processus lors d'un déploiement.
 *
 * ⚠️ Un hébergeur qui met l'instance en veille faute de trafic suspend aussi ce battement : le
 * travail reprend au réveil (rien n'est perdu — les jobs vivent en base), mais il ne progresse pas
 * pendant la veille. C'est le seul cas où l'analyse marque une pause sans personne connecté.
 */
const TICK_MS = Math.max(15_000, Number(process.env.SCHEDULER_TICK_MS ?? 60_000));

function armHeartbeat(): void {
  if (process.env.SCHEDULER_DISABLED === "1") return; // soupape, sans redéploiement de code
  // Jamais pendant les TESTS (chaque fichier importerait ce module et lancerait le planificateur
  // complet sur la base de test), ni pendant la COMPILATION (le build importe les modules serveur
  // pour pré-rendre les pages : il n'a aucune tâche de fond à exécuter).
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const timer = setInterval(() => {
    void runScheduledJobs().catch((e) => console.error("[scheduler] battement échoué", e));
  }, TICK_MS);
  timer.unref?.();
}
armHeartbeat();

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
    await purgeClosedSessionParts().catch(() => 0); // filet : octets d'envois clos qu'un redémarrage aurait laissés
    await runAnppWatchIfDue(); // veille ANPP 1×/jour : une ligne directrice ne doit pas changer sans qu'on le sache
    await pollAiBatches(); // analyses différées (moitié prix) : récupère les lots terminés
    // Rattrapage de l'EXISTANT : les dossiers déjà en base profitent des mêmes règles que les
    // nouveaux — revue de fond jamais livrée, ou pipeline arrêté en chemin. Bornés par passage.
    await expireStaleBatches().catch(() => 0); // lots fantômes : sinon l'écran dit « sous 24 h » à vie
    await catchUpStalledPipelines().catch(() => 0);
    await catchUpMissingAiReviews().catch(() => 0);
    await embedBacklog().catch(() => 0); // vecteurs sémantiques : un paquet par passage, jamais plus
    await runIntelligencePulse(); // Adventum Pulse : instantané horaire (Brain + Process Intelligence) + alerte proactive
    // Caisse d'avance : prévenir les RH 48 h AVANT le rechargement mensuel. Prévenir le jour
    // même ne sert à rien — sortir la somme demande une préparation. Idempotent par échéance.
    await runPettyCashRechargeReminders().catch(() => 0);
    // Échéances des engagements (contrats, BC, assurances, baux) : aligne le statut d'un terme
    // passé, et prévient À L'ENTRÉE dans une zone d'urgence (90 j, 30 j, dépassement) — pas tous
    // les jours, sinon la personne coupe les notifications et rate la vraie.
    await runLegalExpirySweep().catch(() => undefined);
    // Rappels du Chief of Staff : « rappelle-moi mardi à 10 h », « tous les dimanches relance
    // Regulatory » — pop-up au propriétaire, relance du rôle cible s'il y en a un.
    await runAssistantReminders().catch(() => undefined);
    // Ingestion Drive : un paquet de fichiers indexés (texte + classification) par passage —
    // un document mal nommé jamais ouvert devient trouvable par son CONTENU. L'ACL se
    // revérifie à la recherche, nœud par nœud. Débrayage : ASSISTANT_DRIVE_INGESTION=off.
    await runDriveIngestionSweep().catch(() => undefined);

    // LA COUCHE DE CONNAISSANCE — elle avance à son rythme, derrière tout le reste.
    //
    // Placée APRÈS les balayages existants et volontairement modeste : indexer plus vite au
    // prix du service rendu à ceux qui utilisent l'ERP serait un mauvais échange. Si un passage
    // ne finit pas son lot, le suivant reprend là où il en était — rien n'est perdu, et
    // personne n'attend.
    await enqueueDriveBacklog().catch(() => 0);
    await runKnowledgeSweep().catch(() => undefined);
    // LE BATTEMENT D'ADAM — sans navigateur ouvert, sans que le PDG demande quoi que ce soit.
    // Trois gestes : garder l'oreille (renouveler la veille Gmail AVANT expiration), rattraper
    // ce qui est arrivé (histoire incrémentale), et se rattraper soi-même (réconciliation
    // complète toutes les 30 min). C'est ce qui rend « qu'est-ce que j'ai raté ? » possible :
    // le push Pub/Sub est rapide mais fragile, et un message perdu est un SILENCE, pas une
    // erreur — personne ne s'en apercevrait. Sans connexion Google, c'est un no-op.
    // Débrayages : suspension du traitement entrant (réglages), ou connexion en pause.
    await runAdamInboxSweep().catch((e) => console.error("[scheduled] balayage ADAM echoue", e));

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
