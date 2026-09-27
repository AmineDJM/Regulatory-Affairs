import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan, scopeMedicalDoctors, peutAnnuaire, annuaireOuvertParConsole } from "@/lib/rbac";
import { clauseAnnuairesFermes } from "@/lib/queries/annuaires";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { buildAnnuaireWorkbook } from "@/lib/medical/directory-workbook";
import { directoryExportFilename } from "@/lib/medical/directory-sheet";
import type { AnnuaireRow } from "@/lib/medical/directory-grid";

/**
 * EXPORT DE L'ANNUAIRE EN CLASSEUR — exactement les colonnes de l'écran.
 *
 * La PORTÉE gouverne, ici comme partout : un délégué exporte ses praticiens, pas ceux des
 * autres. `scopeMedicalDoctors` est la même fonction que celle qui filtre l'écran — un export
 * qui appliquerait sa propre règle finirait par sortir ce que l'écran cache.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  // LE GRADE, quand l'onglet du module « Annuaires » exporte ce qu'il montre : médecins (tout
  // grade sauf pharmacien) ou pharmaciens. Absent = toute la feuille, comme avant.
  const grade = new URL(req.url).searchParams.get("grade");
  const cle = grade === "pharmaciens" ? "PHARMACIENS" : grade === "medecins" ? "MEDECINS" : null;
  // LA PORTE est celle de l'écran qui exporte (§118.147) : l'onglet d'un annuaire lit la règle
  // de l'accès par annuaire, la feuille entière de la Promotion médicale lit son module.
  const voit = cle ? peutAnnuaire(user, cle, "VIEW") : userCan(user, "MEDICAL", "VIEW");
  if (!voit) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const gradeWhere = grade === "pharmaciens"
    ? { title: "PHARMACIEN" as const }
    : grade === "medecins" ? { title: { not: "PHARMACIEN" as const } } : {};
  // Un annuaire ouvert par la console s'ouvre en entier — la même portée que l'écran.
  const entier = cle ? annuaireOuvertParConsole(user, cle, "VIEW") : false;

  const doctors = await prisma.medicalDoctor.findMany({
    // LES CLAUSES SE COMPOSENT EN `AND` : la portée d'un délégué et l'exclusion des annuaires
    // fermés sont deux `OR`, et les étaler dans le même objet ferait écraser l'une par l'autre.
    where: {
      AND: [
        await companyScopedWhere(user.id, entier ? {} : scopeMedicalDoctors(user)),
        gradeWhere,
        await clauseAnnuairesFermes(user),
      ],
    },
    orderBy: [{ name: "asc" }],
    include: { specialtyRef: { select: { name: true } } },
  });

  const rows: AnnuaireRow[] = doctors.map((d) => ({
    id: d.id,
    lastName: d.lastName,
    firstName: d.firstName,
    address: d.address,
    wilaya: d.wilaya,
    potential: d.potential,
    postalCode: d.postalCode,
    phone: d.phone,
    specialty: d.specialty ?? d.specialtyRef?.name ?? null,
    title: d.title,
    email: d.email,
    sector: d.sector,
  }));

  const buffer = buildAnnuaireWorkbook(rows);
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
