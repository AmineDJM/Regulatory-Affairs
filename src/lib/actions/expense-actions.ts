"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { pickAutoCategory } from "@/lib/budget/auto-category";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

async function nextFinanceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.financeTransaction.findMany({ where: { reference: { startsWith: `FIN-${year}-` } }, select: { reference: true } });
  return buildRef("FIN", year, refs.map((r) => r.reference));
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

  // Facture obligatoire pour les dépenses événementielles : joindre la facture
  // (à l'ordre ou au dossier source) avant de régler, sinon la demander.
  if (order.requiresInvoice) {
    const invoice = await prisma.document.count({
      where: {
        category: "INVOICE",
        OR: [
          { entityType: "EXPENSE_ORDER", entityId: order.id },
          ...(order.sourceType && order.sourceId ? [{ entityType: order.sourceType, entityId: order.sourceId }] : []),
        ],
      },
    });
    if (invoice === 0) return { ok: false, error: "Facture obligatoire : joignez la facture à l'ordre (ou au dossier source) avant de régler, ou demandez-la au demandeur." };
  }

  // Attribution budgétaire : on privilégie la (sous-)catégorie explicitement choisie
  // par la Direction à la validation définitive (`order.budgetCategoryId`). À défaut,
  // attribution automatique à la catégorie de 1er niveau rattachée au module source :
  // la dépense « tombe » dans la catégorie du module d'où vient la demande.
  let budgetCategoryId: string | null = order.budgetCategoryId ?? null;
  if (budgetCategoryId) {
    // Sécurité : on ignore une (sous-)catégorie qui n'existe plus.
    const exists = await prisma.budgetCategoryLine.count({ where: { id: budgetCategoryId } });
    if (exists === 0) budgetCategoryId = null;
  }
  if (!budgetCategoryId && order.sourceType) {
    const sourceModule = ENTITY_MODULE[order.sourceType];
    if (sourceModule) {
      // Deux chances, dans l'ordre : une catégorie qui déclare le module, puis — c'est la
      // nouveauté qui branche les bordereaux de versement — la première catégorie d'une
      // ENVELOPPE qui couvre ce module. Créer l'enveloppe « Regulatory » et cocher le module
      // suffit désormais : les BV payés s'y imputent sans réglage supplémentaire.
      const [envelopes, categories] = await Promise.all([
        prisma.budgetEnvelope.findMany({
          where: { isActive: true },
          select: { id: true, isActive: true, modules: true, module: true, periodStart: true },
        }),
        prisma.budgetCategoryLine.findMany({
          where: { parentId: null, envelope: { isActive: true } },
          select: { id: true, envelopeId: true, module: true, parentId: true, createdAt: true },
        }),
      ]);
      budgetCategoryId = pickAutoCategory(sourceModule, envelopes, categories);
    }
  }

  const tx = await prisma.financeTransaction.create({
    data: {
      reference: await nextFinanceRef(), date: new Date(), direction: "OUT",
      category: order.category, label: order.label, amount: order.amount,
      method: "BANK_TRANSFER", account: "Banque", counterparty: order.beneficiary,
      status: "SETTLED", budgetCategoryId, createdById: user.id,
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
  } else if (order.sourceType === "ADMIN_REQUEST" && order.sourceId) {
    await prisma.administrativeRequest.update({
      where: { id: order.sourceId }, data: { status: "IN_PROGRESS" },
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

/** Le comptable demande la facture au demandeur (dépense événementielle sans facture). */
export async function requestInvoice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE") && !hasGlobalView(user.role)) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };

  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById, type: "ASSIGNMENT", title: "Facture demandée",
      body: `${order.reference} — ${order.label} : merci de joindre la facture pour règlement.`,
      link: "/finances/ordres-de-depense",
    });
  } else {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "ASSIGNMENT", title: "Facture demandée", body: `${order.reference} — ${order.label}`, link: "/finances/ordres-de-depense" });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id, summary: `Facture demandée — ${order.reference}` });
  revalidatePath("/finances/ordres-de-depense");
  return { ok: true };
}

/**
 * Le comptable demande à la Direction de revoir le budget (manque de fonds) :
 * l'ordre passe en « Révision budget demandée » et remonte à la Direction.
 */
export async function requestBudgetRevision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  const reason = fdStr(formData, "reason");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  if (!reason) return { ok: false, error: "Indiquez le motif (ex. manque de budget)." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status !== "PENDING") return { ok: false, error: "Seul un ordre à régler peut faire l'objet d'une demande de révision." };

  await prisma.expenseOrder.update({
    where: { id },
    data: { status: "REVISION_REQUESTED", revisionReason: reason, proposedAmount: fdNum(formData, "proposedAmount"), revisionById: user.id },
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED", title: "Ordre de dépense — révision de budget demandée",
    body: `${order.reference} — ${order.label}`, link: "/finances/ordres-de-depense",
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id, field: "status", newValue: "REVISION_REQUESTED", summary: `Ordre ${order.reference} — révision budget demandée` });
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * La Direction tranche la demande de révision : soit elle AJUSTE le montant (l'ordre
 * repart à régler au nouveau montant), soit elle REFUSE (l'ordre repart à régler tel quel).
 */
export async function resolveBudgetRevision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "FINANCES", "VALIDATE") || userCan(user, "BUDGETS", "VALIDATE"))) {
    return { ok: false, error: "Réservé à la Direction." };
  }
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // ADJUST | REJECT
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status !== "REVISION_REQUESTED") return { ok: false, error: "Cet ordre n'attend pas de révision." };

  let newAmount = order.amount;
  if (decision === "ADJUST") {
    const amt = fdNum(formData, "amount");
    if (amt === null || amt <= 0) return { ok: false, error: "Indiquez le nouveau montant accordé." };
    newAmount = amt as never;
  }
  await prisma.expenseOrder.update({
    where: { id },
    data: { status: "PENDING", amount: newAmount, notes: fdStr(formData, "comment") ?? order.notes, revisionReason: null, proposedAmount: null, revisionById: null },
  });
  if (order.revisionById) {
    await notifyUser({ userId: order.revisionById, type: "GENERIC", title: decision === "ADJUST" ? "Budget ajusté par la Direction" : "Révision refusée — montant maintenu", body: `${order.reference} — ${order.label}`, link: "/finances/ordres-de-depense" });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id, field: "amount", newValue: String(newAmount), summary: `Ordre ${order.reference} — révision ${decision === "ADJUST" ? "ajustée" : "refusée"}` });
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/validations");
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
