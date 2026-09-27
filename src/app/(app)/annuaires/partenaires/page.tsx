import { requireModule } from "@/lib/session";
import { peutAnnuaire } from "@/lib/rbac";
import { chargerPartenaires } from "@/lib/queries/annuaires";
import { ContactsBoard } from "@/app/(app)/mon-espace/annuaire/contacts-board";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Partenaires — AMD Internal OS" };

/**
 * Onglet PARTENAIRES du module « Annuaires » : les contacts externes de la société — agence de
 * voyage, livreur, transitaire, imprimeur, traiteur. Tout le monde LIT (c'est un carnet
 * d'adresses) ; l'écriture reste celle des Moyens généraux, comme dans « Mon espace » — ou de qui
 * s'est vu ouvrir cet annuaire en écriture depuis la console (§118.147).
 */
export default async function AnnuairePartenairesPage() {
  const user = await requireModule("DIRECTORIES");
  const partenaires = await chargerPartenaires(user);
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Les partenaires et prestataires de la société — regroupés par métier, avec leurs coordonnées et identifiants utiles à un dossier de paiement."
      />
      <ContactsBoard
        contacts={partenaires.contacts}
        companies={partenaires.companies}
        canCreate={peutAnnuaire(user, "PARTENAIRES", "CREATE")}
        canEdit={peutAnnuaire(user, "PARTENAIRES", "UPDATE")}
        canDelete={peutAnnuaire(user, "PARTENAIRES", "DELETE")}
      />
    </div>
  );
}
