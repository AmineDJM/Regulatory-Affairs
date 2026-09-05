import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_REQUEST_STATUS, PAYMENT_URGENCY, ENTITY_TYPE_LABELS } from "@/lib/labels";
import { canApprove, canResubmit, isOverdue, deadlineLabel, isWithFinance } from "@/lib/finance/payment-request";
import { isCompanionDossier } from "@/lib/finance/dossier-auto";
import { entityHref } from "@/lib/entity-href";
import { existingEntityIds } from "@/lib/entity-exists";
import { deadlineNatureLabel, deadlineNatureOf } from "@/lib/finance/deadline-nature";
import { PaymentDossier, type PieceView, type EventView } from "./dossier";
import { AskChief } from "@/components/shared/ask-chief";
import { realtimeVoiceConfigured, canUseRealtimeVoice } from "@/lib/assistant/voice-realtime";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return <div><p className="text-xs text-muted-foreground">{label}</p><div className="font-medium">{value}</div></div>;
}

/**
 * LE DOSSIER D'UNE DEMANDE DE PAIEMENT.
 *
 * Gardé par le CERCLE du dossier — le demandeur, le destinataire désigné, les Finances — et non
 * par un module : celui qui fait payer une facture n'a aucune raison d'accéder au grand livre,
 * et ne doit pourtant jamais perdre de vue SA demande.
 */
export default async function PaymentRequestPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const req = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { name: true } },
      pieces: { orderBy: { position: "asc" }, include: { replacedBy: { select: { id: true } } } },
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!req) notFound();

  // LE LIEN « SE RATTACHE À » N'EST PROPOSÉ QUE SI L'OBJET EXISTE ENCORE. Un dossier compagnon
  // survit à un congrès effacé ; `entityHref` en ferait un lien vers une page 404 (mesuré par
  // l'audit navigateur). Un `link` explicite est gardé tel quel : il a été posé par un circuit
  // qui sait où il mène.
  const rattachementHref = req.link
    ? req.link
    : req.entityType && req.entityId && (await existingEntityIds(req.entityType, [req.entityId])).has(req.entityId)
      ? entityHref(req.entityType, req.entityId)
      : null;

  const isFinance = user.role === "FINANCE_BUDGET_MANAGER"
    || userCan(user, "FINANCES", "VALIDATE") || userCan(user, "FINANCES", "UPDATE") || hasGlobalView(user.role);
  const isRequester = req.requesterId === user.id || hasGlobalView(user.role);
  // Un dossier de paiement porte des montants et des factures : il n'est pas public. Seuls le
  // demandeur, les Finances et le destinataire désigné y entrent.
  if (!isFinance && !isRequester && req.recipientId !== user.id) redirect("/validations/paiements");

  const [docs, people, validations] = await Promise.all([
    prisma.document.findMany({
      where: { id: { in: req.pieces.map((p) => p.documentId) } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // LES VALIDATIONS DÉJÀ DEMANDÉES, PIÈCE PAR PIÈCE. Sans elles, on redemande à valider ce
    // qui est déjà chez le Directeur Général : deux demandes arrivent sur le même écran et il
    // doit deviner laquelle fait foi.
    prisma.validationRequest.findMany({
      where: { entityType: "PAYMENT_REQUEST", entityId: req.id, documentId: { not: null } },
      select: { id: true, reference: true, status: true, documentId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.name]));
  const names = new Map(people.map((p) => [p.id, p.name]));

  // La validation la PLUS RÉCENTE par pièce : c'est elle qui décrit l'état actuel. Les
  // précédentes appartiennent à l'historique, que le fil du dossier porte déjà.
  const validationByDoc = new Map<string, (typeof validations)[number]>();
  for (const v of validations) if (v.documentId && !validationByDoc.has(v.documentId)) validationByDoc.set(v.documentId, v);

  const pieces: PieceView[] = req.pieces.map((p) => {
    const v = validationByDoc.get(p.documentId) ?? null;
    return {
      id: p.id, documentId: p.documentId, name: docName.get(p.documentId) ?? "Pièce",
      kind: p.kind, note: p.note, status: p.status, reviewNote: p.reviewNote,
      reviewedBy: p.reviewedById ? names.get(p.reviewedById) ?? null : null,
      replacedById: p.replacedBy?.id ?? null,
      addedBy: p.createdById ? names.get(p.createdById) ?? null : null,
      createdAt: formatDate(p.createdAt.toISOString()),
      validation: v ? { id: v.id, reference: v.reference, status: v.status } : null,
    };
  });
  const events: EventView[] = req.events.map((e) => ({
    id: e.id, kind: e.kind, message: e.message,
    actor: e.actorId ? names.get(e.actorId) ?? null : null,
    at: formatDateTime(e.at.toISOString()),
  }));

  // L'ORDRE DE DÉPENSE derrière ce dossier — sa référence se lit en tête d'un compagnon, pour
  // dire d'où il vient et où le paiement se décide.
  const companion = isCompanionDossier(req.origin);
  const order = req.expenseOrderId
    ? await prisma.expenseOrder.findUnique({ where: { id: req.expenseOrderId }, select: { reference: true } })
    : null;

  const amount = toNumber(req.amount);
  // `entityType` et l'attestation entrent dans le calcul : c'est le rattachement qui exempte un
  // BON DE VERSEMENT du bon de commande et de la facture.
  const approve = canApprove(
    { status: req.status, amount, entityType: req.entityType, paymentMethodStated: req.paymentMethodStated },
    req.pieces,
  );
  const resubmit = canResubmit(req, req.pieces);

  return (
    <div className="space-y-5">
      <BackLink href="/validations/paiements"><ArrowLeft className="h-4 w-4" /> Demandes de paiement</BackLink>
      <PageHeader title={req.title} description={`Réf. ${req.reference} · ${req.payee}`}>
        <StatusBadge map={PAYMENT_REQUEST_STATUS} value={req.status} />
        {isOverdue(req) && <Badge tone="danger" dot={false}>en retard</Badge>}
        {userCan(user, "CHIEF_OF_STAFF", "VIEW") && (
          <AskChief reference={req.reference} call={realtimeVoiceConfigured() && canUseRealtimeVoice(user)} />
        )}
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Le paiement demandé</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Info label="Montant" value={formatCurrency(amount)} />
          <Info label="Bénéficiaire" value={req.payee} />
          <Info
            label="Échéance"
            value={
              <>
                {deadlineLabel(req, PAYMENT_URGENCY)}
                {/* LA DATE SEULE NE DIT QU'À MOITIÉ : « le 15 » n'est pas la même chose selon
                    qu'il s'agit d'un engagement pris ou d'un repère. */}
                {req.dueDate && (
                  <span className={deadlineNatureOf(req.deadlineNature) === "FIXED" ? "block text-xs font-semibold text-destructive" : "block text-xs text-muted-foreground"}>
                    {deadlineNatureLabel(req.deadlineNature)}
                  </span>
                )}
              </>
            }
          />
          <Info label="Demandeur" value={names.get(req.requesterId) ?? "—"} />
          {/* Le destinataire n'existe plus à la création — la demande va au CENTRE. La ligne
              survit pour les demandes anciennes, qui en portent un : la masquer effacerait leur
              historique. `Info` ne rend rien quand la valeur est absente. */}
          <Info label="Destinataire (Finances)" value={req.recipientId ? names.get(req.recipientId) : null} />
          <Info label="Entité" value={req.company?.name} />
          {/* LE CONTACT — celui qu'on appelle quand une pièce manque ou qu'un virement n'arrive
              pas. Sans lui, on cherche dans les mails de quelqu'un qui est en congé. */}
          <Info
            label="Contact bénéficiaire"
            value={[req.contactName, req.contactPhone, req.contactEmail].filter(Boolean).join(" · ") || null}
          />
          <Info
            label="Moyen de paiement"
            value={req.paymentMethodStated
              ? <span className="text-success">Mentionné dans le document</span>
              : <span className="text-warning">Non déclaré</span>}
          />
          <Info label="Décidé par" value={req.decidedById ? names.get(req.decidedById) : null} />
          <Info label="Décidé le" value={req.decidedAt ? formatDate(req.decidedAt.toISOString()) : null} />
          {/* CE QUI A FAIT NAÎTRE CE PAIEMENT, ouvrable d'un clic. Un dossier compagnon ne porte
              pas de `link` : sa route se DÉDUIT du rattachement (`entityHref`), qui tient la
              table des routes en un seul endroit. La recopier ici l'aurait fait diverger. */}
          {rattachementHref ? (
            <Info
              label="Se rattache à"
              value={<Link href={rattachementHref} className="inline-flex items-center gap-1 text-primary hover:underline">
                {req.entityType ? ENTITY_TYPE_LABELS[req.entityType] ?? req.entityType : "l'objet d'origine"} <ExternalLink className="h-3 w-3" />
              </Link>}
            />
          ) : req.entityType && req.entityId ? (
            // L'objet d'origine a disparu : on le DIT, au lieu d'un lien qui répond 404.
            <Info label="Se rattache à" value={`${ENTITY_TYPE_LABELS[req.entityType] ?? req.entityType} — source supprimée`} />
          ) : null}
          {/* L'ORDRE DE DÉPENSE — le vrai objet du décaissement. On le NOMME : sans lui, un
              dossier compagnon parle d'un paiement dont on ne retrouve pas la trace. */}
          <Info label="Ordre de dépense" value={order?.reference} />
          {req.description && (
            <div className="col-span-full"><p className="text-xs text-muted-foreground">Contexte</p><p className="whitespace-pre-wrap">{req.description}</p></div>
          )}
          {req.holdReason && (
            <div className="col-span-full rounded-lg bg-warning/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">Motif de la mise en attente</p>
              <p className="whitespace-pre-wrap">{req.holdReason}</p>
            </div>
          )}
          {req.decisionNote && (
            <div className="col-span-full"><p className="text-xs text-muted-foreground">Note de décision</p><p className="whitespace-pre-wrap">{req.decisionNote}</p></div>
          )}
        </CardContent>
      </Card>

      <PaymentDossier
        id={req.id}
        reference={req.reference}
        status={req.status}
        isRequester={isRequester}
        isFinance={isFinance}
        pieces={pieces}
        events={events}
        people={people.filter((p) => p.id !== user.id)}
        canApproveNow={approve.ok}
        approveBlocker={approve.ok ? null : approve.reason ?? null}
        resubmitBlocker={resubmit.ok ? null : resubmit.reason ?? null}
        entityType={req.entityType}
        paymentMethodStated={req.paymentMethodStated}
        contact={{ name: req.contactName, phone: req.contactPhone, email: req.contactEmail }}
        isCompanion={companion}
        orderReference={order?.reference ?? null}
        withFinance={isWithFinance(req.status)}
      />
    </div>
  );
}
