import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole, anyRoleFilter } from "@/lib/rbac";
import { canDesignateProductManagerAtCreation, canChooseAnalysisAtCreation, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { prisma } from "@/lib/prisma";
import { getEventDetail } from "@/lib/queries/events";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVENT_TYPE, EVENT_SCOPE, EVENT_FORMAT, EVENT_STATUS, PARTICIPANT_ROLE, CONGRESS_REQUEST_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EditEventButton } from "../event-form";
import { EventFundingPanel } from "./funding-panel";
import { ThirdPartyInvolveButton } from "@/components/shared/third-party-involve";
import { InvolvementConversations } from "@/components/ad-pro/involvement-conversations";
import { getInvolvementThreads } from "@/lib/queries/involvement";
import { getEntityMissions } from "@/lib/queries/missions";
import { getWorkflowForEntity } from "@/lib/queries/workflow";
import { MissionAssignmentsCard } from "@/components/missions/mission-assignments-card";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { ValidationStepper, type VStep, type VStepState } from "@/components/shared/validation-stepper";
import { BackLink } from "@/components/shared/back-link";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { AdProItemsPanel } from "@/components/ad-pro/items-panel";
import { loadAdProItems, adProBudgetOptions } from "@/lib/queries/ad-pro-items";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { toNumber } from "@/lib/utils";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { DocumentUpload } from "@/components/documents/document-upload";
import { LinkedRecords } from "@/components/shared/linked-records";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import { DocumentList, type DocItem } from "@/components/documents/document-list";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("EVENTS");
  const e = await getEventDetail(params.id);
  if (!e) notFound();
  const canManage = userCan(user, "EVENTS", "UPDATE");
  const canDelete = userCan(user, "EVENTS", "DELETE");
  // Circuit de prise en charge (financement) — mêmes rôles que pour les congrès.
  const canMarketing = hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN";
  const canValidate = hasGlobalView(user);
  const canSubmit = userCan(user, "EVENTS", "CREATE");
  // National Sales soumettant lui-même : il désigne le chef de produit (l'analyse lui
  // est confiée) au lieu d'approuver préliminairement sa propre demande.
  const canDesignatePM = canDesignateProductManagerAtCreation(user);
  // La Direction choisit son circuit : décision directe, ou avis d'un chef de produit d'abord.
  const canChooseAnalysis = canChooseAnalysisAtCreation(user);
  const [items, promoOptions, budgetOptions] = await Promise.all([
    loadAdProItems("EVENT", e.id),
    promoMaterialOptions(),
    adProBudgetOptions(user),
  ]);
  const canAllocateItems = hasGlobalView(user) || userCan(user, "EVENTS", "VALIDATE");

  // CORRIGER LA DEMANDE : le demandeur tant qu'elle n'est pas tranchée, la Direction toujours.
  const eventDecided = e.requestStatus ? isAdProDecided("EVENT", e.requestStatus) : false;
  const canEditEventRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canUpdate: userCan(user, "EVENTS", "UPDATE") },
    { requesterId: e.requesterId ?? null, decided: eventDecided },
  );
  const eventEditValues = canEditEventRequest ? await adProEditValues("EVENT", e.id) : null;
  const [responsibles, missions, workflow, pmCandidates, documents, involvementThreads] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getEntityMissions("EVENT", e.id),
    getWorkflowForEntity(user, "EVENT", e.id, null),
    canDesignatePM
      ? prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.document.findMany({ where: { entityType: "EVENT", entityId: e.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    getInvolvementThreads("EVENT", e.id),
  ]);
  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  // QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE — la MÊME règle sur les cinq écrans
  // Ad&Pro (`ad-pro/attachments.ts`) : chacun l'épelait à sa façon, et chaque orthographe
  // oubliait quelqu'un, qui envoyait alors la facture par mail avec un dossier vide.
  const attacheur = {
    id: user.id,
    canUploadModule: userCan(user, "EVENTS", "UPLOAD"),
    canUpdateModule: userCan(user, "EVENTS", "UPDATE"),
    canValidateModule: userCan(user, "EVENTS", "VALIDATE"),
    hasGlobalView: hasGlobalView(user),
  };
  const dossierAdPro = { requesterId: e.requesterId ?? null, productManagerId: e.productManagerId ?? null };
  const canUploadDocs = canAttachToAdPro(attacheur, dossierAdPro) || canManage;
  const uploadHint = canUploadDocs ? null : attachHint(attacheur, dossierAdPro);

  return (
    <div className="space-y-5">
      <BackLink href="/events"><ArrowLeft className="h-4 w-4" /> Events</BackLink>
      <PageHeader title={e.name} description={`${EVENT_TYPE[e.type]} · ${EVENT_SCOPE[e.scope]} · ${EVENT_FORMAT[e.format]}`}>
        <StatusBadge map={EVENT_STATUS} value={e.status} />
        {canManage && <EditEventButton event={e} responsibles={responsibles} canDelete={canDelete} />}
        {/* Le DEMANDEUR corrige sa demande tant qu'elle n'est pas tranchée (les gestionnaires
            ont déjà l'édition complète juste au-dessus — inutile de doubler leur bouton). */}
        {!canManage && canEditEventRequest && eventEditValues && (
          <AdProEditButton kind="EVENT" id={e.id} decided={eventDecided} values={eventEditValues} />
        )}
        <SuperAdminDeleteButton kind="EVENT" id={e.id} name={e.name} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>

      <div className="grid gap-5">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Info label="Dates" value={[e.startDate && formatDate(e.startDate), e.endDate && formatDate(e.endDate)].filter(Boolean).join(" → ") || "—"} />
            <Info label="Lieu" value={[e.location, e.city, e.country].filter(Boolean).join(", ")} />
            <Info label="Spécialité" value={e.specialty} />
            <Info label="Produits" value={e.products} />
            <Info label="Capacité" value={e.capacity ? String(e.capacity) : "Illimitée"} />
            <Info label="Budget estimé" value={e.estimatedBudget !== null ? formatCurrency(e.estimatedBudget) : "—"} />
            <Info label="Responsable" value={e.responsibleName} />
            {e.meetingLink && <div className="col-span-full"><a href={e.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Video className="h-4 w-4" /> Lien de connexion (webinar)</a></div>}
            {e.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Description</p><p className="whitespace-pre-wrap">{e.description}</p></div>}
          </CardContent>
        </Card>

      </div>

      {/* DOCUMENTS de l'événement — comme partout ailleurs : convention, programme, photos,
          facture… Le module portait des chiffres de présence (inscrits, taux) qui n'ont plus
          cours depuis qu'on ne gère plus les inscriptions ; il lui manquait ce qui sert
          vraiment, la liste des pièces. */}
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {canUploadDocs
            ? <DocumentUpload entityType="EVENT" entityId={e.id} />
            : uploadHint && <p className="text-xs text-muted-foreground">{uploadHint}</p>}
          <DocumentList
            documents={docItems}
            canDelete={userCan(user, "EVENTS", "DELETE") || hasGlobalView(user)}
            canRename={canUploadDocs}
            canEdit={onlyofficeConfigured() && canUploadDocs}
            path={`/events/${e.id}`}
          />
        </CardContent>
      </Card>
      {/* CE QUI EN DÉCOULE : engagement, facture, courrier. Le mécanisme connaissait déjà ce type
          de dossier ; il ne manquait que le bloc — et l'on ne pouvait donc RIEN rattacher à un
          événement. Créés d'ici, ils gardent le lien : c'est le seul moment où l'on sait de quoi
          ils viennent, et le seul où le rattachement ne coûte rien. */}
      <LinkedRecords entityType="EVENT" entityId={e.id} reference={e.name} canCreate={canUploadDocs} />


      <Card>
        <CardHeader><CardTitle>Suivi de validation</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <ValidationStepper steps={eventValidationSteps(e.status)} />
          <div className="space-y-3 text-sm">
            <Info label="Statut actuel" value={EVENT_STATUS[e.status]?.label ?? e.status} />
            <Info label="Budget estimé / validé" value={e.estimatedBudget !== null ? formatCurrency(e.estimatedBudget) : "À renseigner"} />
            <Info label="Responsable interne" value={e.responsibleName} />
            {canManage && ["DRAFT", "AWAITING_VALIDATION"].includes(e.status) && (
              <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">Faites avancer la validation via « Modifier » : passez le statut à « Attente validation » puis « Validé » (pensez à renseigner le budget).</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Demande de prise en charge (financement)
            {e.requestStatus && <StatusBadge map={CONGRESS_REQUEST_STATUS} value={e.requestStatus} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventFundingPanel
            eventId={e.id}
            requestSubmitted={!!e.requestStatus}
            canSubmit={canSubmit}
            workflow={workflow}
            pmCandidates={canDesignatePM ? pmCandidates : []}
            canChooseAnalysis={canChooseAnalysis}
          />
          {(canManage || canMarketing || canValidate) && (
            <div className="mt-4 border-t border-border pt-3">
              <ThirdPartyInvolveButton type="EVENT" id={e.id} people={responsibles} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* POSTES de l'événement : consulting, traiteur, location de salle… chacun validé à part par
          la Direction, avec son budget et son bon de commande — comme sur le sponsoring. */}
      <Card>
        <CardHeader><CardTitle>Ce que couvre cet événement</CardTitle></CardHeader>
        <CardContent>
          <AdProItemsPanel
            parent="EVENT"
            parentId={e.id}
            items={items}
            amountGranted={e.finalAmount != null ? toNumber(e.finalAmount) : null}
            decided={e.requestStatus ? ["APPROVED", "COMPLETED"].includes(e.requestStatus) : e.status !== "DRAFT" && e.status !== "CANCELLED"}
            canEdit={userCan(user, "EVENTS", "CREATE") || canManage || canAllocateItems}
            canAllocate={canAllocateItems}
            promoOptions={promoOptions}
            budgetOptions={budgetOptions}
            canIssueOrder={userCan(user, "FINANCES", "UPDATE") || userCan(user, "FINANCES", "VALIDATE")}
          />
        </CardContent>
      </Card>

      {e.stats.bySpecialty.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Répartition par spécialité</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {e.stats.bySpecialty.map((s) => <Badge key={s.name} tone="info" dot={false}>{s.name} · {s.count}</Badge>)}
          </CardContent>
        </Card>
      )}

      <InvolvementConversations threads={involvementThreads} currentUserId={user.id} canManage={hasGlobalView(user)} />

      <MissionAssignmentsCard
        entityType="EVENT"
        entityId={e.id}
        assignments={missions}
        users={responsibles}
        canManage={canManage}
        currentUserId={user.id}
        path={`/events/${e.id}`}
      />

    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}

/** Frise du circuit de validation d'un événement, dérivée de son statut. */
function eventValidationSteps(status: string): VStep[] {
  if (status === "CANCELLED") {
    return [
      { label: "Brouillon", state: "done" },
      { label: "Validation par la Direction", state: "rejected" },
      { label: "Annulé", state: "rejected" },
    ];
  }
  const cur = status === "DRAFT" ? 0 : status === "AWAITING_VALIDATION" ? 1 : 2; // VALIDATED et au-delà
  const base = ["Brouillon", "En attente de validation (Direction)", "Validé"];
  return base.map((label, i): VStep => {
    let state: VStepState;
    if (i < cur) state = "done";
    else if (i > cur) state = "todo";
    else state = i === 2 ? "done" : "current";
    return { label, state };
  });
}
