import { notFound, redirect } from "next/navigation";
import { userCan, type SessionUser } from "@/lib/rbac";
import { chargerFeuillePraticiens, type FiltreGrade } from "@/lib/queries/annuaires";
import { AnnuaireGrid } from "@/app/(app)/medical/annuaire/annuaire-grid";
import { DirectoryBar } from "@/app/(app)/medical/annuaire/directory-bar";
import { EnTeteAnnuaires } from "./en-tete";

/**
 * LA FEUILLE DES PRATICIENS, VUE DU MODULE « ANNUAIRES » — médecins ou pharmaciens.
 *
 * Même chargeur, mêmes composants, même portée que l'onglet Annuaire de la Promotion médicale :
 * c'est une autre PORTE sur la même feuille, filtrée par grade. Un délégué y voit ses praticiens,
 * la direction tout ; un annuaire nommé fermé y reste fermé. La seule chose qui change est le
 * chemin des liens (`basePath`), pour que l'on reste dans le module d'où l'on vient.
 */
export async function FeuillePraticiensHub({
  user, grade, annuaire,
}: {
  user: SessionUser;
  grade: Exclude<FiltreGrade, null>;
  annuaire: string | null;
}) {
  // La PORTE est le module du référentiel, pas celle d'« Annuaires » : l'onglet n'est rendu qu'à
  // qui a la Promotion médicale, et son adresse tapée à la main refuse de la même façon.
  if (!userCan(user, "MEDICAL", "VIEW")) redirect("/dashboard?denied=MEDICAL");
  const canImport = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");
  const canDelete = userCan(user, "MEDICAL", "DELETE");

  const feuille = await chargerFeuillePraticiens(user, { annuaire, grade, canManage: canEdit });
  if (!feuille) notFound();

  const basePath = grade === "pharmaciens" ? "/annuaires/pharmaciens" : "/annuaires/medecins";
  const description = grade === "pharmaciens"
    ? "Les pharmaciens de l'annuaire — officines et pharmacies hospitalières — en feuille modifiable, avec les mêmes annuaires nommés que la Promotion médicale."
    : "Les médecins de l'annuaire — hospitaliers et libéraux — en feuille modifiable, exportable, avec vue par spécialité.";

  return (
    <div className="space-y-5">
      <EnTeteAnnuaires user={user} description={description} />
      <DirectoryBar
        directories={feuille.directories}
        current={annuaire}
        companies={feuille.companies}
        generalCount={feuille.generalCount}
        canManage={canEdit}
        people={feuille.people}
        basePath={basePath}
      />
      <AnnuaireGrid
        rows={feuille.rows} couleurs={feuille.couleurs} customColumns={feuille.customColumns}
        canEdit={canEdit} canImport={canImport} canDelete={canDelete} specialties={feuille.specialties}
        directoryId={feuille.openDirectoryId}
        directoryName={feuille.directoryName}
        titreParDefaut={grade === "pharmaciens" ? "PHARMACIEN" : undefined}
        exportHref={`/api/medical/annuaire/export?grade=${grade}`}
      />
    </div>
  );
}
