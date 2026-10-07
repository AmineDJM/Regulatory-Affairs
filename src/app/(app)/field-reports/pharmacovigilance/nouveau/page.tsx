import { redirect } from "next/navigation";
import { lienSignalerPv } from "@/lib/chemins/rapports-terrain";

/** ANCIENNE ADRESSE du formulaire de signalement de pharmacovigilance. */
export default function AncienSignalementPv() {
  redirect(lienSignalerPv());
}
