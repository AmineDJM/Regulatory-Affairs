import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate } from "@/lib/utils";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { AD_PRO_OTHER_STATUS } from "@/lib/labels";
import { OtherDecisionPanel } from "./decision-panel";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default async function AdProOtherDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("AD_PRO_OTHER");
  const req = await prisma.adProOtherRequest.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });
  if (!req) notFound();

  const [documents, people] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "AD_PRO_OTHER", entityId: req.id },
      include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { id: { in: [req.requesterId, req.decidedById].filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));

  const mine = req.requesterId === user.id || hasGlobalView(user.role);
  const mayDecide = userCan(user, "AD_PRO_OTHER", "VALIDATE");
  const open = req.status !== "DONE" && req.status !== "CANCELLED";
  const canUpload = (userCan(user, "AD_PRO_OTHER", "UPLOAD") || mine) && open;

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/ad-pro/autres"><ArrowLeft className="h-4 w-4" /> Autres demandes</BackLink>
      <PageHeader title={req.title} description={`Réf. ${req.reference}`}>
        <StatusBadge map={AD_PRO_OTHER_STATUS} value={req.status} />
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>La demande</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Pour qui / avec qui" value={req.beneficiary} />
              <Info label="Montant estimé" value={req.amount != null ? formatCurrency(toNumber(req.amount)) : null} />
              <Info label="Entité" value={req.company?.name} />
              <Info label="Demandeur" value={req.requesterId ? names.get(req.requesterId) : null} />
              <Info label="Décidée par" value={req.decidedById ? names.get(req.decidedById) : null} />
              <Info label="Décidée le" value={req.decidedAt ? formatDate(req.decidedAt.toISOString()) : null} />
              {req.description && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap">{req.description}</p>
                </div>
              )}
              {req.decisionNote && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Motif de la décision</p>
                  <p className="whitespace-pre-wrap">{req.decisionNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pièces jointes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canUpload && <DocumentUpload entityType="AD_PRO_OTHER" entityId={req.id} />}
              <DocumentList
                documents={docItems}
                canDelete={userCan(user, "AD_PRO_OTHER", "DELETE") || hasGlobalView(user.role)}
                canRename={canUpload}
                canEdit={onlyofficeConfigured() && canUpload}
                path={`/ad-pro/autres/${req.id}`}
              />
            </CardContent>
          </Card>
        </div>

        <OtherDecisionPanel
          id={req.id}
          status={req.status}
          canDecide={mayDecide && req.status === "AWAITING_DECISION"}
          canClose={(mine || mayDecide) && open && req.status !== "AWAITING_DECISION"}
        />
      </div>
    </div>
  );
}
