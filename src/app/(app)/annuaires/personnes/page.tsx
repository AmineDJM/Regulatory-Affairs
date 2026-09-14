import { requireModule } from "@/lib/session";
import { chargerPersonnes } from "@/lib/queries/annuaires";
import { canEditDirectory } from "@/lib/directory/access";
import { PeopleDirectory } from "@/app/(app)/mon-espace/annuaire/people-directory";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Personnes — AMD Internal OS" };

/**
 * Onglet PERSONNES du module « Annuaires » : l'annuaire interne — qui est qui dans l'entreprise,
 * et comment le joindre. L'identité vient du registre RH ; l'annuaire n'ajoute que les moyens de
 * contact, avec leur provenance.
 */
export default async function AnnuairePersonnesPage() {
  const user = await requireModule("DIRECTORIES");
  const people = await chargerPersonnes();
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Les personnes de l'entreprise et les moyens de les joindre — adresses, numéros, alias — avec la provenance de chaque coordonnée."
      />
      <PeopleDirectory people={people} canEdit={canEditDirectory(user)} />
    </div>
  );
}
