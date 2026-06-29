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

export const dynamic = "force-dynamic";

export default async function FieldReportPage({ params }: { params: { id: string } }) {
  const user = await requireModule("MEDICAL");
  const detail = await getFieldReportDetail(user, params.id);
  if (!detail) notFound();
  // Le délégué a une vue ultra-simple (parler → envoyer, l'IA classe seule) ; la
  // Direction / le chef de produit gardent la vue analytique complète.
  const isManager = managesReports(user);

  const doctors = await prisma.medicalDoctor.findMany({
    where: scopeMedicalDoctors(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-5">
      <Link href="/field-reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Rapports terrain
      </Link>
      <PageHeader
        title={isManager ? "Rapport de visite" : "Mon compte rendu de visite"}
        description={
          isManager
            ? (detail.delegateName ? `Délégué : ${detail.delegateName} · classé par l'IA, relecture et validation.` : "Classé par l'IA — relecture et validation.")
            : "Parlez (ou écrivez), envoyez. L'IA comprend et classe tout pour la Direction."
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
