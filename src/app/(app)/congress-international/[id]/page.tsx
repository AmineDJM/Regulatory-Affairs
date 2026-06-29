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
import { CongressDetailView } from "../congress-detail-view";

export default async function CongressIntlDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_INTERNATIONAL");
  const detail = await getCongressDetail("INTL", user, params.id);
  if (!detail) notFound();
  const form = await getCongressFormData();

  const canValidate = userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE") || hasGlobalView(user.role);
  const canAnalyze = detail.productManagerId === user.id || hasGlobalView(user.role);
  // Le demandeur peut joindre des pièces à sa demande, même si son rôle n'a pas UPLOAD.
  const canUpload = userCan(user, "CONGRESS_INTERNATIONAL", "UPLOAD") || detail.requesterId === user.id;
  const canDelete = userCan(user, "CONGRESS_INTERNATIONAL", "DELETE") || hasGlobalView(user.role);
  const docs = await prisma.document.findMany({
    where: { entityType: "CONGRESS_INTERNATIONAL", entityId: detail.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((dc) => ({
    id: dc.id, name: dc.name, category: dc.category, version: dc.version, sizeBytes: dc.sizeBytes,
    confidentiality: dc.confidentiality, uploadedBy: dc.uploadedBy?.name ?? null, createdAt: dc.createdAt.toISOString(), hasFile: Boolean(dc.fileKey),
  }));

  return (
    <div className="space-y-5">
      <Link href="/congress-international" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Congrès internationaux
      </Link>
      <PageHeader title={detail.name} description="Demande de prise en charge — congrès international.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
      </PageHeader>
      <CongressDetailView detail={detail} canValidate={canValidate} canAnalyze={canAnalyze} productManagers={form.productManagers} entityType="CONGRESS_INTERNATIONAL" entityId={detail.id} documents={docItems} canUpload={canUpload} canDelete={canDelete} path={`/congress-international/${detail.id}`} />
    </div>
  );
}
