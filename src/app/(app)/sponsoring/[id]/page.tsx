import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { getEntityMissions } from "@/lib/queries/missions";
import { getWorkflowForEntity } from "@/lib/queries/workflow";
import { MissionAssignmentsCard } from "@/components/missions/mission-assignments-card";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { SPONSORING_STATUS, PRIORITY } from "@/lib/labels";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import { AppealPanel } from "./decision-panel";
import { ThirdPartyButton } from "./third-party-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { AdProItemsPanel, type ItemRow } from "@/components/ad-pro/items-panel";
import { AdProTransferButton } from "@/components/ad-pro/transfer-button";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { BackLink } from "@/components/shared/back-link";

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
  const canPreliminary = hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN";
  const isProductManager = req.productManagerId === user.id;
  const isRequester = req.requesterId === user.id;

  const [pmUser, documents] = await Promise.all([
    req.productManagerId ? prisma.user.findUnique({ where: { id: req.productManagerId }, select: { name: true } }) : Promise.resolve(null),
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

  // Postes du sponsoring : de quoi est fait le montant, et à qui va l'argent. Le matériel
  // promotionnel et l'ordre de dépense sont des scalaires (pas de relation Prisma) : on résout
  // leurs libellés en une requête chacun plutôt qu'une par poste.
  const rawItems = await prisma.adProItem.findMany({
    where: { sponsoringId: req.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const [promoRows, orderRows, promoOptions] = await Promise.all([
    rawItems.some((i) => i.promoMaterialId)
      ? prisma.promoMaterial.findMany({
          where: { id: { in: rawItems.map((i) => i.promoMaterialId).filter((x): x is string => Boolean(x)) } },
          select: { id: true, reference: true, title: true, status: true },
        })
      : Promise.resolve([]),
    rawItems.some((i) => i.expenseOrderId)
      ? prisma.expenseOrder.findMany({
          where: { id: { in: rawItems.map((i) => i.expenseOrderId).filter((x): x is string => Boolean(x)) } },
          select: { id: true, reference: true, status: true },
        })
      : Promise.resolve([]),
    promoMaterialOptions(),
  ]);
  const promoById = new Map(promoRows.map((p) => [p.id, { reference: p.reference, title: p.title, status: String(p.status) }]));
  const orderById = new Map(orderRows.map((o) => [o.id, { reference: o.reference, status: String(o.status) }]));
  const items: ItemRow[] = rawItems.map((i) => ({
    id: i.id, kind: i.kind, label: i.label, notes: i.notes, supplier: i.supplier,
    amountEstimated: i.amountEstimated != null ? toNumber(i.amountEstimated) : null,
    amountGranted: i.amountGranted != null ? toNumber(i.amountGranted) : null,
    addedAfterDecision: i.addedAfterDecision,
    promoMaterialId: i.promoMaterialId,
    promoMaterial: i.promoMaterialId ? promoById.get(i.promoMaterialId) ?? null : null,
    expenseOrderId: i.expenseOrderId,
    expenseOrder: i.expenseOrderId ? orderById.get(i.expenseOrderId) ?? null : null,
  }));
  const decided = ["APPROVED", "ACCEPTED", "PAID", "CLOSED"].includes(req.status);

  const [missions, canManageMissions, missionUsers, workflow] = await Promise.all([
    getEntityMissions("SPONSORING", req.id),
    canAccessEntity(user, "SPONSORING", req.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkflowForEntity(user, "SPONSORING", req.id, req.requesterId),
  ]);

  // L'appel du délégué reste une action propre au sponsoring (après décision).
  const canAppeal = isRequester && ["APPROVED", "REFUSED"].includes(req.status);
  const fmt = (v: unknown) => (v ? formatCurrency(toNumber(v as never)) : null);

  // Corriger la demande : le demandeur tant qu'elle n'est pas tranchée, la Direction toujours.
  const sponsoringDecided = isAdProDecided("SPONSORING", req.status);
  const canEditRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canUpdate: userCan(user, "SPONSORING", "UPDATE") },
    { requesterId: req.requesterId, decided: sponsoringDecided },
  );
  const editValues = canEditRequest ? await adProEditValues("SPONSORING", req.id) : null;

  return (
    <div className="space-y-5">
      <BackLink href="/sponsoring">
        <ArrowLeft className="h-4 w-4" /> Retour au sponsoring
      </BackLink>

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
          {canEditRequest && editValues && (
            <AdProEditButton kind="SPONSORING" id={req.id} decided={sponsoringDecided} values={editValues} />
          )}
          {(canPreliminary || canDirection || isProductManager || isRequester) && <ThirdPartyButton id={req.id} people={missionUsers} />}
          {hasGlobalView(user) && <AdProTransferButton from="SPONSORING" sourceId={req.id} title={req.institution} />}
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

          {/* Ce que couvre RÉELLEMENT le sponsoring : appui, stand, matériel, prestation.
              Les postes ne déclenchent AUCUN circuit propre — ils ventilent l'enveloppe. */}
          <Card>
            <CardHeader>
              <CardTitle>Ce que couvre ce sponsoring</CardTitle>
            </CardHeader>
            <CardContent>
              <AdProItemsPanel
                parent="SPONSORING"
                parentId={req.id}
                items={items}
                amountGranted={req.amountGranted != null ? toNumber(req.amountGranted) : null}
                decided={decided}
                canEdit={userCan(user, "SPONSORING", "CREATE") || userCan(user, "SPONSORING", "UPDATE") || canDirection}
                canAllocate={canDirection}
                promoOptions={promoOptions}
              />
            </CardContent>
          </Card>

          {/* Circuit de validation configurable (piloté par le moteur — éditable dans Administration) */}
          <Card>
            <CardHeader><CardTitle>Circuit de validation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {req.appealCount > 0 && (
                <p className="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-700">Cette demande a fait l'objet d'un appel ({req.appealCount}×) — réexamen par le chef de produit puis décision de la Direction.</p>
              )}
              {workflow ? (
                <WorkflowPanel entityType="SPONSORING" entityId={req.id} view={workflow} />
              ) : (
                <p className="text-sm text-muted-foreground">Circuit indisponible.</p>
              )}
              {canAppeal && (
                <div className="border-t border-border pt-3">
                  <AppealPanel id={req.id} />
                </div>
              )}
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
