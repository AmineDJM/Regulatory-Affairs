"use server";

import { revalidatePath } from "next/cache";
import type { FinanceCategory, FinanceDirection, FinanceMethod, FinanceStatus, PayrollStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const IN_CATEGORIES = ["RECETTE", "CCA", "PRET"];

async function nextRef(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.financeTransaction.count({ where: { reference: { startsWith: `${prefix}-${year}-` } } });
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function createTransaction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };

  const label = fdStr(formData, "label");
  const amount = fdNum(formData, "amount");
  const category = (fdStr(formData, "category") as FinanceCategory) ?? "AUTRE";
  if (!label || amount === null) return { ok: false, error: "Libellé et montant obligatoires." };

  const direction = (fdStr(formData, "direction") as FinanceDirection) ??
    (IN_CATEGORIES.includes(category) ? "IN" : "OUT");

  const created = await prisma.financeTransaction.create({
    data: {
      reference: await nextRef("FIN"),
      date: fdDate(formData, "date") ?? new Date(),
      direction,
      category,
      label,
      amount: Math.abs(amount),
      method: (fdStr(formData, "method") as FinanceMethod) ?? "BANK_TRANSFER",
      account: fdStr(formData, "account") ?? "Banque",
      counterparty: fdStr(formData, "counterparty"),
      invoiceRef: fdStr(formData, "invoiceRef"),
      status: (fdStr(formData, "status") as FinanceStatus) ?? "SETTLED",
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Finances",
    entityType: "FINANCE_TRANSACTION", entityId: created.id,
    summary: `${direction === "IN" ? "Encaissement" : "Décaissement"} ${created.reference} — ${label}`,
  });
  revalidatePath("/finances");
  return { ok: true, id: created.id };
}

export async function updateTransactionStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as FinanceStatus;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  await prisma.financeTransaction.update({ where: { id }, data: { status } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "FINANCE_TRANSACTION",
    entityId: id, field: "status", newValue: status, summary: "Statut de transaction mis à jour",
  });
  revalidatePath("/finances");
  return { ok: true };
}

/** CSV import: date,direction(IN/OUT),category,label,amount,method,account,counterparty */
export async function importTransactions(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };
  const csv = fdStr(formData, "csv");
  if (!csv) return { ok: false, error: "Aucune donnée." };

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(1);
  let n = 0;
  const year = new Date().getFullYear();
  let base = await prisma.financeTransaction.count({ where: { reference: { startsWith: `FIN-${year}-` } } });
  for (const line of lines) {
    const c = line.split(/[;,]/).map((x) => x.trim());
    if (c.length < 5) continue;
    const [date, direction, category, label, amount, method, account, counterparty] = c;
    const amt = Number((amount ?? "").replace(/\s/g, "").replace(",", "."));
    if (!label || Number.isNaN(amt)) continue;
    base += 1;
    await prisma.financeTransaction.create({
      data: {
        reference: `FIN-${year}-${String(base).padStart(3, "0")}`,
        date: date ? new Date(date) : new Date(),
        direction: (direction?.toUpperCase() === "IN" ? "IN" : direction?.toUpperCase() === "OUT" ? "OUT" : (IN_CATEGORIES.includes((category ?? "").toUpperCase()) ? "IN" : "OUT")) as FinanceDirection,
        category: ((category ?? "AUTRE").toUpperCase() as FinanceCategory),
        label,
        amount: Math.abs(amt),
        method: ((method ?? "BANK_TRANSFER").toUpperCase() as FinanceMethod) ?? "BANK_TRANSFER",
        account: account || "Banque",
        counterparty: counterparty || null,
        status: "SETTLED",
        createdById: user.id,
      },
    }).catch(() => undefined);
    n += 1;
  }
  await recordAudit({ actorId: user.id, action: "IMPORT", module: "Finances", summary: `${n} transactions importées` });
  revalidatePath("/finances");
  return { ok: true };
}

// ── Payroll ──

export async function createEmployee(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };
  const fullName = fdStr(formData, "fullName");
  if (!fullName) return { ok: false, error: "Le nom est obligatoire." };
  const created = await prisma.employee.create({
    data: {
      fullName, position: fdStr(formData, "position"), department: fdStr(formData, "department"),
      email: fdStr(formData, "email"), phone: fdStr(formData, "phone"), iban: fdStr(formData, "iban"),
      baseSalary: fdNum(formData, "baseSalary") ?? 0, hireDate: fdDate(formData, "hireDate"),
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Finances", entityType: "EMPLOYEE", entityId: created.id, summary: `Employé « ${fullName} »` });
  revalidatePath("/finances");
  return { ok: true, id: created.id };
}

export async function createPayroll(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };
  const employeeId = fdStr(formData, "employeeId");
  if (!employeeId) return { ok: false, error: "Employé requis." };
  const gross = fdNum(formData, "gross") ?? 0;
  const bonuses = fdNum(formData, "bonuses") ?? 0;
  const deductions = fdNum(formData, "deductions") ?? 0;
  const net = gross + bonuses - deductions;
  const year = fdNum(formData, "year") ?? new Date().getFullYear();
  const month = fdNum(formData, "month") ?? new Date().getMonth() + 1;

  try {
    const created = await prisma.payrollEntry.create({
      data: { employeeId, year, month, gross, bonuses, deductions, net,
        status: (fdStr(formData, "status") as PayrollStatus) ?? "DRAFT", createdById: user.id },
    });
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Finances", entityType: "PAYROLL", entityId: created.id, summary: `Bulletin ${month}/${year}` });
  } catch {
    return { ok: false, error: "Un bulletin existe déjà pour cet employé sur ce mois." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Mark a payslip PAID → record a treasury OUT transaction. */
export async function payPayroll(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Bulletin introuvable." };
  const entry = await prisma.payrollEntry.findUnique({ where: { id }, include: { employee: true } });
  if (!entry) return { ok: false, error: "Bulletin introuvable." };
  if (entry.status === "PAID") return { ok: true };

  const tx = await prisma.financeTransaction.create({
    data: {
      reference: await nextRef("FIN"),
      date: new Date(),
      direction: "OUT",
      category: "SALAIRE",
      label: `Salaire ${entry.month}/${entry.year} — ${entry.employee.fullName}`,
      amount: entry.net,
      method: "BANK_TRANSFER",
      account: "Banque",
      counterparty: entry.employee.fullName,
      status: "SETTLED",
      employeeId: entry.employeeId,
      createdById: user.id,
    },
  });
  await prisma.payrollEntry.update({
    where: { id }, data: { status: "PAID", paidDate: new Date(), transactionId: tx.id },
  });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Finances", entityType: "PAYROLL", entityId: id, summary: `Paie réglée — ${entry.employee.fullName}` });
  revalidatePath("/finances");
  return { ok: true };
}
