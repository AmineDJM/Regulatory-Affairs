import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFieldReportDetail } from "@/lib/queries/field-reports";
import { PageHeader } from "@/components/shared/page-header";
import { ReportEditor } from "./report-editor";

export const dynamic = "force-dynamic";

export default async function FieldReportPage({ params }: { params: { id: string } }) {
  const user = await requireModule("MEDICAL");
  const detail = await getFieldReportDetail(user, params.id);
  if (!detail) notFound();

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
        title="Rapport de visite"
        description={detail.delegateName ? `Délégué : ${detail.delegateName} · Parlez, l'IA structure, vous relisez et validez.` : "Parlez, l'IA structure, vous relisez et validez."}
      />
      <ReportEditor detail={detail} doctors={doctors} />
    </div>
  );
}
