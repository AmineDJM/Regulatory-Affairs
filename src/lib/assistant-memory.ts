import { prisma } from "@/lib/prisma";
import { getManagerOfUser, getDepartmentPath } from "@/lib/departments";

/**
 * MÉMOIRE DE L'ASSISTANT — strictement personnelle.
 *
 * ⚠️ RÈGLE ABSOLUE : ce fichier est la **seule porte d'entrée** vers les fils, messages et
 * mémoires d'assistant. Aucun autre module ne doit interroger `assistantThread`,
 * `assistantMessage` ou `assistantMemory` directement.
 *
 * Le cloisonnement n'est pas une convention, c'est une **structure** :
 *   1. toute fonction exige le `userId` du DEMANDEUR en premier paramètre ;
 *   2. tout `where` contient ce `userId` — un identifiant de fil deviné ne donne rien ;
 *   3. `AssistantMessage` porte lui aussi le `userId` (redondant avec son fil) : même une
 *      erreur de jointure ne peut pas exposer le message d'autrui ;
 *   4. le `userId` vient TOUJOURS de la session serveur, jamais du client.
 *
 * Conséquence : l'assistant du directeur des opérations ne peut pas atteindre celui du
 * chef de produit, littéralement — il n'existe aucun chemin de code pour le faire.
 */

// ───────────────────────────── Fils de conversation ─────────────────────────────

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
  messages: number;
}

/** Les fils de CETTE personne, du plus récent au plus ancien. */
export async function listThreads(userId: string, limit = 30): Promise<ThreadSummary[]> {
  const rows = await prisma.assistantThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title?.trim() || "Nouvelle conversation",
    updatedAt: t.updatedAt.toISOString(),
    messages: t._count.messages,
  }));
}

export interface StoredMessage { role: "user" | "assistant"; content: string; createdAt: string }

/**
 * Messages d'un fil — **uniquement si ce fil appartient au demandeur**.
 * Renvoie `null` si le fil n'existe pas OU ne lui appartient pas : de l'extérieur, les
 * deux cas sont indiscernables (on ne révèle pas l'existence du fil d'autrui).
 */
export async function getThreadMessages(userId: string, threadId: string): Promise<StoredMessage[] | null> {
  const thread = await prisma.assistantThread.findFirst({
    where: { id: threadId, userId }, // ← les DEUX conditions, toujours
    select: { id: true },
  });
  if (!thread) return null;
  const rows = await prisma.assistantMessage.findMany({
    where: { threadId, userId }, // ← ceinture ET bretelles
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, createdAt: true },
  });
  return rows.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content, createdAt: m.createdAt.toISOString() }));
}

/** Crée un fil pour cette personne. Le titre est dérivé de sa première question. */
export async function createThread(userId: string, firstMessage?: string): Promise<string> {
  const title = firstMessage?.trim().slice(0, 80) || null;
  const t = await prisma.assistantThread.create({ data: { userId, title }, select: { id: true } });
  return t.id;
}

/**
 * Ajoute un échange (question puis réponse) à un fil appartenant au demandeur.
 * Si le fil ne lui appartient pas, on n'écrit RIEN et on renvoie false.
 */
export async function appendExchange(
  userId: string, threadId: string, userMessage: string, assistantReply: string,
): Promise<boolean> {
  const owned = await prisma.assistantThread.findFirst({ where: { id: threadId, userId }, select: { id: true, title: true } });
  if (!owned) return false;
  await prisma.assistantMessage.createMany({
    data: [
      { threadId, userId, role: "user", content: userMessage },
      { threadId, userId, role: "assistant", content: assistantReply },
    ],
  });
  await prisma.assistantThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date(), ...(owned.title ? {} : { title: userMessage.trim().slice(0, 80) }) },
  });
  return true;
}

/** Supprime un fil — seulement s'il appartient au demandeur. */
export async function deleteThread(userId: string, threadId: string): Promise<boolean> {
  const { count } = await prisma.assistantThread.deleteMany({ where: { id: threadId, userId } });
  return count > 0;
}

/** Efface TOUTE la mémoire d'une personne (droit à l'oubli, à sa main). */
export async function forgetEverything(userId: string): Promise<void> {
  await prisma.assistantThread.deleteMany({ where: { userId } });
  await prisma.assistantMessage.deleteMany({ where: { userId } });
  await prisma.assistantMemory.deleteMany({ where: { userId } });
}

// ───────────────────────────── Mémoire distillée ─────────────────────────────

export async function getMemory(userId: string): Promise<string | null> {
  const m = await prisma.assistantMemory.findUnique({ where: { userId }, select: { summary: true } });
  return m?.summary ?? null;
}

/**
 * La distillation est-elle due ? On compare le nombre total de messages de la personne au
 * nombre déjà distillé (`turns`). Au-delà du seuil, la mémoire est réécrite (un seul appel
 * IA économique, très épisodique) — inutile de le faire à chaque échange.
 */
export async function distillationDue(userId: string, every = 12): Promise<boolean> {
  const [total, mem] = await Promise.all([
    prisma.assistantMessage.count({ where: { userId } }),
    prisma.assistantMemory.findUnique({ where: { userId }, select: { turns: true } }),
  ]);
  return total - (mem?.turns ?? 0) >= every;
}

/** Nombre de messages mémorisés pour cette personne (base du compteur de distillation). */
export async function countMessages(userId: string): Promise<number> {
  return prisma.assistantMessage.count({ where: { userId } });
}

export async function saveMemory(userId: string, summary: string, turns: number): Promise<void> {
  await prisma.assistantMemory.upsert({
    where: { userId },
    create: { userId, summary: summary.slice(0, 4000), turns },
    update: { summary: summary.slice(0, 4000), turns },
  });
}

/** Les N derniers échanges de la personne, toutes conversations confondues (distillation). */
export async function recentMessages(userId: string, limit = 60): Promise<StoredMessage[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true, createdAt: true },
  });
  return rows
    .reverse()
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content, createdAt: m.createdAt.toISOString() }));
}

// ───────────────────────────── Contexte personnel ─────────────────────────────

/**
 * Ce que l'assistant sait de SA personne : identité, rattachement, hiérarchie, et ce qu'il
 * a retenu d'elle. Uniquement des données que la personne peut déjà voir sur son profil.
 */
export async function personalContext(userId: string): Promise<string> {
  const [user, memory] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, email: true, role: true, secondaryRole: true,
        department: { select: { name: true, id: true } },
        employee: { select: { id: true, position: true, departmentId: true, company: { select: { name: true, shortName: true } } } },
      },
    }),
    getMemory(userId),
  ]);
  if (!user) return "";

  const lines: string[] = [];
  lines.push(`Tu assistes ${user.name} (${user.email}).`);
  if (user.employee?.position) lines.push(`Poste : ${user.employee.position}.`);
  if (user.employee?.company) lines.push(`Entité : ${user.employee.company.shortName ?? user.employee.company.name}.`);

  // Rattachement : fil d'Ariane complet du département.
  const deptId = user.employee?.departmentId ?? user.department?.id ?? null;
  if (deptId) {
    const path = await getDepartmentPath(deptId).catch(() => []);
    if (path.length) lines.push(`Département : ${path.map((p) => p.name).join(" › ")}.`);
  }

  // N+1 réel (manager désigné → responsable de département → parent).
  const mgr = await getManagerOfUser(userId).catch(() => null);
  if (mgr) lines.push(`Son responsable hiérarchique (N+1) est ${mgr.fullName} — c'est lui qui valide ses demandes.`);

  if (memory) lines.push(`\nCE QUE TU AS RETENU DE CETTE PERSONNE (mémoire de vos échanges précédents) :\n${memory}`);

  lines.push(
    "\nCette mémoire et ces conversations sont STRICTEMENT PERSONNELLES : tu n'as jamais accès " +
    "aux conversations d'un autre collaborateur, et tu ne dois jamais prétendre le contraire.",
  );
  return lines.join("\n");
}
