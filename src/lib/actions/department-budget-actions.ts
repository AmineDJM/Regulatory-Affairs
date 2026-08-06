"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  canSetDepartmentBudget, normalizeAmount, normalizeYear, DEPT_BUDGET_LABEL,
  type DeptBudgetKind, type BudgetSetter,
} from "@/lib/department-budget";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const PATH = "/budgets/departements";

/** Le porteur de droits, tel que le module pur l'attend. */
function setterOf(user: { role: string; secondaryRole?: string | null; id: string }): BudgetSetter {
  const u = user as Parameters<typeof userCan>[0];
  return {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(u, "BUDGETS", "UPDATE") || userCan(u, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(u, "RH", "UPDATE"),
  };
}

/**
 * Règle le budget d'un département pour une année et une nature.
 *
 * Le droit est vérifié PAR NATURE : c'est tout l'objet du dispositif. L'administrateur qui
 * tenterait de fixer la masse salariale se voit refuser, et réciproquement — même si les deux
 * cases sont dans le même tableau.
 */
export async function setDepartmentBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const departmentId = fdStr(formData, "departmentId");
  const rawKind = fdStr(formData, "kind");
  if (!departmentId || (rawKind !== "OPERATING" && rawKind !== "HR")) return { ok: false, error: "Paramètres manquants." };
  const kind: DeptBudgetKind = rawKind;

  if (!canSetDepartmentBudget(setterOf(user), kind)) {
    return {
      ok: false,
      error: kind === "HR"
        ? "Le budget des employés est réglé par les ressources humaines."
        : "Le budget de fonctionnement est réglé par l'administrateur.",
    };
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  const year = normalizeYear(fdStr(formData, "year"));
  const notes = fdStr(formData, "notes");

  const before = await prisma.departmentBudget.findUnique({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    select: { amount: true },
  });

  await prisma.departmentBudget.upsert({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    create: { departmentId, year, kind, amount, notes, setById: user.id },
    update: { amount, notes, setById: user.id },
  });

  const previous = before ? Number(before.amount) : null;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Budget ${DEPT_BUDGET_LABEL[kind]} ${year} — ${department.name} : ${previous ?? "—"} → ${amount} DZD`,
  });

  revalidatePath(PATH);
  revalidatePath("/budgets");
  return { ok: true, id: departmentId };
}
