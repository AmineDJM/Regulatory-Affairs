import { redirect } from "next/navigation";

/** « Spécialités » a quitté Force de vente pour le Marketing cockpit (06/10) : l'ancienne adresse y renvoie. */
export default function PlanningSpecialitesPage() {
  redirect("/marketing-cockpit/specialites");
}
