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
import { LinkedRecords } from "@/components/shared/linked-records";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import { CommentThread } from "@/components/shared/comment-thread";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PROMO_MATERIAL_STATUS } from "@/lib/labels";
import {
  canValidate, seesFullCircuit, progress, waitingOn, PROMO_STEP_LABEL, PROMO_TRACKS,
  type PromoState, type PromoTrack,
} from "@/lib/promo-material/circuit";
import { PromoActionPanel } from "./promo-panels";
import { PromoCircuitCard } from "./circuit-card";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

const PROMO_DOC_CATEGORIES = ["QUOTE", "PURCHASE_ORDER", "PAYMENT_SLIP", "PAYMENT_RECEIPT", "PROMO_MATERIAL_FILE", "AD_VISA", "INVOICE", "DELIVERY_NOTE", "SUPPORTING_DOC", "OTHER"];

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
  // QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE — la MÊME règle sur les cinq écrans
  // Ad&Pro (`ad-pro/attachments.ts`). Ici l'ancienne liste NOMMAIT quatre rôles : elle tenait
  // jusqu'à la première nomination qu'on oublie d'y ajouter. On lit désormais ce que la personne
  // peut FAIRE du dossier, et les quatre rôles y entrent par leurs droits — sans être nommés.
  const attacheur = {
    id: user.id,
    canUploadModule: userCan(user, "PROMO_MATERIAL", "UPLOAD"),
    canUpdateModule: userCan(user, "PROMO_MATERIAL", "UPDATE"),
    canValidateModule: userCan(user, "PROMO_MATERIAL", "VALIDATE"),
    hasGlobalView: isDirection,
  };
  const dossierAdPro = { requesterId: pm.requesterId, assistantId: pm.assistantId };
  const canUpload = canAttachToAdPro(attacheur, dossierAdPro)
    || flags.isMarketing || flags.isAssistant || flags.isFinance || flags.isMedicalInfo;
  const uploadHint = canUpload ? null : attachHint(attacheur, dossierAdPro);
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

  // LE CIRCUIT COURT — tout se tranche ICI, côté serveur : ce que la personne voit
  // (seesFullCircuit), ce qu'elle peut faire (canValidate), où en est le dossier. Le composant
  // client ne fait qu'afficher ce qui lui est permis.
  const circuitState = (pm.circuitState ?? null) as PromoState | null;
  const tracksDone = ((pm.tracksDone ?? "").split(",").map((s) => s.trim()).filter(Boolean) as PromoTrack[])
    .filter((t) => (PROMO_TRACKS as readonly string[]).includes(t));
  const circuitProgress = circuitState ? progress(circuitState, tracksDone) : { step: 0, total: 1 };
  const circuitProps = {
    id: pm.id,
    state: circuitState,
    tracksDone: tracksDone as string[],
    showFull: seesFullCircuit(user),
    canAct: circuitState ? canValidate(user, circuitState, { requesterId: pm.requesterId, managerId: pm.managerId }) : false,
    canDrive: flags.isMarketing || flags.isAssistant || isDirection || user.role === "SUPER_ADMIN",
    waitingLabel: circuitState ? waitingOn(circuitState, tracksDone) : "—",
    progressStep: circuitProgress.step,
    progressTotal: circuitProgress.total,
  };

  return (
    <div className="space-y-5">
      <BackLink href="/promo-material"><ArrowLeft className="h-4 w-4" /> Matériel promotionnel</BackLink>
      <PageHeader title={pm.title} description={`Réf. ${pm.reference}`}>
        {circuitState
          ? <StatusBadge map={{ [circuitState]: { label: PROMO_STEP_LABEL[circuitState], tone: circuitState === "REFUSED" ? "danger" : circuitState === "COMPLETED" ? "success" : "info" } }} value={circuitState} />
          : <StatusBadge map={PROMO_MATERIAL_STATUS} value={pm.status} />}
        {canEditPromoRequest && promoEditValues && (
          <AdProEditButton kind="PROMO_MATERIAL" id={pm.id} decided={promoDecided} values={promoEditValues} />
        )}
        <SuperAdminDeleteButton kind="PROMO_MATERIAL" id={pm.id} name={pm.title} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>

      {/* Le circuit COURT — la frise des quinze étapes n'existe plus. Ce que chacun voit ici
          dépend de qui il est : la chaîne entière pour PDG / Super Admin, l'étape en cours pour
          les autres (règle `seesFullCircuit`, tranchée côté serveur). */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Suivi du circuit</CardTitle></CardHeader>
        <CardContent><PromoCircuitCard {...circuitProps} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
              {canUpload
                ? <DocumentUpload entityType="PROMO_MATERIAL" entityId={pm.id} categories={PROMO_DOC_CATEGORIES} />
                : uploadHint && <p className="text-xs text-muted-foreground">{uploadHint}</p>}
              <DocumentList documents={docItems} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload} path={`/promo-material/${pm.id}`} />
            </CardContent>
          </Card>

          {/* CE QUI EN DÉCOULE : engagement, facture, courrier. Le mécanisme connaissait déjà ce
              type de dossier ; il ne manquait que le bloc — et l'on ne pouvait donc RIEN rattacher
              à un dossier de matériel. Créés d'ici, ils gardent le lien : c'est le seul moment où
              l'on sait de quoi ils viennent, et le seul où le rattachement ne coûte rien. */}
          <LinkedRecords entityType="PROMO_MATERIAL" entityId={pm.id} reference={pm.reference} canCreate={canUpload} />

          <Card>
            <CardHeader><CardTitle>Commentaires & échanges</CardTitle></CardHeader>
            <CardContent>
              <CommentThread comments={commentItems} action={addPromoComment} hiddenFields={{ promoId: pm.id }} currentUserId={user.id} canModerate={flags.isAssistant || isDirection} updateAction={updateComment} deleteAction={deleteComment} path={`/promo-material/${pm.id}`} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Les cartes d'action de l'ANCIEN parcours ne servent qu'aux dossiers d'avant la
              réforme : un dossier au circuit court se pilote depuis la carte « Suivi du circuit ». */}
          {!circuitState && (
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
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
