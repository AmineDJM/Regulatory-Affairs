import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole, scopeSponsoring } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { getEntityMissions } from "@/lib/queries/missions";
import { getWorkflowForEntity } from "@/lib/queries/workflow";
import { MissionAssignmentsCard } from "@/components/missions/mission-assignments-card";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { DocItem } from "@/components/documents/document-list";
import { AD_PRO_DOC_CATEGORIES, categoriesDuDepotDeLaDemande } from "@/lib/ad-pro/doc-categories";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { SPONSORING_STATUS, SPONSORING_NATURE, PRIORITY } from "@/lib/labels";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import { AppealPanel } from "./decision-panel";
import { ThirdPartyButton } from "./third-party-button";
import { InvolvementConversations } from "@/components/ad-pro/involvement-conversations";
import { getInvolvementThreads } from "@/lib/queries/involvement";
import { SupprimerDemandeAdPro } from "@/components/ad-pro/supprimer-demande";
import { peutSupprimerUneDemandeAdPro } from "@/lib/queries/ad-pro-suppression";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { AdProItemsPanel } from "@/components/ad-pro/items-panel";
import { PiecesLegalDeLaDemande } from "@/components/ad-pro/pieces-legal-demande";
import { loadAdProItems, adProBudgetOptions, contexteMaterielStock, postesPourCloture, contextePostes } from "@/lib/queries/ad-pro-items";
import { CarteDetailsDemande } from "@/components/ad-pro/pieces-jointes-demande";
import { EspaceDiscussion } from "@/components/ad-pro/espace-discussion";
import { AdProTransferButton } from "@/components/ad-pro/transfer-button";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { BackLink } from "@/components/shared/back-link";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
import { siegeAuCentreAdPro } from "@/lib/ad-pro/centre";
import {
  bilanCloture, etatPostesSponsoring, peutCloturer, quiCloture as quiClotureDe, LIBELLE_QUI_CLOTURE,
} from "@/lib/ad-pro/cloture-sponsoring";
import { porteLeRoleQuiTranche } from "@/lib/personnes/referents-gamme";
import { ClosurePanel } from "./closure-panel";


// Une page qui dépend de QUI regarde ne se met jamais en cache : la même adresse rend autre chose pour le
// demandeur, pour la Direction et pour le Super Admin en Vue exacte (voir `lib/vue-exacte.ts`).
export const dynamic = "force-dynamic";

export default async function SponsoringDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("SPONSORING");
  // LA PORTÉE PAR LIGNE (§118.185, I4) : un délégué n'ouvre que SES demandes — la même phrase
  // qu'une demande inexistante, pour ne pas confirmer qu'un identifiant deviné existe.
  const req = await prisma.sponsoringRequest.findFirst({
    where: { AND: [{ id: params.id }, scopeSponsoring(user)] },
    include: { requester: { select: { name: true } } },
  });
  if (!req) notFound();

  // Rôles dans le circuit
  const canDirection = hasGlobalView(user) || userCan(user, "SPONSORING", "VALIDATE");
  // Étape préliminaire (attribuer la Direction Marketing) : réservée au National Sales
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

  // QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE. La règle vit dans
  // `ad-pro/attachments.ts` et elle est la MÊME sur les cinq écrans Ad&Pro : chacun l'épelait à
  // sa façon, et chaque orthographe oubliait quelqu'un — la Direction qui valide, le chef de
  // produit qui analyse — qui envoyait alors la facture par mail, dossier vide.
  const attacheur = {
    id: user.id,
    canUploadModule: userCan(user, "SPONSORING", "UPLOAD"),
    canUpdateModule: userCan(user, "SPONSORING", "UPDATE"),
    canValidateModule: userCan(user, "SPONSORING", "VALIDATE"),
    hasGlobalView: hasGlobalView(user),
  };
  const dossierAdPro = { requesterId: req.requesterId, productManagerId: req.productManagerId };
  const canUpload = canAttachToAdPro(attacheur, dossierAdPro);
  const uploadHint = attachHint(attacheur, dossierAdPro);
  const canDelete = userCan(user, "SPONSORING", "DELETE");

  // Postes du sponsoring : de quoi est fait le montant, à qui va l'argent, et où en est chacun
  // dans son propre circuit de validation (chargement mutualisé — voir queries/ad-pro-items).
  const [items, promoOptions, budgetOptions, contexte] = await Promise.all([
    loadAdProItems("SPONSORING", req.id),
    promoMaterialOptions(),
    adProBudgetOptions(user),
    contextePostes(user, "SPONSORING", req.id),
  ]);
  // DÉCIDÉE, TARDIVE, CLÔTURÉE — la MÊME lecture que les actions sur les postes (§118.151). La page
  // portait sa propre liste, sans la tenue pré-validée : « Émettre l'ordre » disparaissait sur
  // chaque poste d'un sponsoring pré-validé pendant que l'action l'aurait accepté (§118.5).
  const etatPostes = etatPostesSponsoring(req.status, req.closedAt);
  const decided = etatPostes.decide;

  // LA VALIDATION FINALE : le bilan que l'action relira au clic, et qui la tient — lu sur le
  // parcours GELÉ de l'instance (la borne dit si la Direction a tranché à la place de la
  // Direction Marketing, quand la demande venait d'elle).
  const [instanceBorne, closer] = await Promise.all([
    prisma.workflowInstance.findUnique({
      where: { entityType_entityId: { entityType: "SPONSORING", entityId: req.id } },
      select: { finalSlug: true },
    }),
    req.closedById ? prisma.user.findUnique({ where: { id: req.closedById }, select: { name: true } }) : Promise.resolve(null),
  ]);
  const qui = quiClotureDe(instanceBorne?.finalSlug ?? null);
  // LE BILAN se juge sur les postes tels que la CLÔTURE les lit — nature et matériel réservé compris
  // (§118.167) : la MÊME lecture que l'action et que l'op d'Adam.
  const bilan = bilanCloture(req.status, await postesPourCloture(req.id));
  // LE MAGASIN où un poste « Matériel du stock » pioche, et qui confirme après l'événement (§118.167).
  const materielStock = await contexteMaterielStock(user, "SPONSORING", req.id, canDirection);
  const peutAgirSurLaCloture = peutCloturer({
    estSuperAdmin: user.role === "SUPER_ADMIN",
    porteLeRoleQuiTranche: porteLeRoleQuiTranche(user),
    aLaVueGlobale: hasGlobalView(user),
    estLeDemandeur: req.requesterId === user.id,
  }, qui);

  const [missions, canManageMissions, missionUsers, workflow, involvementThreads] = await Promise.all([
    getEntityMissions("SPONSORING", req.id),
    canAccessEntity(user, "SPONSORING", req.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkflowForEntity(user, "SPONSORING", req.id, req.requesterId),
    getInvolvementThreads("SPONSORING", req.id),
  ]);

  // L'appel du délégué reste une action propre au sponsoring (après décision).
  const canAppeal = isRequester && ["APPROVED", "REFUSED"].includes(req.status);
  // L'ÉTAPE QUI TRANCHE cette demande — la dernière de SA route (la vue retire déjà les étapes hors
  // parcours) : c'est elle que l'appel rouvre (§118.186, R04), et la phrase doit la nommer.
  const etapeQuiTranche = workflow?.steps[workflow.steps.length - 1]?.title ?? null;
  const fmt = (v: unknown) => (v ? formatCurrency(toNumber(v as never)) : null);

  // Corriger la demande : le demandeur tant qu'elle n'est pas tranchée, la Direction toujours.
  const sponsoringDecided = isAdProDecided("SPONSORING", req.status);
  const canEditRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canManage: userCan(user, "SPONSORING", "VALIDATE") },
    { requesterId: req.requesterId, decided: sponsoringDecided },
  );
  const editValues = canEditRequest ? await adProEditValues("SPONSORING", req.id) : null;

  return (
    <div className="space-y-5">
      <BackLink href="/sponsoring">
        <ArrowLeft className="h-4 w-4" /> Retour au sponsoring
      </BackLink>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-xs text-muted-foreground">{req.reference}</span>
            <StatusBadge map={PRIORITY} value={req.strategicImportance} />
            {req.appealCount > 0 && <Badge tone="purple" dot={false}><Gavel className="mr-1 h-3 w-3" /> Appel ×{req.appealCount}</Badge>}
          </div>
          <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{req.institution}</h1>
          {req.doctor && <p className="break-words text-muted-foreground">{req.doctor} · {req.specialty}</p>}
        </div>
        {/* Au téléphone, statut et actions forment une rangée qui se replie ; en colonne à droite au-delà. */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-col sm:items-end">
          <StatusBadge map={SPONSORING_STATUS} value={req.status} />
          {canEditRequest && editValues && (
            <AdProEditButton kind="SPONSORING" id={req.id} decided={sponsoringDecided} values={editValues} />
          )}
          {(canPreliminary || canDirection || isProductManager || isRequester) && <ThirdPartyButton id={req.id} people={missionUsers} />}
          {hasGlobalView(user) && <AdProTransferButton from="SPONSORING" sourceId={req.id} title={req.institution} />}
          <SupprimerDemandeAdPro kind="SPONSORING" id={req.id} name={`${req.reference} — ${req.institution}`} enabled={await peutSupprimerUneDemandeAdPro(user, "SPONSORING", req.id)} />
        </div>
      </div>

      <div>
        <div className="space-y-5">
          {/* LES DÉTAILS ET LES PIÈCES JOINTES DE LA DEMANDE — la demande du médecin (obligatoire), le
              programme, la convention… : « + Pièce jointe » en haut à droite, la liste sous les détails.
              La chaîne d'achat (devis → BC → facture) vit sur chaque poste, plus bas. */}
          <CarteDetailsDemande
            titre="Détails de la demande"
            contentClassName="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 sm:gap-x-6"
            pieces={{
              entityType: "SPONSORING", entityId: req.id, documents: docItems,
              peutDeposer: canUpload, motif: canUpload ? null : (uploadHint ?? null),
              categories: categoriesDuDepotDeLaDemande(AD_PRO_DOC_CATEGORIES),
              canDelete, canRename: canUpload, canEdit: onlyofficeConfigured() && canUpload,
              path: `/sponsoring/${req.id}`,
            }}
          >
              <Info label="Type" value={req.type} />
              <Info label="Ville" value={req.city} />
              <Info label="Produit" value={req.product} />
              {/* LE SPONSORING DEMANDÉ ET LE SPONSORING SUGGÉRÉ — ce que la Direction a nommé, et pas
                  un « budget » : l'argent se décide poste par poste, puis à la clôture (§118.151). */}
              <Info label="Sponsoring demandé (médecin)" value={fmt(req.amountRequested)} />
              <Info label="Sponsoring suggéré (délégué)" value={fmt(req.amountProposed)} />
              <Info label="Nature" value={req.nature ? SPONSORING_NATURE[req.nature] : null} />
              <Info
                label={etatPostes.closParLaCloture ? "Montant accordé (clôture)" : "Montant accordé"}
                value={fmt(req.amountGranted) ?? (req.status === "PRE_VALIDATED" ? "fixé à la validation finale" : null)}
              />
              <Info label="Demandeur" value={req.requester?.name} />
              <Info label="Référent Direction Marketing" value={pmUser?.name} />
              <Info label="Validé par" value={req.validatedBy} />
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="break-words font-medium">{req.description || "—"}</p>
              </div>
              {req.comments && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Appréciation / recommandation (délégué)</p>
                  <p className="break-words font-medium">{req.comments}</p>
                </div>
              )}
          </CarteDetailsDemande>

          {/* LES POSTES DE LA DEMANDE — « dans les postes on voit tous les postes relatifs à cette
              demande » (§118.151). Le premier est le sponsoring lui-même, créé avec la demande
              (direct : versé à l'association ; indirect : prise en charge) ; les autres s'ajoutent
              après la pré-validation de la tenue. Chacun se décide à part, puis la validation
              finale les range dans leurs budgets et clôture. */}
          <Card>
            <CardHeader>
              <CardTitle>Postes de la demande</CardTitle>
            </CardHeader>
            <CardContent>
              <AdProItemsPanel
                parent="SPONSORING"
                parentId={req.id}
                items={items}
                amountGranted={req.amountGranted != null ? toNumber(req.amountGranted) : null}
                decided={decided}
                tardif={etatPostes.tardif}
                fige={etatPostes.clos}
                canEdit={userCan(user, "SPONSORING", "CREATE") || userCan(user, "SPONSORING", "UPDATE") || canDirection}
                canAllocate={canDirection}
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
          <PiecesLegalDeLaDemande spectateur={user} entityType="SPONSORING" entityId={req.id} />

          {/* Circuit de validation configurable (piloté par le moteur — éditable dans Administration) */}
          <Card>
            <CardHeader><CardTitle>Circuit de validation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {req.appealCount > 0 && (
                <p className="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-700">Cette demande a fait l'objet d'un appel ({req.appealCount}×) — réexamen par l'étape qui a tranché{etapeQuiTranche ? ` (« ${etapeQuiTranche} »)` : ""}.</p>
              )}
              {workflow ? (
                <WorkflowPanel entityType="SPONSORING" entityId={req.id} view={workflow} />
              ) : (
                <p className="text-sm text-muted-foreground">Circuit indisponible.</p>
              )}
              {canAppeal && (
                <div className="border-t border-border pt-3">
                  <AppealPanel id={req.id} etape={etapeQuiTranche} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* VALIDATION FINALE ET CLÔTURE (§118.151) — après la pré-validation de la tenue, quand
              les postes sont décidés et rangés dans leurs budgets. Une demande close par un
              TRANSFERT n'a rien à valider ici : elle vit dans un autre module. */}
          {(req.status !== "CLOSED" || etatPostes.closParLaCloture) && (
            <Card>
              <CardHeader><CardTitle>Validation finale et clôture</CardTitle></CardHeader>
              <CardContent>
                <ClosurePanel
                  id={req.id}
                  statut={req.status}
                  bilan={bilan}
                  peutAgir={peutAgirSurLaCloture}
                  quiCloture={LIBELLE_QUI_CLOTURE[qui]}
                  cloture={etatPostes.closParLaCloture && req.closedAt
                    ? {
                        le: formatDateTime(req.closedAt),
                        par: closer?.name ?? null,
                        note: req.closingNote,
                        montant: req.amountGranted != null ? toNumber(req.amountGranted) : null,
                      }
                    : null}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* LA SECTION DISCUSSION — le fil CANONIQUE de la demande et, dessous, les échanges avec les
          personnes impliquées : un seul espace. */}
      <EspaceDiscussion>
        <AdProDiscussionCard entityType="SPONSORING" entityId={req.id} user={user} />
        <InvolvementConversations threads={involvementThreads} currentUserId={user.id} canManage={hasGlobalView(user)} />
      </EspaceDiscussion>

      {/* TOUT EN BAS, PLEINE LARGEUR (Direction, 07/10) : « Accompagnants & délégués » et « Traçabilité » ne sont plus une
          colonne de droite — le reste de la fiche prend toute la largeur. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MissionAssignmentsCard
            entityType="SPONSORING"
            entityId={req.id}
            assignments={missions}
            users={missionUsers}
            canManage={canManageMissions}
            currentUserId={user.id}
            path={`/sponsoring/${req.id}`}
          />
        </div>
        <Card>
          <CardHeader><CardTitle>Traçabilité</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Créé le" value={formatDateTime(req.createdAt)} />
            <Info label="Modifié le" value={formatDateTime(req.updatedAt)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value || "—"}</p>
    </div>
  );
}
