import type { SessionUser } from "@/lib/rbac";
import { BUSINESS_UNITS_TABS } from "@/lib/labels";
import { visibleTabs } from "@/lib/nav-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";

/**
 * L'EN-TÊTE DU MODULE « BUSINESS UNITS » (Direction, 08/10 : « tu crées dans le menu un module "Business Units" et tu y
 * mets BU et secteurs et paramètres ») — Business units, Secteurs, Paramètres. Ces écrans vivaient dans le « ⋯ Réglages »
 * de la Force de vente. Chaque page vérifie côté serveur, avant de rendre cet en-tête, qui peut les ouvrir.
 */
export async function EnteteBu({ user }: { user: SessionUser }) {
  const tabs = await visibleTabs(user, BUSINESS_UNITS_TABS);
  return (
    <div className="space-y-3">
      <PageHeader title="Business Units" />
      <ModuleTabs tabs={tabs} />
    </div>
  );
}
