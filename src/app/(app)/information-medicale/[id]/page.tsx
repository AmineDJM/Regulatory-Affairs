import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldPlus, CheckCircle2, Clock } from "lucide-react";
import { requireUser } from "@/lib/session";
import { hasGlobalView, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDeclaration, canViewDeclaration, sourceLink } from "@/lib/queries/medical-info";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { MEDICAL_INFO_STATUS, DOC_REQUEST_STATUS, ENTITY_TYPE_LABELS } from "@/lib/labels";
import { RequestDocForm, CancelRequestButton, FulfillForm, AuthorityForm, ValidateButton } from "./panels";

export const dynamic = "force-dynamic";

export default async function DeclarationDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const decl = await getDeclaration(params.id);
  if (!decl) notFound();
  if (!canViewDeclaration(user, decl)) notFound();

  const canManage = hasGlobalView(user.role) || userCan(user, "MEDICAL_INFO", "VALIDATE");
  const isValidated = decl.status === "VALIDATED";
  const link = sourceLink(decl.sourceType, decl.sourceId);
  const amount = decl.amount != null ? toNumber(decl.amount) : null;
  const pendingCount = decl.requests.filter((r) => r.status === "PENDING").length;

  const [documents, users] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    canManage
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const docById = new Map(documents.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-5">
      <Link href="/information-medicale" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'information médicale
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldPlus className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">{decl.label}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{decl.reference}</span> · {ENTITY_TYPE_LABELS[decl.sourceType] ?? decl.sourceType}
            {amount != null && <> · {formatCurrency(amount)}</>}
          </p>
        </div>
        <StatusBadge map={MEDICAL_INFO_STATUS} value={decl.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          {/* Synthèse */}
          <Card>
            <CardHeader><CardTitle>Événement déclaré</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Type" value={ENTITY_TYPE_LABELS[decl.sourceType] ?? decl.sourceType} />
              <Row label="Budget accordé" value={amount != null ? formatCurrency(amount) : "—"} />
              <Row label="Bénéficiaire" value={decl.beneficiary ?? "—"} />
              <Row label="Pharmacien responsable" value={decl.pharmacist?.name ?? "Non assigné"} />
              <Row label="Créé le" value={formatDate(decl.createdAt.toISOString())} />
              {isValidated && decl.validatedAt && <Row label="Validé le" value={formatDateTime(decl.validatedAt.toISOString())} />}
              {link && (
                <div className="pt-1">
                  <Link href={link} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Voir l'événement source
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pièces demandées */}
          <Card>
            <CardHeader><CardTitle>Pièces requises</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {decl.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune pièce demandée pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {decl.requests.map((r) => {
                    const mine = r.targetUserId === user.id;
                    return (
                      <li key={r.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{r.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Demandée à {r.targetUser?.name ?? "—"}
                              {mine && <> (vous)</>}
                              {r.fulfilledAt && <> · déposée le {formatDate(r.fulfilledAt.toISOString())}</>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge map={DOC_REQUEST_STATUS} value={r.status} dot={false} />
                            {canManage && r.status === "PENDING" && <CancelRequestButton id={r.id} />}
                          </div>
                        </div>
                        {r.note && <p className="mt-1 text-xs text-muted-foreground">Note : {r.note}</p>}
                        {r.status === "FULFILLED" && r.documentId && docById.has(r.documentId) && (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-success"><FileText className="h-3.5 w-3.5" /> {docById.get(r.documentId)}</p>
                        )}
                        {r.status === "PENDING" && (mine || canManage) && <FulfillForm requestId={r.id} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Documents déposés */}
          {docItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Documents déposés</CardTitle></CardHeader>
              <CardContent>
                <DocumentList documents={docItems} canDelete={false} canEdit={onlyofficeConfigured() && canManage} path={`/information-medicale/${decl.id}`} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne latérale : actions du pharmacien */}
        <div className="space-y-5">
          {canManage && !isValidated && (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Demander une pièce</CardTitle></CardHeader>
                <CardContent><RequestDocForm declarationId={decl.id} users={users} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldPlus className="h-4 w-4" /> Déclaration aux autorités</CardTitle></CardHeader>
                <CardContent><AuthorityForm id={decl.id} authorityRef={decl.authorityRef} authorityNotes={decl.authorityNotes} /></CardContent>
              </Card>
              <Card className="border-success/40">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-success" /> Validation</CardTitle></CardHeader>
                <CardContent><ValidateButton id={decl.id} hasPending={pendingCount > 0} amount={amount} /></CardContent>
              </Card>
            </>
          )}

          {isValidated && (
            <Card className="border-success/40">
              <CardContent className="space-y-2 py-5 text-sm">
                <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-5 w-5" /> Déclaration validée</p>
                <p className="text-muted-foreground">L'événement a été déclaré et validé par le pharmacien responsable.{amount && amount > 0 ? " L'ordre de dépense a été transmis au comptable." : ""}</p>
                {decl.authorityRef && <p className="text-muted-foreground">Référence autorités : <span className="font-medium text-foreground">{decl.authorityRef}</span></p>}
              </CardContent>
            </Card>
          )}

          {!canManage && !isValidated && (
            <Card>
              <CardContent className="flex items-start gap-2 py-5 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                Le pharmacien responsable de l'information médicale instruit cette déclaration. Déposez les pièces qui vous sont demandées ci-contre.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
