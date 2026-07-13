"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { canManageEnvelopes, hasGlobalView, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { buildRef, createWithRetry } from "@/lib/refs";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

const NOT_ALLOWED: ActionResult = { ok: false, error: "Gestion des enveloppes réservée au Super Admin (ou à un délégué)." };

const readAccessRoles = (formData: FormData) => formData.getAll("accessRoles").map(String).filter(Boolean);
const readAccessUserIds = (formData: FormData) => [...new Set(formData.getAll("accessUserIds").map(String).filter(Boolean))];
const readModules = (formData: FormData) => [...new Set(formData.getAll("modules").map(String).filter(Boolean))];

// ─────────────────────── Budget total (fixe / flexible) ───────────────────────

/** Règle le budget total : FIXED (montant figé) ou FLEXIBLE (= somme des enveloppes). */
export async function setBudgetTotal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const mode = fdStr(formData, "mode") === "FIXED" ? "FIXED" : "FLEXIBLE";
  const fixed = fdNum(formData, "budgetFixedTotal") ?? 0;
  await prisma.appSetting.upsert({
    where: { id: "global" },
    update: { budgetTotalMode: mode, budgetFixedTotal: fixed, updatedById: user.id },
    create: { id: "global", budgetTotalMode: mode, budgetFixedTotal: fixed, updatedById: user.id },
  });
  revalidatePath("/budgets");
  return { ok: true };
}

// ─────────────────────────── Enveloppe ───────────────────────────

export async function createEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'enveloppe est obligatoire." };
  const now = new Date();
  const periodStart = fdDate(formData, "periodStart") ?? new Date(now.getFullYear(), 0, 1);
  const periodEnd = fdDate(formData, "periodEnd") ?? new Date(now.getFullYear(), 11, 31);

  const modules = readModules(formData);
  const created = await prisma.budgetEnvelope.create({
    data: {
      name,
      modules,
      module: modules[0] ?? null, // compat : module principal
      accessRoles: readAccessRoles(formData),
      accessUserIds: readAccessUserIds(formData),
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
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  const modules = readModules(formData);
  await prisma.budgetEnvelope.update({
    where: { id },
    data: {
      name,
      modules,
      module: modules[0] ?? null, // compat : module principal
      accessRoles: readAccessRoles(formData),
      accessUserIds: readAccessUserIds(formData),
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
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.budgetEnvelope.delete({ where: { id } });
  revalidatePath("/budgets");
  return { ok: true };
}

// ─────────────────────────── Catégories ───────────────────────────

export async function createBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const envelopeId = fdStr(formData, "envelopeId");
  const name = fdStr(formData, "name");
  if (!envelopeId || !name) return { ok: false, error: "Nom de catégorie manquant." };
  // Sous-catégorie : rattachée à une catégorie parente. Elle n'a pas de module
  // (l'attribution automatique des dépenses se fait au niveau de la catégorie de tête).
  const parentId = fdStr(formData, "parentId");
  const created = await prisma.budgetCategoryLine.create({
    data: {
      envelopeId, name,
      parentId: parentId || null,
      module: parentId ? null : fdStr(formData, "module"),
      allocated: fdNum(formData, "allocated") ?? 0,
      color: fdStr(formData, "color"), notes: fdStr(formData, "notes"),
    },
    select: { id: true },
  });
  revalidatePath("/budgets");
  return { ok: true, id: created.id };
}

export async function updateBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  const parentId = fdStr(formData, "parentId");
  const isSub = Boolean(parentId) && parentId !== id; // pas d'auto-rattachement
  await prisma.budgetCategoryLine.update({
    where: { id },
    data: {
      name, allocated: fdNum(formData, "allocated") ?? 0, color: fdStr(formData, "color"), notes: fdStr(formData, "notes"),
      parentId: isSub ? parentId : null,
      // Le module d'attribution est MODIFIABLE et ré-enregistrable pour une catégorie de tête
      // (une sous-catégorie n'en porte pas — l'attribution auto se fait au niveau de la tête).
      module: isSub ? null : (fdStr(formData, "module") || null),
    },
  });
  revalidatePath("/budgets");
  return { ok: true };
}

export async function deleteBudgetCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageEnvelopes(user)) return NOT_ALLOWED;
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
  if (!(hasGlobalView(user.role) || userCan(user, "BUDGETS", "UPDATE"))) return { ok: false, error: "Allocation réservée à la Direction." };
  const transactionId = fdStr(formData, "transactionId");
  if (!transactionId) return { ok: false, error: "Transaction manquante." };
  const budgetCategoryId = fdStr(formData, "budgetCategoryId"); // null = retirer
  await prisma.financeTransaction.update({ where: { id: transactionId }, data: { budgetCategoryId } });
  revalidatePath("/budgets");
  return { ok: true };
}

/** Prochaine référence FIN unique (dérivée du maximum réel → robuste aux suppressions). */
async function nextFinRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.financeTransaction.findMany({ where: { reference: { startsWith: `FIN-${year}-` } }, select: { reference: true } });
  return buildRef("FIN", year, refs.map((r) => r.reference));
}

/**
 * AJOUT RAPIDE d'une ligne de dépense qui CONSOMME un budget, directement depuis le module
 * Budget (référence + montant). Crée une dépense réelle (FinanceTransaction OUT, RÉGLÉE)
 * imputée à la (sous-)catégorie choisie → la consommation se met à jour aussitôt. Réservé à
 * la Direction / aux gestionnaires, et uniquement sur une enveloppe qui leur est ACCESSIBLE.
 */
export async function addBudgetExpense(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "BUDGETS", "UPDATE"))) return { ok: false, error: "Ajout réservé à la Direction ou aux gestionnaires de budget." };

  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  const reference = fdStr(formData, "reference"); // la « référence » saisie sert de libellé de la dépense
  const amount = fdNum(formData, "amount");
  if (!budgetCategoryId) return { ok: false, error: "Choisissez la catégorie de budget." };
  if (!reference) return { ok: false, error: "Indiquez une référence." };
  if (amount == null || amount <= 0) return { ok: false, error: "Indiquez un montant positif." };

  const cat = await prisma.budgetCategoryLine.findUnique({
    where: { id: budgetCategoryId },
    select: { id: true, name: true, envelope: { select: { accessRoles: true, accessUserIds: true } } },
  });
  if (!cat) return { ok: false, error: "Catégorie introuvable." };
  // Le décideur ne peut imputer qu'à une enveloppe qui lui est OUVERTE (accès Super Admin).
  const allowed = canManageEnvelopes(user) || hasGlobalView(user.role) || cat.envelope.accessRoles.includes(user.role) || cat.envelope.accessUserIds.includes(user.id);
  if (!allowed) return { ok: false, error: "Cette enveloppe ne vous est pas ouverte." };

  const date = fdDate(formData, "date") ?? new Date();
  const label = reference.slice(0, 160);
  const created = await createWithRetry(async () =>
    prisma.financeTransaction.create({
      data: {
        reference: await nextFinRef(),
        date, direction: "OUT", category: "AUTRE", label, amount,
        method: "BANK_TRANSFER", account: "Banque", status: "SETTLED",
        invoiceRef: reference.slice(0, 120), budgetCategoryId, createdById: user.id,
        notes: "Ligne de dépense saisie depuis le module Budget.",
      },
      select: { id: true },
    }),
  );
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Budgets", entityType: "FINANCE_TRANSACTION", entityId: created.id, summary: `Dépense « ${label} » imputée à « ${cat.name} »` });
  revalidatePath("/budgets");
  return { ok: true };
}
