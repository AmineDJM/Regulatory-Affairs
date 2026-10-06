import { redirect } from "next/navigation";

/**
 * LES SPÉCIALITÉS ONT UNE PORTE D'ENTRÉE UNIQUE (Direction, 06/10) : Marketing cockpit › Spécialités. L'ancienne
 * adresse des Annuaires y mène, pour qu'un lien gardé ne tombe pas sur un écran disparu.
 */
export default function AnnuaireSpecialitesPage() {
  redirect("/marketing-cockpit/specialites");
}
