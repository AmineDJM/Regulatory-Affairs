import { redirect } from "next/navigation";

/** « Messages » a quitté Force de vente pour le Marketing cockpit (06/10) : l'ancienne adresse y renvoie. */
export default function PlanningMessagesPage() {
  redirect("/marketing-cockpit/messages");
}
