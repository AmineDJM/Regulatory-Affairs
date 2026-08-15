import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan, scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { buildDirectoryWorkbook, type DirectoryExportRow } from "@/lib/medical/directory-workbook";
import { directoryExportFilename } from "@/lib/medical/directory-sheet";

/**
 * EXPORT DE L'ANNUAIRE EN CLASSEUR.
 *
 * La PORTÉE gouverne, ici comme partout : un délégué exporte ses praticiens, pas ceux des
 * autres. `scopeMedicalDoctors` est la même fonction que celle qui filtre l'écran — un export
 * qui appliquerait sa propre règle finirait par sortir ce que l'écran cache.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "MEDICAL", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const doctors = await prisma.medicalDoctor.findMany({
    where: { ...scopeMedicalDoctors(user), ...currentCompanyWhere() },
    orderBy: [{ name: "asc" }],
    include: {
      specialtyRef: { select: { name: true } },
      institutionRef: { select: { name: true } },
      delegate: { select: { name: true } },
    },
  });

  const rows: DirectoryExportRow[] = doctors.map((d) => ({
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
  }));

  const buffer = buildDirectoryWorkbook(rows);
  await recordAudit({
    actorId: user.id, action: "EXPORT", module: "Promotion médicale",
    summary: `Export de l'annuaire — ${rows.length} praticien(s)`,
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${directoryExportFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
