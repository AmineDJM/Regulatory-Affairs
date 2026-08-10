"use server";

import { revalidatePath } from "next/cache";
import type { ContractType, LeaveType, LeaveStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit, recordFieldChanges } from "@/lib/audit";
import { createExpenseOrder } from "@/lib/expense-orders";
import { askClaude, aiConfigured } from "@/lib/ai";
import { ocrDocument, canOcr } from "@/lib/regulatory/intelligence/ocr/ocr-engine";
import { notifyUser, notifyRoles } from "@/lib/notify";
import {
  createLeaveRequest, attachLeaveFiles, leaveDecider, revalidateLeaveViews,
} from "@/lib/hr/leave-core";
import {
  canDecideLeave, applyLeaveDecision, stageNotifyRoles, LEAVE_STAGE_LABELS, type LeaveStage,
} from "@/lib/leave-workflow";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

/** Inclusive calendar-day count between two dates (min 1). */
function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

function castContract(v: string | null): ContractType | null {
  return v ? (v as ContractType) : null;
}

// ─────────────────────────────── Employees ───────────────────────────────

export async function createEmployee(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "CREATE")) return { ok: false, error: "Non autorisé." };

  const fullName = fdStr(formData, "fullName");
  if (!fullName) return { ok: false, error: "Le nom complet est obligatoire." };

  const dept = await resolveDepartmentFields(formData);
  let created;
  try {
    created = await prisma.employee.create({
      data: {
        fullName,
        position: fdStr(formData, "position"),
        ...(dept ?? {}),
        email: fdStr(formData, "email"),
        phone: fdStr(formData, "phone"),
        iban: fdStr(formData, "iban"),
        baseSalary: fdNum(formData, "baseSalary") ?? 0,
        hireDate: fdDate(formData, "hireDate"),
        contractType: castContract(fdStr(formData, "contractType")),
        contractStart: fdDate(formData, "contractStart"),
        contractEnd: fdDate(formData, "contractEnd"),
        leaveBalanceDays: fdNum(formData, "leaveBalanceDays") ?? 30,
        birthDate: fdDate(formData, "birthDate"),
        nationalId: fdStr(formData, "nationalId"),
        cnasNumber: fdStr(formData, "cnasNumber"),
        address: fdStr(formData, "address"),
        userId: fdStr(formData, "userId"),
        managerId: fdStr(formData, "managerId"),
        companyId: fdStr(formData, "companyId") || null,
      },
    });
  } catch {
    return { ok: false, error: "Création impossible : ce compte applicatif est déjà lié à un employé." };
  }

  // Le compte applicatif lié hérite du département (permissions, périmètres, notifications).
  if (created.userId && created.departmentId) {
    await prisma.user.update({ where: { id: created.userId }, data: { departmentId: created.departmentId } }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines",
    entityType: "EMPLOYEE", entityId: created.id, summary: `Employé « ${fullName} »${created.department ? ` — ${created.department}` : ""}`,
  });
  revalidatePath("/rh");
  revalidatePath("/rh/departements");
  return { ok: true, id: created.id };
}

/**
 * Résout le rattachement au département à partir du formulaire :
 *   • `departmentId` (sélecteur structuré) → on lie et on met à jour le libellé cache ;
 *   • à défaut `department` (texte libre, ex. extrait d'un contrat par l'IA) → on tente de
 *     retrouver un département de même nom pour le lier, sinon on garde le texte seul.
 * Renvoie `undefined` si le formulaire ne parle pas de département (update partiel).
 */
async function resolveDepartmentFields(formData: FormData): Promise<{ departmentId: string | null; department: string | null } | undefined> {
  const hasId = formData.has("departmentId");
  const hasText = formData.has("department");
  if (!hasId && !hasText) return undefined;

  const departmentId = fdStr(formData, "departmentId");
  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    if (dept) return { departmentId, department: dept.name };
  }
  const label = fdStr(formData, "department");
  if (label) {
    const match = await prisma.department.findFirst({ where: { name: { equals: label, mode: "insensitive" } }, select: { id: true, name: true } });
    return match ? { departmentId: match.id, department: match.name } : { departmentId: null, department: label };
  }
  return { departmentId: null, department: null };
}

export async function updateEmployee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Employé introuvable." };

  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Employé introuvable." };

  const deptFields = await resolveDepartmentFields(formData);
  const data = {
    fullName: fdStr(formData, "fullName") ?? before.fullName,
    position: fdStr(formData, "position"),
    // Rattachement structuré + libellé cache (inchangés si le formulaire n'en parle pas).
    ...(deptFields ?? { department: before.department, departmentId: before.departmentId }),
    email: fdStr(formData, "email"),
    phone: fdStr(formData, "phone"),
    iban: fdStr(formData, "iban"),
    baseSalary: fdNum(formData, "baseSalary") ?? 0,
    // Éléments de salaire du bulletin (brut, Ret SS 35 % et TFP restent confidentiels côté salarié).
    retSS9: fdNum(formData, "retSS9"),
    retSS35: fdNum(formData, "retSS35"),
    tfp: fdNum(formData, "tfp"),
    retIrg: fdNum(formData, "retIrg"),
    expenseRefund: fdNum(formData, "expenseRefund"),
    netToPay: fdNum(formData, "netToPay"),
    grossSalary: fdNum(formData, "grossSalary"),
    hireDate: fdDate(formData, "hireDate"),
    contractType: castContract(fdStr(formData, "contractType")),
    contractStart: fdDate(formData, "contractStart"),
    contractEnd: fdDate(formData, "contractEnd"),
    trialStart: fdDate(formData, "trialStart"),
    trialEnd: fdDate(formData, "trialEnd"),
    trialRenewable: fdBool(formData, "trialRenewable"),
    trialRenewed: fdBool(formData, "trialRenewed"),
    trialRenewalStart: fdDate(formData, "trialRenewalStart"),
    trialRenewalEnd: fdDate(formData, "trialRenewalEnd"),
    leaveBalanceDays: fdNum(formData, "leaveBalanceDays") ?? 0,
    birthDate: fdDate(formData, "birthDate"),
    nationalId: fdStr(formData, "nationalId"),
    cnasNumber: fdStr(formData, "cnasNumber"),
    address: fdStr(formData, "address"),
    userId: fdStr(formData, "userId"),
    managerId: fdStr(formData, "managerId"),
    companyId: fdStr(formData, "companyId") || null, // entité de rattachement (modifiable)
    isActive: fdBool(formData, "isActive"),
  };

  let after;
  try {
    after = await prisma.employee.update({ where: { id }, data });
  } catch {
    return { ok: false, error: "Modification impossible : ce compte applicatif est déjà lié à un autre employé." };
  }
  // Le compte applicatif suit le rattachement de la fiche (permissions, périmètres, notifications).
  if (after.userId && after.departmentId !== before.departmentId) {
    await prisma.user.update({ where: { id: after.userId }, data: { departmentId: after.departmentId } }).catch(() => undefined);
  }
  await recordFieldChanges(
    { actorId: user.id, module: "Ressources humaines", entityType: "EMPLOYEE", entityId: id, summary: `Fiche de ${after.fullName}` },
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    ["fullName", "position", "department", "baseSalary", "contractType", "contractEnd", "leaveBalanceDays", "isActive", "userId", "managerId"],
  );
  revalidatePath("/rh");
  revalidatePath(`/rh/${id}`);
  revalidatePath("/rh/departements");
  return { ok: true, id };
}

/**
 * Analyse d'un CONTRAT DE TRAVAIL par IA (OCR Mistral → Claude) pour PRÉ-REMPLIR la fiche
 * employé. Renvoie les champs extraits (jamais persistés ici : les RH relisent, corrigent
 * et enregistrent). N'enregistre AUCUN document (les RH versent eux-mêmes les pièces).
 */
const CONTRACT_SYSTEM = `Tu extrais les informations d'un CONTRAT DE TRAVAIL algérien (ou d'un avenant) afin
de préremplir la fiche RH d'un employé, à partir du texte du document (issu d'un OCR).

Tu renvoies UNIQUEMENT un objet JSON valide (aucun texte autour). Clés (mets "" si l'information
n'est pas présente dans le document) :
- "fullName" : nom complet de l'employé.
- "position" : intitulé du poste.
- "department" : département / service.
- "contractType" : l'une exactement de CDI, CDD, INTERIM, STAGE, FREELANCE, OTHER.
- "baseSalary" : salaire de base mensuel en DZD, chiffres uniquement (ex. "45000"), sinon "".
- "hireDate", "contractStart", "contractEnd", "birthDate" : au format AAAA-MM-JJ, sinon "".
- "email", "phone", "iban", "nationalId" (NIN), "cnasNumber" (n° sécurité sociale), "address".

RÈGLES : n'invente RIEN. Si une information est absente ou incertaine, mets "". Ne déduis pas de
date ou de salaire qui ne figurent pas explicitement dans le texte.`;

const CONTRACT_TYPES_UP = ["CDI", "CDD", "INTERIM", "STAGE", "FREELANCE", "OTHER"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function analyzeEmployeeContract(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; values?: Record<string, string> }> {
  const user = await requireUser();
  if (!userCan(user, "RH", "CREATE")) return { ok: false, error: "Non autorisé." };
  if (!aiConfigured()) return { ok: false, error: "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez le contrat de travail (PDF ou image)." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!canOcr(ext)) return { ok: false, error: `Format .${ext} non pris en charge pour l'OCR (PDF ou image).` };

  let text = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ocr = await ocrDocument({ ext, buffer, langs: ["fra", "eng", "ara"], maxPages: 20 });
    text = ocr.pages.map((p) => p.text).join("\n").trim();
  } catch (err) {
    console.error("[hr] contract OCR failed", err);
    return { ok: false, error: "OCR du contrat impossible." };
  }
  if (text.length < 10) return { ok: false, error: "Le contrat ne contient pas de texte exploitable (OCR vide)." };

  const r = await askClaude(`Texte du contrat de travail :\n\n"""${text.slice(0, 20000)}"""\n\nRenvoie le JSON demandé.`, {
    system: CONTRACT_SYSTEM, maxTokens: 1500, temperature: 0.1,
  });
  if (!r.ok || !r.text) return { ok: false, error: r.error ?? "Analyse impossible." };
  const start = r.text.indexOf("{"); const end = r.text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "Réponse IA non exploitable." };
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(r.text.slice(start, end + 1)) as Record<string, unknown>; }
  catch { return { ok: false, error: "Réponse IA non exploitable." }; }

  const s = (k: string) => { const v = raw[k]; return v == null ? "" : String(v).trim(); };
  const values: Record<string, string> = {};
  for (const k of ["fullName", "position", "department", "email", "phone", "iban", "nationalId", "cnasNumber", "address"]) {
    const v = s(k); if (v) values[k] = v;
  }
  for (const k of ["hireDate", "contractStart", "contractEnd", "birthDate"]) {
    const v = s(k); if (ISO_DATE.test(v)) values[k] = v;
  }
  const ct = s("contractType").toUpperCase(); if (CONTRACT_TYPES_UP.includes(ct)) values.contractType = ct;
  const sal = s("baseSalary").replace(/[^\d.]/g, ""); if (sal && Number(sal) > 0) values.baseSalary = String(Math.round(Number(sal)));

  if (!Object.keys(values).length) return { ok: false, error: "Aucune information exploitable détectée dans le contrat." };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Ressources humaines", summary: `Analyse IA d'un contrat de travail — ${Object.keys(values).length} champ(s) préremplis` });
  return { ok: true, values };
}

export async function setEmployeeActive(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Employé introuvable." };
  const isActive = fdBool(formData, "isActive");
  await prisma.employee.update({ where: { id }, data: { isActive } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "EMPLOYEE",
    entityId: id, field: "isActive", newValue: String(isActive), summary: isActive ? "Employé réactivé" : "Employé désactivé",
  });
  revalidatePath("/rh");
  revalidatePath(`/rh/${id}`);
  return { ok: true };
}

// ─────────────────────────────── Leave ───────────────────────────────

/**
 * Submit a leave request. Self-service by default (resolves the employee linked
 * to the current account); RH users may file on behalf of an employee by passing
 * `employeeId`.
 */
export async function requestLeave(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const explicitId = fdStr(formData, "employeeId");
  const isRh = userCan(user, "RH", "CREATE");
  const employee = explicitId && isRh
    ? await prisma.employee.findUnique({ where: { id: explicitId } })
    : await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) {
    return { ok: false, error: "Aucune fiche employé n'est liée à votre compte. Contactez l'administrateur." };
  }

  const startDate = fdDate(formData, "startDate");
  const endDate = fdDate(formData, "endDate");
  if (!startDate || !endDate) return { ok: false, error: "Dates de début et de fin obligatoires." };
  if (endDate < startDate) return { ok: false, error: "La date de fin précède la date de début." };

  const days = fdNum(formData, "days") ?? daysBetween(startDate, endDate);

  const created = await createLeaveRequest(user.id, employee, {
    type: (fdStr(formData, "type") as LeaveType) ?? "ANNUAL",
    startDate, endDate, days,
    reason: fdStr(formData, "reason"),
  });

  // Justificatifs (certificat médical, formulaire signé…) : la demande les porte.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const err = await attachLeaveFiles(created.id, files, user.id);
    if (err) return { ok: false, error: err };
  }

  revalidateLeaveViews(employee.id);
  return { ok: true, id: created.id };
}

/**
 * DÉCISION SUR UN CONGÉ — une marche du circuit N+1 → RH → DG (cf. `leave-workflow.ts`).
 * Approuver fait monter d'un cran ; seule la dernière marche accorde réellement le congé
 * (et débite le solde). Refuser arrête tout.
 */
export async function decideLeave(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVED | REJECTED
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!leave) return { ok: false, error: "Demande introuvable." };

  const decider = await leaveDecider(user, leave);
  const allowed = canDecideLeave(
    { status: leave.status, stage: leave.stage, requesterUserId: leave.employee.userId },
    decider,
  );
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Non autorisé." };

  const note = fdStr(formData, "note");
  const next = applyLeaveDecision(leave.stage as LeaveStage, decision);
  const now = new Date();

  // Trace par marche : qui a signé quoi, quand. Sans cela, un congé accordé ne dit plus
  // par qui il est passé — et c'est exactement ce qu'on demande six mois plus tard.
  const stampByStage: Record<string, Record<string, unknown>> = {
    MANAGER: { managerDecidedById: user.id, managerDecidedAt: now, managerNote: note },
    HR: { hrDecidedById: user.id, hrDecidedAt: now, hrNote: note },
    DG: { dgDecidedById: user.id, dgDecidedAt: now, dgNote: note },
  };

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: next.status,
      stage: next.stage,
      ...(stampByStage[leave.stage] ?? {}),
      // `decidedBy/At/Note` = la DERNIÈRE main posée sur la demande (compat historique + listes).
      decidedById: user.id, decidedAt: now, decisionNote: note,
    },
  });

  // Le solde ne bouge qu'au bout du circuit — et une seule fois (une seule transition
  // porte `granted`).
  if (next.granted && leave.type === "ANNUAL") {
    await prisma.employee.update({
      where: { id: leave.employeeId },
      data: { leaveBalanceDays: { decrement: Number(leave.days) } },
    });
  }

  const period = `${leave.startDate.toLocaleDateString("fr-FR")} → ${leave.endDate.toLocaleDateString("fr-FR")}`;
  if (next.status === "PENDING") {
    // Marche franchie : on prévient la suivante, et le demandeur suit l'avancement.
    const roles = stageNotifyRoles(next.stage) as UserRole[];
    if (roles.length) {
      await notifyRoles(roles, {
        type: "GENERIC", title: "Congé à valider",
        body: `${leave.employee.fullName} — ${period} (${Number(leave.days)} j). ${LEAVE_STAGE_LABELS[next.stage]}.`,
        link: "/rh",
      });
    }
    if (leave.employee.userId) {
      await notifyUser({
        userId: leave.employee.userId, type: "GENERIC", title: "Congé : une étape de plus",
        body: `Votre demande ${period} avance — ${LEAVE_STAGE_LABELS[next.stage]}.`, link: "/mon-espace",
      });
    }
  } else if (leave.employee.userId) {
    await notifyUser({
      userId: leave.employee.userId, type: "GENERIC",
      title: next.status === "APPROVED" ? "Congé approuvé" : "Congé refusé",
      body: `Votre demande ${period} a été ${next.status === "APPROVED" ? "approuvée" : "refusée"}.${note ? ` ${note}` : ""}`,
      link: "/mon-espace",
    });
  }

  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE", module: "Ressources humaines",
    entityType: "LEAVE_REQUEST", entityId: id,
    summary: decision === "REJECTED"
      ? `Congé refusé (${LEAVE_STAGE_LABELS[leave.stage as LeaveStage]}) — ${leave.employee.fullName}`
      : next.granted
        ? `Congé accordé — ${leave.employee.fullName}`
        : `Congé validé (${LEAVE_STAGE_LABELS[leave.stage as LeaveStage]}) → ${LEAVE_STAGE_LABELS[next.stage]} — ${leave.employee.fullName}`,
  });
  revalidateLeaveViews(leave.employeeId);
  return { ok: true };
}

/** Cancel a still-pending leave request (by its author or an RH manager). */
export async function cancelLeave(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!leave) return { ok: false, error: "Demande introuvable." };

  const isOwner = leave.employee.userId === user.id;
  const isRh = userCan(user, "RH", "UPDATE");
  if (!isOwner && !isRh) return { ok: false, error: "Non autorisé." };
  if (leave.status === "CANCELLED") return { ok: false, error: "Cette demande est déjà annulée." };
  // Le salarié ne retire que ce qui n'a pas encore été tranché. Les RH, eux, annulent AUSSI un
  // congé déjà décidé : un départ qui ne se fait finalement pas doit pouvoir être défait, sinon
  // le solde reste faux et l'historique ment.
  if (!isRh && leave.status !== "PENDING") {
    return { ok: false, error: "Cette demande a déjà été tranchée : demandez aux ressources humaines de l'annuler." };
  }

  // Annuler un congé annuel APPROUVÉ recrédite les jours : sans cela le salarié paierait un
  // congé qu'il n'a pas pris.
  const refund = leave.status === "APPROVED" && leave.type === "ANNUAL" ? Number(leave.days) : 0;

  await prisma.leaveRequest.update({
    where: { id },
    // Le circuit s'arrête là : une demande retirée ne doit plus apparaître dans la file
    // d'aucune des trois marches.
    data: { status: "CANCELLED", stage: "DONE", decidedById: user.id, decidedAt: new Date() },
  });
  if (refund > 0) {
    await prisma.employee.update({ where: { id: leave.employeeId }, data: { leaveBalanceDays: { increment: refund } } });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "LEAVE_REQUEST",
    entityId: id, field: "status", newValue: "CANCELLED",
    summary: `Demande de congé annulée${refund > 0 ? ` — ${refund} j recrédité(s) à ${leave.employee.fullName}` : ""}`,
  });
  revalidateLeaveViews(leave.employeeId);
  return { ok: true };
}

const LEAVE_STATUSES: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

/**
 * MODIFICATION par les RH (DRH) d'une demande de congé — Y COMPRIS déjà décidée (historique) :
 * type, dates, jours, motif, STATUT (décision) et note. Le solde de congé annuel est réajusté
 * proprement : on annule le débit précédent (si la demande était approuvée en annuel) et on
 * applique le nouveau (si elle reste/est approuvée en annuel). Réservé au RH (droit UPDATE).
 */
export async function updateLeaveRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Réservé aux ressources humaines." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!leave) return { ok: false, error: "Demande introuvable." };

  const startDate = fdDate(formData, "startDate") ?? leave.startDate;
  const endDate = fdDate(formData, "endDate") ?? leave.endDate;
  if (endDate < startDate) return { ok: false, error: "La date de fin précède la date de début." };
  const type = (fdStr(formData, "type") as LeaveType | null) ?? leave.type;
  const days = fdNum(formData, "days") ?? Number(leave.days);
  if (!(days >= 0)) return { ok: false, error: "Nombre de jours invalide." };
  const reason = formData.has("reason") ? fdStr(formData, "reason") : leave.reason;
  const statusRaw = fdStr(formData, "status");
  const status: LeaveStatus = statusRaw && (LEAVE_STATUSES as string[]).includes(statusRaw) ? (statusRaw as LeaveStatus) : leave.status;
  const decisionNote = formData.has("decisionNote") ? fdStr(formData, "decisionNote") : leave.decisionNote;

  // Réajustement du solde annuel : différence entre l'ancien débit et le nouveau.
  const oldDebit = leave.status === "APPROVED" && leave.type === "ANNUAL" ? Number(leave.days) : 0;
  const newDebit = status === "APPROVED" && type === "ANNUAL" ? days : 0;
  const balanceDelta = oldDebit - newDebit; // > 0 = on recrédite ; < 0 = on débite davantage

  const statusChanged = status !== leave.status;
  await prisma.leaveRequest.update({
    where: { id },
    data: {
      type, startDate, endDate, days, reason, status, decisionNote,
      // Décision retracée si elle change : décideur/date (ou remise à zéro si repassée « en attente »).
      // Le RH qui rouvre une demande la remet à SA marche : ce qu'il vient de trancher, il n'a
      // pas à le refaire trancher par le N+1.
      ...(statusChanged
        ? {
            decidedById: status === "PENDING" ? null : user.id,
            decidedAt: status === "PENDING" ? null : new Date(),
            stage: status === "PENDING" ? ("HR" as const) : ("DONE" as const),
          }
        : {}),
    },
  });
  if (balanceDelta !== 0) {
    await prisma.employee.update({ where: { id: leave.employeeId }, data: { leaveBalanceDays: { increment: balanceDelta } } });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "LEAVE_REQUEST", entityId: id,
    summary: `Congé modifié par RH — ${leave.employee.fullName} (${days} j, ${status})`,
  });
  revalidateLeaveViews(leave.employeeId);
  return { ok: true };
}

// ─────────────────────────── Avance sur salaire ───────────────────────────

/** Request a salary advance (self-service, or RH on behalf of an employee). */
export async function requestAdvance(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const explicitId = fdStr(formData, "employeeId");
  const isRh = userCan(user, "RH", "CREATE");
  const employee = explicitId && isRh
    ? await prisma.employee.findUnique({ where: { id: explicitId } })
    : await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) {
    return { ok: false, error: "Aucune fiche employé n'est liée à votre compte. Contactez l'administrateur." };
  }

  const amount = fdNum(formData, "amount");
  if (!amount || amount <= 0) return { ok: false, error: "Montant invalide." };

  const created = await prisma.salaryAdvance.create({
    data: { employeeId: employee.id, amount, reason: fdStr(formData, "reason"), createdById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines",
    entityType: "SALARY_ADVANCE", entityId: created.id,
    summary: `Demande d'avance — ${employee.fullName}`,
  });
  revalidatePath("/mon-espace");
  revalidatePath("/rh");
  return { ok: true, id: created.id };
}

/** Approve or reject a pending salary advance (RH). */
export async function decideAdvance(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "VALIDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVED | REJECTED
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const adv = await prisma.salaryAdvance.findUnique({ where: { id }, include: { employee: true } });
  if (!adv) return { ok: false, error: "Demande introuvable." };
  if (adv.status !== "PENDING") return { ok: false, error: "Cette demande a déjà été traitée." };

  await prisma.salaryAdvance.update({
    where: { id },
    data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: fdStr(formData, "note") },
  });
  if (adv.employee.userId) {
    await prisma.notification.create({
      data: {
        userId: adv.employee.userId, type: "GENERIC",
        title: decision === "APPROVED" ? "Avance approuvée" : "Avance refusée",
        body: `Votre demande d'avance sur salaire a été ${decision === "APPROVED" ? "approuvée" : "refusée"}.`,
        link: "/mon-espace",
      },
    }).catch(() => undefined);
  }

  // Approval → emit an ordre de dépense for the comptable (who settles it).
  if (decision === "APPROVED") {
    await createExpenseOrder({
      label: `Avance sur salaire — ${adv.employee.fullName}`,
      amount: Number(adv.amount),
      category: "AVANCE",
      beneficiary: adv.employee.fullName,
      sourceType: "SALARY_ADVANCE",
      sourceId: id,
      requestedById: user.id,
    });
  }

  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE", module: "Ressources humaines",
    entityType: "SALARY_ADVANCE", entityId: id,
    summary: `Avance ${decision === "APPROVED" ? "approuvée" : "refusée"} — ${adv.employee.fullName}`,
  });
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
  return { ok: true };
}

/** Cancel a still-pending advance (by its author or an RH manager). */
export async function cancelAdvance(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const adv = await prisma.salaryAdvance.findUnique({ where: { id }, include: { employee: true } });
  if (!adv) return { ok: false, error: "Demande introuvable." };
  const isOwner = adv.employee.userId === user.id;
  const isRh = userCan(user, "RH", "UPDATE");
  if (!isOwner && !isRh) return { ok: false, error: "Non autorisé." };
  if (adv.status !== "PENDING") return { ok: false, error: "Seule une demande en attente peut être annulée." };

  await prisma.salaryAdvance.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "SALARY_ADVANCE",
    entityId: id, field: "status", newValue: "CANCELLED", summary: "Avance annulée",
  });
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
  return { ok: true };
}
