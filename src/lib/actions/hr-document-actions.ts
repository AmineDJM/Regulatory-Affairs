"use server";

import { revalidatePath } from "next/cache";
import type { HrRequestType, HrRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const REQUEST_TYPES: HrRequestType[] = ["WORK_CERTIFICATE", "CNAS_CERTIFICATE", "SALARY_STATEMENT", "DOMICILIATION", "LEAVE_CERTIFICATE", "OTHER"];
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
