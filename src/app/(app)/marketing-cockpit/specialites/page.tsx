import { redirect } from "next/navigation";

/** « Spécialités » a quitté le Marketing cockpit pour les Annuaires (Direction, 07/10) : l'ancienne adresse y mène. */
export default function MarketingSpecialitesPage() {
  redirect("/annuaires/specialites");
}
