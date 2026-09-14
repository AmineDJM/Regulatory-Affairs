import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { INSTITUTION_TYPE, INSTITUTION_SECTOR, MEDICAL_TABS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { chargerEtablissements } from "@/lib/queries/annuaires";
import { EtablissementsTable } from "./etablissements-table";

export const dynamic = "force-dynamic";

/**
 * ÉTABLISSEMENTS — l'annuaire des hôpitaux, cliniques et cabinets.
 *
 * `MedicalInstitution` et ses trois écritures existaient depuis toujours ; leurs seuls
 * importeurs étaient `assistant.ts` et le catalogue d'ops — Adam savait s'en servir, AUCUN écran
 * ne le pouvait (§118.14). C'est cette porte-là.
 *
 * ── PORTÉE : LE RÉFÉRENTIEL N'EST PAS CLOISONNÉ, ET C'EST DÉJÀ TRANCHÉ ─────────────────────
 *
 * `MedicalInstitution` n'a AUCUNE fonction de portée dans `rbac.ts`, et les huit lecteurs du
 * dépôt l'interrogent sans clause (recherche globale, fabric d'entités, bénéficiaires de
 * congrès, `getMedicalData`). C'est un référentiel d'ÉTABLISSEMENTS, comme les spécialités : le
 * nom d'un CHU n'est pas une donnée confidentielle. En inventer une portée ICI donnerait une
 * troisième vérité qui divergerait des huit autres (§118.5, §118.85).
 *
 * Ce qui EST cloisonné, ce sont les PRATICIENS : le compte affiché par établissement se calcule
 * donc dans la portée de la personne (`scopeMedicalDoctors`) — dans le chargeur partagé avec le
 * module « Annuaires » (`lib/queries/annuaires.ts`), pour que les deux écrans comptent pareil.
 */
export default async function EtablissementsPage() {
  const user = await requireModule("MEDICAL");
  const canCreate = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");
  const canDelete = userCan(user, "MEDICAL", "DELETE");

  const feuille = await chargerEtablissements(user);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Établissements"
        description="CHU, EPH, EHS, cliniques, polycliniques, cabinets — le référentiel auquel se rattachent les praticiens et sur lequel se découpent les secteurs de la force de vente."
      />
      <ModuleTabs tabs={await visibleTabs(user, MEDICAL_TABS)} />
      <EtablissementsTable
        rows={feuille.rows}
        couleurs={feuille.couleurs}
        // Les libellés viennent du référentiel commun : les réécrire ici en ferait deux jeux de
        // mots pour un seul énuméré, qui divergent à la première retouche (§118.5).
        types={Object.entries(INSTITUTION_TYPE).map(([value, label]) => ({ value, label }))}
        sectors={Object.entries(INSTITUTION_SECTOR).map(([value, d]) => ({ value, label: d.label }))}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
