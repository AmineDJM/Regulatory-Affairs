"use server";

import { revalidatePath } from "next/cache";
import { EntityType, type ConvMemberRole, type ConvNotifyLevel } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  getActiveMembership,
  findDirectConversation,
  sanitizeMentionIds,
  verifyBlob,
  preview,
} from "@/lib/messaging";
import { mapMessage, messageInclude, type MessageRow, type MessageDTO } from "@/lib/queries/messaging";
import { fdStr, fdBool, type ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

// ─────────────────────────── Helpers internes ───────────────────────────

function canManage(role: ConvMemberRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Émet un message « système » dans la conversation et remonte sa date. */
async function systemMessage(conversationId: string, body: string): Promise<void> {
  const m = await prisma.message.create({ data: { conversationId, senderId: null, kind: "SYSTEM", body } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
}

/** Ids de membres valides (comptes actifs, hors soi-même), dédoublonnés. */
async function validMemberIds(raw: string | null, selfId: string): Promise<string[]> {
  if (!raw) return [];
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].filter((id) => id !== selfId);
  if (!ids.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}

interface ParsedAttachment {
  blobId: string;
  name: string;
  mime: string;
  size: number;
}

/** Valide les pièces jointes : la signature HMAC prouve qu'un blob provient bien
 *  de notre route d'upload (interdit de référencer un blob arbitraire). */
function parseAttachments(raw: string | null): ParsedAttachment[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: ParsedAttachment[] = [];
    for (const a of arr.slice(0, 10)) {
      if (!a || typeof a.blobId !== "string" || typeof a.sig !== "string") continue;
      if (!verifyBlob(a.blobId, a.sig)) continue;
      out.push({
        blobId: a.blobId,
        name: String(a.name ?? "fichier").slice(0, 200),
        mime: String(a.mime ?? "application/octet-stream").slice(0, 120),
        size: Math.max(0, Math.min(Math.round(Number(a.size) || 0), 2_000_000_000)),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Référence à un objet de l'OS partagé dans un message (validée contre EntityType). */
function parseRef(formData: FormData): { type: EntityType; id: string; label: string | null } | null {
  const type = fdStr(formData, "refType");
  const id = fdStr(formData, "refId");
  if (!type || !id) return null;
  if (!(Object.values(EntityType) as string[]).includes(type)) return null;
  return { type: type as EntityType, id, label: fdStr(formData, "refLabel") };
}

async function validParent(parentId: string | null, conversationId: string): Promise<string | null> {
  if (!parentId) return null;
  const p = await prisma.message.findFirst({
    where: { id: parentId, conversationId, deletedAt: null },
    select: { id: true },
  });
  return p?.id ?? null;
}

// ─────────────────────────── Création de conversations ───────────────────────────

export async function createDirect(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "VIEW")) return DENIED;
  const targetId = fdStr(formData, "userId");
  if (!targetId || targetId === user.id) return { ok: false, error: "Destinataire invalide." };
  const target = await prisma.user.findFirst({ where: { id: targetId, isActive: true }, select: { id: true } });
  if (!target) return { ok: false, error: "Utilisateur introuvable." };

  const existing = await findDirectConversation(user.id, targetId);
  if (existing) return { ok: true, id: existing };

  const conv = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      createdById: user.id,
      members: { create: [{ userId: user.id }, { userId: targetId }] },
    },
    select: { id: true },
  });
  revalidatePath("/messages");
  return { ok: true, id: conv.id };
}

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "CREATE")) return DENIED;
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le nom du groupe est obligatoire." };
  const memberIds = await validMemberIds(fdStr(formData, "members"), user.id);

  const conv = await prisma.conversation.create({
    data: {
      type: "GROUP",
      title,
      color: fdStr(formData, "color"),
      createdById: user.id,
      members: {
        create: [
          { userId: user.id, role: "OWNER" },
          ...memberIds.map((id) => ({ userId: id, role: "MEMBER" as ConvMemberRole })),
        ],
      },
    },
    select: { id: true },
  });
  await systemMessage(conv.id, `${user.name} a créé le groupe « ${title} ».`);
  revalidatePath("/messages");
  return { ok: true, id: conv.id };
}

export async function createChannel(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "CREATE")) return DENIED;
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le nom du canal est obligatoire." };
  const memberIds = await validMemberIds(fdStr(formData, "members"), user.id);

  const conv = await prisma.conversation.create({
    data: {
      type: "CHANNEL",
      title,
      description: fdStr(formData, "description"),
      icon: fdStr(formData, "icon") ?? "Hash",
      color: fdStr(formData, "color"),
      createdById: user.id,
      members: {
        create: [
          { userId: user.id, role: "OWNER" },
          ...memberIds.map((id) => ({ userId: id, role: "MEMBER" as ConvMemberRole })),
        ],
      },
    },
    select: { id: true },
  });
  await systemMessage(conv.id, `${user.name} a créé le canal « ${title} ».`);
  revalidatePath("/messages");
  return { ok: true, id: conv.id };
}

// ─────────────────────────── Messages ───────────────────────────

export async function sendMessage(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; message?: MessageDTO }> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "CREATE")) return { ok: false, error: "Non autorisé." };
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const membership = await getActiveMembership(user.id, conversationId);
  if (!membership) return { ok: false, error: "Vous n'êtes pas membre de cette conversation." };

  const body = (formData.get("body") ? String(formData.get("body")) : "").trim().slice(0, 8000);
  const attachments = parseAttachments(fdStr(formData, "attachments"));
  if (!body && attachments.length === 0) return { ok: false, error: "Message vide." };

  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true, notifyLevel: true },
  });
  const memberIds = new Set(members.map((m) => m.userId));
  const mentionIds = sanitizeMentionIds(fdStr(formData, "mentions"), memberIds, user.id);
  const parentId = await validParent(fdStr(formData, "parentId"), conversationId);
  const ref = parseRef(formData);

  const created = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      kind: attachments.length > 0 && !body ? "FILE" : "TEXT",
      body,
      parentId,
      refType: ref?.type ?? null,
      refId: ref?.id ?? null,
      refLabel: ref?.label ?? null,
      mentions: mentionIds.length ? { create: mentionIds.map((id) => ({ userId: id })) } : undefined,
      attachments: attachments.length
        ? { create: attachments.map((a) => ({ blobId: a.blobId, name: a.name, mime: a.mime, size: a.size })) }
        : undefined,
    },
    include: messageInclude(user.id),
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });
  await prisma.conversationMember.update({ where: { id: membership.id }, data: { lastReadAt: created.createdAt } });

  // Notifier uniquement les personnes mentionnées (le compteur de non-lus gère le reste).
  if (mentionIds.length) {
    const levelById = new Map(members.map((m) => [m.userId, m.notifyLevel]));
    for (const id of mentionIds) {
      if (levelById.get(id) === "NONE") continue;
      await notifyUser({
        userId: id,
        type: "GENERIC",
        title: `${user.name} vous a mentionné`,
        body: preview(body, "TEXT", attachments.length > 0, 120),
        link: `/messages?c=${conversationId}`,
      });
    }
  }

  revalidatePath("/messages");
  return { ok: true, message: mapMessage(created as unknown as MessageRow, user.id) };
}

export async function editMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = (formData.get("body") ? String(formData.get("body")) : "").trim().slice(0, 8000);
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!body) return { ok: false, error: "Le message ne peut pas être vide." };
  const msg = await prisma.message.findUnique({ where: { id }, select: { senderId: true, deletedAt: true } });
  if (!msg || msg.senderId !== user.id || msg.deletedAt) return { ok: false, error: "Modification impossible." };
  await prisma.message.update({ where: { id }, data: { body, editedAt: new Date() } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function deleteMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const msg = await prisma.message.findUnique({ where: { id }, select: { senderId: true, conversationId: true } });
  if (!msg) return { ok: false, error: "Message introuvable." };
  // L'admin (vue globale) peut modérer n'importe quel message ; sinon, l'expéditeur ou un
  // propriétaire/admin de la conversation.
  const admin = hasGlobalView(user.role);
  if (!admin) {
    const membership = await getActiveMembership(user.id, msg.conversationId);
    if (!membership) return DENIED;
    if (msg.senderId !== user.id && !canManage(membership.role)) return DENIED;
  }
  await prisma.message.update({ where: { id }, data: { deletedAt: new Date(), isPinned: false } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function toggleReaction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const messageId = fdStr(formData, "messageId");
  const emoji = fdStr(formData, "emoji");
  if (!messageId || !emoji || emoji.length > 12) return { ok: false, error: "Réaction invalide." };
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true, deletedAt: true } });
  if (!msg || msg.deletedAt) return { ok: false, error: "Message indisponible." };
  if (!(await getActiveMembership(user.id, msg.conversationId))) return DENIED;

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
  });
  if (existing) await prisma.messageReaction.delete({ where: { id: existing.id } });
  else await prisma.messageReaction.create({ data: { messageId, userId: user.id, emoji } });
  return { ok: true };
}

export async function togglePinMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "messageId");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const msg = await prisma.message.findUnique({ where: { id }, select: { conversationId: true, isPinned: true, deletedAt: true } });
  if (!msg || msg.deletedAt) return { ok: false, error: "Message indisponible." };
  if (!(await getActiveMembership(user.id, msg.conversationId))) return DENIED;
  await prisma.message.update({ where: { id }, data: { isPinned: !msg.isPinned } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function bookmarkMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const messageId = fdStr(formData, "messageId");
  if (!messageId) return { ok: false, error: "Identifiant manquant." };
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
  if (!msg) return { ok: false, error: "Message introuvable." };
  if (!(await getActiveMembership(user.id, msg.conversationId))) return DENIED;
  const existing = await prisma.messageBookmark.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
  });
  if (existing) await prisma.messageBookmark.delete({ where: { id: existing.id } });
  else await prisma.messageBookmark.create({ data: { messageId, userId: user.id } });
  return { ok: true };
}

export async function markRead(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const membership = await getActiveMembership(user.id, conversationId);
  if (!membership) return DENIED;
  await prisma.conversationMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
  return { ok: true };
}

// ─────────────────────────── Préférences par conversation ───────────────────────────

export async function togglePinConversation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m) return DENIED;
  await prisma.conversationMember.update({ where: { id: m.id }, data: { isPinned: !m.isPinned } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function toggleMute(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m) return DENIED;
  await prisma.conversationMember.update({ where: { id: m.id }, data: { isMuted: !m.isMuted } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function setNotifyLevel(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  const level = fdStr(formData, "level");
  if (!conversationId || !level || !["ALL", "MENTIONS", "NONE"].includes(level)) return { ok: false, error: "Niveau invalide." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m) return DENIED;
  await prisma.conversationMember.update({ where: { id: m.id }, data: { notifyLevel: level as ConvNotifyLevel } });
  revalidatePath("/messages");
  return { ok: true };
}

// ─────────────────────────── Gestion des membres / conversation ───────────────────────────

export async function updateConversation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m || !canManage(m.role)) return DENIED;
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true, title: true } });
  if (!conv || conv.type === "DIRECT") return { ok: false, error: "Conversation non modifiable." };

  const title = fdStr(formData, "title");
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      title: title ?? conv.title,
      description: fdStr(formData, "description"),
      icon: fdStr(formData, "icon"),
      color: fdStr(formData, "color"),
    },
  });
  if (title && title !== conv.title) {
    await systemMessage(conversationId, `${user.name} a renommé la conversation en « ${title} ».`);
  }
  revalidatePath("/messages");
  return { ok: true };
}

export async function addMembers(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m || !canManage(m.role)) return DENIED;
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true } });
  if (!conv || conv.type === "DIRECT") return { ok: false, error: "Impossible d'ajouter des membres ici." };

  const ids = await validMemberIds(fdStr(formData, "members"), user.id);
  if (!ids.length) return { ok: false, error: "Aucun membre valide." };

  const added: string[] = [];
  for (const id of ids) {
    const existing = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: id } },
    });
    if (existing) {
      if (existing.leftAt) {
        await prisma.conversationMember.update({ where: { id: existing.id }, data: { leftAt: null, role: "MEMBER" } });
        added.push(id);
      }
    } else {
      await prisma.conversationMember.create({ data: { conversationId, userId: id, role: "MEMBER" } });
      added.push(id);
    }
  }
  if (added.length) {
    const names = await prisma.user.findMany({ where: { id: { in: added } }, select: { name: true } });
    await systemMessage(conversationId, `${user.name} a ajouté ${names.map((n) => n.name).join(", ")}.`);
  }
  revalidatePath("/messages");
  return { ok: true };
}

export async function removeMember(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  const userId = fdStr(formData, "userId");
  if (!conversationId || !userId) return { ok: false, error: "Paramètres manquants." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m || !canManage(m.role)) return DENIED;
  if (userId === user.id) return { ok: false, error: "Utilisez « Quitter » pour partir vous-même." };
  const target = await prisma.conversationMember.findFirst({ where: { conversationId, userId, leftAt: null } });
  if (!target) return { ok: false, error: "Membre introuvable." };
  await prisma.conversationMember.update({ where: { id: target.id }, data: { leftAt: new Date() } });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (u) await systemMessage(conversationId, `${user.name} a retiré ${u.name}.`);
  revalidatePath("/messages");
  return { ok: true };
}

export async function setMemberRole(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  const userId = fdStr(formData, "userId");
  const role = fdStr(formData, "role");
  if (!conversationId || !userId || !role || !["ADMIN", "MEMBER"].includes(role)) return { ok: false, error: "Paramètres invalides." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m || m.role !== "OWNER") return { ok: false, error: "Seul le propriétaire peut gérer les rôles." };
  const target = await prisma.conversationMember.findFirst({ where: { conversationId, userId, leftAt: null } });
  if (!target || target.role === "OWNER") return { ok: false, error: "Membre introuvable." };
  await prisma.conversationMember.update({ where: { id: target.id }, data: { role: role as ConvMemberRole } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function leaveConversation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m) return DENIED;
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true } });
  if (conv?.type === "DIRECT") return { ok: false, error: "On ne peut pas quitter un message direct." };
  await prisma.conversationMember.update({ where: { id: m.id }, data: { leftAt: new Date() } });
  await systemMessage(conversationId, `${user.name} a quitté la conversation.`);
  revalidatePath("/messages");
  return { ok: true };
}

export async function archiveConversation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Conversation manquante." };
  const m = await getActiveMembership(user.id, conversationId);
  if (!m || !canManage(m.role)) return DENIED;
  await prisma.conversation.update({ where: { id: conversationId }, data: { isArchived: fdBool(formData, "archived") } });
  revalidatePath("/messages");
  return { ok: true };
}

export async function joinChannel(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "VIEW")) return DENIED;
  const conversationId = fdStr(formData, "conversationId");
  if (!conversationId) return { ok: false, error: "Canal manquant." };
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true, isArchived: true } });
  if (!conv || conv.type !== "CHANNEL" || conv.isArchived) return { ok: false, error: "Canal indisponible." };

  const existing = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (existing && !existing.leftAt) return { ok: true, id: conversationId };
  if (existing) await prisma.conversationMember.update({ where: { id: existing.id }, data: { leftAt: null, role: "MEMBER" } });
  else await prisma.conversationMember.create({ data: { conversationId, userId: user.id, role: "MEMBER" } });
  await systemMessage(conversationId, `${user.name} a rejoint le canal.`);
  revalidatePath("/messages");
  return { ok: true, id: conversationId };
}
