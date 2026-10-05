import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { peutGererSpecialites } from "@/lib/rbac";
import { EcranSpecialites } from "@/components/directory/ecran-specialites";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Spécialités — AMD Internal OS" };

/**
 * Onglet SPÉCIALITÉS du module « Annuaires » : le référentiel auquel la spécialité d'un praticien
 * se RATTACHE (§118.180). Il existait en base, avec ses trois écritures, et AUCUN écran : on ne
 * pouvait ni ajouter « Néphrologie », ni corriger « Cardiolgie », ni réunir deux doublons — et la
 * feuille de l'annuaire écrivait donc du texte que rien ne reliait.
 *
 * La porte est `peutGererSpecialites` — la Promotion médicale, les deux directeurs des opérations
 * (décision du 04/10) ET la Direction Marketing (05/10) —, la même que l'onglet et les actions : un
 * référentiel est une STRUCTURE de l'annuaire (§118.147), il ne s'ouvre pas par la case « Médecins »
 * de la console. L'écran lui-même (`EcranSpecialites`) est partagé avec Marketing cockpit › Spécialités.
 */
export default async function AnnuaireSpecialitesPage() {
  const user = await requireModule("DIRECTORIES");
  if (!peutGererSpecialites(user, "VIEW")) redirect("/dashboard?denied=MEDICAL");
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Le référentiel des spécialités médicales : la spécialité d'un praticien s'y rattache, et c'est elle que lisent l'annuaire, les demandes Ad & Pro et, demain, les cibles des Business Units."
      />
      <EcranSpecialites user={user} />
    </div>
  );
}
