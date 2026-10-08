import { requireModule } from "@/lib/session";
import { VueEnsembleBudget, CONFIG_BUDGET_OPERATIONS, type ParamsBudget } from "../budgets/vues-budget";

export const dynamic = "force-dynamic";

/** BUDGET OPERATIONS & SALES — VUE D'ENSEMBLE (Direction, 08/10). Les écrans de Budgets, bornés aux enveloppes du pôle. */
export default async function BudgetOperationsPage({ searchParams }: { searchParams: ParamsBudget }) {
  const user = await requireModule("BUDGET_OPERATIONS");
  return <VueEnsembleBudget user={user} searchParams={searchParams} config={CONFIG_BUDGET_OPERATIONS} />;
}