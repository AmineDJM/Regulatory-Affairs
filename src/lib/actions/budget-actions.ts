"use server";

import { revalidatePath } from "next/cache";
import type { BudgetCategory } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

function computeStatus(consumed: number, initial: number) {
  if (initial > 0 && consumed > initial) return "OVER_BUDGET" as const;
  if (initial > 0 && consumed / initial > 0.8) return "AT_RISK" as const;
  return "ON_TRACK" as const;
}

export async function createBudget(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "CREATE")) return { ok: false, error: "Non autorisé." };

  const label = fdStr(formData, "label");
  if (!label) return { ok: false, error: "La ligne budgétaire est obligatoire." };

  const initial = fdNum(formData, "initialBudget") ?? 0;
  const consumed = fdNum(formData, "consumedBudget") ?? 0;
  const status = computeStatus(consumed, initial);

  const created = await prisma.budgetLine.create({
    data: {
      year: fdNum(formData, "year") ?? new Date().getFullYear(),
      month: fdNum(formData, "month"),
      department: (fdStr(formData, "department") as BudgetCategory) ?? "MARKETING",
      label,
      initialBudget: initial,
      consumedBudget: consumed,
      futureCommitted: fdNum(formData, "futureCommitted") ?? 0,
      status,
      comments: fdStr(formData, "comments"),
      ownerId: user.id,
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets",
    entityType: "BUDGET", entityId: created.id, summary: `Ligne budgétaire « ${label} »`,
  });

  if (status === "OVER_BUDGET") {
    await notifyRoles(["DIRECTION", "FINANCE_BUDGET_MANAGER"], {
      type: "BUDGET_EXCEEDED", title: "Budget dépassé", body: label, link: "/budgets",
    });
  }

  revalidatePath("/budgets");
  return { ok: true, id: created.id };
}
