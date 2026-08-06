import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDepartmentBudgets, getGeneralBudgetAccess, hasAnyDepartmentBudgetGrant } from "@/lib/queries/department-budget";
import { normalizeYear, totals, canManageDepartmentBudgetAccess } from "@/lib/department-budget";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { BUDGET_TABS } from "@/lib/labels";
import { DepartmentBudgetTable } from "./department-budget-table";

export const dynamic = "force-dynamic";

/**
 * BUDGET PAR DÉPARTEMENT — un tableau, deux responsables, des accès réglables.
 *
 * Le même écran porte les deux colonnes, mais chacune n'est modifiable que par qui de droit :
 * l'administrateur règle le fonctionnement, les ressources humaines règlent les employés. Les
 * mettre côte à côte est délibéré — c'est la seule façon de voir ce que coûte réellement un
 * département ; les rendre modifiables séparément l'est tout autant.
 *
 * Au-dessus de ce socle, le **Super Admin** ouvre nommément : « le responsable du Commercial
 * règle le fonctionnement DE SON département ». C'est la porte d'entrée de l'écran, et non
 * `requireModule("BUDGETS")` — sinon une personne autorisée sur un département mais sans le
 * module serait refoulée à l'entrée, et son autorisation ne servirait à rien.
 */
export default async function DepartmentBudgetsPage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireUser();
  const year = normalizeYear(searchParams.year);

  const canViewBudgetsModule = userCan(user, "BUDGETS", "VIEW");
  const subject = { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null };
  if (!canViewBudgetsModule && !(await hasAnyDepartmentBudgetGrant(subject))) notFound();

  const rights = {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(user, "BUDGETS", "UPDATE") || userCan(user, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(user, "RH", "UPDATE"),
  };
  const canManageAccess = canManageDepartmentBudgetAccess(rights);

  const [rows, tabs, generalGrant, users] = await Promise.all([
    getDepartmentBudgets(subject, rights, canViewBudgetsModule, year),
    visibleTabs(user, BUDGET_TABS),
    canManageAccess ? getGeneralBudgetAccess() : Promise.resolve(null),
    // La liste des comptes ne part au navigateur QUE pour qui règle les accès.
    canManageAccess
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={tabs} />
      <PageHeader
        title="Budget par département"
        description="Chaque département a son budget. Le fonctionnement (hors employés) est réglé par l'administrateur ; les employés et le recrutement, par les ressources humaines. Le Super Admin peut ouvrir l'accès à d'autres personnes, département par département."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun département"
          description="Créez d'abord les départements depuis Ressources humaines › Départements — un budget se rattache à un département existant."
        />
      ) : (
        <DepartmentBudgetTable
          rows={rows}
          year={year}
          totals={totals(rows)}
          canManageAccess={canManageAccess}
          generalGrant={generalGrant}
          users={users}
        />
      )}
    </div>
  );
}
