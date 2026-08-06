import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFieldReportDetail, managesReports } from "@/lib/queries/field-reports";
import { PageHeader } from "@/components/shared/page-header";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { ReportEditor } from "./report-editor";
import { SimpleReportEditor } from "./simple-report-editor";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function FieldReportPage({ params }: { params: { id: string } }) {
  // La fiche d'un rapport est gardée par le MÊME module que la liste (« Rapports terrain »),
  // et non plus par « Promotion médicale » : sinon un profil ayant accès aux rapports mais pas
  // à la promotion médicale (ex. Direction des opérations) était renvoyé vers « Mon espace »
  // en ouvrant un rapport. L'accès fin (voir/éditer CE rapport) reste géré par getFieldReportDetail.
  const user = await requireModule("FIELD_REPORTS");
  const detail = await getFieldReportDetail(user, params.id);
  if (!detail) notFound();
  // Compte rendu (synthèse) simple pour tous : dicter/écrire + médecin(s), établissement,
  // spécialité, date, pièces jointes. Le gestionnaire peut aussi valider/rouvrir.
  const isManager = managesReports(user);

  const doctors = await prisma.medicalDoctor.findMany({
    where: scopeMedicalDoctors(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-5">
      <BackLink href="/field-reports">
        <ArrowLeft className="h-4 w-4" /> Rapports terrain
      </BackLink>
      <PageHeader
        title={isManager ? "Rapport de visite" : "Mon compte rendu de visite"}
        description={
          isManager
            ? (detail.delegateName ? `Délégué : ${detail.delegateName} · relecture et validation.` : "Relecture et validation.")
            : "Parlez (ou écrivez) votre compte rendu, puis envoyez."
        }
      >
        <SuperAdminDeleteButton kind="FIELD_REPORT" id={detail.id} name={detail.delegateName ? `Rapport — ${detail.delegateName}` : "Rapport de visite"} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>
      {isManager
        ? <ReportEditor detail={detail} doctors={doctors} />
        : <SimpleReportEditor detail={detail} doctors={doctors} />}
    </div>
  );
}
