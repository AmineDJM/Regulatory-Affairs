import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { WORKSPACE_TABS } from "@/lib/labels";
import { chargerPartenaires, chargerPersonnes } from "@/lib/queries/annuaires";
import { ContactsBoard } from "./contacts-board";
import { PeopleDirectory } from "./people-directory";
import { canEditDirectory } from "@/lib/directory/access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaire de l'entreprise — AMD Internal OS" };

/**
 * L'ANNUAIRE DE L'ENTREPRISE — tout ce qui n'est ni un praticien, ni un salarié.
 *
 * Agence de voyage, livreur, transitaire, imprimeur, agence marketing, hôtel, traiteur. Ces
 * numéros vivent dans les téléphones de trois personnes : le jour où celle qui connaît
 * l'imprimeur est en congé, on le cherche sur Internet et on rappelle un prestataire qu'on avait
 * quitté — au prix qu'on avait quitté.
 *
 * ── POURQUOI IL A QUITTÉ LES MOYENS GÉNÉRAUX ──────────────────────────────────────────────
 *
 * C'est un CARNET D'ADRESSES, pas un outil de caisse. Le ranger derrière le module de ceux qui
 * achètent et décaissent revenait à le fermer à tous ceux qui le cherchent — le délégué qui doit
 * joindre le transitaire, l'assistante qui prépare un déplacement, le juriste qui saisit une
 * partie au contrat. Il est donc un ONGLET DE « MON ESPACE » : chacun le LIT.
 *
 * L'ÉCRITURE, elle, n'a pas bougé d'un pouce — elle demande toujours le droit des Moyens
 * généraux. Un annuaire que chacun corrige devient un annuaire dont personne ne se sert.
 *
 * LA LECTURE VIT DANS `lib/queries/annuaires.ts`, partagée avec les onglets Partenaires et
 * Personnes du module « Annuaires » (pôle Administration) : même chargeur, mêmes composants.
 */
export default async function CompanyContactsPage() {
  // LIRE : l'espace de travail, c'est-à-dire tout le monde. ÉCRIRE : les Moyens généraux.
  const user = await requireModule("WORKSPACE");
  const canCreate = userCan(user, "GENERAL_MEANS", "CREATE");
  const canEdit = userCan(user, "GENERAL_MEANS", "UPDATE");
  const canDelete = userCan(user, "GENERAL_MEANS", "DELETE");

  const [tabs, partenaires, people] = await Promise.all([
    visibleTabs(user, WORKSPACE_TABS),
    chargerPartenaires(user),
    chargerPersonnes(),
  ]);

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={tabs} />
      <PageHeader
        title="Annuaire de l'entreprise"
        description="Agence de voyage, livreur, transitaire, imprimeur, agence marketing, hôtel, traiteur — les contacts externes de la société, regroupés par métier. Cherchez par métier, par nom, ou par un fragment de numéro ; chaque coordonnée se copie d'un clic."
      />
      <PeopleDirectory people={people} canEdit={canEditDirectory(user)} />
      <ContactsBoard
        contacts={partenaires.contacts}
        companies={partenaires.companies}
        canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  );
}
