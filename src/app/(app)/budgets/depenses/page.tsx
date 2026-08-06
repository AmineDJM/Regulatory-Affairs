import { requireModule } from "@/lib/session";
import { canManageEnvelopes, canManageEnvelope, hasGlobalView } from "@/lib/rbac";
import { getEnvelopes, getBudgetOverview } from "@/lib/queries/budget";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { BUDGET_TABS } from "@/lib/labels";
import { BudgetContextBar } from "../budget-context-bar";
import { BudgetExpenses } from "../budget-expenses";
import { resolveBudgetEnvelope } from "@/lib/budget-scope";

export const dynamic = "force-dynamic";

/** BUDGETS — écran de travail : imputer les dépenses, en ajouter, corriger. */
export default async function BudgetExpensesPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");
  const [envelopes, tabs] = await Promise.all([getEnvelopes(user), visibleTabs(user, BUDGET_TABS)]);
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(user, resolveBudgetEnvelope(searchParams.env), from, to);

  const canManageContent = overview ? canManageEnvelope(user, overview.envelope) : canManageEnvelopes(user);
  const canAttribute = hasGlobalView(user.role) || canManageContent;

  return (
    <div className="space-y-5">
      <PageHeader title="Dépenses" description="Rattachez chaque dépense à une catégorie — c'est ce qui rend la vue d'ensemble juste." />
      <ModuleTabs tabs={tabs} />
      {!overview ? (
        <EmptyState icon="Wallet" title="Aucune enveloppe budgétaire" description="Aucune enveloppe ne vous est ouverte pour le moment." />
      ) : (
        <>
          <BudgetContextBar envelopes={envelopes} currentId={overview.envelope.id} from={overview.period.from} to={overview.period.to} />
          <BudgetExpenses overview={overview} canAttribute={canAttribute} />
        </>
      )}
    </div>
  );
}
