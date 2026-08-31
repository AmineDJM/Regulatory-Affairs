import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldPlus, CheckCircle2, Clock, HandCoins } from "lucide-react";
import { requireUser } from "@/lib/session";
import { hasGlobalView, userCan, scopeCongressIntl, scopeCongressNational } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDeclaration, canViewDeclaration, sourceLink } from "@/lib/queries/medical-info";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { CommentThread } from "@/components/shared/comment-thread";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { addMedicalInfoComment } from "@/lib/actions/medical-info-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { MEDICAL_INFO_STATUS, DOC_REQUEST_STATUS, ENTITY_TYPE_LABELS } from "@/lib/labels";
import { RequestDocForm, CancelRequestButton, FulfillForm, AuthorityForm, ValidateButton, DirectionValidateButton, BvCard, AuthorityLocked } from "./panels";
import { bvCanDeliver, bvCanRequest, bvCanRequestQuittance, bvStage, bvUnlocksAuthorities } from "@/lib/medical-info/bv";
import { bvStateOf } from "@/lib/medical-info/bv-state";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function DeclarationDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const decl = await getDeclaration(params.id);
  if (!decl) notFound();
  if (!canViewDeclaration(user, decl)) notFound();

  const canManage = hasGlobalView(user.role) || userCan(user, "MEDICAL_INFO", "VALIDATE");

  // ── LE BON DE VERSEMENT : l'étape qui précède la déclaration aux autorités ────────────────
  // Deux temps. Le bon est d'abord ACCORDÉ — trois signatures : le responsable, le chef de
  // produit du dossier, puis le centre de validations — et la quittance n'est demandée au
  // paiement qu'ensuite. L'état ne vit dans aucun champ : il se compose de la validation, de la
  // demande de paiement, de son passage au centre, de son règlement et de la remise au bureau du
  // PRIM. C'est cette REMISE qui ouvre la déclaration : « payé » ne veut pas dire « le
  // pharmacien a le papier en main ».
  const bv = await bvStateOf(decl);
  const bvEtape = bvStage(bv);
  const autoritesOuvertes = bvUnlocksAuthorities(bv);
  const canDeliverBv = bvCanDeliver(bv) && (userCan(user, "FINANCES", "UPDATE") || hasGlobalView(user.role));
  const bvMontant = decl.bvRequestId
    ? await prisma.paymentRequest.findUnique({ where: { id: decl.bvRequestId }, select: { amount: true } })
    : null;
  const bvRemisPar = decl.bvDeliveredById
    ? await prisma.user.findUnique({ where: { id: decl.bvDeliveredById }, select: { name: true } })
    : null;
  const isValidated = decl.status === "VALIDATED";
  const isAwaitingDirection = decl.status === "AWAITING_DIRECTION";
  const isDirection = hasGlobalView(user.role);
  const link = sourceLink(decl.sourceType, decl.sourceId);
  // On ne montre le lien vers l'événement source que s'il est RÉELLEMENT ouvrable
  // par cet utilisateur (sinon la page source renvoyait un 404 — hors portée).
  let canOpenSource = false;
  if (link) {
    if (hasGlobalView(user.role)) canOpenSource = true;
    else if (decl.sourceType === "SPONSORING") canOpenSource = userCan(user, "SPONSORING", "VIEW");
    else if (decl.sourceType === "CONGRESS_INTERNATIONAL")
      canOpenSource = userCan(user, "CONGRESS_INTERNATIONAL", "VIEW") &&
        (await prisma.congressInternational.count({ where: { id: decl.sourceId, ...scopeCongressIntl(user) } })) > 0;
    else if (decl.sourceType === "CONGRESS_NATIONAL")
      canOpenSource = userCan(user, "CONGRESS_NATIONAL", "VIEW") &&
        (await prisma.congressNational.count({ where: { id: decl.sourceId, ...scopeCongressNational(user) } })) > 0;
    else if (decl.sourceType === "EVENT") canOpenSource = userCan(user, "EVENTS", "VIEW");
  }
  const amount = decl.amount != null ? toNumber(decl.amount) : null;
  const pendingCount = decl.requests.filter((r) => r.status === "PENDING").length;

  const [documents, users, comments, sourceDocuments, requesterUser] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    canManage
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.comment.findMany({
      where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Pièces déjà jointes à l'événement source (congrès / sponsoring), consultables ici.
    prisma.document.findMany({
      where: { entityType: decl.sourceType, entityId: decl.sourceId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    decl.requesterId ? prisma.user.findUnique({ where: { id: decl.requesterId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  const toDocItem = (d: (typeof documents)[number]): DocItem => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  });
  const sourceDocItems: DocItem[] = sourceDocuments.map(toDocItem);

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const docById = new Map(documents.map((d) => [d.id, d.name]));
  const commentItems = comments.map((c) => ({
    id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId, body: c.body,
    createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/information-medicale">
        <ArrowLeft className="h-4 w-4" /> Retour à l'information médicale
      </BackLink>

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
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge map={MEDICAL_INFO_STATUS} value={decl.status} />
          <SuperAdminDeleteButton kind="MEDICAL_INFO_DECLARATION" id={decl.id} name={decl.reference} enabled={user.role === "SUPER_ADMIN"} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          {/* Synthèse */}
          <Card>
            <CardHeader><CardTitle>Événement déclaré</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Type" value={ENTITY_TYPE_LABELS[decl.sourceType] ?? decl.sourceType} />
              <Row label="Demandeur (à la source)" value={requesterUser?.name ?? "—"} />
              <Row label="Budget accordé" value={amount != null ? formatCurrency(amount) : "—"} />
              <Row label="Bénéficiaire" value={decl.beneficiary ?? "—"} />
              <Row label="Pharmacien responsable" value={decl.pharmacist?.name ?? "Non assigné"} />
              <Row label="Créé le" value={formatDate(decl.createdAt.toISOString())} />
              {decl.pharmacistValidatedAt && <Row label="Validé (pharmacien) le" value={formatDateTime(decl.pharmacistValidatedAt.toISOString())} />}
              {isValidated && decl.validatedAt && <Row label="Validé (Direction) le" value={formatDateTime(decl.validatedAt.toISOString())} />}
              {link && canOpenSource && (
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

          {/* Documents joints à l'événement source (congrès / sponsoring) */}
          {sourceDocItems.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Documents de l'événement</CardTitle>
                <span className="text-xs text-muted-foreground">{ENTITY_TYPE_LABELS[decl.sourceType] ?? decl.sourceType}</span>
              </CardHeader>
              <CardContent>
                <DocumentList documents={sourceDocItems} canDelete={false} path={`/information-medicale/${decl.id}`} />
              </CardContent>
            </Card>
          )}

          {/* Documents déposés */}
          {docItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Documents déposés</CardTitle></CardHeader>
              <CardContent>
                <DocumentList documents={docItems} canDelete={canManage} canEdit={onlyofficeConfigured() && canManage} path={`/information-medicale/${decl.id}`} />
              </CardContent>
            </Card>
          )}

          {/* Espace de discussion (pharmacien · Direction · parties prenantes) */}
          <Card>
            <CardHeader><CardTitle>Commentaires & échanges</CardTitle></CardHeader>
            <CardContent>
              <CommentThread
                comments={commentItems}
                action={addMedicalInfoComment}
                hiddenFields={{ declarationId: decl.id }}
                currentUserId={user.id}
                canModerate={canManage}
                updateAction={updateComment}
                deleteAction={deleteComment}
                path={`/information-medicale/${decl.id}`}
              />
            </CardContent>
          </Card>
        </div>

        {/* Colonne latérale : actions du pharmacien */}
        <div className="space-y-5">
          {canManage && !isValidated && (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Demander une pièce</CardTitle></CardHeader>
                <CardContent><RequestDocForm declarationId={decl.id} users={users} /></CardContent>
              </Card>
              {/* LE BON DE VERSEMENT vient AVANT : on ne déclare pas aux autorités sans avoir
                  versé la taxe, et sans le bon en main — c'est ce papier qu'on dépose. */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HandCoins className="h-4 w-4" /> Bon de versement</CardTitle></CardHeader>
                <CardContent>
                  <BvCard
                    id={decl.id}
                    stage={bvEtape}
                    amount={bvMontant ? toNumber(bvMontant.amount) : null}
                    deliveredAt={decl.bvDeliveredAt?.toISOString() ?? null}
                    deliveredBy={bvRemisPar?.name ?? null}
                    skipReason={decl.bvSkipReason}
                    bvAmount={decl.bvAmount ? toNumber(decl.bvAmount) : null}
                    canRequest={bvCanRequest(bv)}
                    canRequestQuittance={canManage && bvCanRequestQuittance(bv)}
                    canDeliver={canDeliverBv}
                    canSkip={!autoritesOuvertes && bvCanRequest(bv)}
                    requestHref={decl.bvRequestId ? `/validations/paiements/${decl.bvRequestId}` : null}
                    validationHref={decl.bvValidationId ? `/validations/${decl.bvValidationId}` : null}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldPlus className="h-4 w-4" /> Déclaration aux autorités</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {/* FERMÉE tant que le bon n'est pas remis. Le serveur applique la même règle :
                      masquer une carte est du confort, le refus est la règle. */}
                  {autoritesOuvertes ? (
                    <>
                      <AuthorityForm id={decl.id} authorityRef={decl.authorityRef} authorityNotes={decl.authorityNotes} />
                      <div className="space-y-1.5 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">Joindre un document (récépissé, accusé… — facultatif)</p>
                        <DocumentUpload entityType="MEDICAL_INFO_DECLARATION" entityId={decl.id} categories={["SUPPORTING_DOC", "OTHER"]} compact />
                      </div>
                    </>
                  ) : (
                    <AuthorityLocked stage={bvEtape} />
                  )}
                </CardContent>
              </Card>
              {!isAwaitingDirection && (
                <Card className="border-success/40">
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-success" /> Validation (pharmacien)</CardTitle></CardHeader>
                  <CardContent><ValidateButton id={decl.id} hasPending={pendingCount > 0} /></CardContent>
                </Card>
              )}
            </>
          )}

          {/* Direction : validation finale → ordre de dépense (comptable) */}
          {isDirection && isAwaitingDirection && (
            <Card className="border-success/50">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-success" /> Validation finale (Direction)</CardTitle></CardHeader>
              <CardContent><DirectionValidateButton id={decl.id} amount={amount} /></CardContent>
            </Card>
          )}

          {/* Validé par le pharmacien → en attente de la Direction (vue des autres) */}
          {isAwaitingDirection && !isDirection && (
            <Card className="border-warning/40">
              <CardContent className="flex items-start gap-2 py-5 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                Validé par le pharmacien responsable. En attente de la <strong>validation finale de la Direction</strong> (pour le comptable).
              </CardContent>
            </Card>
          )}

          {isValidated && (
            <Card className="border-success/40">
              <CardContent className="space-y-2 py-5 text-sm">
                <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-5 w-5" /> Déclaration validée</p>
                <p className="text-muted-foreground">L'événement a été validé par le pharmacien responsable puis par la Direction.{amount && amount > 0 ? " L'ordre de dépense a été transmis au comptable." : ""}</p>
                {decl.authorityRef && <p className="text-muted-foreground">Référence autorités : <span className="font-medium text-foreground">{decl.authorityRef}</span></p>}
              </CardContent>
            </Card>
          )}

          {!canManage && !isValidated && !isAwaitingDirection && (
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
