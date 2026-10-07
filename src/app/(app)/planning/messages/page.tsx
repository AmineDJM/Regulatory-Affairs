import { redirect } from "next/navigation";

/** « Messages » est une vue du Marketing cockpit (07/10) : l'ancienne adresse de la Force de vente y renvoie. */
export default function PlanningMessagesPage() {
  redirect("/marketing-cockpit?vue=messages");
}
