import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { peutGererSpecialites } from "@/lib/rbac";
import { resolveRepScope } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { EcranSpecialites } from "@/components/directory/ecran-specialites";
import { PlanningTabs } from "../tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Force de vente — Spécialités — AMD Internal OS" };

/**
 * Onglet SPÉCIALITÉS de la FORCE DE VENTE (§118.209). Décision de la Direction (05/10) : « donne la
 * gestion des spécialités, dans Force de vente, dans un onglet à part au marketing — ils peuvent
 * ajouter, supprimer, modifier ».
 *
 * C'est le MÊME écran que Annuaires › Spécialités (`EcranSpecialites` : même chargeur, mêmes
 * actions, même règle) — pas une seconde implémentation. La porte est celle de la force de vente
 * (le module qui monte l'onglet), PUIS `peutGererSpecialites` : la Direction Marketing n'a de la
 * Force de vente que la lecture, et le droit de gérer le référentiel lui est donné par cette règle
 * précise, pas en élargissant le module — qui lui ouvrirait les Business Units, les affectations
 * et les paramètres de la force de vente (§118.16).
 */
export default async function PlanningSpecialitesPage() {
  const user = await requireModule("SALES_PLANNING");
  if (!peutGererSpecialites(user, "VIEW")) redirect("/dashboard?denied=SALES_PLANNING");
  const scope = await resolveRepScope(user);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Spécialités"
        description="Le référentiel des spécialités médicales : celles que les Business Units visent et que la fiche d'un praticien porte. Ajouter, renommer, fusionner deux doublons, retirer — le même écran que Annuaires › Spécialités."
      />
      <PlanningTabs active="specialites" canConfigure={scope.canConfigure} isSupervisor={scope.isSupervisor} specialites />
      <EcranSpecialites user={user} />
    </div>
  );
}
