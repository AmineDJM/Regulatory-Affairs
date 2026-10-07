import { redirect } from "next/navigation";

/** « Spécialités » vit dans les Annuaires (Direction, 07/10) : l'ancienne adresse de la Force de vente y renvoie. */
export default function PlanningSpecialitesPage() {
  redirect("/annuaires/specialites");
}
