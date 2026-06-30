import { requireModule } from "@/lib/session";
import { canManageEnvelopes } from "@/lib/rbac";
import { getEnvelopes, getBudgetOverview } from "@/lib/queries/budget";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetBoard, CreateEnvelopeButton } from "./budget-board";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");
  // Gestion des enveloppes : prérogative Super Admin (délégable). La Direction
  // des opérations consulte les budgets mais n'en a pas la gestion par défaut.
  const canManage = canManageEnvelopes(user);

  const [envelopes, settings] = await Promise.all([getEnvelopes(user), getAppSettings()]);
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(user, searchParams.env ?? null, from, to);

  // Budget total au-dessus des enveloppes : figé (FIXED) ou somme des enveloppes
  // actives visibles (FLEXIBLE).
  const flexibleTotal = envelopes.filter((e) => e.isActive).reduce((s, e) => s + e.total, 0);
  const budgetTotal = {
    mode: settings.budgetTotalMode,
    value: settings.budgetTotalMode === "FIXED" ? settings.budgetFixedTotal : flexibleTotal,
    fixed: settings.budgetFixedTotal,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Budget total réparti en enveloppes (par module) puis en catégories ; la consommation réelle est calculée sur la période choisie.">
        {canManage && <CreateEnvelopeButton />}
      </PageHeader>

      {!overview ? (
        <EmptyState
          icon="Wallet"
          title="Aucune enveloppe budgétaire"
          description={canManage ? "Créez une enveloppe : un budget total pour une période, que vous répartirez ensuite en catégories." : "Aucune enveloppe ne vous est ouverte pour le moment."}
        />
      ) : (
        <BudgetBoard overview={overview} envelopes={envelopes} canManage={canManage} budgetTotal={budgetTotal} />
      )}
    </div>
  );
}
