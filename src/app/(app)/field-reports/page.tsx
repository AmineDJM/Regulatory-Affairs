import { redirect } from "next/navigation";
import { CHEMIN_RAPPORTS_TERRAIN } from "@/lib/chemins/rapports-terrain";

/**
 * ANCIENNE ADRESSE des Rapports terrain — devenus l'onglet « Rapports » de la Promotion médicale
 * (Direction, 07/10). Les liens déjà envoyés (notifications, courriels) y arrivent encore.
 */
export default function AncienneListeRapports() {
  redirect(CHEMIN_RAPPORTS_TERRAIN);
}
