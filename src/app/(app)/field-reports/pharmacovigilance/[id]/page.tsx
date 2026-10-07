import { redirect } from "next/navigation";
import { lienCasPvKam } from "@/lib/chemins/rapports-terrain";

/** ANCIENNE ADRESSE de la fiche d'un cas, côté KAM — les notifications déjà envoyées la portent. */
export default function AncienneFicheCasPv({ params }: { params: { id: string } }) {
  redirect(lienCasPvKam(params.id));
}
