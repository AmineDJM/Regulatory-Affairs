import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getSfeConfig } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { PlanningTabs } from "../tabs";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await requireModule("SALES_PLANNING");
  const canEdit = userCan(user, "SALES_PLANNING", "UPDATE");
  const config = await getSfeConfig();

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Paramètres 100% configurables : capacité terrain, poids des positions et fréquences par palier de potentiel." />
      <PlanningTabs active="parametres" canConfigure={canEdit} />
      <SettingsForm config={config} canEdit={canEdit} />
    </div>
  );
}
