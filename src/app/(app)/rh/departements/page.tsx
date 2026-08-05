import Link from "next/link";
import { ArrowLeft, Building2, Network } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDepartmentTree, flattenTree } from "@/lib/departments";
import { getCompanies, getCompanyScope, companyLabel } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { DepartmentsManager } from "./departments-manager";

export const metadata = { title: "Départements — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requireModule("RH");
  const canManage = userCan(user, "RH", "UPDATE");

  // Périmètre d'ENTITÉ actif (sélecteur de la barre supérieure) : chaque société a ses
  // propres départements ; « toutes les entités » donne la vue groupe.
  const companyScope = getCompanyScope();
  const [companies, tree, employees, unassigned] = await Promise.all([
    getCompanies(),
    getDepartmentTree(companyScope),
    prisma.employee.findMany({
      where: { isActive: true, ...(companyScope ? { companyId: companyScope } : {}) },
      select: { id: true, fullName: true, position: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true, departmentId: null, ...(companyScope ? { companyId: companyScope } : {}) },
      select: { id: true, fullName: true, position: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const scopedCompany = companyScope ? companies.find((c) => c.id === companyScope) ?? null : null;

  const flat = flattenTree(tree);
  const totalAffected = tree.reduce((a, d) => a + d.totalMembers, 0);
  const maxDepth = flat.reduce((a, o) => Math.max(a, o.depth), 0) + (flat.length ? 1 : 0);

  return (
    <div className="space-y-5">
      <Link href="/rh" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Ressources humaines
      </Link>
      <PageHeader
        title="Départements"
        description={
          scopedCompany
            ? `Structure de ${companyLabel(scopedCompany)} : départements et sous-départements sur autant de niveaux que nécessaire. Chaque département a un responsable — c'est lui qui incarne le N+1 des personnes rattachées.`
            : "Structure du groupe (toutes entités) : départements et sous-départements sur autant de niveaux que nécessaire. Chaque département a un responsable — c'est lui qui incarne le N+1 des personnes rattachées. Choisissez une entité dans la barre du haut pour ne voir que la sienne."
        }
      >
        <Link href="/admin/organigramme"><Button variant="outline"><Network className="h-4 w-4" /> Organigramme</Button></Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Départements" value={flat.length} icon="Building2" />
        <KpiCard label="Niveaux" value={maxDepth} icon="Network" hint="profondeur de la structure" />
        <KpiCard label="Personnes rattachées" value={totalAffected} icon="Users" tone="success" />
        <KpiCard label="Non affectées" value={unassigned.length} icon="UserMinus" tone={unassigned.length > 0 ? "warning" : "default"} />
      </div>

      {flat.length === 0 && (
        <div className="surface flex items-start gap-3 p-4 text-sm">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Aucun département pour l&apos;instant. Créez vos départements de tête (ex. Direction, Commercial,
            Regulatory), puis leurs sous-départements. Rattachez ensuite chaque employé depuis sa fiche RH
            ou depuis la liste « non affectées » ci-dessous.
          </p>
        </div>
      )}

      <DepartmentsManager
        tree={tree} options={flat} employees={employees} unassigned={unassigned} canManage={canManage}
        companies={companies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
        companyScope={companyScope}
      />
    </div>
  );
}
