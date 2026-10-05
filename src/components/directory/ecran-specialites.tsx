import { redirect } from "next/navigation";
import { peutGererSpecialites, type SessionUser } from "@/lib/rbac";
import { chargerSpecialites } from "@/lib/queries/specialites";
import { SpecialitesTable } from "./specialites-table";

/**
 * L'ÉCRAN DU RÉFÉRENTIEL DES SPÉCIALITÉS — UN SEUL, monté par deux portes (§118.209).
 *
 * Annuaires › Spécialités (§118.180) et Force de vente › Spécialités (décision de la Direction,
 * 05/10 : la Direction Marketing gère les spécialités depuis la force de vente) rendent CE composant,
 * qui lit le MÊME chargeur et la MÊME règle (`peutGererSpecialites`) : deux écrans qui chargent ou
 * décident séparément divergent, toujours (§118.5) — l'un montrerait un bouton que l'action refuse.
 *
 * Il refuse AVANT de charger quoi que ce soit quand la personne n'a pas le droit de lecture (le menu
 * n'est pas la garde) ; chaque bouton suit son geste.
 */
export async function EcranSpecialites({ user }: { user: SessionUser }) {
  if (!peutGererSpecialites(user, "VIEW")) redirect("/dashboard?denied=MEDICAL");
  const donnees = await chargerSpecialites(user);
  return (
    <SpecialitesTable
      specialites={donnees.specialites}
      heritees={donnees.heritees}
      heriteesTotal={donnees.heriteesTotal}
      canCreate={peutGererSpecialites(user, "CREATE")}
      canEdit={peutGererSpecialites(user, "UPDATE")}
      canDelete={peutGererSpecialites(user, "DELETE")}
    />
  );
}
