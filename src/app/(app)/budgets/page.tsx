import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getEnvelopes, getBudgetOverview } from "@/lib/queries/budget";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetBoard, CreateEnvelopeButton } from "./budget-board";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");
  const canManage = userCan(user, "BUDGETS", "UPDATE");

  const envelopes = await getEnvelopes();
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(searchParams.env ?? null, from, to);

  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Enveloppe budgétaire de la Direction : un budget total réparti en catégories, et la consommation réelle calculée sur la période choisie.">
        {canManage && <CreateEnvelopeButton />}
      </PageHeader>

      {!overview ? (
        <EmptyState
          icon="Wallet"
          title="Aucune enveloppe budgétaire"
          description={canManage ? "Créez une enveloppe : un budget total pour une période, que vous répartirez ensuite en catégories." : "La Direction n'a pas encore défini de budget."}
        />
      ) : (
        <BudgetBoard overview={overview} envelopes={envelopes} canManage={canManage} />
      )}
    </div>
  );
}
