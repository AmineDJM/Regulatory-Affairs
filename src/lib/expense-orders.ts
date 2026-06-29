import type { EntityType, FinanceCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { notifyRoles } from "./notify";

export async function nextExpenseRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.expenseOrder.count({ where: { reference: { startsWith: `OD-${year}-` } } });
  return `OD-${year}-${String(count + 1).padStart(3, "0")}`;
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
}

/**
 * Emit an "ordre de dépense" for the accountant when the Direction (or RH) validates
 * a spend. Best-effort notification to the comptable role. Returns the created order.
 */
export async function createExpenseOrder(input: CreateExpenseOrderInput) {
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
