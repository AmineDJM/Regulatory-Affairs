import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere, getMyCompanies, companyLabel } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { WORKSPACE_TABS } from "@/lib/labels";
import { ContactsBoard, type ContactRow } from "./contacts-board";
import { PeopleDirectory, type DirectoryPerson } from "./people-directory";
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
 * ── POURQUOI IL A QUITTÉ LES MOYENS GÉNÉRAUX ────────────────────────────────────────────────
 *
 * C'est un CARNET D'ADRESSES, pas un outil de caisse. Le ranger derrière le module de ceux qui
 * achètent et décaissent revenait à le fermer à tous ceux qui le cherchent — le délégué qui doit
 * joindre le transitaire, l'assistante qui prépare un déplacement, le juriste qui saisit une
 * partie au contrat. Il est donc un ONGLET DE « MON ESPACE » : chacun le LIT.
 *
 * L'ÉCRITURE, elle, n'a pas bougé d'un pouce — elle demande toujours le droit des Moyens
 * généraux. Un annuaire que chacun corrige devient un annuaire dont personne ne se sert.
 */
export default async function CompanyContactsPage() {
  // LIRE : l'espace de travail, c'est-à-dire tout le monde. ÉCRIRE : les Moyens généraux.
  const user = await requireModule("WORKSPACE");
  const canCreate = userCan(user, "GENERAL_MEANS", "CREATE");
  const canEdit = userCan(user, "GENERAL_MEANS", "UPDATE");
  const canDelete = userCan(user, "GENERAL_MEANS", "DELETE");

  const [tabs, contacts, myCompanies, employees] = await Promise.all([
    visibleTabs(user, WORKSPACE_TABS),
    prisma.companyContact.findMany({
      where: await companyScopedWhere(user.id, {}),
      include: { company: { select: { name: true, shortName: true } } },
      orderBy: [{ name: "asc" }],
    }),
    getMyCompanies(user.id),
    // LES PERSONNES — lues depuis le registre RH, qui reste la source de leur identité. L'écran
    // n'ajoute que les moyens de les joindre.
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true, fullName: true, position: true, department: true, userId: true,
        email: true, phone: true,
        company: { select: { name: true, shortName: true } },
        user: { select: { email: true } },
        directoryEntry: {
          select: {
            id: true, aliases: true,
            endpoints: {
              where: { isActive: true },
              orderBy: [{ isPrimary: "desc" }, { channel: "asc" }],
              select: { id: true, channel: true, value: true, label: true, confidence: true, isPrimary: true },
            },
          },
        },
      },
    }),
  ]);

  const people: DirectoryPerson[] = employees.map((e) => {
    const endpoints = e.directoryEntry?.endpoints ?? [];
    const inDirectory = new Set(endpoints.map((p) => p.value.toLowerCase()));
    // Les adresses des fiches ERP ne sont montrées que si l'annuaire ne les porte pas déjà :
    // afficher deux fois la même adresse ferait douter qu'il s'agisse de la même.
    const erpEmails = [e.email, e.user?.email]
      .filter((m): m is string => Boolean(m))
      .map((m) => m.toLowerCase())
      .filter((m, i, all) => all.indexOf(m) === i && !inDirectory.has(m));
    return {
      key: e.id,
      name: e.fullName,
      jobTitle: e.position,
      department: e.department,
      company: e.company?.shortName ?? e.company?.name ?? null,
      userId: e.userId,
      employeeId: e.id,
      entryId: e.directoryEntry?.id ?? null,
      aliases: e.directoryEntry?.aliases ?? [],
      endpoints: endpoints.map((p) => ({
        id: p.id, channel: p.channel, value: p.value, label: p.label,
        confidence: p.confidence, isPrimary: p.isPrimary,
      })),
      erpEmails,
    };
  });

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
      <ModuleTabs tabs={tabs} />
      <PageHeader
        title="Annuaire de l'entreprise"
        description="Agence de voyage, livreur, transitaire, imprimeur, agence marketing, hôtel, traiteur — les contacts externes de la société, regroupés par métier. Cherchez par métier, par nom, ou par un fragment de numéro ; chaque coordonnée se copie d'un clic."
      />
      <PeopleDirectory people={people} canEdit={canEditDirectory(user)} />
      <ContactsBoard
        contacts={rows}
        companies={myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
        canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  );
}
