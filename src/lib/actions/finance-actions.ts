"use server";

import { revalidatePath } from "next/cache";
import type { FinanceCategory, FinanceDirection, FinanceMethod, FinanceStatus, PayrollStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { buildRef, nextRefNumber } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const IN_CATEGORIES = ["RECETTE", "CCA", "PRET"];

async function nextRef(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.financeTransaction.findMany({ where: { reference: { startsWith: `${prefix}-${year}-` } }, select: { reference: true } });
  return buildRef(prefix, year, refs.map((r) => r.reference));
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

  // Référence SAISIE acceptée (les encaissements portent souvent celle du reçu ou du virement) ;
  // à défaut, on continue de la générer. Une référence déjà prise repart en auto plutôt que de
  // faire échouer la saisie sur une contrainte d'unicité.
  const wanted = fdStr(formData, "reference");
  const free = wanted ? (await prisma.financeTransaction.count({ where: { reference: wanted } })) === 0 : false;

  const created = await prisma.financeTransaction.create({
    data: {
      reference: free && wanted ? wanted : await nextRef("FIN"),
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
      companyId: fdStr(formData, "companyId") || null,
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

/**
 * Modifie une écriture du livre comptable (tous champs sauf la référence, qui reste stable).
 * Réservé à qui peut mettre à jour les Finances. La consommation budgétaire et la trésorerie
 * se recalculent automatiquement à partir des champs mis à jour.
 */
export async function updateTransaction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const label = fdStr(formData, "label");
  const amount = fdNum(formData, "amount");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!label || amount === null) return { ok: false, error: "Libellé et montant obligatoires." };
  const category = (fdStr(formData, "category") as FinanceCategory) ?? "AUTRE";
  const direction = (fdStr(formData, "direction") as FinanceDirection) ??
    (IN_CATEGORIES.includes(category) ? "IN" : "OUT");

  await prisma.financeTransaction.update({
    where: { id },
    data: {
      date: fdDate(formData, "date") ?? undefined,
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
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "FINANCE_TRANSACTION",
    entityId: id, summary: `Écriture modifiée — ${label}`,
  });
  revalidatePath("/finances");
  return { ok: true };
}

/** Supprime définitivement une écriture du livre comptable (trésorerie recalculée). */
export async function deleteTransaction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "DELETE")) return { ok: false, error: "Suppression non autorisée." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const tx = await prisma.financeTransaction.findUnique({ where: { id }, select: { reference: true, label: true } });
  if (!tx) return { ok: false, error: "Écriture introuvable." };
  // Un bulletin de paie réglé peut pointer cette écriture : on délie proprement (repasse en non réglé).
  await prisma.payrollEntry.updateMany({ where: { transactionId: id }, data: { transactionId: null, status: "VALIDATED", paidDate: null } }).catch(() => {});
  await prisma.financeTransaction.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Finances", entityType: "FINANCE_TRANSACTION",
    entityId: id, summary: `Écriture supprimée — ${tx.reference} · ${tx.label}`,
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
  const existingRefs = await prisma.financeTransaction.findMany({ where: { reference: { startsWith: `FIN-${year}-` } }, select: { reference: true } });
  let base = nextRefNumber(existingRefs.map((r) => r.reference)) - 1; // prochain = base+1 (dérivé du max, robuste aux trous)
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

// ── Solde d'ouverture de trésorerie (initialisation puis calcul) ──

/**
 * Définit (ou met à jour) le solde d'ouverture d'un compte de trésorerie. Le solde
 * courant affiché = solde d'ouverture + flux réglés. Permet d'initialiser la
 * trésorerie à l'adoption de la plateforme, puis de la laisser se calculer.
 */
export async function setTreasuryOpeningBalance(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const name = (fdStr(formData, "name") ?? "").trim();
  if (!name) return { ok: false, error: "Nom du compte obligatoire." };
  const openingBalance = fdNum(formData, "openingBalance") ?? 0;
  const openingDate = fdDate(formData, "openingDate") ?? new Date();
  const notes = fdStr(formData, "notes");

  await prisma.treasuryAccount.upsert({
    where: { name },
    update: { openingBalance, openingDate, notes },
    create: { name, openingBalance, openingDate, notes, createdById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances",
    summary: `Solde d'ouverture « ${name} » = ${openingBalance.toLocaleString("fr-FR")} DZD`,
  });
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteTreasuryAccount(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.treasuryAccount.delete({ where: { id } }).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Finances", summary: "Solde d'ouverture supprimé" });
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

/**
 * ENCAISSEMENT SIMPLE — cinq champs et c'est réglé : date, référence, libellé, montant, client.
 *
 * Le formulaire complet (catégorie, méthode, compte, statut, entité, pièce…) est fait pour la
 * saisie comptable soignée ; encaisser un règlement client n'a pas besoin de tout cela, et
 * l'obligation de tout remplir décourageait la saisie au fil de l'eau. Les valeurs implicites
 * sont celles du cas courant : recette, réglée, virement bancaire.
 */
export async function createQuickIncome(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };

  const label = fdStr(formData, "label");
  const amount = fdNum(formData, "amount");
  if (!label || amount === null) return { ok: false, error: "Libellé et montant obligatoires." };
  if (amount <= 0) return { ok: false, error: "Le montant d'un encaissement doit être positif." };

  const wanted = fdStr(formData, "reference");
  const free = wanted ? (await prisma.financeTransaction.count({ where: { reference: wanted } })) === 0 : false;
  if (wanted && !free) return { ok: false, error: `La référence « ${wanted} » est déjà utilisée.` };

  const created = await prisma.financeTransaction.create({
    data: {
      reference: wanted || (await nextRef("FIN")),
      date: fdDate(formData, "date") ?? new Date(),
      direction: "IN",
      category: "RECETTE",
      label,
      amount,
      method: "BANK_TRANSFER",
      account: "Banque",
      counterparty: fdStr(formData, "client"),
      status: "SETTLED",
      companyId: fdStr(formData, "companyId") || null,
      createdById: user.id,
    },
    select: { id: true, reference: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Finances",
    entityType: "FINANCE_TRANSACTION", entityId: created.id,
    summary: `Encaissement ${created.reference} — ${label} (${amount.toLocaleString("fr-FR")} DZD)`,
  });
  revalidatePath("/finances");
  return { ok: true, id: created.id };
}

/**
 * L'ADMINISTRATEUR DEMANDE une mise à jour du solde de trésorerie. Les Finances le mettent à
 * jour quand elles le veulent ; l'admin, lui, ne saisit pas à leur place — il le demande, et la
 * demande arrive là où elle sera traitée (notification + tâche dans leur file).
 */
export async function requestTreasuryUpdate(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !hasGlobalView(user)) return { ok: false, error: "Réservé à l'administration." };
  const note = fdStr(formData, "note");

  await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
    type: "GENERIC",
    title: "Mise à jour du solde de trésorerie demandée",
    body: note || "L'administration demande l'actualisation des soldes de trésorerie.",
    link: "/finances",
  }).catch(() => undefined);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances",
    summary: `Mise à jour du solde de trésorerie demandée${note ? ` — ${note}` : ""}`,
  });
  revalidatePath("/finances");
  return { ok: true };
}
