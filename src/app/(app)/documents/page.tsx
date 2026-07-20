import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { accessibleDocumentWhere } from "@/lib/queries/documents";
import { getDriveTabs } from "@/lib/queries/drive";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { DocumentsTable, type DocumentRow } from "./documents-table";

export default async function DocumentsPage() {
  const user = await requireModule("DOCUMENTS");
  const [where, tabs] = await Promise.all([accessibleDocumentWhere(user), getDriveTabs(user)]);

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { uploadedBy: { select: { name: true } } },
  });

  const rows: DocumentRow[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    entityType: d.entityType,
    confidentiality: d.confidentiality,
    version: d.version,
    sizeKb: d.sizeBytes ? Math.round(d.sizeBytes / 1024) : 0,
    uploadedBy: d.uploadedBy?.name ?? "—",
    createdAt: d.createdAt.toISOString(),
    hasFile: Boolean(d.fileKey),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Bibliothèque documentaire centralisée — tous les fichiers, filtrés selon vos accès."
      />
      <ModuleTabs tabs={tabs} />
      <DocumentsTable rows={rows} />
    </div>
  );
}
