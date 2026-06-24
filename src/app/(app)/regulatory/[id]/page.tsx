import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { can } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { addRegulatoryComment } from "@/lib/actions/regulatory-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { CommentThread } from "@/components/shared/comment-thread";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { StepTimeline, type StepItem } from "./step-timeline";
import { StatusEditor } from "./status-editor";
import { PRIORITY, REGULATORY_STATUS, PRODUCT_TYPE } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";

const REG_DOC_CATEGORIES = [
  "CTD_FULL", "MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5",
  "GMP_CERTIFICATE", "CPP", "ORIGIN_AMM", "SUBMISSION_LETTER", "BV_RECEIPT",
  "QUERY_RESPONSE", "REGISTRATION_DECISION", "OTHER",
];

export default async function RegulatoryDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("REGULATORY");
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", params.id, "VIEW"))) {
    notFound();
  }

  const product = await prisma.regulatoryProduct.findUnique({
    where: { id: params.id },
    include: {
      responsible: { select: { name: true } },
      assistant: { select: { name: true } },
      assignedUsers: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!product) notFound();

  const [documents, comments] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "REGULATORY_PRODUCT", entityId: product.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { entityType: "REGULATORY_PRODUCT", entityId: product.id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canUpdate = can(user.role, "REGULATORY", "UPDATE");
  const canUpload = can(user.role, "REGULATORY", "UPLOAD");
  const canDelete = can(user.role, "REGULATORY", "DELETE");

  const steps: StepItem[] = product.steps.map((s) => ({
    id: s.id,
    type: s.type,
    order: s.order,
    status: s.status,
    plannedDate: s.plannedDate?.toISOString() ?? null,
    actualDate: s.actualDate?.toISOString() ?? null,
    responsible: s.responsible,
    comment: s.comment,
    missingDocs: s.missingDocs,
  }));

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    version: d.version,
    sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality,
    uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(),
    hasFile: Boolean(d.fileKey),
  }));

  const doneSteps = product.steps.filter((s) => s.status === "DONE").length;

  return (
    <div className="space-y-5">
      <Link
        href="/regulatory"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{product.reference}</span>
            <StatusBadge map={PRIORITY} value={product.priority} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.dci}</h1>
          {product.brandName && <p className="text-muted-foreground">{product.brandName}</p>}
        </div>
        {canUpdate ? (
          <StatusEditor id={product.id} status={product.status} priority={product.priority} />
        ) : (
          <StatusBadge map={REGULATORY_STATUS} value={product.status} />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du dossier</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Dosage" value={product.dosage} />
              <Info label="Forme" value={product.pharmaceuticalForm} />
              <Info label="Classe thérapeutique" value={product.therapeuticClass} />
              <Info label="Type" value={PRODUCT_TYPE[product.productType] ?? product.productType} />
              <Info label="Fournisseur / Lab" value={product.partnerLab} />
              <Info label="Pays d'origine" value={product.countryOfOrigin} />
              <Info label="Responsable" value={product.responsible?.name} />
              <Info label="Assistante" value={product.assistant?.name} />
              <Info label="Date cible" value={product.targetDate ? formatDate(product.targetDate) : null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Workflow réglementaire</CardTitle>
              <Badge tone="info">{doneSteps}/{product.steps.length} étapes</Badge>
            </CardHeader>
            <CardContent>
              <StepTimeline steps={steps} canUpdate={canUpdate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={comments.map((c) => ({
                  id: c.id,
                  author: c.author?.name ?? "Utilisateur",
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                }))}
                action={addRegulatoryComment}
                hiddenFields={{ productId: product.id }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Badge tone="neutral">{docItems.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpload && (
                <DocumentUpload
                  entityType="REGULATORY_PRODUCT"
                  entityId={product.id}
                  categories={REG_DOC_CATEGORIES}
                />
              )}
              <DocumentList documents={docItems} canDelete={canDelete} path={`/regulatory/${product.id}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traçabilité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Créé le" value={formatDateTime(product.createdAt)} />
              <Info label="Modifié le" value={formatDateTime(product.updatedAt)} />
              <div>
                <p className="text-xs text-muted-foreground">Utilisateurs assignés</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {product.assignedUsers.length === 0 && <span className="text-muted-foreground">—</span>}
                  {product.assignedUsers.map((u) => (
                    <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      <Avatar name={u.name} size="sm" className="h-4 w-4 text-[8px]" />
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
