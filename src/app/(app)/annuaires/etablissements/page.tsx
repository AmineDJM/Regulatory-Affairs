import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { INSTITUTION_TYPE, INSTITUTION_SECTOR } from "@/lib/labels";
import { chargerEtablissements } from "@/lib/queries/annuaires";
import { EtablissementsTable } from "./etablissements-table";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Établissements — AMD Internal OS" };

/**
 * Onglet ÉTABLISSEMENTS du module « Annuaires » : le référentiel des hôpitaux, cliniques et
 * cabinets. C'est LE SEUL écran du référentiel depuis 09/2026 — l'onglet de la Promotion
 * médicale a été retiré à la demande de la Direction, et sa route redirige ici (§118.138).
 *
 * ── PORTÉE : LE RÉFÉRENTIEL N'EST PAS CLOISONNÉ, ET C'EST DÉJÀ TRANCHÉ ─────────────────────
 *
 * `MedicalInstitution` n'a AUCUNE fonction de portée dans `rbac.ts`, et les huit lecteurs du
 * dépôt l'interrogent sans clause (recherche globale, fabric d'entités, bénéficiaires de
 * congrès, `getMedicalData`). C'est un référentiel d'ÉTABLISSEMENTS, comme les spécialités : le
 * nom d'un CHU n'est pas une donnée confidentielle. En inventer une portée ICI donnerait une
 * neuvième vérité qui divergerait des huit autres (§118.5, §118.85).
 *
 * Ce qui EST cloisonné, ce sont les PRATICIENS : le compte affiché par établissement se calcule
 * donc dans la portée de la personne (`scopeMedicalDoctors`), dans le chargeur partagé.
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
