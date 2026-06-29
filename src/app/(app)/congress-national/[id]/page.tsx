import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getCongressDetail, getCongressFormData } from "@/lib/queries/congress";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { type DocItem } from "@/components/documents/document-list";
import { CONGRESS_REQUEST_STATUS } from "@/lib/labels";
import { CongressDetailView } from "../../congress-international/congress-detail-view";

export default async function CongressNatDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_NATIONAL");
  const detail = await getCongressDetail("NATIONAL", user, params.id);
  if (!detail) notFound();
  const form = await getCongressFormData();

  const canValidate = userCan(user, "CONGRESS_NATIONAL", "VALIDATE") || hasGlobalView(user.role);
  const canAnalyze = detail.productManagerId === user.id || hasGlobalView(user.role);
  const canUpload = userCan(user, "CONGRESS_NATIONAL", "UPLOAD") || detail.requesterId === user.id;
  const canDelete = userCan(user, "CONGRESS_NATIONAL", "DELETE") || hasGlobalView(user.role);
  const docs = await prisma.document.findMany({
    where: { entityType: "CONGRESS_NATIONAL", entityId: detail.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((dc) => ({
    id: dc.id, name: dc.name, category: dc.category, version: dc.version, sizeBytes: dc.sizeBytes,
    confidentiality: dc.confidentiality, uploadedBy: dc.uploadedBy?.name ?? null, createdAt: dc.createdAt.toISOString(), hasFile: Boolean(dc.fileKey),
  }));

  return (
    <div className="space-y-5">
      <Link href="/congress-national" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Événements nationaux
      </Link>
      <PageHeader title={detail.name} description="Demande de prise en charge — événement national.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
      </PageHeader>
      <CongressDetailView detail={detail} canValidate={canValidate} canAnalyze={canAnalyze} productManagers={form.productManagers} entityType="CONGRESS_NATIONAL" entityId={detail.id} documents={docItems} canUpload={canUpload} canDelete={canDelete} path={`/congress-national/${detail.id}`} />
    </div>
  );
}
