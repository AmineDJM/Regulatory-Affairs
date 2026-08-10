"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { FinanceCategory } from "@prisma/client";
import type { AdminRequestType, AdminRequestStatus, Priority, AdminApprovalStatus, DriverMissionStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyIdForNew } from "@/lib/company";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { algiersInputToUtc, formatAlgiers } from "@/lib/calendar-tz";
import { archiveProcessedRequest } from "@/lib/archive";
import { ADMIN_REQUEST_TYPE } from "@/lib/labels";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { createDirectValidation } from "@/lib/validation";
import { buildRef, createWithRetry } from "@/lib/refs";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

/**
 * Archive une demande administrative TERMINÉE dans le Drive du traitant
 * (« Dossier traité / Bureau du secrétariat ») : récapitulatif + copie des pièces.
 * Une seule fois par demande ; ne fait jamais échouer le traitement.
 */
async function archiveAdminRequestIfDone(id: string, actorId: string): Promise<void> {
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    include: { requester: { select: { name: true } }, assignedTo: { select: { name: true } } },
  });
  if (!req || req.archivedNodeId || req.status !== "DONE") return;

  const docs = await prisma.document.findMany({
    where: { entityType: "ADMIN_REQUEST", entityId: id },
    select: { name: true, fileKey: true, mimeType: true },
  });
  const lines = [
    `Demande administrative — ${req.reference}`,
    `Titre : ${req.title}`,
    `Type : ${ADMIN_REQUEST_TYPE[req.type] ?? req.type}${req.subtype ? ` (${req.subtype})` : ""}`,
    req.requester?.name ? `Demandeur : ${req.requester.name}` : null,
    req.assignedTo?.name ? `Traitée par : ${req.assignedTo.name}` : null,
    req.description ? `Description : ${req.description}` : null,
    `Créée le : ${formatAlgiers(req.createdAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    `Terminée le : ${formatAlgiers(req.completedAt ?? new Date(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join("\n");

  const day = new Date().toISOString().slice(0, 10);
  const nodeId = await archiveProcessedRequest({
    bureau: "Bureau du secrétariat",
    folderName: `${day} — ${req.reference} — ${req.title}`,
    summary: lines,
    attachments: docs.map((d) => ({ name: d.name, fileKey: d.fileKey, mimeType: d.mimeType })),
    ownerId: actorId,
  });
  if (nodeId) {
    await prisma.administrativeRequest.update({ where: { id }, data: { archivedNodeId: nodeId } });
    revalidatePath("/drive");
  }
}

/** Fenêtre pendant laquelle le demandeur peut encore modifier/supprimer sa demande. */
const EDIT_WINDOW_MS = 30 * 60 * 1000;

/** Référence robuste (dérivée du maximum réel, pas de `count()+1` fragile). */
async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `REQ-${year}-` } },
    select: { reference: true },
  });
  return buildRef("REQ", year, refs.map((r) => r.reference));
}

/** Le demandeur peut agir tant que la demande est NEW et dans les 30 minutes. */
function withinRequesterWindow(req: { requesterId: string | null; status: AdminRequestStatus; createdAt: Date; processingStartedAt: Date | null }, userId: string): boolean {
  if (req.requesterId !== userId) return false;
  if (req.status !== "NEW") return false;
  if (req.processingStartedAt) return false;
  return Date.now() - req.createdAt.getTime() <= EDIT_WINDOW_MS;
}

/** Type-specific fields are submitted as `f_<name>` and stored in `fields` JSON. */
function collectFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("f_") && typeof v === "string" && v.trim()) out[k.slice(2)] = v.trim();
  }
  return out;
}

/**
 * Comme `collectFields`, mais conserve les champs **vidés** (valeur ""). Utilisé à
 * l'édition par le demandeur : il doit pouvoir modifier OU effacer n'importe quel
 * champ qu'il a saisi (remplacement intégral, pas seulement un ajout).
 */
function collectAllFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("f_") && typeof v === "string") {
      const val = v.trim();
      if (val) out[k.slice(2)] = val;
    }
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
      companyId: await companyIdForNew(user.id),
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
  if (status === "DONE") await archiveAdminRequestIfDone(id, user.id);
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
  // Échéance : « date et heure max » (datetime-local, heure d'Alger) ou simple date.
  const deadlineRaw = fdStr(formData, "deadline");
  const deadline = deadlineRaw ? algiersInputToUtc(deadlineRaw) ?? fdDate(formData, "deadline") : null;
  // Points de passage (point A, B, C…) avec la consigne à chaque point.
  const stopLocations = formData.getAll("stopLocation").map((v) => String(v).trim());
  const stopTasks = formData.getAll("stopTask").map((v) => String(v).trim());
  const stops = stopLocations
    .map((location, i) => ({ location, task: stopTasks[i] || null }))
    .filter((s) => s.location);

  const created = await prisma.driverMission.create({
    data: {
      requestId: requestId ?? undefined, title, assignedToId,
      startLocation: fdStr(formData, "startLocation"), destination: fdStr(formData, "destination"),
      address: fdStr(formData, "address"), contactName: fdStr(formData, "contactName"), contactPhone: fdStr(formData, "contactPhone"),
      instructions: fdStr(formData, "instructions"), deadline,
      proofType: fdStr(formData, "proofType"), createdById: user.id,
      stops: stops.length ? { create: stops.map((s, i) => ({ position: i, location: s.location, task: s.task })) } : undefined,
    },
    select: { id: true },
  });

  // Pièces jointes (bon de commande, dossier à déposer, plan…) versées à la course.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const maxMb = (await getAppSettings()).maxUploadMb;
    for (const file of files) {
      const invalid = validateUpload(file.name, file.size, maxMb);
      if (invalid) return { ok: false, error: invalid };
      const key = `DRIVER_MISSION/${created.id}/${randomUUID()}__${file.name}`;
      try {
        await saveFile(key, Buffer.from(await file.arrayBuffer()));
      } catch (err) {
        console.error("[mission] storage write failed, recording metadata only", err);
      }
      await prisma.document.create({
        data: {
          name: file.name, category: "OTHER", entityType: "DRIVER_MISSION", entityId: created.id,
          fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
        },
      });
    }
  }

  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "MEDICAL_TOUR", title: "Nouvelle course chauffeur", body: title, link: `/demandes/driver` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "DRIVER_MISSION", entityId: created.id, summary: `Mission « ${title} »` });
  if (requestId) revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes/driver");
  revalidatePath("/demandes/courses");
  return { ok: true, id: created.id };
}

/** Coche / décoche un point de passage d'une course (chauffeur assigné ou gestionnaire). */
export async function toggleMissionStop(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const stop = await prisma.driverMissionStop.findUnique({
    where: { id },
    select: { done: true, mission: { select: { id: true, assignedToId: true } } },
  });
  if (!stop) return { ok: false, error: "Point introuvable." };
  const allowed = stop.mission.assignedToId === user.id || hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  if (!allowed) return DENIED;
  const done = !stop.done;
  await prisma.driverMissionStop.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath("/demandes/driver");
  revalidatePath("/demandes/courses");
  return { ok: true };
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

// ─────────────────────────── Demande multi-cellules (lot) ───────────────────────────

interface BatchCell {
  type?: string;
  title?: string;
  description?: string;
  priority?: string;
  deadline?: string;
  articleId?: string;
  articleName?: string;
  quantity?: string;
  budget?: string;
}

const REQ_TYPES: AdminRequestType[] = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Crée plusieurs demandes en un seul envoi (cellules). Chaque cellule devient une
 * demande administrative à part entière, partageant un même `batchId` afin de
 * rester regroupées — mais pilotée indépendamment par l'assistante (statut,
 * validations). Idéal quand un employé a plusieurs besoins à formuler d'un coup.
 */
export async function createRequestBatch(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return DENIED;

  let cells: BatchCell[];
  try {
    cells = JSON.parse(fdStr(formData, "cells") ?? "[]");
  } catch {
    return { ok: false, error: "Format des cellules invalide." };
  }
  const clean = (Array.isArray(cells) ? cells : []).filter((c) => c && c.title && String(c.title).trim() && c.type);
  if (clean.length === 0) return { ok: false, error: "Ajoutez au moins une cellule (type + objet)." };
  if (clean.length > 25) return { ok: false, error: "25 cellules maximum par envoi." };

  const batchId = randomUUID();
  const concernedUserId = fdStr(formData, "concernedUserId");
  const assignedToId = fdStr(formData, "assignedToId");
  const departmentId = fdStr(formData, "departmentId");
  const createdIds: string[] = [];

  for (const c of clean) {
    const type = (REQ_TYPES.includes(c.type as AdminRequestType) ? c.type : "OTHER") as AdminRequestType;
    const priority = (c.priority && PRIORITIES.includes(c.priority as Priority) ? c.priority : "MEDIUM") as Priority;
    const fields: Record<string, string> = {};
    if (c.articleName) fields.article = String(c.articleName);
    if (c.articleId) fields.articleId = String(c.articleId);
    if (c.quantity) fields.quantite = String(c.quantity);
    if (c.budget) fields.budget = String(c.budget);
    const deadline = c.deadline ? new Date(c.deadline) : null;

    const created = await createWithRetry(async () =>
      prisma.administrativeRequest.create({
        data: {
          reference: await nextRequestRef(),
          title: String(c.title).trim(),
          type,
          description: c.description ? String(c.description).trim() : null,
          priority,
          deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
          concernedUserId,
          assignedToId,
          departmentId,
          fields,
          batchId,
          requesterId: user.id,
          createdById: user.id,
        },
        select: { id: true },
      }),
    );
    createdIds.push(created.id);
  }

  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Nouvelles demandes (lot)", body: `${createdIds.length} demande(s) à traiter`, link: `/demandes/${createdIds[0]}` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: createdIds[0], summary: `Lot de ${createdIds.length} demande(s) créé` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true, id: createdIds[0] };
}

// ─────────────────────────── Fenêtre demandeur (30 min) ───────────────────────────

/** Le demandeur modifie sa propre demande dans les 30 minutes (avant traitement). */
export async function editOwnRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { requesterId: true, status: true, createdAt: true, processingStartedAt: true, fields: true, deletedAt: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!withinRequesterWindow(req, user.id)) return { ok: false, error: "Le délai de modification (30 min) est dépassé." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le titre est obligatoire." };
  const existingFields = (req.fields as Record<string, string> | null) ?? {};
  // Édition complète : si le formulaire renvoie des champs `f_*`, on remplace
  // intégralement les champs saisis (y compris ceux que le demandeur a vidés) ;
  // sinon on conserve l'existant.
  const hasFieldInputs = [...formData.keys()].some((k) => k.startsWith("f_"));
  const fields = hasFieldInputs ? collectAllFields(formData) : existingFields;

  await prisma.administrativeRequest.update({
    where: { id },
    data: {
      title,
      description: fdStr(formData, "description"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      deadline: fdDate(formData, "deadline"),
      fields,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: "Demande modifiée par le demandeur (≤ 30 min)" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  return { ok: true };
}

/** Le demandeur supprime sa propre demande dans les 30 minutes (soft delete tracé). */
export async function deleteOwnRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { requesterId: true, status: true, createdAt: true, processingStartedAt: true, reference: true, deletedAt: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!withinRequesterWindow(req, user.id)) return { ok: false, error: "Le délai de suppression (30 min) est dépassé." };

  await prisma.administrativeRequest.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id, deletionReason: "Supprimée par le demandeur (≤ 30 min)", status: "CANCELLED", cancelledAt: new Date() },
  });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Demande ${req.reference} supprimée par le demandeur` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

// ─────────────────────────── Suppression traçable (assistante) ───────────────────────────

/** L'assistante supprime une ou plusieurs demandes — soft delete + motif obligatoire. */
export async function deleteRequests(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) return DENIED;
  const ids = (fdStr(formData, "ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Aucune demande sélectionnée." };
  const reason = fdStr(formData, "reason");
  if (!reason) return { ok: false, error: "Le motif de suppression est obligatoire (traçabilité)." };

  const targets = await prisma.administrativeRequest.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, reference: true } });
  if (targets.length === 0) return { ok: false, error: "Demande(s) introuvable(s)." };

  await prisma.administrativeRequest.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { deletedAt: new Date(), deletedById: user.id, deletionReason: reason },
  });
  for (const t of targets) {
    await recordAudit({ actorId: user.id, action: "DELETE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: t.id, newValue: reason, summary: `Demande ${t.reference} supprimée — motif : ${reason}` });
  }
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/** Restaure une demande supprimée (assistante / super admin). */
export async function restoreRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) return DENIED;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { reference: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  await prisma.administrativeRequest.update({ where: { id }, data: { deletedAt: null, deletedById: null, deletionReason: null, status: "NEW", cancelledAt: null } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Demande ${req.reference} restaurée` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

// ─────────────────────────── Flux de traitement (assistante) ───────────────────────────

/** « Commencer le traitement » : passe la demande en cours et fige la fenêtre demandeur. */
export async function startRequestProcessing(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, status: true, reference: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  await prisma.administrativeRequest.update({ where: { id }, data: { status: "IN_PROGRESS", processingStartedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: "IN_PROGRESS", summary: "Traitement démarré" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/**
 * « Demande de validation des Finances » (flux achat). Crée une demande de
 * validation dans le bureau central « Demandes de validations » à destination de
 * l'équipe Finances, rattachée à la demande. Va-et-vient possible : en cas de refus
 * ou de modification demandée, l'assistante peut renvoyer une nouvelle validation.
 */
export async function requestFinanceValidation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true, title: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  // Validateurs Finances : choisis dans le formulaire, sinon tous les responsables Finances.
  let validatorIds = [fdStr(formData, "validatorId"), fdStr(formData, "validator2Id")].filter((v): v is string => Boolean(v));
  if (validatorIds.length === 0) {
    const finance = await prisma.user.findMany({ where: { isActive: true, role: "FINANCE_BUDGET_MANAGER" }, select: { id: true } });
    validatorIds = finance.map((f) => f.id);
  }
  if (validatorIds.length === 0) return { ok: false, error: "Aucun responsable Finances disponible. Choisissez un validateur." };

  const amount = fdNum(formData, "amount");
  const note = fdStr(formData, "comment");
  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Achat — ${req.reference} : ${req.title}`,
    description: [note, amount ? `Montant estimé : ${amount.toLocaleString("fr-FR")} DZD` : null].filter(Boolean).join(" — ") || null,
    module: "Finances",
    link: `/demandes/${id}`,
    validatorIds,
    entityType: "ADMIN_REQUEST",
    entityId: id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.administrativeRequest.update({ where: { id }, data: { status: "AWAITING_VALIDATION" } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Validation Finances demandée (${res.reference})` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * « Demander une validation » (flux hors achat). L'assistante estime qui doit
 * valider (opérations, direction, autre) — ou personne. Routé vers le bureau
 * central « Demandes de validations ».
 */
export async function requestInternalValidation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true, title: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  const validatorIds = [fdStr(formData, "validatorId"), fdStr(formData, "validator2Id")].filter((v): v is string => Boolean(v));
  if (validatorIds.length === 0) return { ok: false, error: "Choisissez au moins un validateur." };

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `${req.reference} : ${req.title}`,
    description: fdStr(formData, "comment"),
    module: "Bureau du secrétariat",
    link: `/demandes/${id}`,
    validatorIds,
    entityType: "ADMIN_REQUEST",
    entityId: id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.administrativeRequest.update({ where: { id }, data: { status: "AWAITING_VALIDATION" } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Validation interne demandée (${res.reference})` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * « Fin de la demande ». Pour un achat, exige la facture finale (document de
 * catégorie INVOICE) avant de clôturer.
 */
export async function finishRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    select: { assignedToId: true, type: true, reference: true, title: true, linkedEntityType: true },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  if (req.type === "PURCHASE") {
    const invoice = await prisma.document.count({ where: { entityType: "ADMIN_REQUEST", entityId: id, category: "INVOICE" } });
    if (invoice === 0) return { ok: false, error: "Pour un achat, uploadez d'abord la facture finale (catégorie « Facture »)." };
  }

  // IMPUTATION AUX MOYENS GÉNÉRAUX — le geste qui manquait entre « la demande est faite » et
  // « le budget le sait ».
  //
  // Terminer un achat sans dire QUI le paie laissait le budget des moyens généraux intact
  // pendant que l'argent, lui, était sorti. L'assistante choisit donc le département à
  // débiter : le sien, ou celui qui a demandé — chaque département a SES moyens généraux, et
  // c'est le demandeur qui les consomme, pas le secrétariat qui exécute.
  //
  // EXCEPTION : ce qui vient d'Ad & Pro est déjà porté par le budget de l'opération (poste,
  // ordre de dépense). L'imputer une seconde fois le compterait deux fois.
  const fromAdPro = ["SPONSORING", "CONGRESS_NATIONAL", "CONGRESS_INTERNATIONAL", "EVENT", "PROMO_MATERIAL"]
    .includes(req.linkedEntityType ?? "");
  const departmentId = fdStr(formData, "budgetDepartmentId");
  const amount = fdNum(formData, "budgetAmount");
  const alreadyImputed = await prisma.departmentBudgetExpense.count({ where: { adminRequestId: id } });

  if (req.type === "PURCHASE" && !fromAdPro && alreadyImputed === 0 && (!departmentId || !amount)) {
    return {
      ok: false,
      error: "Choisissez le budget de moyens généraux à débiter (le vôtre ou celui du département concerné) et le montant réellement dépensé.",
    };
  }

  if (departmentId && amount != null && alreadyImputed === 0) {
    if (amount < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } });
    if (!dept) return { ok: false, error: "Département introuvable." };
    await prisma.departmentBudgetExpense.create({
      data: {
        departmentId: dept.id,
        year: new Date().getFullYear(),
        kind: "OPERATING",
        label: `${req.reference} — ${req.title}`,
        amount,
        notes: fdStr(formData, "budgetNote"),
        adminRequestId: id,
        createdById: user.id,
      },
    });
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Bureau du secrétariat",
      entityType: "ADMIN_REQUEST", entityId: id,
      summary: `Imputée aux moyens généraux de ${dept.name} — ${amount} DZD`,
    });
    revalidatePath("/moyens-generaux");
    revalidatePath("/budgets/departements");
  }

  await prisma.administrativeRequest.update({ where: { id }, data: { status: "DONE", completedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: "DONE", summary: "Fin de la demande" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/**
 * SOUMETTRE UNE PIÈCE JOINTE À VALIDATION — à n'importe quel moment, à une ou plusieurs personnes.
 *
 * Chaque pièce se soumet À PART (une facture peut partir en validation pendant que le devis reste
 * en discussion), au bureau de validation CENTRAL : les validateurs choisis la retrouvent dans
 * /validations et Mon travail, comme toute validation. En PARALLÈLE — tous saisis et notifiés en
 * même temps, aucun ordre imposé. Et parce qu'on ne valide pas une pièce hors de son contexte,
 * être validateur d'une pièce OUVRE L'ACCÈS à toute la demande (géré sur la page de la demande).
 */
export async function submitAttachmentValidation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  const validatorIds = formData.getAll("validatorIds").map((v) => String(v).trim()).filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();
  // Montant (DZD) et catégorie de finance FACULTATIFS : s'ils sont là, l'approbation de la pièce
  // émettra automatiquement l'ordre de dépense correspondant vers les Finances.
  const amount = fdNum(formData, "amount");
  const rawCategory = String(formData.get("category") ?? "").trim();
  const category = (Object.values(FinanceCategory) as string[]).includes(rawCategory) ? rawCategory : null;
  if (!requestId || !documentId) return { ok: false, error: "Pièce ou demande manquante." };
  if (validatorIds.length === 0) return { ok: false, error: "Choisissez au moins un validateur." };
  if (amount !== null && amount < 0) return { ok: false, error: "Montant invalide." };

  const req = await prisma.administrativeRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    select: { id: true, reference: true, title: true, requesterId: true, assignedToId: true },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const isSecretary = user.role === "DIRECTION_ASSISTANT";
  const allowed = hasGlobalView(user.role) || isSecretary || userCan(user, "ADMIN_REQUESTS", "UPDATE")
    || req.requesterId === user.id || req.assignedToId === user.id;
  if (!allowed) return { ok: false, error: "Non autorisé sur cette demande." };

  const doc = await prisma.document.findFirst({
    where: { id: documentId, entityType: "ADMIN_REQUEST", entityId: requestId },
    select: { id: true, name: true },
  });
  if (!doc) return { ok: false, error: "Cette pièce n'appartient pas à la demande." };

  // Pas deux validations EN COURS sur la même pièce : la seconde sèmerait la confusion sur
  // laquelle fait foi. Une pièce refusée peut en revanche être resoumise (nouvelle version).
  const pending = await prisma.validationRequest.count({
    where: { documentId: doc.id, entityType: "ADMIN_REQUEST", entityId: requestId, status: "PENDING" },
  });
  if (pending > 0) return { ok: false, error: "Cette pièce est déjà en cours de validation." };

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Pièce jointe « ${doc.name} » — ${req.reference}`,
    description: note || `Validation de la pièce « ${doc.name} » de la demande ${req.reference} — ${req.title}.`,
    link: `/demandes/${req.id}`,
    module: "Bureau du secrétariat",
    entityType: "ADMIN_REQUEST",
    entityId: req.id,
    documentId: doc.id,
    mode: "PARALLEL",
    validatorIds,
    amount,
    category,
    // Se choisir soi-même comme validateur est PERMIS ici : la validation de pièce est un avis,
    // pas un circuit hiérarchique — sans cela, le choix s'évaporait et l'écran réclamait
    // « au moins un validateur » alors qu'on venait d'en saisir un.
    allowSelf: true,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: req.id,
    summary: `Pièce « ${doc.name} » soumise à validation (${validatorIds.length} validateur·s) — ${res.reference}`,
  });
  revalidatePath(`/demandes/${req.id}`);
  revalidatePath("/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}

/**
 * RETIRER UNE VALIDATION DE PIÈCE EN COURS — soumise par erreur, mauvaise pièce, mauvais
 * validateurs : tant qu'elle est EN ATTENTE, celui qui l'a soumise (ou l'assistante / un profil
 * gestionnaire) peut la retirer. Statut ANNULÉ (trace conservée, pas de suppression) ; les
 * validateurs encore saisis sont prévenus et la pièce redevient soumissible.
 */
export async function cancelAttachmentValidation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const validationId = String(formData.get("validationId") ?? "").trim();
  if (!validationId) return { ok: false, error: "Validation manquante." };

  const val = await prisma.validationRequest.findFirst({
    where: { id: validationId, entityType: "ADMIN_REQUEST", documentId: { not: null } },
    select: {
      id: true, reference: true, title: true, status: true, requesterId: true, entityId: true,
      steps: { select: { validatorId: true, status: true } },
    },
  });
  if (!val) return { ok: false, error: "Validation introuvable." };
  if (val.status !== "PENDING") return { ok: false, error: "Cette validation est déjà clôturée." };

  const isSecretary = user.role === "DIRECTION_ASSISTANT";
  const allowed = hasGlobalView(user.role) || isSecretary || userCan(user, "ADMIN_REQUESTS", "UPDATE") || val.requesterId === user.id;
  if (!allowed) return { ok: false, error: "Non autorisé." };

  await prisma.validationRequest.update({ where: { id: val.id }, data: { status: "CANCELLED", decidedAt: new Date() } });

  // Prévenir ceux qui l'avaient encore dans leur file — sinon ils chercheraient une demande disparue.
  for (const s of val.steps) {
    if (s.status === "PENDING" && s.validatorId !== user.id) {
      await notifyUser({
        userId: s.validatorId, type: "GENERIC", title: "Validation retirée",
        body: `${val.reference} — ${val.title}`, link: val.entityId ? `/demandes/${val.entityId}` : "/validations",
      });
    }
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: val.entityId ?? val.id,
    summary: `Validation de pièce retirée — ${val.reference}`,
  });
  if (val.entityId) revalidatePath(`/demandes/${val.entityId}`);
  revalidatePath("/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}
