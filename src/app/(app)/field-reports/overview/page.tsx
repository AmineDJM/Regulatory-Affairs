import { redirect } from "next/navigation";
import { CHEMIN_APERCU_RAPPORTS } from "@/lib/chemins/rapports-terrain";

/** ANCIENNE ADRESSE de l'analyse des rapports terrain. */
export default function AncienApercuRapports() {
  redirect(CHEMIN_APERCU_RAPPORTS);
}
