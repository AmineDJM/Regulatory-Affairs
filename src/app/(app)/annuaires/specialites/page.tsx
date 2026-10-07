import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { peutGererSpecialites } from "@/lib/rbac";
import { EcranSpecialites } from "@/components/directory/ecran-specialites";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Spécialités — AMD Internal OS" };

/**
 * Onglet SPÉCIALITÉS des ANNUAIRES — la porte UNIQUE du référentiel (Direction, 07/10 : « Spécialités → Annuaires »).
 * Les anciennes adresses (Marketing cockpit › Spécialités, Force de vente › Spécialités) y mènent.
 *
 * La porte est la règle du référentiel, `peutGererSpecialites` — la Promotion médicale, les deux directeurs des
 * opérations, la Direction Marketing —, et non une case d'annuaire : la Direction Marketing garde la gestion qu'elle
 * avait depuis le cockpit (§118.209). L'écran est le composant partagé (`EcranSpecialites`), qui revérifie la règle.
 */
export default async function AnnuaireSpecialitesPage() {
  const user = await requireUser();
  if (!peutGererSpecialites(user, "VIEW")) redirect("/dashboard?denied=MEDICAL");
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Le référentiel des spécialités médicales : celles que les Business Units visent et que la fiche d'un praticien porte."
      />
      <EcranSpecialites user={user} />
    </div>
  );
}
