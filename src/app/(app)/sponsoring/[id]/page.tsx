import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Gavel } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { getEntityMissions } from "@/lib/queries/missions";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import { MissionAssignmentsCard } from "@/components/missions/mission-assignments-card";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { SPONSORING_STATUS, PRIORITY } from "@/lib/labels";
import { DecisionPanel } from "./decision-panel";
import { ThirdPartyButton } from "./third-party-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { ValidationStepper, type VStep, type VStepState } from "@/components/shared/validation-stepper";

const SPONSORING_DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];

export default async function SponsoringDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("SPONSORING");
  const req = await prisma.sponsoringRequest.findUnique({
    where: { id: params.id },
    include: { requester: { select: { name: true } } },
  });
  if (!req) notFound();

  // Rôles dans le circuit
  const canDirection = hasGlobalView(user) || userCan(user, "SPONSORING", "VALIDATE");
  // Étape préliminaire (attribuer le chef de produit) : réservée au National Sales
  // (la demande émane d'un délégué). Ni la Direction ni la Direction Marketing n'y interviennent.
  const canMarketing = hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN";
  const isProductManager = req.productManagerId === user.id;
  const isRequester = req.requesterId === user.id;
  // Confidentialité : l'analyse et le budget du chef de produit ne sont JAMAIS
  // visibles par le délégué (demandeur). Seuls la Direction, la Direction Marketing
  // et le chef de produit assigné les voient. Le délégué ne voit que le budget final.
  const canSeeInternal = canDirection || canMarketing || isProductManager;

  const [pmUser, productManagers, documents] = await Promise.all([
    req.productManagerId ? prisma.user.findUnique({ where: { id: req.productManagerId }, select: { name: true } }) : Promise.resolve(null),
    canMarketing ? prisma.user.findMany({ where: { role: { in: ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"] }, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.document.findMany({ where: { entityType: "SPONSORING", entityId: req.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  // Le demandeur (délégué) peut toujours joindre des pièces à SA demande.
  const canUpload = userCan(user, "SPONSORING", "UPLOAD") || isRequester;
  const canDelete = userCan(user, "SPONSORING", "DELETE");

  const [missions, canManageMissions, missionUsers, budgetCategories] = await Promise.all([
    getEntityMissions("SPONSORING", req.id),
    canAccessEntity(user, "SPONSORING", req.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getBudgetCategoryOptions("SPONSORING"),
  ]);

  const showPanel =
    (canMarketing && req.status === "AWAITING_PRELIMINARY") ||
    (canDirection && ["AWAITING_FINAL", "AWAITING_FINAL_APPEAL"].includes(req.status)) ||
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
        <div className="flex flex-col items-end gap-2">
          <StatusBadge map={SPONSORING_STATUS} value={req.status} />
          {(canMarketing || canDirection || isProductManager || isRequester) && <ThirdPartyButton id={req.id} people={missionUsers} />}
          <SuperAdminDeleteButton kind="SPONSORING" id={req.id} name={`${req.reference} — ${req.institution}`} enabled={user.role === "SUPER_ADMIN"} />
        </div>
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
            <CardContent className="space-y-4 text-sm">
              {/* Frise toujours visible : où en est la demande dans le circuit. */}
              <ValidationStepper steps={sponsoringValidationSteps(req.status)} />
              {req.appealCount > 0 && (
                <p className="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-700">Cette demande a fait l'objet d'un appel ({req.appealCount}×) — réexamen par le chef de produit puis décision de la Direction.</p>
              )}
              {(canSeeInternal && req.preliminaryNote) || (canSeeInternal && (req.productManagerNotes || req.productManagerBudget != null)) || req.appealReason || ["APPROVED", "REFUSED"].includes(req.status) ? (
                <div className="space-y-3 border-t border-border pt-3">
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
                </div>
              ) : null}
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
                  canMarketing={canMarketing}
                  isProductManager={isProductManager}
                  isRequester={isRequester}
                  productManagers={productManagers}
                  budgetCategories={budgetCategories}
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
              <DocumentList documents={docItems} canDelete={canDelete} canEdit={onlyofficeConfigured() && canUpload} path={`/sponsoring/${req.id}`} />
            </CardContent>
          </Card>
          <MissionAssignmentsCard
            entityType="SPONSORING"
            entityId={req.id}
            assignments={missions}
            users={missionUsers}
            canManage={canManageMissions}
            currentUserId={user.id}
            path={`/sponsoring/${req.id}`}
          />
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

/** Frise du circuit de validation sponsoring/congrès, dérivée du statut. */
function sponsoringValidationSteps(status: string): VStep[] {
  // Étape « active » du circuit (0 = pré-validation … 3 = résultat).
  let cur: number;
  if (["RECEIVED", "IN_ANALYSIS", "AWAITING_PRELIMINARY"].includes(status)) cur = 0;
  else if (["PRELIMINARY_APPROVED", "APPEAL_PENDING"].includes(status)) cur = 1;
  else if (["AWAITING_FINAL", "AWAITING_FINAL_APPEAL", "AWAITING_DIRECTION", "ACCEPTED"].includes(status)) cur = 2;
  else cur = 3; // APPROVED / REFUSED / PAID / CLOSED / CANCELLED
  const refused = status === "REFUSED";
  const cancelled = status === "CANCELLED";
  const approved = ["APPROVED", "PAID", "CLOSED"].includes(status);

  const base = ["Pré-validation (Direction)", "Analyse chef de produit", "Décision de la Direction", "Résultat"];
  return base.map((label, i): VStep => {
    let state: VStepState;
    if (i < cur) state = "done";
    else if (i > cur) state = "todo";
    else state = i === 3 ? (refused || cancelled ? "rejected" : "done") : "current";
    if (i === 3) label = refused ? "Refusé" : cancelled ? "Annulé" : approved ? "Accordé" : "Résultat";
    return { label, state };
  });
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
