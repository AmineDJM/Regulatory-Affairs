import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan, scopeMedicalDoctors, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor, getMyCompanies, companyLabel } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import type { AnnuaireRow } from "@/lib/medical/directory-grid";
import { AnnuaireGrid } from "./annuaire-grid";
import { DirectoryBar, type DirectoryRow } from "./directory-bar";

export const dynamic = "force-dynamic";

/**
 * ANNUAIRE — la feuille détaillée du module Annuaire (ex-« Promotion médicale »).
 *
 * Tous ceux avec qui l'on travaille : médecins, pharmaciens, praticiens hospitaliers. En FEUILLE
 * MODIFIABLE — on ne consulte pas un annuaire, on le corrige : chaque cellule s'édite sur place,
 * les colonnes fermées (wilaya, grade, secteur, potentiel) se choisissent dans un menu, et l'on
 * peut basculer en vue par spécialité.
 *
 * La portée est celle du module : un délégué voit et corrige ses praticiens, la direction voit
 * tout. C'est `scopeMedicalDoctors` qui décide, la même fonction que partout ailleurs — et chaque
 * écriture est revérifiée au niveau de la ligne côté serveur.
 */
export default async function AnnuairePage({ searchParams }: { searchParams?: { annuaire?: string } }) {
  const user = await requireModule("MEDICAL");
  const canImport = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");
  const canDelete = userCan(user, "MEDICAL", "DELETE");

  // L'annuaire ouvert : « general » = ceux qui ne sont rangés nulle part, un identifiant = cet
  // annuaire, absent = tous les praticiens du périmètre.
  const generalOnly = searchParams?.annuaire === "general";
  const openDirectoryId = searchParams?.annuaire && searchParams.annuaire !== "general" ? searchParams.annuaire : null;
  const directoryWhere = generalOnly ? { directoryId: null } : openDirectoryId ? { directoryId: openDirectoryId } : {};

  const scope = { ...scopeMedicalDoctors(user), ...await currentCompanyWhereFor(user.id) };

  // L'ACCÈS PAR ANNUAIRE. Liste d'accès vide = ouvert à tout le module ; des noms = fermé à tous
  // les autres, hors vue globale. On tranche AVANT de charger les praticiens : un annuaire fermé
  // ne doit fuir ni par sa pastille, ni par ses praticiens dans la vue « Tous ».
  const privileged = user.role === "SUPER_ADMIN" || hasGlobalView(user.role);
  const allDirectories = await prisma.medicalDirectory.findMany({
    select: {
      id: true, name: true, companyId: true, createdById: true,
      company: { select: { name: true, shortName: true } },
      access: { select: { userId: true } },
    },
    orderBy: { name: "asc" },
  });
  const canOpenDirectory = (d: { createdById: string | null; access: { userId: string }[] }) =>
    privileged || d.access.length === 0 || d.createdById === user.id || d.access.some((a) => a.userId === user.id);
  const visibleDirectoryRows = allDirectories.filter(canOpenDirectory);
  const hiddenIds = allDirectories.filter((d) => !canOpenDirectory(d)).map((d) => d.id);
  // Ouvrir un annuaire fermé par son adresse ne marche pas plus que par sa pastille.
  if (openDirectoryId && !visibleDirectoryRows.some((d) => d.id === openDirectoryId)) notFound();
  // La vue « Tous » exclut les praticiens des annuaires fermés — sans quoi la restriction ne
  // serait qu'une pastille masquée.
  const hiddenWhere = hiddenIds.length > 0 && !openDirectoryId && !generalOnly
    ? { OR: [{ directoryId: null }, { directoryId: { notIn: hiddenIds } }] }
    : {};

  const [doctors, specialtyRefs, directoryCounts, generalCount, myCompanies] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: { ...scope, ...directoryWhere, ...hiddenWhere },
      orderBy: [{ name: "asc" }],
      include: { specialtyRef: { select: { name: true } } },
    }),
    prisma.medicalSpecialty.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    // Les comptes se calculent DANS LA PORTÉE de la personne : afficher « 300 » à un délégué qui
    // n'en voit que douze donnerait un chiffre faux et ferait croire à un problème d'accès.
    prisma.medicalDoctor.groupBy({ by: ["directoryId"], where: { ...scope, directoryId: { not: null } }, _count: { _all: true } }),
    prisma.medicalDoctor.count({ where: { ...scope, directoryId: null } }),
    getMyCompanies(user.id),
  ]);
  const countByDirectory = new Map(directoryCounts.map((c) => [c.directoryId as string, c._count._all]));
  const directories: DirectoryRow[] = visibleDirectoryRows.map((d) => ({
    id: d.id, name: d.name, companyId: d.companyId,
    companyLabel: d.company ? d.company.shortName ?? d.company.name : null,
    doctorCount: countByDirectory.get(d.id) ?? 0,
    accessUserIds: d.access.map((a) => a.userId),
  }));

  const rows: AnnuaireRow[] = doctors.map((d) => ({
    id: d.id,
    lastName: d.lastName,
    firstName: d.firstName,
    address: d.address,
    city: d.city,
    wilaya: d.wilaya,
    potential: d.potential,
    postalCode: d.postalCode,
    phone: d.phone,
    // La saisie libre l'emporte à l'affichage sur le référentiel, comme à l'édition.
    specialty: d.specialty ?? d.specialtyRef?.name ?? null,
    title: d.title,
    email: d.email,
    sector: d.sector,
  }));

  // Saisie assistée de la spécialité : le référentiel structuré ET les libellés déjà employés.
  const specialties = [...new Set([
    ...specialtyRefs.map((s) => s.name),
    ...rows.map((r) => r.specialty).filter((s): s is string => Boolean(s)),
  ])].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="space-y-5">
      <BackLink href="/medical">
        <ArrowLeft className="h-4 w-4" /> Annuaire
      </BackLink>
      <PageHeader
        title="Annuaire"
        description="Tous les praticiens avec qui nous travaillons — médecins, pharmaciens, hospitaliers — en feuille modifiable, exportable, avec vue par spécialité."
      />
      <DirectoryBar
        directories={directories}
        current={searchParams?.annuaire ?? null}
        companies={myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
        generalCount={generalCount}
        canManage={canEdit}
        people={canEdit
          ? (await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }))
          : []}
      />
      <AnnuaireGrid rows={rows} canEdit={canEdit} canImport={canImport} canDelete={canDelete} specialties={specialties} />
    </div>
  );
}
