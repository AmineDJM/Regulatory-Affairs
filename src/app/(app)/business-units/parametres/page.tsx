import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getSfeConfig } from "@/lib/sfe";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";
import { EnteteBu } from "../entete";
import { SettingsForm } from "./settings-form";
import { TourPlanningForm } from "./tour-planning-form";

export const dynamic = "force-dynamic";

/**
 * BUSINESS UNITS › Paramètres (Direction, 08/10 ; avant : « ⋯ › Réglages › Paramètres » de la Force de vente) — capacité
 * terrain, poids des positions, fréquences de REPLI par palier (pour les seuls praticiens rangés dans aucune stratégie de
 * segmentation), et la maille des plans de tournée. Le module ouvre l'écran ; le droit de MODIFIER le module (celui que
 * l'action serveur relit) décide de ce qu'on peut y écrire — la page le vérifie ici, pas seulement le menu.
 */
export default async function ParametresPage() {
  const user = await requireModule("BUSINESS_UNITS");
  const canEdit = userCan(user, "BUSINESS_UNITS", "UPDATE");
  const [config, reglageTournee] = await Promise.all([getSfeConfig(), lireReglageTournee()]);

  return (
    <div className="space-y-5">
      <EnteteBu user={user} />
      <SettingsForm config={config} canEdit={canEdit} />
      {/* LA MAILLE DE PLANIFICATION a une porte plus étroite que les autres paramètres : la demande la réserve au Super
          Admin. Elle se LIT par tous ceux qui voient l'écran. */}
      <TourPlanningForm reglage={reglageTournee} canEdit={user.role === "SUPER_ADMIN"} />
    </div>
  );
}
