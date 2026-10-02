import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { chargerSpecialites } from "@/lib/queries/specialites";
import { EnTeteAnnuaires } from "../en-tete";
import { SpecialitesTable } from "./specialites-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Spécialités — AMD Internal OS" };

/**
 * Onglet SPÉCIALITÉS du module « Annuaires » : le référentiel auquel la spécialité d'un praticien
 * se RATTACHE (§118.180). Il existait en base, avec ses trois écritures, et AUCUN écran : on ne
 * pouvait ni ajouter « Néphrologie », ni corriger « Cardiolgie », ni réunir deux doublons — et la
 * feuille de l'annuaire écrivait donc du texte que rien ne reliait.
 *
 * La porte est celle de la Promotion médicale (le module du référentiel, comme les écritures
 * existantes) : un référentiel est une STRUCTURE de l'annuaire (§118.147), il ne s'ouvre pas par
 * la case « Médecins » de la console.
 */
export default async function AnnuaireSpecialitesPage() {
  const user = await requireModule("DIRECTORIES");
  if (!userCan(user, "MEDICAL", "VIEW")) redirect("/dashboard?denied=MEDICAL");
  const donnees = await chargerSpecialites(user);
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Le référentiel des spécialités médicales : la spécialité d'un praticien s'y rattache, et c'est elle que lisent l'annuaire, les demandes Ad & Pro et, demain, les cibles des Business Units."
      />
      <SpecialitesTable
        specialites={donnees.specialites}
        heritees={donnees.heritees}
        heriteesTotal={donnees.heriteesTotal}
        canCreate={userCan(user, "MEDICAL", "CREATE")}
        canEdit={userCan(user, "MEDICAL", "UPDATE")}
        canDelete={userCan(user, "MEDICAL", "DELETE")}
      />
    </div>
  );
}
