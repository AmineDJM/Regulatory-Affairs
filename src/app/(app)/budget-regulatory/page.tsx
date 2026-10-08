import { requireModule } from "@/lib/session";
import { VueEnsembleBudget, CONFIG_BUDGET_REGULATORY, type ParamsBudget } from "../budgets/vues-budget";

export const dynamic = "force-dynamic";

/** BUDGET REGULATORY — VUE D'ENSEMBLE (Direction, 08/10). Les écrans de Budgets, bornés aux enveloppes du pôle. */
export default async function BudgetRegulatoryPage({ searchParams }: { searchParams: ParamsBudget }) {
  const user = await requireModule("BUDGET_REGULATORY");
  return <VueEnsembleBudget user={user} searchParams={searchParams} config={CONFIG_BUDGET_REGULATORY} />;
}