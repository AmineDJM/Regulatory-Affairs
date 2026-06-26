"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

// ─────────────────────────── Enveloppe ───────────────────────────

export async function createEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'enveloppe est obligatoire." };
  const now = new Date();
  const periodStart = fdDate(formData, "periodStart") ?? new Date(now.getFullYear(), 0, 1);
  const periodEnd = fdDate(formData, "periodEnd") ?? new Date(now.getFullYear(), 11, 31);

  const created = await prisma.budgetEnvelope.create({
    data: {
      name,
      periodStart,
      periodEnd,
      totalAmount: fdNum(formData, "totalAmount") ?? 0,
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Budgets", summary: `Enveloppe budgétaire « ${name} »` });
  revalidatePath("/budgets");
  return { ok: true, id: created.id };
}

export async function updateEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  await prisma.budgetEnvelope.update({
    where: { id },
    data: {
      name,
      periodStart: fdDate(formData, "periodStart") ?? undefined,
      periodEnd: fdDate(formData, "periodEnd") ?? undefined,
      totalAmount: fdNum(formData, "totalAmount") ?? 0,
      notes: fdStr(formData, "notes"),
      isActive: fdBool(formData, "isActive"),
    },
  });
  revalidatePath("/budgets");
  return { ok: true };
}

export async function deleteEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.budgetEnvelope.delete({ where: { id } });
  revalidatePath("/budgets");
  return { ok: true };
}

// ─────────────────────────── Catégories ───────────────────────────

export async function createBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const envelopeId = fdStr(formData, "envelopeId");
  const name = fdStr(formData, "name");
  if (!envelopeId || !name) return { ok: false, error: "Nom de catégorie manquant." };
  const created = await prisma.budgetCategoryLine.create({
    data: { envelopeId, name, allocated: fdNum(formData, "allocated") ?? 0, color: fdStr(formData, "color"), notes: fdStr(formData, "notes") },
    select: { id: true },
  });
  revalidatePath("/budgets");
  return { ok: true, id: created.id };
}

export async function updateBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  await prisma.budgetCategoryLine.update({
    where: { id },
    data: { name, allocated: fdNum(formData, "allocated") ?? 0, color: fdStr(formData, "color"), notes: fdStr(formData, "notes") },
  });
  revalidatePath("/budgets");
  return { ok: true };
}

export async function deleteBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  // Les dépenses attribuées repassent en « non attribué » (FK SetNull).
  await prisma.budgetCategoryLine.delete({ where: { id } });
  revalidatePath("/budgets");
  return { ok: true };
}

/** Attribue (ou retire) une dépense à une catégorie budgétaire. */
export async function attributeTransaction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BUDGETS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const transactionId = fdStr(formData, "transactionId");
  if (!transactionId) return { ok: false, error: "Transaction manquante." };
  const budgetCategoryId = fdStr(formData, "budgetCategoryId"); // null = retirer
  await prisma.financeTransaction.update({ where: { id: transactionId }, data: { budgetCategoryId } });
  revalidatePath("/budgets");
  return { ok: true };
}
