import { redirect } from "next/navigation";
import { CHEMIN_PV_KAM } from "@/lib/chemins/rapports-terrain";

/** ANCIENNE ADRESSE des signalements de pharmacovigilance du KAM. */
export default function AnciensSignalementsPv() {
  redirect(CHEMIN_PV_KAM);
}
