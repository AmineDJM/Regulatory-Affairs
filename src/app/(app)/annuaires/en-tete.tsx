import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { ANNUAIRES_TABS } from "@/lib/labels";
import type { SessionUser } from "@/lib/rbac";

/**
 * L'EN-TÊTE DU MODULE « ANNUAIRES » — un titre, une phrase, et les onglets que la personne a le
 * droit de voir. Chaque onglet porte le module de son référentiel (`ANNUAIRES_TABS`) : c'est
 * `visibleTabs` qui tranche, pas cette page — un onglet Médecins montré à qui n'a pas la
 * Promotion médicale serait une fuite par le menu, même si la page derrière refusait.
 */
export async function EnTeteAnnuaires({ user, description }: { user: SessionUser; description: string }) {
  return (
    <>
      <PageHeader title="Annuaires" description={description} />
      <ModuleTabs tabs={await visibleTabs(user, ANNUAIRES_TABS)} />
    </>
  );
}

/** Le premier onglet que la personne peut ouvrir — là où mène l'entrée de menu. */
export async function premierOngletOuvert(user: SessionUser): Promise<string | null> {
  const tabs = await visibleTabs(user, ANNUAIRES_TABS);
  return tabs.find((t) => t.show)?.href ?? null;
}
