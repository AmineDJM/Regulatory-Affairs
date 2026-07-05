"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { HrRequestType, HrRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const REQUEST_TYPES: HrRequestType[] = ["WORK_CERTIFICATE", "CNAS_CERTIFICATE", "SALARY_STATEMENT", "DOMICILIATION", "LEAVE_CERTIFICATE", "LEAVE_TITLE", "MISSION_ORDER", "EXPENSE_REPORT", "EXCEPTIONAL_EXIT", "SICK_LEAVE", "ANNUAL_LEAVE", "UNPAID_LEAVE", "SPECIAL_LEAVE", "MATERNITY_LEAVE", "OTHER"];
const REQUEST_STATUSES: HrRequestStatus[] = ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "REJECTED"];

/** Demande d'attestation par l'employé (acte côté « Mon dossier RH »). */
export async function requestHrDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true } });
  if (!employee) return { ok: false, error: "Aucun dossier RH n'est lié à votre compte. Contactez les RH." };

  const typeRaw = fdStr(formData, "type");
  const type = (typeRaw && REQUEST_TYPES.includes(typeRaw as HrRequestType) ? typeRaw : "WORK_CERTIFICATE") as HrRequestType;

  const created = await prisma.hrDocumentRequest.create({
    data: { employeeId: employee.id, type, details: fdStr(formData, "details") },
  });

  // Pièces jointes facultatives (justificatif d'arrêt maladie, formulaire de congé…),
  // versées au dossier de la demande (visibles du demandeur et des RH).
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const maxMb = (await getAppSettings()).maxUploadMb;
    for (const file of files) {
      const invalid = validateUpload(file.name, file.size, maxMb);
      if (invalid) return { ok: false, error: invalid };
      const key = `HR_REQUEST/${created.id}/${randomUUID()}__${file.name}`;
      try {
        await saveFile(key, Buffer.from(await file.arrayBuffer()));
      } catch (err) {
        console.error("[hr-request] storage write failed, recording metadata only", err);
      }
      await prisma.document.create({
        data: {
          name: file.name, category: "OTHER", entityType: "HR_REQUEST", entityId: created.id,
          fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
        },
      });
    }
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "RH", summary: `Demande RH — ${type}` });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "GENERIC",
    title: "Nouvelle demande RH",
    body: `${employee.fullName} a demandé un document RH.`,
    link: `/rh/${employee.id}`,
  });
  revalidatePath("/mon-dossier");
  revalidatePath("/rh");
  return { ok: true, id: created.id };
}

/** Échange dans une demande RH : le demandeur ou les RH y répondent (fil de discussion). */
export async function addHrRequestComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "requestId");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Message vide." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const isOwner = req.employee.userId === user.id;
  const isHr = userCan(user, "RH", "UPDATE");
  if (!(isOwner || isHr)) return { ok: false, error: "Non autorisé." };

  await prisma.comment.create({ data: { entityType: "HR_REQUEST", entityId: id, body, authorId: user.id } });
  // Notifie l'autre partie.
  if (isHr && req.employee.userId) {
    await notifyUser({ userId: req.employee.userId, type: "GENERIC", title: "Réponse des RH à votre demande", body, link: "/mon-dossier" });
  } else if (isOwner) {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "GENERIC", title: "Message sur une demande RH", body: `${req.employee.fullName} : ${body}`, link: `/rh/${req.employeeId}` });
  }
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  return { ok: true };
}

/** Traitement d'une demande par les RH (statut + note). */
export async function processHrRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const statusRaw = fdStr(formData, "status");
  const status = (statusRaw && REQUEST_STATUSES.includes(statusRaw as HrRequestStatus) ? statusRaw : "IN_PROGRESS") as HrRequestStatus;

  const req = await prisma.hrDocumentRequest.update({
    where: { id },
    data: { status, hrNote: fdStr(formData, "hrNote"), handledById: user.id },
    include: { employee: { select: { fullName: true, userId: true } } },
  });
  if (req.employee.userId) {
    await notifyUser({
      userId: req.employee.userId,
      type: "GENERIC",
      title: "Votre demande RH a été mise à jour",
      body: `Statut : ${status}.`,
      link: "/mon-dossier",
    });
  }
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  return { ok: true };
}

/** Annulation/suppression d'une demande (employé sur sa demande en attente, ou RH). */
export async function deleteHrRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.hrDocumentRequest.findUnique({
    where: { id },
    include: { employee: { select: { userId: true } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const isOwner = req.employee.userId === user.id;
  const isHr = userCan(user, "RH", "UPDATE");
  if (!((isOwner && req.status === "PENDING") || isHr)) return { ok: false, error: "Non autorisé." };
  await prisma.hrDocumentRequest.delete({ where: { id } });
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  return { ok: true };
}

/** Suppression d'un document RH (RH) — libère le blob chiffré. */
export async function deleteEmployeeDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };
  const doc = await prisma.employeeDocument.findUnique({ where: { id }, select: { blobId: true, employeeId: true, name: true } });
  if (!doc) return { ok: false, error: "Document introuvable." };
  await prisma.employeeDocument.delete({ where: { id } });
  await releaseBlob(doc.blobId);
  await recordAudit({ actorId: user.id, action: "DELETE", module: "RH", entityType: "EMPLOYEE", entityId: doc.employeeId, summary: `Document RH « ${doc.name} » supprimé` });
  revalidatePath(`/rh/${doc.employeeId}`);
  revalidatePath("/mon-dossier");
  return { ok: true };
}
