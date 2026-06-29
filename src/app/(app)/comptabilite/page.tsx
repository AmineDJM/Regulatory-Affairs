import { redirect } from "next/navigation";

/**
 * L'espace comptable est désormais fusionné dans le module Finances (cockpit DAF
 * unifié). On redirige les anciens liens vers /finances.
 */
export default function ComptabiliteRedirect() {
  redirect("/finances");
}
