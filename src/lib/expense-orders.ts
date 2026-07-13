import type { EntityType, FinanceCategory } from "@prisma/client";
import { buildRef } from "@/lib/refs";
import { prisma } from "./prisma";
import { notifyRoles } from "./notify";

export async function nextExpenseRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.expenseOrder.findMany({ where: { reference: { startsWith: `OD-${year}-` } }, select: { reference: true } });
  return buildRef("OD", year, refs.map((r) => r.reference));
}

interface CreateExpenseOrderInput {
  label: string;
  amount: number;
  category: FinanceCategory;
  beneficiary?: string | null;
  sourceType?: EntityType;
  sourceId?: string;
  requestedById?: string | null;
  notes?: string | null;
  dueDate?: Date | null;
  /** (Sous-)catégorie budgétaire choisie par la Direction — attribution au règlement. */
  budgetCategoryId?: string | null;
}

// Dépenses « événementielles » : une facture est obligatoire avant le règlement.
const INVOICE_REQUIRED_SOURCES: EntityType[] = ["SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "PROMO_MATERIAL"];

/**
 * Emit an "ordre de dépense" for the accountant when the Direction (or RH) validates
 * a spend. Best-effort notification to the comptable role. Returns the created order.
 * Les dépenses événementielles (sponsoring, congrès, matériel promo) exigent une
 * facture jointe avant règlement.
 */
export async function createExpenseOrder(input: CreateExpenseOrderInput) {
  const requiresInvoice = (input.sourceType ? INVOICE_REQUIRED_SOURCES.includes(input.sourceType) : false) || input.category === "EVENEMENT";
  const order = await prisma.expenseOrder.create({
    data: {
      reference: await nextExpenseRef(),
      label: input.label,
      amount: input.amount,
      category: input.category,
      beneficiary: input.beneficiary ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      requestedById: input.requestedById ?? null,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      budgetCategoryId: input.budgetCategoryId ?? null,
      requiresInvoice,
    },
  });
  await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Nouvel ordre de dépense",
    body: `${order.reference} — ${input.label} (${input.amount.toLocaleString("fr-FR")} DZD)`,
    link: "/finances/ordres-de-depense",
  });
  return order;
}
