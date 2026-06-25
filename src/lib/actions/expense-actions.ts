"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

async function nextFinanceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.financeTransaction.count({ where: { reference: { startsWith: `FIN-${year}-` } } });
  return `FIN-${year}-${String(count + 1).padStart(3, "0")}`;
}

/** Comptable settles an ordre de dépense → generates the treasury OUT entry and marks the source paid. */
export async function settleExpenseOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status === "PAID") return { ok: true };
  if (order.status !== "PENDING") return { ok: false, error: "Cet ordre a été annulé." };

  const tx = await prisma.financeTransaction.create({
    data: {
      reference: await nextFinanceRef(), date: new Date(), direction: "OUT",
      category: order.category, label: order.label, amount: order.amount,
      method: "BANK_TRANSFER", account: "Banque", counterparty: order.beneficiary,
      status: "SETTLED", createdById: user.id,
    },
  });
  await prisma.expenseOrder.update({
    where: { id }, data: { status: "PAID", transactionId: tx.id, paidById: user.id, paidDate: new Date() },
  });

  // Mark the originating record as settled.
  if (order.sourceType === "SPONSORING" && order.sourceId) {
    await prisma.sponsoringRequest.update({ where: { id: order.sourceId }, data: { status: "PAID" } }).catch(() => undefined);
  } else if (order.sourceType === "SALARY_ADVANCE" && order.sourceId) {
    await prisma.salaryAdvance.update({
      where: { id: order.sourceId }, data: { status: "PAID", paidDate: new Date(), transactionId: tx.id },
    }).catch(() => undefined);
  }

  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById, type: "GENERIC", title: "Ordre de dépense réglé",
      body: `${order.reference} — ${order.label}`, link: "/finances/ordres-de-depense",
    });
  }
  await recordAudit({
    actorId: user.id, action: "VALIDATE", module: "Finances", entityType: "EXPENSE_ORDER",
    entityId: id, summary: `Ordre ${order.reference} réglé — ${order.label}`,
  });
  revalidatePath("/finances");
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/sponsoring");
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
  return { ok: true };
}

/** Cancel a pending ordre de dépense (e.g. created in error). */
export async function cancelExpenseOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status !== "PENDING") return { ok: false, error: "Seul un ordre à régler peut être annulé." };
  await prisma.expenseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER",
    entityId: id, field: "status", newValue: "CANCELLED", summary: `Ordre ${order.reference} annulé`,
  });
  revalidatePath("/finances/ordres-de-depense");
  return { ok: true };
}
