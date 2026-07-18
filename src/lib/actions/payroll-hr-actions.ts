"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob } from "@/lib/drive-storage";
import { validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { buildRef } from "@/lib/refs";
import { formatMonth } from "@/lib/utils";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const PATH = "/rh/paie";
/** Marge avant de notifier l'employé (en cas d'erreur de saisie, les RH peuvent annuler). */
const NOTIFY_DELAY_MS = 24 * 3600 * 1000;

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

function canRunPayroll(user: Parameters<typeof userCan>[0]): boolean {
  return userCan(user, "RH", "UPDATE");
}

/**
 * Marque le salaire d'un employé « Payé » pour un mois : montant total versé +
 * fiche de paie (déposée dans le dossier RH de l'employé, période YYYY-MM).
 * L'employé est notifié 24 h PLUS TARD (marge d'erreur), via les tâches planifiées.
 */
export async function markSalaryPaid(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canRunPayroll(user)) return { ok: false, error: "Réservé aux RH." };
  const employeeId = fdStr(formData, "employeeId");
  const year = fdNum(formData, "year");
  const month = fdNum(formData, "month");
  const amount = fdNum(formData, "amount");
  if (!employeeId || !year || !month || month < 1 || month > 12) return { ok: false, error: "Paramètres invalides." };
  if (amount === null || amount <= 0) return { ok: false, error: "Indiquez le montant total du versement." };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true } });
  if (!employee) return { ok: false, error: "Employé introuvable." };

  const existing = await prisma.payrollEntry.findUnique({ where: { employeeId_year_month: { employeeId, year, month } } });
  if (existing?.status === "PAID") return { ok: false, error: "Ce mois est déjà marqué payé pour cet employé." };

  // Fiche de paie (FACULTATIVE) → si fournie, déposée dans le dossier RH de l'employé
  // (visible par lui). Sinon le mois est marqué payé sans pièce jointe.
  const file = formData.get("payslip");
  let payslipDocumentId: string | null = null;
  if (file instanceof File && file.size > 0) {
    const invalid = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
    if (invalid) return { ok: false, error: invalid };
    const { blobId } = await putBlob(Buffer.from(await file.arrayBuffer()));
    const payslip = await prisma.employeeDocument.create({
      data: {
        employeeId, category: "PAYSLIP", name: file.name, blobId,
        mime: file.type || "application/pdf", size: file.size,
        period: ym(year, month), visibleToEmployee: true, uploadedById: user.id,
      },
      select: { id: true },
    });
    payslipDocumentId = payslip.id;
  }

  const now = new Date();
  const data = {
    net: amount, status: "PAID" as const, paidDate: now,
    payslipDocumentId,
    employeeNotifyAt: new Date(now.getTime() + NOTIFY_DELAY_MS),
    employeeNotifiedAt: null,
    createdById: existing ? undefined : user.id,
  };
  if (existing) await prisma.payrollEntry.update({ where: { id: existing.id }, data });
  else await prisma.payrollEntry.create({ data: { employeeId, year, month, gross: amount, ...data, createdById: user.id } });

  await recordAudit({
    actorId: user.id, action: "VALIDATE", module: "RH", entityType: "PAYROLL",
    summary: `Paie ${ym(year, month)} — ${employee.fullName} : payé (${amount.toLocaleString("fr-FR")} DZD)`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Annule un « Payé » (erreur de saisie) tant que la ligne n'a pas été transférée
 * dans le budget : supprime la fiche déposée et la notification différée si elle
 * n'est pas encore partie.
 */
export async function unmarkSalaryPaid(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canRunPayroll(user)) return { ok: false, error: "Réservé aux RH." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ligne introuvable." };
  const entry = await prisma.payrollEntry.findUnique({ where: { id }, include: { employee: { select: { fullName: true } } } });
  if (!entry || entry.status !== "PAID") return { ok: false, error: "Ligne introuvable." };
  if (entry.budgetTransferredAt) return { ok: false, error: "Déjà transférée dans le budget : annulation impossible ici." };

  if (entry.payslipDocumentId) {
    const doc = await prisma.employeeDocument.findUnique({ where: { id: entry.payslipDocumentId }, select: { blobId: true } });
    await prisma.employeeDocument.delete({ where: { id: entry.payslipDocumentId } }).catch(() => {});
    if (doc) await releaseBlob(doc.blobId).catch(() => {});
  }
  await prisma.payrollEntry.update({
    where: { id },
    data: { status: "DRAFT", paidDate: null, payslipDocumentId: null, employeeNotifyAt: null },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "RH", entityType: "PAYROLL",
    summary: `Paie ${ym(entry.year, entry.month)} — ${entry.employee.fullName} : paiement annulé (correction)`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Transfère dans le BUDGET tous les salaires payés (non encore transférés) d'un mois :
 * une écriture de trésorerie SALAIRE (sortie) par employé, imputée à la (sous-)catégorie
 * budgétaire choisie. Appelé après le résumé de confirmation côté interface.
 */
export async function transferPayrollToBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canRunPayroll(user)) return { ok: false, error: "Réservé aux RH." };
  const year = fdNum(formData, "year");
  const month = fdNum(formData, "month");
  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  if (!year || !month) return { ok: false, error: "Mois invalide." };
  if (!budgetCategoryId) return { ok: false, error: "Choisissez la catégorie budgétaire." };
  const category = await prisma.budgetCategoryLine.findUnique({ where: { id: budgetCategoryId }, select: { name: true } });
  if (!category) return { ok: false, error: "Catégorie budgétaire introuvable." };

  const entries = await prisma.payrollEntry.findMany({
    where: { year, month, status: "PAID", budgetTransferredAt: null },
    include: { employee: { select: { fullName: true } } },
  });
  if (entries.length === 0) return { ok: false, error: "Aucun salaire payé à transférer pour ce mois." };

  // Références robustes calculées une fois pour le lot.
  const finRefs = (await prisma.financeTransaction.findMany({
    where: { reference: { startsWith: `FIN-${year}-` } },
    select: { reference: true },
  })).map((r) => r.reference);

  let total = 0;
  for (const [i, entry] of entries.entries()) {
    const reference = buildRef("FIN", year, finRefs).replace(/(\d+)$/, (m) => String(Number(m) + i).padStart(m.length, "0"));
    const tx = await prisma.financeTransaction.create({
      data: {
        reference,
        date: new Date(),
        direction: "OUT",
        category: "SALAIRE",
        label: `Salaire ${ym(year, month)} — ${entry.employee.fullName}`,
        amount: entry.net,
        method: "BANK_TRANSFER",
        account: "Banque",
        counterparty: entry.employee.fullName,
        status: "SETTLED",
        employeeId: entry.employeeId,
        budgetCategoryId,
        createdById: user.id,
      },
      select: { id: true },
    });
    await prisma.payrollEntry.update({
      where: { id: entry.id },
      data: { transactionId: tx.id, budgetTransferredAt: new Date(), budgetCategoryId },
    });
    total += Number(entry.net);
  }

  await recordAudit({
    actorId: user.id, action: "VALIDATE", module: "RH", entityType: "PAYROLL",
    summary: `Paie ${formatMonth(ym(year, month))} transférée au budget « ${category.name} » — ${entries.length} salaire·s, ${total.toLocaleString("fr-FR")} DZD`,
  });
  revalidatePath(PATH);
  revalidatePath("/finances");
  revalidatePath("/budgets");
  return { ok: true };
}
