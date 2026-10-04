import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole, anyRoleFilter } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { porteeModificationEvenement } from "@/lib/events/modification";
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
import { SupprimerDemandeAdPro } from "@/components/ad-pro/supprimer-demande";
import { peutSupprimerUneDemandeAdPro } from "@/lib/queries/ad-pro-suppression";
import { BackLink } from "@/components/shared/back-link";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { AdProItemsPanel } from "@/components/ad-pro/items-panel";
import { PiecesLegalDeLaDemande } from "@/components/ad-pro/pieces-legal-demande";
import { loadAdProItems, adProBudgetOptions, contexteMaterielStock, contextePostes } from "@/lib/queries/ad-pro-items";
import { CarteDetailsDemande } from "@/components/ad-pro/pieces-jointes-demande";
import { EspaceDiscussion } from "@/components/ad-pro/espace-discussion";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { toNumber } from "@/lib/utils";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { AD_PRO_DOC_CATEGORIES, categoriesDuDepotDeLaDemande } from "@/lib/ad-pro/doc-categories";
import { getAdProCreateData } from "@/lib/queries/ad-pro";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import type { DocItem } from "@/components/documents/document-list";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
import { siegeAuCentreAdPro } from "@/lib/ad-pro/centre";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("EVENTS");
  const e = await getEventDetail(params.id);
  if (!e) notFound();
  // LA PORTE DE LA FICHE (§118.184) : société, parties prenantes. Un identifiant ne suffit plus à ouvrir
  // l'événement d'une autre société — hors de cette porte, il est introuvable, comme s'il n'existait pas.
  if (!(await canAccessEntity(user, "EVENT", e.id, "VIEW"))) notFound();
  // LE FORMULAIRE COMPLET : qui tranche les événements, ou la vue globale — et après la décision, la
  // seule organisation (`events/modification.ts`, la même règle que l'action). Le droit UPDATE seul
  // l'ouvrait à tous les délégués, sur les événements de leurs collègues.
  const eventDecided = e.requestStatus ? isAdProDecided("EVENT", e.requestStatus) : false;
  const porteeEdition = porteeModificationEvenement({
    vueGlobale: hasGlobalView(user), tranche: userCan(user, "EVENTS", "VALIDATE"), decided: eventDecided,
  });
  const canManage = porteeEdition !== "AUCUNE" && (await canAccessEntity(user, "EVENT", e.id, "UPDATE"));
  const canDelete = userCan(user, "EVENTS", "DELETE");
  // Circuit de prise en charge (financement) — mêmes rôles que pour les congrès.
  const canMarketing = hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN";
  const canValidate = hasGlobalView(user);
  // SOUMETTRE — ET RELANCER APRÈS UN REFUS (§118.186) — : l'organisateur, ou qui modifie l'événement en
  // entier. La même règle que l'action : un bouton offert à qui l'action refusera fait chercher une
  // panne qui n'existe pas (§118.83).
  const sonEvenement = e.requesterId === user.id || (!e.requesterId && e.createdById === user.id);
  const canSubmit = userCan(user, "EVENTS", "CREATE") && (sonEvenement || hasGlobalView(user) || userCan(user, "EVENTS", "VALIDATE"));
  // LES MÊMES RÉFÉRENTIELS QU'À LA CRÉATION. Le formulaire de modification porte les mêmes champs
  // obligatoires (`champsManquants` est lu par les deux actions) : sans les menus, la personne
  // devrait ressaisir en texte libre ce qu'elle avait choisi dans l'annuaire — et l'action la
  // refuserait pour un champ qu'elle ne sait plus proposer.
  const [items, promoOptions, budgetOptions, adPro, contexte] = await Promise.all([
    loadAdProItems("EVENT", e.id),
    promoMaterialOptions(),
    adProBudgetOptions(user),
    canManage ? getAdProCreateData(user.id, ["EVENT"]) : Promise.resolve(null),
    contextePostes(user, "EVENT", e.id),
  ]);
  const canAllocateItems = hasGlobalView(user) || userCan(user, "EVENTS", "VALIDATE");
  // LE MAGASIN où un poste « Matériel du stock » pioche, et qui confirme après l'événement (§118.167).
  const materielStock = await contexteMaterielStock(user, "EVENT", e.id, canAllocateItems);

  // CORRIGER LA DEMANDE : le demandeur tant qu'elle n'est pas tranchée, la Direction toujours.
  const canEditEventRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canManage: userCan(user, "EVENTS", "VALIDATE") },
    { requesterId: e.requesterId ?? null, decided: eventDecided },
  );
  const eventEditValues = canEditEventRequest ? await adProEditValues("EVENT", e.id) : null;
  const [responsibles, missions, workflow, documents, involvementThreads] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getEntityMissions("EVENT", e.id),
    getWorkflowForEntity(user, "EVENT", e.id, e.requesterId ?? null),
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
        {canManage && (
          <EditEventButton
            event={e}
            responsibles={responsibles}
            referentiels={adPro ? {
              doctors: adPro.doctors, products: adPro.products,
              specialties: adPro.specialties, specialtiesHeritees: adPro.specialtiesHeritees,
              businessUnits: adPro.businessUnits, businessUnitDeduite: adPro.businessUnitDeduite,
            } : undefined}
            canDelete={canDelete}
            organisationSeule={porteeEdition === "ORGANISATION"}
          />
        )}
        {/* Le DEMANDEUR corrige sa demande tant qu'elle n'est pas tranchée (les gestionnaires
            ont déjà l'édition complète juste au-dessus — inutile de doubler leur bouton). */}
        {!canManage && canEditEventRequest && eventEditValues && (
          <AdProEditButton kind="EVENT" id={e.id} decided={eventDecided} values={eventEditValues} />
        )}
        <SupprimerDemandeAdPro kind="EVENT" id={e.id} name={e.name} enabled={await peutSupprimerUneDemandeAdPro(user, "EVENT", e.id)} />
      </PageHeader>

      <div className="grid gap-5">
        {/* LES INFORMATIONS ET LES PIÈCES JOINTES DE L'ÉVÉNEMENT — convention, programme, photos… :
            « + Pièce jointe » en haut à droite. La chaîne d'achat vit sur chaque poste. */}
        <CarteDetailsDemande
          titre="Informations"
          contentClassName="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3"
          pieces={{
            entityType: "EVENT", entityId: e.id, documents: docItems,
            peutDeposer: canUploadDocs, motif: uploadHint,
            categories: categoriesDuDepotDeLaDemande(AD_PRO_DOC_CATEGORIES),
            canDelete: userCan(user, "EVENTS", "DELETE") || hasGlobalView(user),
            canRename: canUploadDocs, canEdit: onlyofficeConfigured() && canUploadDocs,
            path: `/events/${e.id}`,
          }}
        >
            <Info label="Dates" value={[e.startDate && formatDate(e.startDate), e.endDate && formatDate(e.endDate)].filter(Boolean).join(" → ") || "—"} />
            <Info label="Lieu" value={[e.location, e.city, e.country].filter(Boolean).join(", ")} />
            <Info label="Spécialité" value={e.specialty} />
            <Info label="Produits" value={e.products} />
            <Info label="Capacité" value={e.capacity ? String(e.capacity) : "Illimitée"} />
            <Info label="Budget estimé" value={e.estimatedBudget !== null ? formatCurrency(e.estimatedBudget) : "—"} />
            <Info label="Responsable" value={e.responsibleName} />
            {e.meetingLink && <div className="col-span-full"><a href={e.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Video className="h-4 w-4" /> Lien de connexion (webinar)</a></div>}
            {e.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Description</p><p className="whitespace-pre-wrap">{e.description}</p></div>}
        </CarteDetailsDemande>

      </div>

      {/* LE BLOC « SUIVI DE VALIDATION » A ÉTÉ RETIRÉ (demande de la Direction, 09/2026).
          Il montrait une frise « Brouillon → En attente → Validé » dérivée de `Event.status`,
          c'est-à-dire d'un champ que le formulaire « Modifier » écrivait à la main — et il
          invitait même à le faire (« Faites avancer la validation via Modifier »). Un événement
          pouvait donc s'afficher « Validé » sans qu'aucune étape ne l'ait validé : deux vérités
          sur la même question, et c'est la plus flatteuse qui gagnait (§118.5, §118.138).
          La SEULE frise de validation est désormais celle du circuit, juste en dessous, et
          `lib/events/statut.ts` interdit au formulaire d'écrire un verdict. */}

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
            materiel={materielStock}
            canIssueOrder={userCan(user, "FINANCES", "UPDATE") || userCan(user, "FINANCES", "VALIDATE")}
            canViserBC={siegeAuCentreAdPro(user)}
            contexte={contexte}
          />
        </CardContent>
      </Card>

      {/* LES PIÈCES LEGAL RATTACHÉES À LA DEMANDE ELLE-MÊME, hors postes — d'avant les postes, ou qui ne sont pas des achats. */}
      <PiecesLegalDeLaDemande spectateur={user} entityType="EVENT" entityId={e.id} />

      {e.stats.bySpecialty.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Répartition par spécialité</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {e.stats.bySpecialty.map((s) => <Badge key={s.name} tone="info" dot={false}>{s.name} · {s.count}</Badge>)}
          </CardContent>
        </Card>
      )}

      <MissionAssignmentsCard
        entityType="EVENT"
        entityId={e.id}
        assignments={missions}
        users={responsibles}
        canManage={canManage}
        currentUserId={user.id}
        path={`/events/${e.id}`}
      />

      {/* LA SECTION DISCUSSION — le fil CANONIQUE de la demande et les échanges avec les personnes
          impliquées : un seul espace. */}
      <EspaceDiscussion>
        <AdProDiscussionCard entityType="EVENT" entityId={e.id} user={user} />
        <InvolvementConversations threads={involvementThreads} currentUserId={user.id} canManage={hasGlobalView(user)} />
      </EspaceDiscussion>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
