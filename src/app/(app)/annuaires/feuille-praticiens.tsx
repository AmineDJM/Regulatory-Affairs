import { notFound, redirect } from "next/navigation";
import { userCan, peutAnnuaire, annuaireOuvertParConsole, peutGererSpecialites, type SessionUser } from "@/lib/rbac";
import { chargerFeuillePraticiens, type FiltreGrade } from "@/lib/queries/annuaires";
import { AnnuaireGrid } from "@/app/(app)/medical/annuaire/annuaire-grid";
import { DirectoryBar } from "@/app/(app)/medical/annuaire/directory-bar";
import { EnTeteAnnuaires } from "./en-tete";
import { BarreSpecialites } from "./barre-specialites";

/**
 * LA FEUILLE DES PRATICIENS, VUE DU MODULE « ANNUAIRES » — médecins ou pharmaciens.
 *
 * Même chargeur, mêmes composants, même portée que l'onglet Annuaire de la Promotion médicale :
 * c'est une autre PORTE sur la même feuille, filtrée par grade. Un délégué y voit ses praticiens,
 * la direction tout ; un annuaire nommé fermé y reste fermé. La seule chose qui change est le
 * chemin des liens (`basePath`), pour que l'on reste dans le module d'où l'on vient.
 */
export async function FeuillePraticiensHub({
  user, grade, annuaire, specialite = null, archives = false,
}: {
  user: SessionUser;
  grade: Exclude<FiltreGrade, null>;
  annuaire: string | null;
  /** `?specialite=` — un annuaire par spécialité (médecins) : un identifiant ou `sans`. */
  specialite?: string | null;
  /** `?archives=1` — la vue des fiches archivées. */
  archives?: boolean;
}) {
  // LA PORTE est celle de l'ANNUAIRE (§118.147) : le module du référentiel (la Promotion
  // médicale), OU l'annuaire coché pour cette personne dans la console. L'onglet n'est rendu qu'à
  // qui passe l'une des deux, et son adresse tapée à la main refuse de la même façon.
  const cle = grade === "pharmaciens" ? "PHARMACIENS" : "MEDECINS";
  if (!peutAnnuaire(user, cle, "VIEW")) redirect("/dashboard?denied=MEDICAL");
  const canImport = peutAnnuaire(user, cle, "CREATE");
  const canEdit = peutAnnuaire(user, cle, "UPDATE");
  const canDelete = peutAnnuaire(user, cle, "DELETE");
  // LA STRUCTURE — annuaires nommés, leurs accès, leurs colonnes — reste la Promotion médicale :
  // ouvrir la modification des FICHES n'ouvre pas le droit de réorganiser le référentiel.
  const canManageStructure = userCan(user, "MEDICAL", "UPDATE");

  // MÉDECINS : PLUS D'ANNUAIRES NOMMÉS NI D'« ANNUAIRE GÉNÉRAL » (Direction, 06/10 : « enlève tous les praticiens et
  // trucs généraux, garde la rubrique des spécialités ») — la feuille se range par SPÉCIALITÉ, et c'est tout.
  const medecins = grade === "medecins";
  const gerer = {
    creer: peutGererSpecialites(user, "CREATE"),
    modifier: peutGererSpecialites(user, "UPDATE"),
    supprimer: peutGererSpecialites(user, "DELETE"),
  };
  const feuille = await chargerFeuillePraticiens(user, {
    annuaire: medecins ? null : annuaire, grade, canManage: canManageStructure,
    specialitesVides: medecins && (gerer.creer || gerer.modifier || gerer.supprimer),
    entier: annuaireOuvertParConsole(user, cle, "VIEW"),
    // L'annuaire par spécialité ne concerne que les médecins ; l'archivage, les deux grades.
    specialite: grade === "medecins" ? specialite : null,
    archives,
  });
  if (!feuille) notFound();

  const basePath = grade === "pharmaciens" ? "/annuaires/pharmaciens" : "/annuaires/medecins";
  const description = grade === "pharmaciens"
    ? "Les pharmaciens de l'annuaire — officines et pharmacies hospitalières — en feuille modifiable, avec les mêmes annuaires nommés que la Promotion médicale."
    : "Les médecins de l'annuaire — hospitaliers et libéraux — en feuille modifiable, exportable, avec vue par spécialité.";

  return (
    <div className="space-y-5">
      <EnTeteAnnuaires user={user} description={description} />
      {!medecins && (
        <DirectoryBar
          directories={feuille.directories}
          current={annuaire}
          companies={feuille.companies}
          generalCount={feuille.generalCount}
          canManage={canManageStructure}
          people={feuille.people}
          basePath={basePath}
        />
      )}
      <BarreSpecialites
        basePath={basePath} annuaire={medecins ? null : annuaire} gerer={medecins ? gerer : undefined}
        specialites={feuille.annuairesSpecialite} sansSpecialite={feuille.sansSpecialiteCount}
        ouverte={feuille.specialiteOuverte} archives={feuille.archives} archivesCount={feuille.archivesCount}
        avecSpecialites={grade === "medecins"}
      />
      <AnnuaireGrid
        archives={feuille.archives}
        rows={feuille.rows} etablissements={feuille.etablissements} couleurs={feuille.couleurs} customColumns={feuille.customColumns}
        canEdit={canEdit} canImport={canImport} canImportFile={userCan(user, "MEDICAL", "CREATE")} canDelete={canDelete} specialties={feuille.specialties}
        canManageColumns={canManageStructure}
        directoryId={feuille.openDirectoryId}
        directoryName={feuille.directoryName}
        titreParDefaut={grade === "pharmaciens" ? "PHARMACIEN" : undefined}
        exportHref={`/api/medical/annuaire/export?grade=${grade}`}
      />
    </div>
  );
}
