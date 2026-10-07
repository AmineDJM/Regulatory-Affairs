import { redirect } from "next/navigation";
import { lienRapportTerrain } from "@/lib/chemins/rapports-terrain";

/** ANCIENNE ADRESSE de la fiche d'un rapport terrain — même fiche, sous Promotion médicale › Rapports. */
export default function AncienneFicheRapport({ params }: { params: { id: string } }) {
  redirect(lienRapportTerrain(params.id));
}
