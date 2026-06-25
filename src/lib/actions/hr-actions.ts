"use server";

import { revalidatePath } from "next/cache";
import type { ContractType, LeaveType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit, recordFieldChanges } from "@/lib/audit";
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

  let created;
  try {
    created = await prisma.employee.create({
      data: {
        fullName,
        position: fdStr(formData, "position"),
        department: fdStr(formData, "department"),
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
      },
    });
  } catch {
    return { ok: false, error: "Création impossible : ce compte applicatif est déjà lié à un employé." };
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines",
    entityType: "EMPLOYEE", entityId: created.id, summary: `Employé « ${fullName} »`,
  });
  revalidatePath("/rh");
  return { ok: true, id: created.id };
}

export async function updateEmployee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Employé introuvable." };

  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Employé introuvable." };

  const data = {
    fullName: fdStr(formData, "fullName") ?? before.fullName,
    position: fdStr(formData, "position"),
    department: fdStr(formData, "department"),
    email: fdStr(formData, "email"),
    phone: fdStr(formData, "phone"),
    iban: fdStr(formData, "iban"),
    baseSalary: fdNum(formData, "baseSalary") ?? 0,
    hireDate: fdDate(formData, "hireDate"),
    contractType: castContract(fdStr(formData, "contractType")),
    contractStart: fdDate(formData, "contractStart"),
    contractEnd: fdDate(formData, "contractEnd"),
    leaveBalanceDays: fdNum(formData, "leaveBalanceDays") ?? 0,
    birthDate: fdDate(formData, "birthDate"),
    nationalId: fdStr(formData, "nationalId"),
    cnasNumber: fdStr(formData, "cnasNumber"),
    address: fdStr(formData, "address"),
    userId: fdStr(formData, "userId"),
    managerId: fdStr(formData, "managerId"),
    isActive: fdBool(formData, "isActive"),
  };

  let after;
  try {
    after = await prisma.employee.update({ where: { id }, data });
  } catch {
    return { ok: false, error: "Modification impossible : ce compte applicatif est déjà lié à un autre employé." };
  }
  await recordFieldChanges(
    { actorId: user.id, module: "Ressources humaines", entityType: "EMPLOYEE", entityId: id, summary: `Fiche de ${after.fullName}` },
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    ["fullName", "position", "department", "baseSalary", "contractType", "contractEnd", "leaveBalanceDays", "isActive", "userId", "managerId"],
  );
  revalidatePath("/rh");
  revalidatePath(`/rh/${id}`);
  return { ok: true, id };
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

  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      type: (fdStr(formData, "type") as LeaveType) ?? "ANNUAL",
      startDate, endDate, days,
      reason: fdStr(formData, "reason"),
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines",
    entityType: "LEAVE_REQUEST", entityId: created.id,
    summary: `Demande de congé — ${employee.fullName} (${days} j)`,
  });
  revalidatePath("/mon-espace");
  revalidatePath("/rh");
  return { ok: true, id: created.id };
}

/** Approve or reject a pending leave request. Approving annual leave debits the balance. */
export async function decideLeave(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "VALIDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVED | REJECTED
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!leave) return { ok: false, error: "Demande introuvable." };
  if (leave.status !== "PENDING") return { ok: false, error: "Cette demande a déjà été traitée." };

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: fdStr(formData, "note") },
  });

  // Annual leave reduces the remaining balance when granted.
  if (decision === "APPROVED" && leave.type === "ANNUAL") {
    await prisma.employee.update({
      where: { id: leave.employeeId },
      data: { leaveBalanceDays: { decrement: Number(leave.days) } },
    });
  }

  // Notify the requester, if they have an account.
  if (leave.employee.userId) {
    await prisma.notification.create({
      data: {
        userId: leave.employee.userId,
        type: "GENERIC",
        title: decision === "APPROVED" ? "Congé approuvé" : "Congé refusé",
        body: `Votre demande du ${leave.startDate.toLocaleDateString("fr-FR")} a été ${decision === "APPROVED" ? "approuvée" : "refusée"}.`,
        link: "/mon-espace",
      },
    }).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE", module: "Ressources humaines",
    entityType: "LEAVE_REQUEST", entityId: id,
    summary: `Congé ${decision === "APPROVED" ? "approuvé" : "refusé"} — ${leave.employee.fullName}`,
  });
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
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
  if (leave.status !== "PENDING") return { ok: false, error: "Seule une demande en attente peut être annulée." };

  await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "LEAVE_REQUEST",
    entityId: id, field: "status", newValue: "CANCELLED", summary: "Demande de congé annulée",
  });
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
  return { ok: true };
}
