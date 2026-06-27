import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Gavel } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { SPONSORING_STATUS, PRIORITY } from "@/lib/labels";
import { DecisionPanel } from "./decision-panel";

const SPONSORING_DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];

export default async function SponsoringDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("SPONSORING");
  const req = await prisma.sponsoringRequest.findUnique({
    where: { id: params.id },
    include: { requester: { select: { name: true } } },
  });
  if (!req) notFound();

  // Rôles dans le circuit
  const canDirection = hasGlobalView(user.role) || userCan(user, "SPONSORING", "VALIDATE");
  const isProductManager = req.productManagerId === user.id;
  const isRequester = req.requesterId === user.id;
  // Confidentialité : l'analyse et le budget du chef de produit ne sont JAMAIS
  // visibles par le délégué (demandeur). Seuls la Direction et le chef de produit
  // assigné les voient. Le délégué ne voit que le budget final + le commentaire.
  const canSeeInternal = canDirection || isProductManager;

  const [pmUser, productManagers, documents] = await Promise.all([
    req.productManagerId ? prisma.user.findUnique({ where: { id: req.productManagerId }, select: { name: true } }) : Promise.resolve(null),
    canDirection ? prisma.user.findMany({ where: { role: "PRODUCT_MANAGER", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.document.findMany({ where: { entityType: "SPONSORING", entityId: req.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  const canUpload = userCan(user, "SPONSORING", "UPLOAD");
  const canDelete = userCan(user, "SPONSORING", "DELETE");

  const showPanel =
    (canDirection && ["AWAITING_PRELIMINARY", "AWAITING_FINAL", "AWAITING_FINAL_APPEAL"].includes(req.status)) ||
    (isProductManager && ["PRELIMINARY_APPROVED", "APPEAL_PENDING"].includes(req.status)) ||
    (isRequester && ["APPROVED", "REFUSED"].includes(req.status));

  const fmt = (v: unknown) => (v ? formatCurrency(toNumber(v as never)) : null);

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
            {req.appealCount > 0 && <Badge tone="purple" dot={false}><Gavel className="mr-1 h-3 w-3" /> Appel ×{req.appealCount}</Badge>}
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
              <Info label="Budget demandé (intéressé)" value={fmt(req.amountRequested)} />
              <Info label="Budget suggéré (délégué)" value={fmt(req.amountProposed)} />
              <Info label="Budget accordé (Direction)" value={fmt(req.amountGranted)} />
              <Info label="Demandeur" value={req.requester?.name} />
              <Info label="Chef de produit" value={pmUser?.name} />
              <Info label="Validé par" value={req.validatedBy} />
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="font-medium">{req.description || "—"}</p>
              </div>
              {req.comments && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Appréciation / recommandation (délégué)</p>
                  <p className="font-medium">{req.comments}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suivi de validation */}
          <Card>
            <CardHeader><CardTitle>Suivi de validation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {canSeeInternal && req.preliminaryNote && (
                <Step title="Pré-validation (Direction)" internal>
                  <p className="whitespace-pre-wrap">{req.preliminaryNote}</p>
                </Step>
              )}
              {canSeeInternal && (req.productManagerNotes || req.productManagerBudget != null) ? (
                <Step title="Analyse chef de produit" internal>
                  {req.productManagerNotes && <p className="whitespace-pre-wrap">{req.productManagerNotes}</p>}
                  {req.productManagerBudget != null && <p className="mt-1 text-muted-foreground">Budget proposé : <span className="font-medium text-foreground">{fmt(req.productManagerBudget)}</span></p>}
                </Step>
              ) : null}
              {req.appealReason && (
                <Step title="Appel du délégué" tone="purple">
                  <p className="whitespace-pre-wrap">{req.appealReason}</p>
                </Step>
              )}
              {(req.status === "APPROVED" || req.status === "REFUSED") && (
                <Step title={`Décision de la Direction — ${SPONSORING_STATUS[req.status]?.label ?? req.status}`}>
                  {req.amountGranted != null && req.status === "APPROVED" && <p>Budget accordé : <span className="font-medium">{fmt(req.amountGranted)}</span></p>}
                  {req.finalDecision && <p className="mt-1 whitespace-pre-wrap">{req.finalDecision}</p>}
                  {req.validationDate && <p className="mt-1 text-xs text-muted-foreground">{formatDate(req.validationDate)}{req.validatedBy ? ` · ${req.validatedBy}` : ""}</p>}
                </Step>
              )}
              {!canSeeInternal && !["APPROVED", "REFUSED"].includes(req.status) && (
                <p className="text-muted-foreground">Votre demande suit son cours. Vous serez notifié de la décision de la Direction (budget accordé et commentaire).</p>
              )}
            </CardContent>
          </Card>

          {showPanel && (
            <Card>
              <CardHeader><CardTitle>Action requise</CardTitle></CardHeader>
              <CardContent>
                <DecisionPanel
                  id={req.id}
                  status={req.status}
                  canDirection={canDirection}
                  isProductManager={isProductManager}
                  isRequester={isRequester}
                  productManagers={productManagers}
                />
              </CardContent>
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
              {req.status === "APPROVED" && !documents.some((d) => d.category === "INVOICE") && (
                <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
                  Sponsoring accordé — pensez à joindre la <strong>facture</strong> (catégorie « Facture / Invoice »).
                </div>
              )}
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

function Step({ title, children, internal, tone }: { title: string; children: React.ReactNode; internal?: boolean; tone?: "purple" }) {
  return (
    <div className={`rounded-lg border-l-2 px-3 py-2 ${tone === "purple" ? "border-l-purple-400 bg-purple-500/5" : internal ? "border-l-warning/60 bg-warning/5" : "border-l-primary/50 bg-secondary/40"}`}>
      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {internal && <Lock className="h-3 w-3" />} {title}
        {internal && <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium normal-case text-warning">Confidentiel — non visible par le délégué</span>}
      </p>
      {children}
    </div>
  );
}
