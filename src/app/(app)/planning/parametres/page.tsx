import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { getSfeConfig } from "@/lib/sfe";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";
import { EnteteReglages } from "../reglages";
import { SettingsForm } from "./settings-form";
import { TourPlanningForm } from "./tour-planning-form";

export const dynamic = "force-dynamic";

/**
 * « ⋯ › Réglages › Paramètres » — capacité terrain, poids des positions, fréquences de REPLI par palier (pour les seuls
 * praticiens rangés dans aucune stratégie de segmentation), et la maille des plans de tournée. Réservé à qui configure la
 * force de vente : la page le vérifie ici, pas seulement le menu.
 */
export default async function ParametresPage() {
  const user = await requireModule("SALES_PLANNING");
  const canEdit = userCan(user, "SALES_PLANNING", "UPDATE");
  if (!canEdit && !hasGlobalView(user)) redirect("/planning");
  const [config, reglageTournee] = await Promise.all([getSfeConfig(), lireReglageTournee()]);

  return (
    <div className="space-y-5">
      <EnteteReglages actif="parametres" />
      <SettingsForm config={config} canEdit={canEdit} />
      {/* LA MAILLE DE PLANIFICATION a une porte plus étroite que les autres paramètres : la demande la réserve au Super
          Admin. Elle se LIT par tous ceux qui voient l'écran. */}
      <TourPlanningForm reglage={reglageTournee} canEdit={user.role === "SUPER_ADMIN"} />
    </div>
  );
}
