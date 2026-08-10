import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPromoMaterial, canViewPromo, promoNames } from "@/lib/queries/promo-material";
import { addPromoComment } from "@/lib/actions/promo-material-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { CommentThread } from "@/components/shared/comment-thread";
import { ValidationStepper, type VStep, type VStepState } from "@/components/shared/validation-stepper";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PROMO_MATERIAL_STATUS, PROMO_MATERIAL_FLOW } from "@/lib/labels";
import { PromoActionPanel } from "./promo-panels";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

const PROMO_DOC_CATEGORIES = ["QUOTE", "PURCHASE_ORDER", "PAYMENT_SLIP", "PAYMENT_RECEIPT", "PROMO_MATERIAL_FILE", "AD_VISA", "INVOICE", "DELIVERY_NOTE", "SUPPORTING_DOC", "OTHER"];

function promoSteps(status: string): VStep[] {
  if (status === "CANCELLED") {
    return [{ label: "Demande", state: "done" }, { label: "Annulé", state: "rejected" }];
  }
  const cur = PROMO_MATERIAL_FLOW.indexOf(status);
  return PROMO_MATERIAL_FLOW.map((s, i): VStep => {
    let state: VStepState;
    if (i < cur) state = "done";
    else if (i > cur) state = "todo";
    else state = s === "SETTLED" ? "done" : "current";
    return { label: PROMO_MATERIAL_STATUS[s]?.label ?? s, state };
  });
}

export default async function PromoMaterialDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("PROMO_MATERIAL");
  const pm = await getPromoMaterial(params.id);
  if (!pm) notFound();
  if (!canViewPromo(user, pm)) notFound();
  const names = await promoNames(pm);

  // CORRIGER LA DEMANDE : le demandeur tant que l'agence n'est pas choisie, la Direction
  // toujours. Au-delà du choix d'agence, le bon de commande et le visa s'appuient sur ce qui a
  // été arrêté — corriger après coup ferait diverger la pièce et le dossier.
  const promoDecided = isAdProDecided("PROMO_MATERIAL", pm.status);
  const canEditPromoRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user.role), canUpdate: userCan(user, "PROMO_MATERIAL", "UPDATE") },
    { requesterId: pm.requesterId, decided: promoDecided },
  );
  const promoEditValues = canEditPromoRequest ? await adProEditValues("PROMO_MATERIAL", pm.id) : null;

  const isDirection = hasGlobalView(user.role);
  const flags = {
    isMarketing: pm.requesterId === user.id || isDirection,
    isAssistant: user.role === "DIRECTION_ASSISTANT" || isDirection,
    isFinance: user.role === "FINANCE_BUDGET_MANAGER" || isDirection,
    isMedicalInfo: user.role === "MEDICAL_INFO_PHARMACIST" || isDirection,
    isDirection,
  };
  const canUpload = userCan(user, "PROMO_MATERIAL", "UPLOAD") || flags.isMarketing || flags.isAssistant || flags.isFinance || flags.isMedicalInfo;
  const canDelete = userCan(user, "PROMO_MATERIAL", "DELETE") || isDirection;

  const [documents, comments] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: pm.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.comment.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: pm.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const commentItems = comments.map((c) => ({
    id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId, body: c.body,
    createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null,
  }));
  const amount = pm.chosenAmount != null ? toNumber(pm.chosenAmount) : pm.amount != null ? toNumber(pm.amount) : null;

  return (
    <div className="space-y-5">
      <BackLink href="/promo-material"><ArrowLeft className="h-4 w-4" /> Matériel promotionnel</BackLink>
      <PageHeader title={pm.title} description={`Réf. ${pm.reference}`}>
        <StatusBadge map={PROMO_MATERIAL_STATUS} value={pm.status} />
        {canEditPromoRequest && promoEditValues && (
          <AdProEditButton kind="PROMO_MATERIAL" id={pm.id} decided={promoDecided} values={promoEditValues} />
        )}
        <SuperAdminDeleteButton kind="PROMO_MATERIAL" id={pm.id} name={pm.title} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Suivi du circuit</CardTitle></CardHeader>
        <CardContent><ValidationStepper steps={promoSteps(pm.status)} /></CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Agence retenue" value={pm.chosenAgency} />
              <Info label="Montant" value={amount != null ? formatCurrency(amount) : null} />
              <Info label="N° bon de commande" value={pm.bcReference} />
              <Info label="Visa publicitaire" value={pm.visaReference} />
              <Info label="Réf. autorités" value={pm.authorityRef} />
              <Info label="Marketing (demandeur)" value={names.requester} />
              <Info label="Assistante" value={names.assistant} />
              <Info label="BC validé le" value={pm.bcValidatedAt ? formatDate(pm.bcValidatedAt.toISOString()) : null} />
              <Info label="Paiement le" value={pm.paymentDoneAt ? formatDate(pm.paymentDoneAt.toISOString()) : null} />
              {pm.financeReminderCount > 0 && <Info label="Relances finances" value={`${pm.financeReminderCount}${pm.financeReminderAt ? ` · ${formatDateTime(pm.financeReminderAt.toISOString())}` : ""}`} />}
              {pm.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Brief</p><p className="whitespace-pre-wrap">{pm.description}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Documents (devis, BC, quittance, matériel, visa, facture…)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canUpload && <DocumentUpload entityType="PROMO_MATERIAL" entityId={pm.id} categories={PROMO_DOC_CATEGORIES} />}
              <DocumentList documents={docItems} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload} path={`/promo-material/${pm.id}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Commentaires & échanges</CardTitle></CardHeader>
            <CardContent>
              <CommentThread comments={commentItems} action={addPromoComment} hiddenFields={{ promoId: pm.id }} currentUserId={user.id} canModerate={flags.isAssistant || isDirection} updateAction={updateComment} deleteAction={deleteComment} path={`/promo-material/${pm.id}`} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <PromoActionPanel
            id={pm.id}
            status={pm.status}
            flags={flags}
            chosenAgency={pm.chosenAgency}
            bcReference={pm.bcReference}
            visaReference={pm.visaReference}
            authorityRef={pm.authorityRef}
            amount={amount}
            reminderCount={pm.financeReminderCount}
          />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
