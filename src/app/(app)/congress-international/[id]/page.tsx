import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { getCongressDetail } from "@/lib/queries/congress";
import { getEntityMissions } from "@/lib/queries/missions";
import { getWorkflowForEntity } from "@/lib/queries/workflow";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SupprimerDemandeAdPro } from "@/components/ad-pro/supprimer-demande";
import { peutSupprimerUneDemandeAdPro } from "@/lib/queries/ad-pro-suppression";
import { type DocItem } from "@/components/documents/document-list";
import { CONGRESS_REQUEST_STATUS } from "@/lib/labels";
import { CongressDetailView } from "../congress-detail-view";
import { getInvolvementThreads } from "@/lib/queries/involvement";
import { CarePanel } from "@/components/care/care-panel";
import { getCareDossier } from "@/lib/queries/care";
import { careDirectoryOptions, carePromoOptions } from "@/lib/actions/care-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdProTransferButton } from "@/components/ad-pro/transfer-button";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { BackLink } from "@/components/shared/back-link";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { AD_PRO_DOC_CATEGORIES, categoriesDuDepotDeLaDemande } from "@/lib/ad-pro/doc-categories";
import { canAttachToAdPro } from "@/lib/ad-pro/attachments";
import { AdProItemsPanel } from "@/components/ad-pro/items-panel";
import { PiecesLegalDeLaDemande } from "@/components/ad-pro/pieces-legal-demande";
import { loadAdProItems, adProBudgetOptions, contexteMaterielStock, contextePostes } from "@/lib/queries/ad-pro-items";
import { EspaceDiscussion } from "@/components/ad-pro/espace-discussion";
import { InvolvementConversations } from "@/components/ad-pro/involvement-conversations";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { toNumber } from "@/lib/utils";
import { siegeAuCentreAdPro } from "@/lib/ad-pro/centre";

export default async function CongressIntlDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_INTERNATIONAL");
  const detail = await getCongressDetail("INTL", user, params.id);
  if (!detail) notFound();

  // Impliquer une tierce personne : ouvert aux acteurs du circuit (National Sales,
  // référent Direction Marketing assigné, Direction) — le moteur pilote désormais la validation.
  const canInvolveThirdParty = hasGlobalView(user) || hasRole(user, "NATIONAL_SALES") || detail.productManagerId === user.id;
  // Le demandeur peut joindre des pièces à sa demande, même si son rôle n'a pas UPLOAD.
  // QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE. La règle vit dans
  // `ad-pro/attachments.ts`, la MÊME sur les cinq écrans Ad&Pro : chacun l'épelait à sa façon, et
  // chaque orthographe oubliait quelqu'un — la Direction qui valide, la Direction Marketing qui
  // analyse — qui envoyait alors la facture par mail, dossier vide.
  const attacheur = {
    id: user.id,
    canUploadModule: userCan(user, "CONGRESS_INTERNATIONAL", "UPLOAD"),
    canUpdateModule: userCan(user, "CONGRESS_INTERNATIONAL", "UPDATE"),
    canValidateModule: userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE"),
    hasGlobalView: hasGlobalView(user),
  };
  const dossierAdPro = { requesterId: detail.requesterId, productManagerId: detail.productManagerId };
  const canUpload = canAttachToAdPro(attacheur, dossierAdPro);
  const canDelete = userCan(user, "CONGRESS_INTERNATIONAL", "DELETE") || hasGlobalView(user);
  const docs = await prisma.document.findMany({
    where: { entityType: "CONGRESS_INTERNATIONAL", entityId: detail.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((dc) => ({
    id: dc.id, name: dc.name, category: dc.category, version: dc.version, sizeBytes: dc.sizeBytes,
    confidentiality: dc.confidentiality, uploadedBy: dc.uploadedBy?.name ?? null, createdAt: dc.createdAt.toISOString(), hasFile: Boolean(dc.fileKey),
  }));

  const [missions, canManageMissions, missionUsers, workflow] = await Promise.all([
    getEntityMissions("CONGRESS_INTERNATIONAL", detail.id),
    canAccessEntity(user, "CONGRESS_INTERNATIONAL", detail.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkflowForEntity(user, "CONGRESS_INTERNATIONAL", detail.id, detail.requesterId),
  ]);

  // Le dossier de prise en charge : les personnes, ce qu'il faut pour chacune, et les devis.
  const canDecideCare = hasGlobalView(user) || userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE");
  const canEditCare = userCan(user, "CONGRESS_INTERNATIONAL", "CREATE") || userCan(user, "CONGRESS_INTERNATIONAL", "UPDATE") || canDecideCare;
  const [care, directory, carePromos, intl] = await Promise.all([
    getCareDossier("INTERNATIONAL", detail.id),
    careDirectoryOptions(),
    carePromoOptions(),
    prisma.congressInternational.findUnique({ where: { id: detail.id }, select: { requestStatus: true, finalAmount: true } }),
  ]);

  // Corriger la demande : le demandeur tant qu'elle n'est pas tranchée, la Direction toujours.
  const requestDecided = isAdProDecided("CONGRESS_INTERNATIONAL", detail.requestStatus);
  const canEditRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canManage: userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE") },
    { requesterId: detail.requesterId, decided: requestDecided },
  );
  const editValues = canEditRequest ? await adProEditValues("CONGRESS_INTERNATIONAL", detail.id) : null;

  // POSTES de la prise en charge : consulting, traiteur, salle… chacun validé à part par la
  // Direction, avec son budget et son bon de commande. Même panneau que les autres opérations
  // Ad & Pro — la question « de quoi est fait ce montant » ne change pas d'un module à l'autre.
  const [items, promoOptions, budgetOptions, contexte, involvementThreads] = await Promise.all([
    loadAdProItems("CONGRESS_INTERNATIONAL", detail.id),
    promoMaterialOptions(),
    adProBudgetOptions(user),
    contextePostes(user, "CONGRESS_INTERNATIONAL", detail.id),
    getInvolvementThreads("CONGRESS_INTERNATIONAL", detail.id),
  ]);
  const canAllocateItems = hasGlobalView(user) || userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE");
  // LE MAGASIN où un poste « Matériel du stock » pioche, et qui confirme après l'événement (§118.167).
  const materielStock = await contexteMaterielStock(user, "CONGRESS_INTERNATIONAL", detail.id, canAllocateItems);

  return (
    <div className="space-y-5">
      <BackLink href="/congress-international">
        <ArrowLeft className="h-4 w-4" /> Prises en charge Internationales
      </BackLink>
      <PageHeader title={detail.name} description="Demande de prise en charge — congrès international.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
        {canEditRequest && editValues && (
          <AdProEditButton kind="CONGRESS_INTERNATIONAL" id={detail.id} decided={requestDecided} values={editValues} />
        )}
        {hasGlobalView(user) && <AdProTransferButton from="CONGRESS_INTERNATIONAL" sourceId={detail.id} title={detail.name} />}
        <SupprimerDemandeAdPro kind="CONGRESS_INTERNATIONAL" id={detail.id} name={detail.name} enabled={await peutSupprimerUneDemandeAdPro(user, "CONGRESS_INTERNATIONAL", detail.id)} />
      </PageHeader>
      {/* « + Pièce jointe » vit dans la carte « Informations » de la vue détaillée (audit n° 18). */}
      {/* LES PROFESSIONNELS PROPOSÉS POUR LA PRISE EN CHARGE — la seule liste de qui est pris en
          charge (décision du 04/10/2026), et leurs pièces juste dessous. Avant le reste : c'est la
          question qu'on se pose en ouvrant l'écran. */}
      <Card>
        <CardHeader><CardTitle>Professionnels proposés pour la prise en charge</CardTitle></CardHeader>
        <CardContent>
          <CarePanel
            scope="INTERNATIONAL"
            requestId={detail.id}
            beneficiaries={care.beneficiaries}
            quotes={care.quotes}
            directory={directory}
            eventApproved={["APPROVED", "COMPLETED"].includes(intl?.requestStatus ?? "")}
            canEdit={canEditCare}
            canDecide={canDecideCare}
            promoOptions={carePromos}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ce que couvre cette prise en charge</CardTitle></CardHeader>
        <CardContent>
          <AdProItemsPanel
            parent="CONGRESS_INTERNATIONAL"
            parentId={detail.id}
            items={items}
            amountGranted={intl?.finalAmount != null ? toNumber(intl.finalAmount) : null}
            decided={["APPROVED", "COMPLETED"].includes(intl?.requestStatus ?? "")}
            canEdit={userCan(user, "CONGRESS_INTERNATIONAL", "CREATE") || userCan(user, "CONGRESS_INTERNATIONAL", "UPDATE") || canAllocateItems}
            canAllocate={canAllocateItems}
            promoOptions={promoOptions}
            budgetOptions={budgetOptions}
            materiel={materielStock}
            canIssueOrder={userCan(user, "FINANCES", "UPDATE") || userCan(user, "FINANCES", "VALIDATE")}
            canViserBC={siegeAuCentreAdPro(user)}
            contexte={contexte}
          />
        </CardContent>
      </Card>

      {/* LES PIÈCES LEGAL RATTACHÉES À LA DEMANDE ELLE-MÊME, hors postes — d'avant les postes, ou qui ne sont pas des achats. */}
      <PiecesLegalDeLaDemande spectateur={user} entityType="CONGRESS_INTERNATIONAL" entityId={detail.id} />

      <CongressDetailView piecesJointes={{ entityType: "CONGRESS_INTERNATIONAL", entityId: detail.id, documents: docItems, peutDeposer: canUpload, categories: categoriesDuDepotDeLaDemande(AD_PRO_DOC_CATEGORIES), canDelete, canRename: canUpload, canEdit: onlyofficeConfigured() && canUpload, path: `/congress-international/${detail.id}`, }} detail={detail} workflow={workflow} canInvolveThirdParty={canInvolveThirdParty} entityType="CONGRESS_INTERNATIONAL" entityId={detail.id} documents={docItems} canUpload={canUpload} canDelete={canDelete} path={`/congress-international/${detail.id}`} missions={missions} missionUsers={missionUsers} canManageMissions={canManageMissions} currentUserId={user.id} involvementThreads={[]} canModerate={hasGlobalView(user)} />

      {/* LA SECTION DISCUSSION — le fil CANONIQUE de la demande et les échanges avec les personnes
          impliquées : un seul espace (la vue détaillée ne les rend plus à part). */}
      <EspaceDiscussion>
        <AdProDiscussionCard entityType="CONGRESS_INTERNATIONAL" entityId={detail.id} user={user} />
        <InvolvementConversations threads={involvementThreads} currentUserId={user.id} canManage={hasGlobalView(user)} />
      </EspaceDiscussion>

    </div>
  );
}
