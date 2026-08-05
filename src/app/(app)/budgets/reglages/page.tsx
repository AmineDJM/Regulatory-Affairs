import { requireModule } from "@/lib/session";
import { canManageEnvelopes, canManageEnvelope } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getEnvelopes, getBudgetOverview } from "@/lib/queries/budget";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { BUDGET_TABS } from "@/lib/labels";
import { BudgetContextBar } from "../budget-context-bar";
import { BudgetSettings } from "../budget-settings";
import { CreateEnvelopeButton } from "../budget-forms";

export const dynamic = "force-dynamic";

/** BUDGETS — écran de paramétrage : l'enveloppe, ses catégories, le budget total. */
export default async function BudgetSettingsPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");
  // GOUVERNANCE des accès (créer/modifier/supprimer une enveloppe, régler ses listes d'accès
  // et le budget total) : prérogative Super Admin, délégable via BUDGETS:DELETE.
  const canManageAccess = canManageEnvelopes(user);

  const [envelopes, settings, users, tabs] = await Promise.all([
    getEnvelopes(user),
    getAppSettings(),
    canManageAccess
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
    visibleTabs(user, BUDGET_TABS),
  ]);
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(user, searchParams.env ?? null, from, to);

  // GESTION du CONTENU de l'enveloppe affichée : gouverneur global OU délégué sur CETTE enveloppe.
  const canManageContent = overview ? canManageEnvelope(user, overview.envelope) : canManageAccess;

  const flexibleTotal = envelopes.filter((e) => e.isActive).reduce((s, e) => s + e.total, 0);
  const budgetTotal = {
    mode: settings.budgetTotalMode,
    value: settings.budgetTotalMode === "FIXED" ? settings.budgetFixedTotal : flexibleTotal,
    fixed: settings.budgetFixedTotal,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Réglages du budget" description="L'enveloppe, sa répartition en catégories, et le budget total au-dessus des enveloppes.">
        {canManageAccess && <CreateEnvelopeButton users={users} />}
      </PageHeader>
      <ModuleTabs tabs={tabs} />
      {!overview ? (
        <EmptyState
          icon="Wallet"
          title="Aucune enveloppe budgétaire"
          description={canManageAccess ? "Créez une enveloppe : un budget total pour une période, que vous répartirez ensuite en catégories." : "Aucune enveloppe ne vous est ouverte pour le moment."}
        />
      ) : (
        <>
          <BudgetContextBar envelopes={envelopes} currentId={overview.envelope.id} from={overview.period.from} to={overview.period.to} />
          <BudgetSettings
            overview={overview}
            canManage={canManageContent}
            canManageAccess={canManageAccess}
            budgetTotal={budgetTotal}
            users={users}
          />
        </>
      )}
    </div>
  );
}
