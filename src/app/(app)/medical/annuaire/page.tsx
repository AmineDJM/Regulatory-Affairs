import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DIRECTORY_COLUMNS } from "@/lib/medical/directory-sheet";
import { directoryCell, type DirectoryExportRow } from "@/lib/medical/directory-workbook";
import { DirectorySheetView, type DirectorySheetRow } from "./directory-sheet-view";

export const dynamic = "force-dynamic";

/**
 * ANNUAIRE — sous-module de la Promotion médicale.
 *
 * Tous ceux avec qui l'on travaille : médecins, pharmaciens, praticiens hospitaliers. En FEUILLE,
 * parce que c'est ainsi qu'un annuaire se lit, se trie et se corrige — et parce que l'écran et le
 * classeur exporté portent alors exactement les mêmes colonnes.
 *
 * La portée est celle du module : un délégué voit ses praticiens, la direction voit tout. C'est
 * `scopeMedicalDoctors` qui décide, la même fonction que partout ailleurs — un annuaire qui
 * appliquerait sa propre règle finirait par montrer ce que le reste de l'outil cache.
 */
export default async function AnnuairePage() {
  const user = await requireModule("MEDICAL");
  const canImport = userCan(user, "MEDICAL", "CREATE");

  const doctors = await prisma.medicalDoctor.findMany({
    where: { ...scopeMedicalDoctors(user), ...currentCompanyWhere() },
    orderBy: [{ name: "asc" }],
    include: {
      specialtyRef: { select: { name: true } },
      institutionRef: { select: { name: true } },
      delegate: { select: { name: true } },
    },
  });

  // Les cellules sont écrites par LA MÊME fonction que l'export : l'écran et le classeur ne
  // peuvent donc pas raconter deux choses différentes du même praticien.
  const rows: DirectorySheetRow[] = doctors.map((d) => {
    const row: DirectoryExportRow = {
      name: d.name,
      title: d.title,
      specialty: d.specialtyRef?.name ?? d.specialty,
      sector: d.sector,
      institution: d.institutionRef?.name ?? d.institution,
      city: d.city,
      region: d.region,
      phone: d.phone,
      email: d.email,
      influence: d.influence,
      potential: d.potential,
      affinity: d.affinity,
      targetProducts: d.targetProducts,
      delegate: d.delegate?.name ?? null,
      comments: d.comments,
    };
    return { id: d.id, cells: DIRECTORY_COLUMNS.map((c) => directoryCell(row, c.key)) };
  });

  return (
    <div className="space-y-5">
      <BackLink href="/medical">
        <ArrowLeft className="h-4 w-4" /> Promotion médicale
      </BackLink>
      <PageHeader
        title="Annuaire"
        description="Tous les praticiens avec qui nous travaillons — médecins, pharmaciens, hospitaliers — en format feuille, exportable et importable."
      />
      <DirectorySheetView rows={rows} canImport={canImport} />
    </div>
  );
}
