import Link from "next/link";
import { Network } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDepartmentTree, flattenTree } from "@/lib/departments";
import { getMyCompanies, myCompanyScope, platformScope, companyLabel } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { MenuDossier } from "@/components/shared/menu-dossier";
import { DepartmentsManager } from "./departments-manager";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { EMPLOYES_TABS } from "@/lib/labels";

export const metadata = { title: "Départements — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requireModule("EMPLOYEES");
  const canManage = userCan(user, "EMPLOYEES", "UPDATE");
  // LES ONGLETS DU SOUS-MODULE « EMPLOYÉS » (Direction, 06/10) : équipe, consultants, départements.
  const tabs = await visibleTabs(user, EMPLOYES_TABS);

  // Périmètre d'ENTITÉ actif (sélecteur de la barre supérieure) : chaque société a ses
  // propres départements ; « toutes les entités » donne la vue de SES entités.
  //
  // LA PORTÉE EST VALIDÉE (§118.177). Elle lisait le cookie tel quel : y écrire l'identifiant d'une
  // autre société montrait ses départements et ses salariés, et SANS cookie un salarié mono-entité
  // voyait ceux de tout le groupe. C'est le défaut que `myCompanyScope` ferme ailleurs — « le
  // cookie est une demande, jamais une autorisation ». Les salariés passent par `platformScope`,
  // le filtre de la liste RH (`getRhData`) : deux écrans du même module ne doivent pas répondre
  // différemment à « quels salariés vois-je ? ».
  const [companyScope, companies, entite] = await Promise.all([
    myCompanyScope(user.id), getMyCompanies(user.id), platformScope(user.id),
  ]);
  // On n'enferme personne par omission : sans entité ouverte, la structure reste celle du groupe.
  const parmi = companies.length > 0 ? companies.map((c) => c.id) : null;
  const [tree, employees, unassigned] = await Promise.all([
    getDepartmentTree(companyScope, parmi),
    prisma.employee.findMany({
      where: { AND: [{ isActive: true }, entite] },
      select: { id: true, fullName: true, position: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.employee.findMany({
      where: { AND: [{ isActive: true, departmentId: null }, entite] },
      select: { id: true, fullName: true, position: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const scopedCompany = companyScope ? companies.find((c) => c.id === companyScope) ?? null : null;

  const flat = flattenTree(tree);
  const totalAffected = tree.reduce((a, d) => a + d.totalMembers, 0);

  // UNE LIGNE DE RÉSUMÉ au lieu de quatre chiffres et d'un paragraphe (maquette « Employés », Direction 07/10).
  const resume = [
    scopedCompany ? companyLabel(scopedCompany) : "Toutes les entités",
    `${flat.length} département${flat.length > 1 ? "s" : ""}`,
    `${totalAffected} personne${totalAffected > 1 ? "s" : ""} rattachée${totalAffected > 1 ? "s" : ""}`,
    unassigned.length > 0 ? `${unassigned.length} non affectée${unassigned.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <DepartmentsManager
      resume={resume}
      onglets={<ModuleTabs tabs={tabs} />}
      // Les gestes secondaires, rangés dans « ⋯ » : le geste principal (« Nouveau département ») reste visible.
      menu={
        <MenuDossier>
          <Link href="/admin/organigramme" role="menuitem">
            <Button variant="ghost" className="w-full justify-start"><Network className="h-4 w-4" /> Organigramme</Button>
          </Link>
        </MenuDossier>
      }
      tree={tree} options={flat} employees={employees} unassigned={unassigned} canManage={canManage}
      companies={companies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
      companyScope={companyScope}
    />
  );
}
