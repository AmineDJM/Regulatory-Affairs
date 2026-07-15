import crypto from "crypto";
import type { ConversationMember, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Cœur de la messagerie interne — règles d'accès & présence.
 *
 * Principe de sécurité : l'accès à une conversation est **strictement** gouverné
 * par l'appartenance (ConversationMember actif), jamais par un scope RBAC global.
 * On ne voit, n'écrit et ne télécharge que dans les conversations dont on est
 * membre — y compris un Super Admin (la messagerie reste un espace de confiance ;
 * l'entreprise possède la donnée, mais pas de « lecture par-dessus l'épaule » ici).
 */

/** Présence dérivée du dernier battement de cœur (heartbeat) de l'utilisateur. */
export type Presence = "online" | "away" | "offline";

export function presenceOf(lastSeenAt: Date | string | null | undefined): Presence {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 90_000) return "online"; // moins de 1 min 30
  if (diff < 10 * 60_000) return "away"; // moins de 10 min
  return "offline";
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "En ligne",
  away: "Absent",
  offline: "Hors ligne",
};

/** Renvoie l'adhésion active de l'utilisateur à une conversation (ou null). */
export async function getActiveMembership(
  userId: string,
  conversationId: string,
): Promise<ConversationMember | null> {
  return prisma.conversationMember.findFirst({
    where: { userId, conversationId, leftAt: null },
  });
}

/** Indique si l'utilisateur peut accéder à la conversation (membre actif). */
export async function canAccessConversation(userId: string, conversationId: string): Promise<boolean> {
  return (await getActiveMembership(userId, conversationId)) !== null;
}

/** Cherche le message direct (1-1) déjà existant entre deux utilisateurs. */
export async function findDirectConversation(a: string, b: string): Promise<string | null> {
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: a } } },
        { members: { some: { userId: b } } },
      ],
    },
    select: { id: true },
  });
  return existing?.id ?? null;
}

/** Sélecteur compact pour afficher un utilisateur dans la messagerie. */
export const messagingUserSelect = {
  id: true,
  name: true,
  title: true,
  role: true,
  avatarColor: true,
  lastSeenAt: true,
  isActive: true,
  chatStatus: true,
  statusMessage: true,
} satisfies Prisma.UserSelect;

/** Statut de messagerie choisi manuellement (façon Teams). */
export type ChatStatus = "AVAILABLE" | "BUSY" | "DND" | "BRB" | "AWAY" | "OFFLINE";
export const CHAT_STATUSES: ChatStatus[] = ["AVAILABLE", "BUSY", "DND", "BRB", "AWAY", "OFFLINE"];
export const CHAT_STATUS_LABEL: Record<ChatStatus, string> = {
  AVAILABLE: "Disponible",
  BUSY: "Occupé",
  DND: "Ne pas déranger",
  BRB: "De retour bientôt",
  AWAY: "Absent",
  OFFLINE: "Hors ligne",
};
/** Valide et normalise un statut manuel reçu du client (ou null pour « automatique »). */
export function normalizeChatStatus(raw: string | null | undefined): ChatStatus | null {
  return raw && (CHAT_STATUSES as string[]).includes(raw) ? (raw as ChatStatus) : null;
}

// ─────────────────────────── Signature des pièces jointes ───────────────────────────
// Une pièce jointe est référencée par l'id de son blob chiffré. Pour empêcher un
// client de référencer un blob arbitraire (ex. un fichier du Drive) dont il ne
// possède pas le contenu, la route d'upload signe l'id du blob ; `sendMessage` ne
// crée une pièce jointe que si la signature est valide.

function blobSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "amd-internal-os";
}

export function signBlob(blobId: string): string {
  return crypto.createHmac("sha256", blobSecret()).update(blobId).digest("hex").slice(0, 32);
}

export function verifyBlob(blobId: string, sig: string): boolean {
  try {
    const expected = signBlob(blobId);
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** Met à jour la présence (best-effort, ne casse jamais l'appel parent). */
export async function touchPresence(userId: string): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}

/** Tronque un corps de message pour un aperçu (liste, citation, notification). */
export function preview(body: string, kind: string, hasAttachment: boolean, max = 90): string {
  if (kind === "FILE" || (!body && hasAttachment)) return "📎 Pièce jointe";
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean && hasAttachment) return "📎 Pièce jointe";
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/**
 * Extrait les identifiants mentionnés à partir d'une liste candidate.
 * La saisie passe les ids choisis dans l'autocomplétion ; on ne garde que ceux
 * qui sont réellement membres de la conversation (sécurité + cohérence).
 */
export function sanitizeMentionIds(raw: string | null, memberIds: Set<string>, selfId: string): string[] {
  if (!raw) return [];
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const id of ids) if (id !== selfId && memberIds.has(id)) out.add(id);
  return [...out];
}
