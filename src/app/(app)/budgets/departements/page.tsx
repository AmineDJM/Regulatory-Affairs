import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getDepartmentBudgets } from "@/lib/queries/department-budget";
import { settableKinds, normalizeYear, totals } from "@/lib/department-budget";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { BUDGET_TABS } from "@/lib/labels";
import { DepartmentBudgetTable } from "./department-budget-table";

export const dynamic = "force-dynamic";

/**
 * BUDGET PAR DÉPARTEMENT — un tableau, deux responsables.
 *
 * Le même écran porte les deux colonnes, mais chacune n'est modifiable que par qui de droit :
 * l'administrateur règle le fonctionnement, les ressources humaines règlent les employés et le
 * recrutement. Les mettre côte à côte est délibéré — c'est la seule façon de voir ce que coûte
 * réellement un département ; les rendre modifiables séparément l'est tout autant.
 */
export default async function DepartmentBudgetsPage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireModule("BUDGETS");
  const year = normalizeYear(searchParams.year);

  const setter = {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(user, "BUDGETS", "UPDATE") || userCan(user, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(user, "RH", "UPDATE"),
  };
  const editable = settableKinds(setter);

  const [rows, tabs] = await Promise.all([
    getDepartmentBudgets(user.id, year),
    visibleTabs(user, BUDGET_TABS),
  ]);

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={tabs} />
      <PageHeader
        title="Budget par département"
        description="Chaque département a son budget. Le fonctionnement (hors employés) est réglé par l'administrateur ; les employés et le recrutement, par les ressources humaines."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun département"
          description="Créez d'abord les départements depuis Ressources humaines › Départements — un budget se rattache à un département existant."
        />
      ) : (
        <DepartmentBudgetTable rows={rows} year={year} editable={editable} totals={totals(rows)} />
      )}
    </div>
  );
}
