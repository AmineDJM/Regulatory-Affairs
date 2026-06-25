"use server";

import { revalidatePath } from "next/cache";
import type { AdminRequestType, AdminRequestStatus, Priority, AdminApprovalStatus, DriverMissionStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.administrativeRequest.count({ where: { reference: { startsWith: `REQ-${year}-` } } });
  return `REQ-${year}-${String(count + 1).padStart(3, "0")}`;
}

/** Type-specific fields are submitted as `f_<name>` and stored in `fields` JSON. */
function collectFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("f_") && typeof v === "string" && v.trim()) out[k.slice(2)] = v.trim();
  }
  return out;
}

function isManager(user: SessionUser, assignedToId: string | null): boolean {
  return hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE") || assignedToId === user.id;
}

// ─────────────────────────────── Création ───────────────────────────────

export async function createRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return DENIED;
  const type = fdStr(formData, "type") as AdminRequestType | null;
  const title = fdStr(formData, "title");
  if (!type || !title) return { ok: false, error: "Type et titre obligatoires." };

  const created = await prisma.administrativeRequest.create({
    data: {
      reference: await nextRequestRef(),
      title, type,
      description: fdStr(formData, "description"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      deadline: fdDate(formData, "deadline"),
      concernedUserId: fdStr(formData, "concernedUserId"),
      assignedToId: fdStr(formData, "assignedToId"),
      departmentId: fdStr(formData, "departmentId"),
      fields: collectFields(formData),
      requesterId: user.id,
      createdById: user.id,
    },
    select: { id: true, reference: true, assignedToId: true },
  });

  if (created.assignedToId && created.assignedToId !== user.id) {
    await notifyUser({ userId: created.assignedToId, type: "ASSIGNMENT", title: "Nouvelle demande administrative", body: `${created.reference} — ${title}`, link: `/demandes/${created.id}` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: created.id, summary: `Demande ${created.reference} — ${title}` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true, id: created.id };
}

// ─────────────────────────────── Traitement ───────────────────────────────

export async function updateRequestStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as AdminRequestStatus | null;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, requesterId: true, reference: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  const data: { status: AdminRequestStatus; completedAt?: Date | null; cancelledAt?: Date | null; blockedReason?: string | null } = { status };
  if (status === "DONE") data.completedAt = new Date();
  if (status === "CANCELLED") data.cancelledAt = new Date();
  if (status === "BLOCKED") data.blockedReason = fdStr(formData, "blockedReason");
  await prisma.administrativeRequest.update({ where: { id }, data });

  if (req.requesterId && req.requesterId !== user.id) {
    await notifyUser({ userId: req.requesterId, type: "GENERIC", title: "Demande mise à jour", body: `${req.reference} — ${status}`, link: `/demandes/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: status, summary: `Statut → ${status}` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

export async function assignRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const assignedToId = fdStr(formData, "assignedToId");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true } });
  if (!req || !isManager(user, req.assignedToId)) return DENIED;
  await prisma.administrativeRequest.update({ where: { id }, data: { assignedToId } });
  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Demande qui vous est assignée", body: req.reference, link: `/demandes/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: id, summary: "Responsable modifié" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

// ─────────────────────────────── Validations ───────────────────────────────

export async function requestApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const validatorId = fdStr(formData, "validatorId");
  if (!requestId || !validatorId) return { ok: false, error: "Validateur requis." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id: requestId }, select: { assignedToId: true, reference: true } });
  if (!req || !isManager(user, req.assignedToId)) return DENIED;

  const amount = fdNum(formData, "amount");
  await prisma.adminApproval.create({
    data: { requestId, requestedById: user.id, validatorId, status: "PENDING", comment: fdStr(formData, "comment"), amount: amount ?? undefined },
  });
  await prisma.administrativeRequest.update({ where: { id: requestId }, data: { validatorId, status: "AWAITING_VALIDATION" } });
  await notifyUser({ userId: validatorId, type: "VALIDATION_REQUIRED", title: "Validation demandée", body: `${req.reference}${amount ? ` — ${amount.toLocaleString("fr-FR")} DZD` : ""}`, link: `/demandes/${requestId}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: requestId, summary: "Validation demandée" });
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes/approvals");
  return { ok: true };
}

export async function decideApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const approvalId = fdStr(formData, "approvalId");
  const decision = fdStr(formData, "decision") as AdminApprovalStatus | null;
  if (!approvalId || !decision || decision === "PENDING") return { ok: false, error: "Décision invalide." };
  const approval = await prisma.adminApproval.findUnique({ where: { id: approvalId }, include: { request: { select: { id: true, title: true, requesterId: true, assignedToId: true, reference: true, fields: true } } } });
  if (!approval) return { ok: false, error: "Validation introuvable." };
  const allowed = approval.validatorId === user.id || userCan(user, "ADMIN_REQUESTS", "VALIDATE") || hasGlobalView(user.role);
  if (!allowed) return DENIED;
  if (approval.status !== "PENDING") return { ok: false, error: "Déjà traité." };

  await prisma.adminApproval.update({ where: { id: approvalId }, data: { status: decision, comment: fdStr(formData, "comment") ?? approval.comment, decidedAt: new Date() } });

  const req = approval.request;
  let reqStatus: AdminRequestStatus = "IN_PROGRESS";
  if (decision === "APPROVED") {
    const amt = approval.amount ? Number(approval.amount) : 0;
    if (amt > 0) {
      const fields = (req.fields as Record<string, unknown> | null) ?? {};
      await createExpenseOrder({
        label: `Demande ${req.reference} — ${req.title}`,
        amount: amt, category: "AUTRE",
        beneficiary: (fields.beneficiaire as string) ?? req.title,
        sourceType: "ADMIN_REQUEST", sourceId: req.id, requestedById: user.id,
      });
      reqStatus = "AWAITING_PAYMENT";
    }
  } else if (decision === "REJECTED") {
    reqStatus = "BLOCKED";
  }
  await prisma.administrativeRequest.update({ where: { id: req.id }, data: { status: reqStatus } });

  for (const uid of [req.assignedToId, req.requesterId]) {
    if (uid && uid !== user.id) await notifyUser({ userId: uid, type: "GENERIC", title: `Validation : ${decision === "APPROVED" ? "acceptée" : decision === "REJECTED" ? "refusée" : "modif. demandée"}`, body: req.reference, link: `/demandes/${req.id}` });
  }
  await recordAudit({ actorId: user.id, action: decision === "REJECTED" ? "REFUSE" : "VALIDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: req.id, summary: `Validation ${decision}` });
  revalidatePath(`/demandes/${req.id}`);
  revalidatePath("/demandes/approvals");
  revalidatePath("/finances/ordres-de-depense");
  return { ok: true };
}

// ─────────────────────────────── Missions chauffeur ───────────────────────────────

export async function createMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Titre de mission requis." };
  if (requestId) {
    const req = await prisma.administrativeRequest.findUnique({ where: { id: requestId }, select: { assignedToId: true } });
    if (!req || !isManager(user, req.assignedToId)) return DENIED;
  } else if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) {
    return DENIED;
  }
  const assignedToId = fdStr(formData, "assignedToId");
  const created = await prisma.driverMission.create({
    data: {
      requestId: requestId ?? undefined, title, assignedToId,
      startLocation: fdStr(formData, "startLocation"), destination: fdStr(formData, "destination"),
      address: fdStr(formData, "address"), contactName: fdStr(formData, "contactName"), contactPhone: fdStr(formData, "contactPhone"),
      instructions: fdStr(formData, "instructions"), deadline: fdDate(formData, "deadline"),
      proofType: fdStr(formData, "proofType"), createdById: user.id,
    },
    select: { id: true },
  });
  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "MEDICAL_TOUR", title: "Nouvelle mission chauffeur", body: title, link: `/demandes/driver` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "DRIVER_MISSION", entityId: created.id, summary: `Mission « ${title} »` });
  if (requestId) revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes/driver");
  return { ok: true, id: created.id };
}

export async function updateMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as DriverMissionStatus | null;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const mission = await prisma.driverMission.findUnique({ where: { id }, select: { assignedToId: true, requestId: true, title: true } });
  if (!mission) return { ok: false, error: "Mission introuvable." };
  const allowed = mission.assignedToId === user.id || hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  if (!allowed) return DENIED;

  const data: { status: DriverMissionStatus; proofComment?: string | null; startedAt?: Date; completedAt?: Date } = { status, proofComment: fdStr(formData, "proofComment") };
  if (status === "EN_ROUTE" || status === "ACCEPTED") data.startedAt = new Date();
  if (status === "DONE") data.completedAt = new Date();
  await prisma.driverMission.update({ where: { id }, data });

  if ((status === "DONE" || status === "PROBLEM") && mission.requestId) {
    const req = await prisma.administrativeRequest.findUnique({ where: { id: mission.requestId }, select: { assignedToId: true, reference: true } });
    if (req?.assignedToId && req.assignedToId !== user.id) {
      await notifyUser({ userId: req.assignedToId, type: "GENERIC", title: `Mission ${status === "DONE" ? "terminée" : "— problème"}`, body: mission.title, link: `/demandes/${mission.requestId}` });
    }
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "DRIVER_MISSION", entityId: id, field: "status", newValue: status, summary: `Mission → ${status}` });
  revalidatePath("/demandes/driver");
  if (mission.requestId) revalidatePath(`/demandes/${mission.requestId}`);
  return { ok: true };
}

// ─────────────────────────────── Commentaires ───────────────────────────────

export async function addRequestComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const body = fdStr(formData, "body");
  if (!requestId || !body) return { ok: false, error: "Commentaire vide." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id: requestId }, select: { requesterId: true, assignedToId: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };

  await prisma.comment.create({ data: { entityType: "ADMIN_REQUEST", entityId: requestId, body, authorId: user.id } });
  const other = user.id === req.requesterId ? req.assignedToId : req.requesterId;
  if (other && other !== user.id) {
    await notifyUser({ userId: other, type: "GENERIC", title: "Nouveau commentaire", body: body.slice(0, 80), link: `/demandes/${requestId}` });
  }
  revalidatePath(`/demandes/${requestId}`);
  return { ok: true };
}
