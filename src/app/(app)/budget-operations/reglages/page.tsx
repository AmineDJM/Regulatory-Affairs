import { requireModule } from "@/lib/session";
import { VueReglagesBudget, CONFIG_BUDGET_OPERATIONS, type ParamsBudget } from "../../budgets/vues-budget";

export const dynamic = "force-dynamic";

/** BUDGET OPERATIONS & SALES — créer une enveloppe, la régler, la répartir en catégories. */
export default async function BudgetOperationsReglagesPage({ searchParams }: { searchParams: ParamsBudget }) {
  const user = await requireModule("BUDGET_OPERATIONS");
  return <VueReglagesBudget user={user} searchParams={searchParams} config={CONFIG_BUDGET_OPERATIONS} />;
}