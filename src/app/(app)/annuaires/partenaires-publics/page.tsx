import { requireModule } from "@/lib/session";
import { peutAnnuaire } from "@/lib/rbac";
import { chargerPartenaires } from "@/lib/queries/annuaires";
import { ContactsBoard } from "@/app/(app)/mon-espace/annuaire/contacts-board";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Partenaires publics — AMD Internal OS" };

/**
 * Onglet PARTENAIRES PUBLICS du module « Annuaires » (Direction, 06/10) : ministères, Pharmacie centrale, ANPP,
 * directions de la santé, CNAS, douanes… La même fiche et le même écran que les Partenaires — seule la sphère change.
 * Tout le monde lit ; les Moyens généraux écrivent, ou qui s'est vu ouvrir cet annuaire depuis la console.
 */
export default async function AnnuairePartenairesPublicsPage() {
  const user = await requireModule("DIRECTORIES");
  const partenaires = await chargerPartenaires(user, "PUBLIC");
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Les organismes publics avec qui l'entreprise traite — ministères, Pharmacie centrale, ANPP, directions de la santé, caisses, douanes — avec leurs coordonnées."
      />
      <ContactsBoard
        sphere="PUBLIC"
        contacts={partenaires.contacts}
        companies={partenaires.companies}
        canCreate={peutAnnuaire(user, "PARTENAIRES_PUBLICS", "CREATE")}
        canEdit={peutAnnuaire(user, "PARTENAIRES_PUBLICS", "UPDATE")}
        canDelete={peutAnnuaire(user, "PARTENAIRES_PUBLICS", "DELETE")}
      />
    </div>
  );
}
