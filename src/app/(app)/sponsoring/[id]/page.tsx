import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { SPONSORING_STATUS, PRIORITY } from "@/lib/labels";
import { DecisionPanel } from "./decision-panel";

const FINAL = ["ACCEPTED", "REFUSED", "PAID", "CLOSED"];
const SPONSORING_DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];

export default async function SponsoringDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("SPONSORING");
  const req = await prisma.sponsoringRequest.findUnique({
    where: { id: params.id },
    include: { requester: { select: { name: true } } },
  });
  if (!req) notFound();

  const documents = await prisma.document.findMany({
    where: { entityType: "SPONSORING", entityId: req.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  const canValidate = userCan(user, "SPONSORING", "VALIDATE");
  const canUpload = userCan(user, "SPONSORING", "UPLOAD");
  const canDelete = userCan(user, "SPONSORING", "DELETE");

  return (
    <div className="space-y-5">
      <Link href="/sponsoring" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au sponsoring
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{req.reference}</span>
            <StatusBadge map={PRIORITY} value={req.strategicImportance} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{req.institution}</h1>
          {req.doctor && <p className="text-muted-foreground">{req.doctor} · {req.specialty}</p>}
        </div>
        <StatusBadge map={SPONSORING_STATUS} value={req.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Détails de la demande</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Type" value={req.type} />
              <Info label="Ville" value={req.city} />
              <Info label="Produit" value={req.product} />
              <Info label="Montant demandé" value={req.amountRequested ? formatCurrency(toNumber(req.amountRequested)) : null} />
              <Info label="Montant proposé" value={req.amountProposed ? formatCurrency(toNumber(req.amountProposed)) : null} />
              <Info label="Montant accordé" value={req.amountGranted ? formatCurrency(toNumber(req.amountGranted)) : null} />
              <Info label="Demandeur" value={req.requester?.name} />
              <Info label="Validé par" value={req.validatedBy} />
              <Info label="Date validation" value={req.validationDate ? formatDate(req.validationDate) : null} />
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="font-medium">{req.description || "—"}</p>
              </div>
              {req.finalDecision && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Décision finale</p>
                  <p className="font-medium">{req.finalDecision}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {canValidate && !FINAL.includes(req.status) && (
            <Card>
              <CardHeader><CardTitle>Décision</CardTitle></CardHeader>
              <CardContent><DecisionPanel id={req.id} /></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Badge tone="neutral">{docItems.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpload && <DocumentUpload entityType="SPONSORING" entityId={req.id} categories={SPONSORING_DOC_CATEGORIES} />}
              <DocumentList documents={docItems} canDelete={canDelete} path={`/sponsoring/${req.id}`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Traçabilité</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Info label="Créé le" value={formatDateTime(req.createdAt)} />
              <Info label="Modifié le" value={formatDateTime(req.updatedAt)} />
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
