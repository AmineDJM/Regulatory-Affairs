import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor, getMyCompanies, companyLabel } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ContactsBoard, type ContactRow } from "./contacts-board";

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
 * Il vit dans les MOYENS GÉNÉRAUX parce que c'est le service qui traite réellement avec eux. La
 * lecture est ouverte à tous ceux qui ont le module ; l'écriture demande le droit correspondant —
 * un annuaire que chacun corrige devient un annuaire dont personne ne se sert.
 */
export default async function CompanyContactsPage() {
  const user = await requireModule("GENERAL_MEANS");
  const canCreate = userCan(user, "GENERAL_MEANS", "CREATE");
  const canEdit = userCan(user, "GENERAL_MEANS", "UPDATE");
  const canDelete = userCan(user, "GENERAL_MEANS", "DELETE");

  const [contacts, myCompanies] = await Promise.all([
    prisma.companyContact.findMany({
      where: { ...await currentCompanyWhereFor(user.id) },
      include: { company: { select: { name: true, shortName: true } } },
      orderBy: [{ name: "asc" }],
    }),
    getMyCompanies(user.id),
  ]);

  const rows: ContactRow[] = contacts.map((c) => ({
    id: c.id, name: c.name, kind: c.kind, contactName: c.contactName,
    phone: c.phone, phoneAlt: c.phoneAlt, email: c.email, website: c.website,
    address: c.address, city: c.city, wilaya: c.wilaya,
    rc: c.rc, nif: c.nif, rib: c.rib, notes: c.notes,
    isActive: c.isActive, companyId: c.companyId,
    companyLabel: c.company ? c.company.shortName ?? c.company.name : null,
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/moyens-generaux">
        <ArrowLeft className="h-4 w-4" /> Moyens généraux
      </BackLink>
      <PageHeader
        title="Annuaire de l'entreprise"
        description="Agence de voyage, livreur, transitaire, imprimeur, agence marketing, hôtel, traiteur — les contacts externes de la société, regroupés par métier. Cherchez par métier, par nom, ou par un fragment de numéro ; chaque coordonnée se copie d'un clic."
      />
      <ContactsBoard
        contacts={rows}
        companies={myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
        canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  );
}
