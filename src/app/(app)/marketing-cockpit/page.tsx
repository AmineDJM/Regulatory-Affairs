import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** L'adresse racine du Marketing cockpit n'a pas d'écran propre : elle mène au premier onglet, « Messages ». */
export default function MarketingCockpitPage() {
  redirect("/marketing-cockpit/messages");
}
