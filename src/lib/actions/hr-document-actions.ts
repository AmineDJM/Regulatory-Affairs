"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { HrRequestType, HrRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createEventForUser } from "@/lib/calendar";
import { algiersInputToUtc, formatAlgiers } from "@/lib/calendar-tz";
import { formatMonth, nextMonthYm } from "@/lib/utils";
import { archiveProcessedRequest } from "@/lib/archive";
import { getBlob } from "@/lib/drive-storage";
import { HR_REQUEST_TYPE, HR_REQUEST_STATUS } from "@/lib/labels";
import { HR_APPROVAL_TYPES, hrNature } from "@/lib/hr-request-flow";
import {
  createLeaveRequest, attachLeaveFiles, revalidateLeaveViews, leaveDaysBetween,
  hrTypeIsLeave, HR_TYPE_TO_LEAVE,
} from "@/lib/hr/leave-core";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const REQUEST_TYPES: HrRequestType[] = ["WORK_CERTIFICATE", "CNAS_CERTIFICATE", "SALARY_STATEMENT", "DOMICILIATION", "LEAVE_CERTIFICATE", "LEAVE_TITLE", "MISSION_ORDER", "EXPENSE_REPORT", "EXCEPTIONAL_EXIT", "SICK_LEAVE", "ANNUAL_LEAVE", "UNPAID_LEAVE", "SPECIAL_LEAVE", "MATERNITY_LEAVE", "HR_INTERVIEW", "OTHER"];
const REQUEST_STATUSES: HrRequestStatus[] = ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "REJECTED"];
const YM = /^\d{4}-\d{2}$/;
/** Statuts « traités » : la demande part alors dans la boîte « Dossier traité » du Drive. */
const DONE_STATUSES: HrRequestStatus[] = ["READY", "DELIVERED", "APPROVED", "REJECTED"];
/** Types « congé » à période complète (jours entiers, début + fin obligatoires). */
const LEAVE_PERIOD_TYPES: HrRequestType[] = ["ANNUAL_LEAVE", "UNPAID_LEAVE", "SPECIAL_LEAVE", "MATERNITY_LEAVE", "SICK_LEAVE"];
/** Types nécessitant au moins une date de début (congés + absence ponctuelle). */
const PERIOD_TYPES: HrRequestType[] = [...LEAVE_PERIOD_TYPES, "EXCEPTIONAL_EXIT"];

/** Jours calendaires inclusifs entre deux dates (min 1). */
function daysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Débit UNIQUE du solde de congés d'un employé lorsqu'un congé ANNUEL est accordé.
 * Verrou `balanceAppliedAt` : idempotent (jamais débité deux fois). Les congés sans
 * solde / exceptionnels / maternité / maladie ne débitent pas. Renvoie le nb de jours débités.
 */
async function applyAnnualLeaveBalance(
  req: { id: string; type: HrRequestType; employeeId: string; balanceAppliedAt: Date | null; periodDays: unknown },
  actorId: string,
  employeeName: string,
): Promise<number> {
  const pd = req.periodDays ? Number(req.periodDays) : 0;
  if (req.type !== "ANNUAL_LEAVE" || req.balanceAppliedAt || !(pd > 0)) return 0;
  await prisma.employee.update({ where: { id: req.employeeId }, data: { leaveBalanceDays: { decrement: pd } } });
  await prisma.hrDocumentRequest.update({ where: { id: req.id }, data: { balanceAppliedAt: new Date() } });
  await recordAudit({ actorId, action: "UPDATE", module: "RH", summary: `Congé annuel accordé — ${employeeName} (−${pd} j de solde)` });
  return pd;
}

/**
 * Archive une demande RH TRAITÉE dans le Drive du traitant (« Dossier traité / RH ») :
 * récapitulatif + copie des pièces jointes + document déposé en réponse. Une seule fois
 * par demande ; ne fait jamais échouer le traitement.
 */
async function archiveHrRequestIfDone(id: string, actorId: string): Promise<void> {
  const req = await prisma.hrDocumentRequest.findUnique({
    where: { id },
    include: { employee: { select: { fullName: true } }, fulfilment: { select: { name: true, mime: true, blobId: true } } },
  });
  if (!req || req.archivedNodeId || !DONE_STATUSES.includes(req.status)) return;

  const docs = await prisma.document.findMany({
    where: { entityType: "HR_REQUEST", entityId: id },
    select: { name: true, fileKey: true, mimeType: true },
  });
  const lines = [
    `Demande RH — ${HR_REQUEST_TYPE[req.type] ?? req.type}`,
    `Employé : ${req.employee.fullName}`,
    `Statut : ${HR_REQUEST_STATUS[req.status]?.label ?? req.status}`,
    `Demandée le : ${formatAlgiers(req.createdAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    req.details ? `Précisions : ${req.details}` : null,
    req.hrNote ? `Note RH : ${req.hrNote}` : null,
    req.expenseMonth ? `Mois concerné : ${formatMonth(req.expenseMonth)}` : null,
    req.approvedMonth ? `Validée pour : ${formatMonth(req.approvedMonth)}` : null,
    req.periodStart ? `Période : du ${formatAlgiers(req.periodStart, { day: "2-digit", month: "long", year: "numeric" })}${req.periodEnd ? ` au ${formatAlgiers(req.periodEnd, { day: "2-digit", month: "long", year: "numeric" })}` : ""}${req.periodDays ? ` (${Number(req.periodDays)} j)` : ""}` : null,
    req.originalsAckAt ? `Originaux réceptionnés le : ${formatAlgiers(req.originalsAckAt, { day: "2-digit", month: "long", year: "numeric" })}` : null,
    req.meetingAt ? `Entrevue : ${formatAlgiers(req.meetingAt, { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}${req.meetingConfirmedAt ? " (confirmée)" : ""}` : null,
    `Traitée le : ${formatAlgiers(new Date(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join("\n");

  // Document RH déposé en réponse (stockage chiffré du Drive RH).
  const extraFiles: { name: string; content: Buffer; mimeType?: string | null }[] = [];
  if (req.fulfilment) {
    try {
      const buf = await getBlob(req.fulfilment.blobId);
      if (buf) extraFiles.push({ name: req.fulfilment.name, content: buf, mimeType: req.fulfilment.mime });
    } catch { /* pièce illisible : le récapitulatif suffit */ }
  }

  const day = new Date().toISOString().slice(0, 10);
  const nodeId = await archiveProcessedRequest({
    bureau: "RH",
    folderName: `${day} — ${HR_REQUEST_TYPE[req.type] ?? req.type} — ${req.employee.fullName}`,
    summary: lines,
    attachments: docs.map((d) => ({ name: d.name, fileKey: d.fileKey, mimeType: d.mimeType })),
    extraFiles,
    ownerId: actorId,
  });
  if (nodeId) {
    await prisma.hrDocumentRequest.update({ where: { id }, data: { archivedNodeId: nodeId } });
    revalidatePath("/drive");
  }
}

/**
 * Le formulaire « Nouvelle demande RH » parle en périodes (`periodStart`/`periodEnd`) ; le
 * circuit de congé parle en dates de début/fin. Cette fonction traduit, valide, crée la
 * demande unique et y verse les justificatifs.
 */
async function createLeaveFromHrForm(
  actorId: string,
  employee: { id: string; fullName: string; userId: string | null },
  type: HrRequestType,
  formData: FormData,
): Promise<ActionResult> {
  const start = fdDate(formData, "periodStart");
  if (!start) return { ok: false, error: "Indiquez la date de début du congé / de l'absence." };
  // La sortie exceptionnelle tient sur une journée : sa date de fin, c'est sa date de début.
  const end = fdDate(formData, "periodEnd") ?? (type === "EXCEPTIONAL_EXIT" ? start : null);
  if (!end) return { ok: false, error: "Indiquez la date de fin du congé." };
  if (end < start) return { ok: false, error: "La date de fin précède la date de début." };

  const days = fdNum(formData, "periodDays") ?? leaveDaysBetween(start, end);
  const created = await createLeaveRequest(actorId, employee, {
    type: HR_TYPE_TO_LEAVE[type] ?? "OTHER",
    startDate: start, endDate: end, days,
    reason: fdStr(formData, "details"),
  });

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const err = await attachLeaveFiles(created.id, files, actorId);
    if (err) return { ok: false, error: err };
  }
  revalidateLeaveViews(employee.id);
  return { ok: true, id: created.id };
}

/** Demande d'attestation par l'employé (acte côté « Mon dossier RH »). */
export async function requestHrDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true, userId: true } });
  if (!employee) return { ok: false, error: "Aucun dossier RH n'est lié à votre compte. Contactez les RH." };

  const typeRaw = fdStr(formData, "type");
  const type = (typeRaw && REQUEST_TYPES.includes(typeRaw as HrRequestType) ? typeRaw : "WORK_CERTIFICATE") as HrRequestType;

  // UN CONGÉ N'EST PAS UN DOCUMENT À PRÉPARER : c'est une décision qui monte N+1 → RH → DG.
  // Quelle que soit la porte d'entrée (ce formulaire, « Mon espace », ou l'assistant IA), il
  // n'existe qu'UNE demande de congé. Sans ce renvoi, un congé déposé ici échappait à la file
  // de validation, aux « Absents aujourd'hui » et au solde.
  if (hrTypeIsLeave(type)) return createLeaveFromHrForm(user.id, employee, type, formData);

  // Note de frais : le mois concerné est obligatoire (« YYYY-MM »).
  const expenseMonth = fdStr(formData, "expenseMonth");
  if (type === "EXPENSE_REPORT" && (!expenseMonth || !YM.test(expenseMonth))) {
    return { ok: false, error: "Indiquez le mois concerné par la note de frais." };
  }

  // Congés / absences : période demandée. Début obligatoire ; fin obligatoire pour les congés
  // à jours entiers. Le nombre de jours est calculé si non fourni (calendaire inclusif).
  const needsPeriod = PERIOD_TYPES.includes(type);
  const periodStart = needsPeriod ? fdDate(formData, "periodStart") : null;
  const periodEnd = needsPeriod ? fdDate(formData, "periodEnd") : null;
  if (needsPeriod && !periodStart) return { ok: false, error: "Indiquez la date de début du congé / de l'absence." };
  if (LEAVE_PERIOD_TYPES.includes(type) && !periodEnd) return { ok: false, error: "Indiquez la date de fin du congé." };
  if (periodStart && periodEnd && periodEnd < periodStart) return { ok: false, error: "La date de fin précède la date de début." };
  let periodDays = needsPeriod ? fdNum(formData, "periodDays") : null;
  if (periodDays == null && periodStart && periodEnd) periodDays = daysInclusive(periodStart, periodEnd);

  const created = await prisma.hrDocumentRequest.create({
    data: {
      employeeId: employee.id, type, details: fdStr(formData, "details"),
      expenseMonth: type === "EXPENSE_REPORT" ? expenseMonth : null,
      periodStart, periodEnd,
      periodDays: periodDays != null ? periodDays : null,
    },
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

  // Congé ANNUEL approuvé (READY) : débit UNIQUE du solde de congés de l'employé.
  // (Les congés/absences passent normalement par decideHrLeave ; garde de compat.)
  if (status === "READY") {
    await applyAnnualLeaveBalance(req, user.id, req.employee.fullName);
  }

  if (req.employee.userId) {
    await notifyUser({
      userId: req.employee.userId,
      type: "GENERIC",
      title: "Votre demande RH a été mise à jour",
      body: `Statut : ${HR_REQUEST_STATUS[status]?.label ?? status}.`,
      link: "/mon-dossier",
    });
  }
  await archiveHrRequestIfDone(id, user.id);
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  revalidatePath("/rh");
  return { ok: true };
}

/**
 * Décision RH sur une NOTE DE FRAIS : valider pour le mois demandé, valider pour
 * le mois suivant, ou refuser. Un commentaire libre passe par le fil d'échange.
 */
export async function decideExpenseReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | APPROVE_NEXT | REJECT
  if (!id || !decision || !["APPROVE", "APPROVE_NEXT", "REJECT"].includes(decision)) return { ok: false, error: "Décision invalide." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req || req.type !== "EXPENSE_REPORT") return { ok: false, error: "Note de frais introuvable." };
  if (!req.expenseMonth || !YM.test(req.expenseMonth)) return { ok: false, error: "Cette note de frais n'a pas de mois renseigné." };
  // Verrou : pas de traitement tant que le bureau du secrétariat n'a pas accusé
  // réception des documents ORIGINAUX (l'accusé est visible dans la demande).
  if (!req.originalsAckAt) {
    return { ok: false, error: "Traitement impossible : le bureau du secrétariat n'a pas encore accusé réception des originaux." };
  }

  const approvedMonth = decision === "APPROVE" ? req.expenseMonth : decision === "APPROVE_NEXT" ? nextMonthYm(req.expenseMonth) : null;
  const note = fdStr(formData, "hrNote");
  await prisma.hrDocumentRequest.update({
    where: { id },
    data: {
      status: decision === "REJECT" ? "REJECTED" : "READY",
      approvedMonth,
      handledById: user.id,
      ...(note ? { hrNote: note } : {}),
    },
  });

  const body = decision === "REJECT"
    ? `Votre note de frais (${formatMonth(req.expenseMonth)}) a été refusée.`
    : `Votre note de frais (${formatMonth(req.expenseMonth)}) est validée pour ${formatMonth(approvedMonth)}${decision === "APPROVE_NEXT" ? " (mois suivant)" : ""}.`;
  if (req.employee.userId) {
    await notifyUser({ userId: req.employee.userId, type: "GENERIC", title: decision === "REJECT" ? "Note de frais refusée" : "Note de frais validée", body, link: "/mon-dossier" });
  }
  await recordAudit({
    actorId: user.id, action: decision === "REJECT" ? "REFUSE" : "VALIDATE", module: "RH",
    summary: `Note de frais ${req.employee.fullName} (${req.expenseMonth}) — ${decision === "REJECT" ? "refusée" : `validée pour ${approvedMonth}`}`,
  });
  await archiveHrRequestIfDone(id, user.id);
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  revalidatePath("/rh");
  return { ok: true };
}

/**
 * Décision RH sur une demande de NATURE APPROBATION (congé / absence / autorisation de
 * sortie) : Accorder ou Refuser — pas de document à préparer. Un congé annuel accordé
 * débite le solde de l'employé (verrou balanceAppliedAt). Une note RH facultative peut être jointe.
 */
export async function decideHrLeave(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | REJECT
  if (!id || !decision || !["APPROVE", "REJECT"].includes(decision)) return { ok: false, error: "Décision invalide." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (hrNature(req.type) !== "APPROVAL") return { ok: false, error: "Cette demande ne relève pas d'une décision d'accord." };

  const approved = decision === "APPROVE";
  const note = fdStr(formData, "hrNote");
  await prisma.hrDocumentRequest.update({
    where: { id },
    data: { status: approved ? "APPROVED" : "REJECTED", handledById: user.id, ...(note ? { hrNote: note } : {}) },
  });

  // Congé annuel accordé : débit du solde (idempotent). Autres congés/absences : pas de solde.
  const debited = approved ? await applyAnnualLeaveBalance(req, user.id, req.employee.fullName) : 0;

  const label = HR_REQUEST_TYPE[req.type] ?? req.type;
  const periodTxt = req.periodStart
    ? ` (du ${formatAlgiers(req.periodStart, { day: "2-digit", month: "long", year: "numeric" })}${req.periodEnd ? ` au ${formatAlgiers(req.periodEnd, { day: "2-digit", month: "long", year: "numeric" })}` : ""})`
    : "";
  if (req.employee.userId) {
    await notifyUser({
      userId: req.employee.userId, type: "GENERIC",
      title: approved ? "Demande accordée" : "Demande refusée",
      body: approved
        ? `Votre demande « ${label} »${periodTxt} a été accordée.${debited > 0 ? ` ${debited} j déduits de votre solde de congés.` : ""}`
        : `Votre demande « ${label} »${periodTxt} a été refusée.${note ? ` Motif : ${note}` : ""}`,
      link: "/mon-dossier",
    });
  }
  await recordAudit({
    actorId: user.id, action: approved ? "VALIDATE" : "REFUSE", module: "RH",
    summary: `${label} — ${req.employee.fullName} : ${approved ? "accordée" : "refusée"}`,
  });
  await archiveHrRequestIfDone(id, user.id);
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  revalidatePath("/rh");
  return { ok: true };
}

/**
 * Accusé de réception des ORIGINAUX d'une note de frais par le BUREAU DU
 * SECRÉTARIAT (droit « Modifier » sur le module Bureau du secrétariat, ou vue globale).
 */
export async function ackExpenseOriginals(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) {
    return { ok: false, error: "Réservé au bureau du secrétariat." };
  }
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req || req.type !== "EXPENSE_REPORT") return { ok: false, error: "Note de frais introuvable." };
  if (req.originalsAckAt) return { ok: false, error: "Originaux déjà réceptionnés." };

  await prisma.hrDocumentRequest.update({ where: { id }, data: { originalsAckAt: new Date(), originalsAckById: user.id } });
  if (req.employee.userId) {
    await notifyUser({
      userId: req.employee.userId, type: "GENERIC", title: "Originaux réceptionnés",
      body: `Le bureau du secrétariat a accusé réception des originaux de votre note de frais (${formatMonth(req.expenseMonth)}).`,
      link: "/mon-dossier",
    });
  }
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "GENERIC", title: "Originaux de note de frais réceptionnés",
    body: `${req.employee.fullName} — ${formatMonth(req.expenseMonth)} (accusé par ${user.name}).`,
    link: `/rh/${req.employeeId}`,
  });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Demandes administratives", summary: `Accusé de réception originaux note de frais — ${req.employee.fullName} (${req.expenseMonth ?? "?"})` });
  revalidatePath("/demandes");
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  return { ok: true };
}

/**
 * ENTREVUE RH : proposer (ou contre-proposer) une date. Les RH proposent en premier,
 * l'employé peut répondre par une autre date — chaque proposition remplace la précédente.
 */
export async function proposeHrMeeting(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const when = fdStr(formData, "meetingAt"); // datetime-local, heure d'Alger
  if (!id || !when) return { ok: false, error: "Indiquez la date et l'heure proposées." };
  const at = algiersInputToUtc(when);
  if (!at) return { ok: false, error: "Date invalide." };
  if (at < new Date()) return { ok: false, error: "La date proposée est déjà passée." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req || req.type !== "HR_INTERVIEW") return { ok: false, error: "Demande d'entrevue introuvable." };
  if (req.meetingConfirmedAt) return { ok: false, error: "L'entrevue est déjà confirmée." };
  const isOwner = req.employee.userId === user.id;
  const isHr = userCan(user, "RH", "UPDATE");
  if (!(isOwner || isHr)) return { ok: false, error: "Non autorisé." };

  await prisma.hrDocumentRequest.update({
    where: { id },
    data: { meetingAt: at, meetingProposedById: user.id, meetingConfirmedAt: null, status: "IN_PROGRESS", ...(isHr && !isOwner ? { handledById: user.id } : {}) },
  });
  const whenLabel = formatAlgiers(at, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  if (isOwner) {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "GENERIC", title: "Entrevue RH — date proposée par l'employé", body: `${req.employee.fullName} propose : ${whenLabel}.`, link: `/rh/${req.employeeId}` });
  } else if (req.employee.userId) {
    await notifyUser({ userId: req.employee.userId, type: "GENERIC", title: "Entrevue RH — date proposée", body: `Les RH vous proposent : ${whenLabel}. Acceptez ou proposez une autre date.`, link: "/mon-dossier" });
  }
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  revalidatePath("/rh");
  return { ok: true };
}

/** ENTREVUE RH : accepter la date proposée par l'autre partie → rendez-vous au calendrier. */
export async function confirmHrMeeting(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.hrDocumentRequest.findUnique({ where: { id }, include: { employee: { select: { userId: true, fullName: true } } } });
  if (!req || req.type !== "HR_INTERVIEW") return { ok: false, error: "Demande d'entrevue introuvable." };
  if (!req.meetingAt || !req.meetingProposedById) return { ok: false, error: "Aucune date proposée à accepter." };
  if (req.meetingConfirmedAt) return { ok: false, error: "L'entrevue est déjà confirmée." };
  if (req.meetingProposedById === user.id) return { ok: false, error: "L'autre partie doit accepter votre proposition." };
  const isOwner = req.employee.userId === user.id;
  const isHr = userCan(user, "RH", "UPDATE");
  if (!(isOwner || isHr)) return { ok: false, error: "Non autorisé." };

  await prisma.hrDocumentRequest.update({
    where: { id },
    data: { meetingConfirmedAt: new Date(), status: "READY", ...(isHr && !isOwner ? { handledById: user.id } : {}) },
  });

  // Rendez-vous au calendrier des deux parties (organisateur = côté RH).
  const employeeUserId = req.employee.userId;
  const rhUserId = req.meetingProposedById === employeeUserId ? user.id : req.meetingProposedById;
  if (rhUserId) {
    try {
      await createEventForUser(rhUserId, {
        title: `Entrevue RH — ${req.employee.fullName}`,
        kind: "MEETING",
        startAt: req.meetingAt,
        inviteeIds: employeeUserId && employeeUserId !== rhUserId ? [employeeUserId] : [],
      });
    } catch (err) {
      console.error("[hr-meeting] calendar event failed", err);
    }
  }

  const whenLabel = formatAlgiers(req.meetingAt, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  if (isOwner) {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "GENERIC", title: "Entrevue RH confirmée", body: `${req.employee.fullName} — ${whenLabel}.`, link: `/rh/${req.employeeId}` });
  } else if (employeeUserId) {
    await notifyUser({ userId: employeeUserId, type: "GENERIC", title: "Entrevue RH confirmée", body: `Votre entrevue est confirmée : ${whenLabel}. Elle apparaît dans votre calendrier.`, link: "/mon-dossier" });
  }
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "RH", summary: `Entrevue RH confirmée — ${req.employee.fullName} (${whenLabel})` });
  // Archive dans le Drive du côté RH (même si c'est l'employé qui a accepté).
  await archiveHrRequestIfDone(id, rhUserId ?? user.id);
  revalidatePath("/mon-dossier");
  revalidatePath(`/rh/${req.employeeId}`);
  revalidatePath("/rh");
  revalidatePath("/calendar");
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
