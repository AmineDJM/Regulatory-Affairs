import { requireModule } from "@/lib/session";
import { VueDepensesBudget, CONFIG_BUDGET_OPERATIONS, type ParamsBudget } from "../../budgets/vues-budget";

export const dynamic = "force-dynamic";

/** BUDGET OPERATIONS & SALES — imputer les dépenses aux catégories des enveloppes du pôle, en ajouter, corriger. */
export default async function BudgetOperationsDepensesPage({ searchParams }: { searchParams: ParamsBudget }) {
  const user = await requireModule("BUDGET_OPERATIONS");
  return <VueDepensesBudget user={user} searchParams={searchParams} config={CONFIG_BUDGET_OPERATIONS} />;
}