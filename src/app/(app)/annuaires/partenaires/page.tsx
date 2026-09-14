import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { chargerPartenaires } from "@/lib/queries/annuaires";
import { ContactsBoard } from "@/app/(app)/mon-espace/annuaire/contacts-board";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Partenaires — AMD Internal OS" };

/**
 * Onglet PARTENAIRES du module « Annuaires » : les contacts externes de la société — agence de
 * voyage, livreur, transitaire, imprimeur, traiteur. Tout le monde LIT (c'est un carnet
 * d'adresses) ; l'écriture reste celle des Moyens généraux, comme dans « Mon espace ».
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
        canCreate={userCan(user, "GENERAL_MEANS", "CREATE")}
        canEdit={userCan(user, "GENERAL_MEANS", "UPDATE")}
        canDelete={userCan(user, "GENERAL_MEANS", "DELETE")}
      />
    </div>
  );
}
