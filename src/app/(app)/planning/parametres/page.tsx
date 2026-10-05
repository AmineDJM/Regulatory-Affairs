import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getSfeConfig } from "@/lib/sfe";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";
import { PageHeader } from "@/components/shared/page-header";
import { PlanningTabs } from "../tabs";
import { SettingsForm } from "./settings-form";
import { TourPlanningForm } from "./tour-planning-form";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await requireModule("SALES_PLANNING");
  const canEdit = userCan(user, "SALES_PLANNING", "UPDATE");
  const [config, reglageTournee] = await Promise.all([getSfeConfig(), lireReglageTournee()]);

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Paramètres 100% configurables : capacité terrain, poids des positions, fréquences par palier de potentiel — et la maille des plans de tournée." />
      <PlanningTabs active="parametres" canConfigure={canEdit} />
      <SettingsForm config={config} canEdit={canEdit} />
      {/* LA MAILLE DE PLANIFICATION a une porte plus étroite que les autres paramètres : la demande
          la réserve au Super Admin. Elle se LIT par tous ceux qui voient l'écran — un KAM qui
          découvre une période trimestrielle doit pouvoir savoir d'où elle vient. */}
      <TourPlanningForm reglage={reglageTournee} canEdit={user.role === "SUPER_ADMIN"} />
    </div>
  );
}
