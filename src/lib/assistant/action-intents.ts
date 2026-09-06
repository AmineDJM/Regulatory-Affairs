import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { PowerTool } from "@/lib/assistant/power-tools";

/**
 * ACTION INTENTS — la machine d'état SERVEUR unique des actions de l'assistant.
 *
 * Deux pannes réelles ont motivé cette couche :
 *   • MÉMOIRE — « est-ce que je t'avais déjà demandé de contacter Redouane ? » → « je ne
 *     retrouve rien », alors que la notification avait été PRÉPARÉE quelques minutes plus tôt.
 *     Cause : la proposition ne vivait que dans l'UI — aucune trace structurée.
 *   • ÉTAT — « Message envoyé à Khaled » suivi de « je ne peux pas confirmer l'envoi » :
 *     le modèle racontait l'exécution au lieu de la LIRE.
 *
 * La règle, désormais : CHAQUE proposition d'action est persistée ICI avec un état canonique
 * (PROPOSED → CONFIRMED → EXECUTING → EXECUTED, ou FAILED / CANCELLED / EXPIRED). L'UI, le
 * texte et la voix LISENT cet état — personne ne l'invente. L'exécution est IDEMPOTENTE :
 * un retry / une reconnexion ne renvoie jamais deux messages, deux notifications, deux tâches.
 */

export type ActionIntentStatus =
  | "PROPOSED" | "CONFIRMED" | "EXECUTING" | "EXECUTED" | "FAILED" | "CANCELLED" | "EXPIRED";

export const INTENT_STATUS_LABEL: Record<ActionIntentStatus, string> = {
  PROPOSED: "PROPOSÉE — en attente de confirmation, JAMAIS exécutée",
  CONFIRMED: "CONFIRMÉE — exécution imminente",
  EXECUTING: "EN COURS D'EXÉCUTION",
  EXECUTED: "EXÉCUTÉE",
  FAILED: "ÉCHOUÉE — non exécutée",
  CANCELLED: "ANNULÉE — jamais exécutée",
  EXPIRED: "EXPIRÉE — jamais exécutée",
};

/** Ce que la couche a besoin de connaître d'une proposition (sous-ensemble de ProposedAction). */
export interface IntentSeed {
  kind: string;
  module: string;
  title: string;
  fields: { label: string; value: string }[];
  level?: "SENSITIVE" | "CRITICAL";
  /** CRITICAL : la valeur à RESSAISIR — stockée pour que le SERVEUR la vérifie à l'exécution. */
  confirmText?: string;
  payload: unknown;
}

/** Le résumé MÉMORISABLE : titre + champs clés — c'est lui qui répond à « déjà demandé ? ». */
export function intentSummary(seed: IntentSeed): string {
  const details = seed.fields.slice(0, 3).map((f) => `${f.label} : ${f.value}`.slice(0, 90)).join(" · ");
  return `${seed.title}${details ? ` — ${details}` : ""}`.slice(0, 400);
}

const pushEvent = (events: unknown, status: string): unknown[] => [
  ...(Array.isArray(events) ? events : []),
  { status, at: new Date().toISOString() },
];

/**
 * Persiste CHAQUE proposition (texte, voix via délégation, nudge) et renvoie les ids créés,
 * dans l'ordre des propositions. Ne bloque JAMAIS la réponse : en cas d'échec d'écriture, la
 * proposition part sans id (l'exécution retombe alors sur le chemin sans reçu).
 */
export async function persistActionIntents(
  userId: string,
  seeds: IntentSeed[],
  origin: "text" | "voice" | "nudge",
): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (const seed of seeds) {
    try {
      const row = await prisma.assistantActionIntent.create({
        data: {
          userId,
          kind: seed.kind,
          module: seed.module,
          title: seed.title,
          summary: intentSummary(seed),
          payload: seed.payload as object,
          status: "PROPOSED",
          origin,
          level: seed.level ?? null,
          confirmText: seed.confirmText ?? null,
          events: pushEvent([], "PROPOSED") as object,
        },
        select: { id: true },
      });
      out.push(row.id);
    } catch (err) {
      console.error("[assistant] persistActionIntent failed", err);
      out.push(null);
    }
  }
  return out;
}

export interface IntentExecuteResult {
  ok: boolean;
  message?: string;
  link?: string;
  error?: string;
  revalidate?: string[];
  /** true = l'action avait DÉJÀ été exécutée : reçu renvoyé, rien relancé (idempotence). */
  alreadyExecuted?: boolean;
}

/**
 * Exécute une action SOUS SON INTENT : réclamation ATOMIQUE de l'état (un seul gagnant en cas
 * de retry/double-clic/reconnexion), exécution, puis REÇU canonique persisté. Une action déjà
 * EXÉCUTÉE renvoie son reçu d'origine sans rien relancer. Le payload exécuté est celui STOCKÉ
 * à la proposition (le serveur est l'autorité), pas celui renvoyé par le client.
 */
export async function executeIntentGuarded(
  user: CurrentUser,
  intentId: string,
  run: (payload: unknown) => Promise<{ ok: boolean; message?: string; link?: string; error?: string; revalidate?: string[] }>,
): Promise<IntentExecuteResult | null> {
  const intent = await prisma.assistantActionIntent.findFirst({ where: { id: intentId, userId: user.id } });
  if (!intent) return null; // intent inconnu (ou pas à ce compte) → l'appelant retombe sur le chemin sans reçu

  if (intent.status === "EXECUTED") {
    return {
      ok: true, alreadyExecuted: true,
      message: intent.resultMessage ?? `Déjà exécutée le ${intent.executedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—"} — rien n'a été relancé.`,
      link: intent.resultLink ?? undefined,
    };
  }
  if (intent.status === "EXECUTING") {
    return { ok: false, error: "Cette action est déjà en cours d'exécution — elle ne sera pas lancée deux fois." };
  }
  if (intent.status === "CANCELLED" || intent.status === "EXPIRED") {
    return { ok: false, error: "Cette action a été annulée : elle n'a jamais été exécutée. Redemandez-la si besoin." };
  }

  // RÉCLAMATION ATOMIQUE : un seul appel gagne le droit d'exécuter (PROPOSED/CONFIRMED/FAILED
  // → EXECUTING). Un perdant relit l'état et reçoit le reçu ou « en cours ».
  const now = new Date();
  const claimed = await prisma.assistantActionIntent.updateMany({
    where: { id: intentId, userId: user.id, status: { in: ["PROPOSED", "CONFIRMED", "FAILED"] } },
    data: {
      status: "EXECUTING", decidedAt: intent.decidedAt ?? now,
      events: pushEvent(pushEvent(intent.events, "CONFIRMED"), "EXECUTING") as object,
    },
  });
  if (claimed.count === 0) {
    const again = await prisma.assistantActionIntent.findFirst({ where: { id: intentId, userId: user.id } });
    if (again?.status === "EXECUTED") {
      return { ok: true, alreadyExecuted: true, message: again.resultMessage ?? "Déjà exécutée.", link: again.resultLink ?? undefined };
    }
    return { ok: false, error: "Cette action est déjà en cours d'exécution — elle ne sera pas lancée deux fois." };
  }

  let result: { ok: boolean; message?: string; link?: string; error?: string; revalidate?: string[] };
  try {
    result = await run(intent.payload);
  } catch (err) {
    console.error("[assistant] intent execution crashed", err);
    result = { ok: false, error: "L'action n'a pas pu être exécutée." };
  }

  // Le REÇU canonique — c'est LUI que « c'est envoyé ? » relira, pas la mémoire du modèle.
  const fresh = await prisma.assistantActionIntent.findFirst({ where: { id: intentId }, select: { events: true } });
  await prisma.assistantActionIntent.update({
    where: { id: intentId },
    data: result.ok
      ? { status: "EXECUTED", executedAt: new Date(), resultMessage: result.message ?? "Action exécutée.", resultLink: result.link ?? null, error: null, events: pushEvent(fresh?.events, "EXECUTED") as object }
      : { status: "FAILED", error: result.error ?? "Échec.", events: pushEvent(fresh?.events, "FAILED") as object },
  }).catch((err) => console.error("[assistant] intent receipt failed", err));

  return { ...result };
}

/** Annulation : PROPOSED → CANCELLED (une action déjà lancée ne s'annule pas d'un clic). */
export async function cancelActionIntent(userId: string, intentId: string): Promise<boolean> {
  const intent = await prisma.assistantActionIntent.findFirst({ where: { id: intentId, userId }, select: { events: true } });
  const done = await prisma.assistantActionIntent.updateMany({
    where: { id: intentId, userId, status: "PROPOSED" },
    data: { status: "CANCELLED", decidedAt: new Date(), events: pushEvent(intent?.events, "CANCELLED") as object },
  });
  return done.count > 0;
}

const frDate = (d: Date | null): string => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "—");

/**
 * Le bloc « ACTIONS RÉCENTES » injecté dans le contexte (texte ET voix) : l'état canonique des
 * dernières intentions — c'est lui qui empêche « je ne retrouve aucune trace » quelques minutes
 * après avoir préparé une notification. Null quand il n'y a rien.
 *
 * CE BLOC A DÉJÀ DÉRAILLÉ UNE CONVERSATION, et la façon dont il l'a fait mérite d'être dite. Le
 * PDG demandait « tu as reçu des e-mails ou pas ? » ; l'assistant répondait « laisse-moi vérifier
 * ta boîte »… puis enchaînait sur une action Finances sans rapport. La proposition Finances datait
 * d'une autre branche de la conversation, elle n'avait jamais été exécutée — et elle figurait ici,
 * intacte, sous un titre qui la présentait comme « l'état CANONIQUE serveur ». Le modèle a fait
 * ce que le contexte suggérait : reprendre un dossier ouvert.
 *
 * Deux corrections, et elles sont de nature différente :
 *
 *   • UNE PROPOSITION SE PÉRIME. Passé quelques heures sans décision, elle n'est plus un fil en
 *     cours : c'est une trace. `action_history` la retrouvera si on la cherche ; elle n'a plus à
 *     s'imposer à chaque tour. (Une action EXÉCUTÉE, elle, reste : « c'est fait » ne se périme
 *     jamais, et c'est précisément ce qu'on interroge après coup.)
 *
 *   • UNE PROPOSITION NE SE REPREND PAS TOUTE SEULE. Le rappel est là pour répondre à « où en
 *     est… ? », pas pour fournir un sujet quand la question porte sur autre chose. Le bloc le dit
 *     maintenant explicitement, parce qu'un intitulé de section suffit à orienter un modèle.
 */
const PROPOSAL_CONTEXT_WINDOW_MS = 6 * 3_600_000;

export async function recentActionIntentsContext(userId: string, limit = 6): Promise<string | null> {
  const rows = await prisma.assistantActionIntent.findMany({
    where: {
      userId,
      OR: [
        { status: { not: "PROPOSED" } },
        { status: "PROPOSED", proposedAt: { gte: new Date(Date.now() - PROPOSAL_CONTEXT_WINDOW_MS) } },
      ],
    },
    orderBy: { proposedAt: "desc" },
    take: limit,
    select: { title: true, summary: true, status: true, proposedAt: true, executedAt: true, resultMessage: true },
  }).catch(() => []);
  if (rows.length === 0) return null;
  const lines = rows.map((r) => {
    const label = INTENT_STATUS_LABEL[r.status as ActionIntentStatus] ?? r.status;
    const when = r.status === "EXECUTED" ? `le ${frDate(r.executedAt)}` : `proposée le ${frDate(r.proposedAt)}`;
    return `- [${label}] ${r.summary} (${when})`;
  });
  return `ACTIONS RÉCENTES DE CETTE PERSONNE (état CANONIQUE serveur — LA vérité sur « déjà demandé ? » /
« déjà envoyé ? » ; une action PROPOSÉE n'a JAMAIS été exécutée ; ne JAMAIS dire « envoyé » sans un
état EXÉCUTÉE ici ou dans action_history) :
${lines.join("\n")}

CETTE LISTE EST UN RAPPEL, PAS UN ORDRE DU JOUR. Elle sert à répondre quand on t'interroge SUR elle
(« où en est… ? », « c'est parti ? », « je te l'avais demandé ? »). Elle ne fournit JAMAIS le sujet
d'une réponse : si la question porte sur autre chose, ignore-la entièrement. Une proposition restée
en attente sur un domaine ne doit jamais s'inviter dans une question qui porte sur un autre domaine
— et ne se relance pas d'elle-même : seule la personne la reprend, explicitement.
UNE ACTION EXÉCUTÉE N'INTERDIT PAS DE LA REFAIRE : si la personne redemande la même chose (une tâche,
un message), dis qu'une action semblable a été exécutée (avec sa date) ET propose quand même la
nouvelle — l'objet a pu être supprimé ou modifié depuis, et c'est elle qui tranche en confirmant.
Ne réponds JAMAIS « déjà fait » à la place d'une proposition.`;
}

// ───────────────────────── L'outil de consultation ─────────────────────────

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

export const ACTION_INTENT_TOOLS: PowerTool[] = [
  {
    def: {
      name: "action_history",
      description:
        "L'HISTORIQUE CANONIQUE des actions de l'assistant pour CE compte : ce qui a été proposé, confirmé, exécuté (avec reçu), " +
        "échoué ou annulé — la SEULE source de vérité pour « est-ce que je t'avais déjà demandé… ? », « c'est envoyé ? », " +
        "« qu'est-ce que je t'ai demandé de faire aujourd'hui ? ». TOUJOURS l'appeler avant de répondre à ces questions : " +
        "ne JAMAIS répondre de mémoire, ne JAMAIS dire « exécuté » sans un état EXÉCUTÉE ici.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Filtre optionnel (nom, sujet — ex. « Redouane », « contrats »)." },
          days: { type: "number", description: "Fenêtre en jours (défaut 30)." },
        },
      },
    },
    allowed: () => true, // strictement cloisonné par userId dans la requête
    label: "Historique des actions consulté",
    run: async (input, user) => {
      const q = str(input, "query");
      const days = typeof input.days === "number" && input.days > 0 ? Math.min(input.days, 365) : 30;
      const since = new Date(Date.now() - days * 86_400_000);
      const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      const rows = await prisma.assistantActionIntent.findMany({
        where: {
          userId: user.id,
          proposedAt: { gte: since },
          ...(tokens.length > 0
            ? { AND: tokens.map((t) => ({ OR: [{ title: { contains: t, mode: "insensitive" as const } }, { summary: { contains: t, mode: "insensitive" as const } }] })) }
            : {}),
        },
        orderBy: { proposedAt: "desc" },
        take: 25,
      });
      if (rows.length === 0) {
        return q
          ? `Aucune action tracée contenant « ${q} » sur ${days} j. L'absence de trace ICI est fiable : aucune action de ce type n'a été proposée ni exécutée par l'assistant sur la période.`
          : `Aucune action de l'assistant tracée sur ${days} j.`;
      }
      return JSON.stringify({
        rappel: "États CANONIQUES serveur. PROPOSÉE = jamais exécutée. Seule EXÉCUTÉE (avec reçu) vaut envoi réel.",
        actions: rows.map((r) => ({
          titre: r.title,
          resume: r.summary,
          statut: INTENT_STATUS_LABEL[r.status as ActionIntentStatus] ?? r.status,
          origine: r.origin,
          proposeeLe: frDate(r.proposedAt),
          ...(r.decidedAt ? { decideeLe: frDate(r.decidedAt) } : {}),
          ...(r.executedAt ? { executeeLe: frDate(r.executedAt) } : {}),
          ...(r.resultMessage ? { recu: r.resultMessage } : {}),
          ...(r.resultLink ? { lien: r.resultLink } : {}),
          ...(r.error ? { erreur: r.error } : {}),
        })),
      });
    },
  },

  {
    def: {
      name: "episodic_recall",
      description:
        "LA MÉMOIRE ÉPISODIQUE FÉDÉRÉE : tout ce qui s'est PASSÉ entre l'utilisateur et l'assistant — actions (avec leur état " +
        "canonique), rappels planifiés, décisions enregistrées, engagements suivis, livrables générés — en UNE recherche. " +
        "Pour « on avait parlé de quoi ? », « qu'est-ce qu'on a fait / décidé cette semaine ? », « on avait prévu quelque chose " +
        "sur X ? ». À consulter AVANT de répondre « je ne retrouve rien » : l'absence de trace ici est fiable, un souvenir ne l'est pas.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Filtre optionnel (sujet, nom, référence)." },
          days: { type: "number", description: "Fenêtre en jours (défaut 30)." },
        },
      },
    },
    allowed: () => true, // chaque registre est strictement cloisonné par user.id / ownerId
    label: "Mémoire épisodique consultée",
    run: async (input, user) => {
      const q = str(input, "query");
      const days = typeof input.days === "number" && input.days > 0 ? Math.min(input.days, 365) : 30;
      const since = new Date(Date.now() - days * 86_400_000);
      const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
      const textWhere = (fields: string[]) =>
        tokens.length > 0
          ? { AND: tokens.map((t) => ({ OR: fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" as const } })) })) }
          : {};

      // Les CINQ registres, en parallèle — chacun déjà cloisonné à CE compte.
      const [intents, reminders, decisions, commitments, artifacts] = await Promise.all([
        prisma.assistantActionIntent.findMany({
          where: { userId: user.id, proposedAt: { gte: since }, ...textWhere(["title", "summary"]) },
          orderBy: { proposedAt: "desc" }, take: 10,
          select: { title: true, summary: true, status: true, proposedAt: true, executedAt: true },
        }).catch(() => []),
        prisma.assistantReminder.findMany({
          where: { userId: user.id, createdAt: { gte: since }, ...textWhere(["title", "note"]) },
          orderBy: { createdAt: "desc" }, take: 10,
          select: { title: true, dueAt: true, recurrence: true, active: true },
        }).catch(() => []),
        prisma.executiveDecision.findMany({
          where: { ownerId: user.id, createdAt: { gte: since }, ...textWhere(["title", "context"]) },
          orderBy: { createdAt: "desc" }, take: 10,
          select: { title: true, status: true, createdAt: true },
        }).catch(() => []),
        prisma.executiveCommitment.findMany({
          where: { ownerId: user.id, createdAt: { gte: since }, ...textWhere(["who", "what"]) },
          orderBy: { createdAt: "desc" }, take: 10,
          select: { who: true, what: true, status: true, dueAt: true },
        }).catch(() => []),
        prisma.assistantArtifact.findMany({
          where: { ownerId: user.id, createdAt: { gte: since }, ...textWhere(["title"]) },
          orderBy: { createdAt: "desc" }, take: 10,
          select: { title: true, formats: true, createdAt: true },
        }).catch(() => []),
      ]);

      const total = intents.length + reminders.length + decisions.length + commitments.length + artifacts.length;
      if (total === 0) {
        return q
          ? `Aucune trace ÉPISODIQUE contenant « ${q} » sur ${days} j — ni action, ni rappel, ni décision, ni engagement, ni livrable. Cette absence est fiable pour ce qui passe par l'assistant ; un échange purement oral hors outil ne laisse pas de trace ici.`
          : `Aucune trace épisodique sur ${days} j.`;
      }
      return JSON.stringify({
        periode: `${days} derniers jours`,
        ...(intents.length > 0 ? {
          actions: intents.map((r) => ({
            resume: r.summary, statut: INTENT_STATUS_LABEL[r.status as ActionIntentStatus] ?? r.status,
            proposeeLe: frDate(r.proposedAt), ...(r.executedAt ? { executeeLe: frDate(r.executedAt) } : {}),
          })),
        } : {}),
        ...(reminders.length > 0 ? {
          rappels: reminders.map((r) => ({ titre: r.title, echeance: frDate(r.dueAt), recurrence: r.recurrence, actif: r.active })),
        } : {}),
        ...(decisions.length > 0 ? {
          decisions: decisions.map((d) => ({ titre: d.title, statut: d.status, le: frDate(d.createdAt) })),
        } : {}),
        ...(commitments.length > 0 ? {
          engagements: commitments.map((c) => ({ qui: c.who, quoi: c.what, statut: c.status, echeance: c.dueAt ? frDate(c.dueAt) : null })),
        } : {}),
        ...(artifacts.length > 0 ? {
          livrables: artifacts.map((a) => ({ titre: a.title, formats: a.formats, le: frDate(a.createdAt) })),
        } : {}),
        rappel: "Objets STRUCTURÉS de ce compte — la vérité sur ce qui s'est passé avec l'assistant, sans dépendre du transcript.",
      });
    },
  },
];
