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
import { entryCost } from "@/lib/hr/payroll-cost";
import { validateAmounts, resolvedGross, amendImpact, canAmend } from "@/lib/hr/payroll-amend";

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
  // COÛT EMPLOYEUR = ce que la société décaisse réellement (brut + charges patronales), et donc
  // le total imputé au BUDGET ; net = salaire affiché au SALARIÉ. Le brut reste une information
  // de bulletin, facultative : c'est le coût employeur qui fait la masse salariale.
  const employerCost = fdNum(formData, "employerCost");
  const gross = fdNum(formData, "gross");
  const net = fdNum(formData, "net");
  if (!employeeId || !year || !month || month < 1 || month > 12) return { ok: false, error: "Paramètres invalides." };
  // Les règles arithmétiques du bulletin vivent dans un module partagé : la CORRECTION les
  // rejoue à l'identique, et une ligne corrigée ne peut donc pas passer un contrôle que la
  // même ligne créée n'aurait pas passé.
  const invalidAmounts = validateAmounts({ employerCost, net, gross });
  if (invalidAmounts) return { ok: false, error: invalidAmounts };

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
    // Le brut n'est plus obligatoire : à défaut de saisie, on l'inscrit au coût employeur
    // plutôt que de laisser un 0 qui ferait passer la ligne pour une paie nulle.
    gross: resolvedGross({ employerCost, net, gross }),
    employerCost: employerCost as number,
    net: net as number, status: "PAID" as const, paidDate: now,
    payslipDocumentId,
    employeeNotifyAt: new Date(now.getTime() + NOTIFY_DELAY_MS),
    employeeNotifiedAt: null,
    createdById: existing ? undefined : user.id,
  };
  if (existing) await prisma.payrollEntry.update({ where: { id: existing.id }, data });
  else await prisma.payrollEntry.create({ data: { employeeId, year, month, ...data, createdById: user.id } });

  await recordAudit({
    actorId: user.id, action: "VALIDATE", module: "RH", entityType: "PAYROLL",
    summary: `Paie ${ym(year, month)} — ${employee.fullName} : payé (coût employeur ${data.employerCost.toLocaleString("fr-FR")} → budget · net ${data.net.toLocaleString("fr-FR")} DZD au salarié)`,
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
        label: `Salaire ${ym(year, month)} — ${entry.employee.fullName} (coût employeur)`,
        // LE COÛT EMPLOYEUR est ce que la société décaisse réellement — charges patronales
        // comprises — et donc ce qui doit peser sur le budget. Le brut n'en est qu'une partie ;
        // imputer le brut sous-évaluait la masse salariale du montant des charges.
        amount: entryCost({
          employerCost: entry.employerCost != null ? Number(entry.employerCost) : null,
          gross: Number(entry.gross), bonuses: Number(entry.bonuses), deductions: Number(entry.deductions),
        }),
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
    total += entryCost({
      employerCost: entry.employerCost != null ? Number(entry.employerCost) : null,
      gross: Number(entry.gross), bonuses: Number(entry.bonuses), deductions: Number(entry.deductions),
    });
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

/**
 * CORRIGER UNE LIGNE DE PAIE DÉJÀ FAITE — montants, fiche de paie, y compris après transfert.
 *
 * Jusqu'ici un mois marqué payé ne se corrigeait pas : on ne pouvait que l'ANNULER en entier,
 * et seulement avant le transfert au budget. Une erreur de mille dinars sur un net obligeait
 * donc à défaire la ligne puis à tout ressaisir — ce que personne ne fait un vendredi soir.
 * On la laissait fausse, et la masse salariale avec.
 *
 * APRÈS LE TRANSFERT, la correction ne s'arrête pas à la ligne : elle suit jusqu'à l'écriture
 * de trésorerie créée par le transfert. Sinon la paie dit un montant et le budget en dit un
 * autre, et l'on découvre l'écart en fin d'exercice sans savoir lequel des deux a raison.
 *
 * La FICHE DE PAIE se remplace : la nouvelle prend la place de l'ancienne dans le dossier de
 * l'employé, et l'ancienne est libérée. Empiler deux bulletins pour le même mois dans le
 * dossier d'un salarié, c'est lui laisser deviner lequel fait foi.
 */
export async function updatePayrollEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canRunPayroll(user)) return { ok: false, error: "Réservé aux RH." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ligne introuvable." };

  const entry = await prisma.payrollEntry.findUnique({
    where: { id },
    include: { employee: { select: { fullName: true } } },
  });
  if (!entry) return { ok: false, error: "Ligne introuvable." };
  const allowed = canAmend(entry);
  if (!allowed.ok) return { ok: false, error: allowed.error };

  const employerCost = fdNum(formData, "employerCost");
  const net = fdNum(formData, "net");
  const gross = fdNum(formData, "gross");
  const invalid = validateAmounts({ employerCost, net, gross });
  if (invalid) return { ok: false, error: invalid };

  const before = { employerCost: Number(entry.employerCost ?? entry.gross), net: Number(entry.net) };
  const after = { employerCost: employerCost as number, net: net as number };
  const impact = amendImpact(before, after, { transferred: Boolean(entry.budgetTransferredAt) });

  // La fiche de paie REMPLACE la précédente, elle ne s'y ajoute pas.
  const file = formData.get("payslip");
  let payslipDocumentId = entry.payslipDocumentId;
  if (file instanceof File && file.size > 0) {
    const badFile = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
    if (badFile) return { ok: false, error: badFile };
    const { blobId } = await putBlob(Buffer.from(await file.arrayBuffer()));
    const fresh = await prisma.employeeDocument.create({
      data: {
        employeeId: entry.employeeId, category: "PAYSLIP", name: file.name, blobId,
        mime: file.type || "application/pdf", size: file.size,
        period: ym(entry.year, entry.month), visibleToEmployee: true, uploadedById: user.id,
      },
      select: { id: true },
    });
    if (entry.payslipDocumentId) {
      const old = await prisma.employeeDocument.findUnique({ where: { id: entry.payslipDocumentId }, select: { blobId: true } });
      await prisma.employeeDocument.delete({ where: { id: entry.payslipDocumentId } }).catch(() => {});
      if (old) await releaseBlob(old.blobId).catch(() => {});
    }
    payslipDocumentId = fresh.id;
  }

  await prisma.payrollEntry.update({
    where: { id },
    data: {
      employerCost: after.employerCost,
      net: after.net,
      gross: resolvedGross({ employerCost, net, gross }),
      payslipDocumentId,
    },
  });

  // LE BUDGET SUIT. Sans cette reprise, la ligne corrigée et l'écriture de trésorerie
  // divergeraient en silence.
  if (impact.syncBudget && entry.transactionId) {
    await prisma.financeTransaction.update({
      where: { id: entry.transactionId },
      data: {
        amount: entryCost({
          employerCost: after.employerCost,
          gross: Number(entry.gross), bonuses: Number(entry.bonuses), deductions: Number(entry.deductions),
        }),
        label: `Salaire ${ym(entry.year, entry.month)} — ${entry.employee.fullName} (coût employeur, corrigé)`,
      },
    }).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "RH", entityType: "PAYROLL", entityId: id,
    summary: `Paie ${formatMonth(ym(entry.year, entry.month))} — ${entry.employee.fullName} : ${impact.summary}${impact.syncBudget ? " · écriture budgétaire corrigée" : ""}`,
  });
  revalidatePath(PATH);
  if (impact.syncBudget) { revalidatePath("/finances"); revalidatePath("/budgets"); }
  return { ok: true, message: impact.syncBudget ? "Ligne et écriture budgétaire corrigées." : "Ligne corrigée." };
}
