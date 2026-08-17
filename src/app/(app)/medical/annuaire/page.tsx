import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import type { AnnuaireRow } from "@/lib/medical/directory-grid";
import { AnnuaireGrid } from "./annuaire-grid";

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
export default async function AnnuairePage() {
  const user = await requireModule("MEDICAL");
  const canImport = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");

  const [doctors, specialtyRefs] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: { ...scopeMedicalDoctors(user), ...currentCompanyWhere() },
      orderBy: [{ name: "asc" }],
      include: { specialtyRef: { select: { name: true } } },
    }),
    prisma.medicalSpecialty.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

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
      <AnnuaireGrid rows={rows} canEdit={canEdit} canImport={canImport} specialties={specialties} />
    </div>
  );
}
