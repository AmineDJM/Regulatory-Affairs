import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { INSTITUTION_TYPE, INSTITUTION_SECTOR } from "@/lib/labels";
import { chargerEtablissements } from "@/lib/queries/annuaires";
import { EtablissementsTable } from "@/app/(app)/medical/etablissements/etablissements-table";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Établissements — AMD Internal OS" };

/**
 * Onglet ÉTABLISSEMENTS du module « Annuaires » : le référentiel des hôpitaux, cliniques et
 * cabinets — le même chargeur et la même feuille que l'onglet de la Promotion médicale.
 */
export default async function AnnuaireEtablissementsPage() {
  const user = await requireModule("DIRECTORIES");
  if (!userCan(user, "MEDICAL", "VIEW")) redirect("/dashboard?denied=MEDICAL");
  const feuille = await chargerEtablissements(user);
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="CHU, EPH, EHS, cliniques, polycliniques, cabinets — le référentiel auquel se rattachent les praticiens et sur lequel se découpent les secteurs de la force de vente."
      />
      <EtablissementsTable
        rows={feuille.rows}
        couleurs={feuille.couleurs}
        types={Object.entries(INSTITUTION_TYPE).map(([value, label]) => ({ value, label }))}
        sectors={Object.entries(INSTITUTION_SECTOR).map(([value, d]) => ({ value, label: d.label }))}
        canCreate={userCan(user, "MEDICAL", "CREATE")}
        canEdit={userCan(user, "MEDICAL", "UPDATE")}
        canDelete={userCan(user, "MEDICAL", "DELETE")}
      />
    </div>
  );
}
