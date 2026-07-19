"use server";

import { revalidatePath } from "next/cache";
import type { Priority, RegRequestCategory, RegRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canCreateRegRequest, canAnswerRegRequests, type SessionUser } from "@/lib/rbac";
import { getAppSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { buildRef } from "@/lib/refs";
import { notifyUser, broadcastNotification } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const BASE = "/regulatory/requests";

function parseCategory(v: string | null): RegRequestCategory {
  return v === "QUESTION" || v === "DOCUMENT" || v === "STATUS_UPDATE" || v === "VARIATION" || v === "OTHER" ? v : "QUESTION";
}
function parsePriority(v: string | null): Priority {
  return v === "LOW" || v === "MEDIUM" || v === "HIGH" || v === "CRITICAL" ? v : "MEDIUM";
}
function parseStatus(v: string | null): RegRequestStatus | null {
  return v === "OPEN" || v === "IN_PROGRESS" || v === "ANSWERED" || v === "CLOSED" ? v : null;
}

/** Accès à une demande précise : le demandeur (PRIM) OU un répondant Regulatory. */
async function loadAccessible(user: SessionUser, id: string) {
  const req = await prisma.regulatoryRequest.findUnique({ where: { id } });
  if (!req) return { error: "Demande introuvable." as const };
  const allowed = canAnswerRegRequests(user) || req.requesterId === user.id;
  if (!allowed) return { error: "Accès non autorisé à cette demande." as const };
  return { req };
}

// ─────────────────────────── Création (PRIM) ───────────────────────────
export async function createRegRequest(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { regRequestCreatorRoles } = await getAppSettings();
  if (!canCreateRegRequest(user, regRequestCreatorRoles)) {
    return { ok: false, error: "Création réservée au PRIM et aux rôles autorisés par le Super Admin. L'équipe Regulatory répond aux demandes." };
  }
  const subject = fdStr(formData, "subject");
  const body = fdStr(formData, "body");
  if (!subject) return { ok: false, error: "L'objet de la demande est obligatoire." };
  if (!body) return { ok: false, error: "Décrivez votre demande." };

  const year = new Date().getFullYear();
  const existing = await prisma.regulatoryRequest.findMany({ where: { reference: { startsWith: `RRQ-${year}-` } }, select: { reference: true } });
  const reference = buildRef("RRQ", year, existing.map((r) => r.reference));

  const req = await prisma.regulatoryRequest.create({
    data: {
      reference, subject, body,
      category: parseCategory(fdStr(formData, "category")),
      priority: parsePriority(fdStr(formData, "priority")),
      productId: fdStr(formData, "productId") || null,
      requesterId: user.id,
    },
    select: { id: true, reference: true },
  });

  await recordAudit({ actorId: user.id, action: "CREATE", module: "Regulatory", summary: `Demande info médicale « ${subject} » (${req.reference})` });
  // Prévient l'équipe Regulatory (le responsable) qu'une nouvelle demande est arrivée.
  await broadcastNotification({ audience: "ROLE", role: "HEAD_OF_REGULATORY", title: "Nouvelle demande de l'information médicale", body: subject, link: `${BASE}/${req.id}` }).catch(() => {});
  revalidatePath(BASE);
  return { ok: true, id: req.id };
}

// ─────────────────────────── Message (fil) ───────────────────────────
export async function postRegRequestMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = fdStr(formData, "body");
  if (!id) return { ok: false, error: "Demande introuvable." };
  if (!body) return { ok: false, error: "Le message est vide." };
  const acc = await loadAccessible(user, id);
  if ("error" in acc) return { ok: false, error: acc.error };
  const req = acc.req;

  const isAnswerer = canAnswerRegRequests(user) && req.requesterId !== user.id;
  await prisma.$transaction(async (tx) => {
    await tx.regulatoryRequestMessage.create({ data: { requestId: id, authorId: user.id, body } });
    // Un répondant Regulatory qui intervient prend la demande en charge (assignation + statut).
    const data: { updatedAt: Date; assignedToId?: string; status?: RegRequestStatus } = { updatedAt: new Date() };
    if (isAnswerer) {
      if (!req.assignedToId) data.assignedToId = user.id;
      if (req.status === "OPEN") data.status = "IN_PROGRESS";
    }
    await tx.regulatoryRequest.update({ where: { id }, data });
  });

  // Notifie l'AUTRE partie.
  const recipientId = isAnswerer ? req.requesterId : req.assignedToId;
  if (recipientId && recipientId !== user.id) {
    await notifyUser({ userId: recipientId, type: "GENERIC", title: `Réponse — ${req.reference}`, body, link: `${BASE}/${id}` }).catch(() => {});
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", summary: `Message sur demande ${req.reference}` });
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  return { ok: true };
}

// ─────────────────────────── Statut (Regulatory) ───────────────────────────
export async function setRegRequestStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAnswerRegRequests(user)) return { ok: false, error: "Réservé à l'équipe Regulatory." };
  const id = fdStr(formData, "id");
  const status = parseStatus(fdStr(formData, "status"));
  if (!id || !status) return { ok: false, error: "Statut invalide." };
  const req = await prisma.regulatoryRequest.findUnique({ where: { id }, select: { requesterId: true, reference: true, assignedToId: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  await prisma.regulatoryRequest.update({
    where: { id },
    data: { status, assignedToId: req.assignedToId ?? user.id },
  });
  if (req.requesterId && req.requesterId !== user.id) {
    await notifyUser({ userId: req.requesterId, type: "GENERIC", title: `Demande ${req.reference} — ${status === "ANSWERED" ? "répondue" : status === "CLOSED" ? "clôturée" : "prise en charge"}`, link: `${BASE}/${id}` }).catch(() => {});
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", summary: `Statut demande ${req.reference} → ${status}` });
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  return { ok: true };
}

// ─────────────────────────── Suppression ───────────────────────────
export async function deleteRegRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.regulatoryRequest.findUnique({ where: { id }, select: { requesterId: true, reference: true, status: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  // Le demandeur peut retirer sa demande tant qu'elle est encore OUVERTE ; un répondant/global peut toujours.
  const allowed = canAnswerRegRequests(user) || (req.requesterId === user.id && req.status === "OPEN");
  if (!allowed) return { ok: false, error: "Suppression non autorisée." };
  await prisma.regulatoryRequest.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Regulatory", summary: `Demande info médicale ${req.reference} supprimée` });
  revalidatePath(BASE);
  return { ok: true };
}
