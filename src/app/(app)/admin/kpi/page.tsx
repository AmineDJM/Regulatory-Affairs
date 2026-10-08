import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { ADMIN_TABS, ROLE_LABELS } from "@/lib/labels";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CatalogueKpi } from "./catalogue";

export const dynamic = "force-dynamic";
export const metadata = { title: "KPI & modèles — AMD Internal OS" };

/**
 * LE CATALOGUE DES KPI ET LES MODÈLES PAR RÔLE (KPI sans code, Direction 08/10) — Super Admin seul. Un modèle de rôle
 * est un jeu de KPI pondérés qui s'applique à tous ceux qui ont ce rôle (le modèle KAM est posé par la migration, et se
 * modifie ici). Chaque manager ajoute ensuite, depuis Mon équipe, les KPI de son équipe.
 */
export default async function AdminKpiPage() {
  const user = await requireModule("ADMIN");
  const onglets = <ModuleTabs tabs={ADMIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />;
  if (user.role !== "SUPER_ADMIN") {
    return (
      <div className="space-y-5">
        <PageHeader title="KPI & modèles" />
        {onglets}
        <EmptyState icon="Lock" title="Réservé au Super Admin" description="Le catalogue des KPI et les modèles par rôle sont tenus par le Super Admin." />
      </div>
    );
  }
  const roles = Object.entries(ROLE_LABELS).map(([cle, libelle]) => ({ cle, libelle }));
  return (
    <div className="space-y-5">
      <PageHeader title="KPI & modèles" description="Le catalogue des KPI et les modèles par rôle." />
      {onglets}
      <CatalogueKpi roles={roles} />
    </div>
  );
}
