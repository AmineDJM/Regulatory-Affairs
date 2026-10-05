import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { MARKETING_COCKPIT_TABS } from "@/lib/labels";
import type { SessionUser } from "@/lib/rbac";

/**
 * L'EN-TÊTE DU « MARKETING COCKPIT » — un titre, une phrase, et les onglets que la personne a le
 * droit de voir (`visibleTabs` tranche, pas cette page : « Spécialités » suit la règle
 * `peutGererSpecialites`, « Messages » le module Force de vente).
 */
export async function EnTeteMarketingCockpit({ user, title, description }: { user: SessionUser; title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <ModuleTabs tabs={await visibleTabs(user, MARKETING_COCKPIT_TABS)} />
    </>
  );
}
