import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_REQUEST_STATUS, PAYMENT_URGENCY, ENTITY_TYPE_LABELS } from "@/lib/labels";
import { canApprove, canResubmit, isOverdue, deadlineLabel } from "@/lib/finance/payment-request";
import { PaymentDossier, type PieceView, type EventView } from "./dossier";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return <div><p className="text-xs text-muted-foreground">{label}</p><div className="font-medium">{value}</div></div>;
}

export default async function PaymentRequestPage({ params }: { params: { id: string } }) {
  const user = await requireModule("VALIDATIONS");
  const req = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { name: true } },
      pieces: { orderBy: { position: "asc" }, include: { replacedBy: { select: { id: true } } } },
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!req) notFound();

  const isFinance = user.role === "FINANCE_BUDGET_MANAGER"
    || userCan(user, "FINANCES", "VALIDATE") || userCan(user, "FINANCES", "UPDATE") || hasGlobalView(user.role);
  const isRequester = req.requesterId === user.id || hasGlobalView(user.role);
  // Un dossier de paiement porte des montants et des factures : il n'est pas public. Seuls le
  // demandeur, les Finances et le destinataire désigné y entrent.
  if (!isFinance && !isRequester && req.recipientId !== user.id) redirect("/validations/paiements");

  const [docs, people] = await Promise.all([
    prisma.document.findMany({
      where: { id: { in: req.pieces.map((p) => p.documentId) } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.name]));
  const names = new Map(people.map((p) => [p.id, p.name]));

  const pieces: PieceView[] = req.pieces.map((p) => ({
    id: p.id, documentId: p.documentId, name: docName.get(p.documentId) ?? "Pièce",
    kind: p.kind, note: p.note, status: p.status, reviewNote: p.reviewNote,
    reviewedBy: p.reviewedById ? names.get(p.reviewedById) ?? null : null,
    replacedById: p.replacedBy?.id ?? null,
    addedBy: p.createdById ? names.get(p.createdById) ?? null : null,
    createdAt: formatDate(p.createdAt.toISOString()),
  }));
  const events: EventView[] = req.events.map((e) => ({
    id: e.id, kind: e.kind, message: e.message,
    actor: e.actorId ? names.get(e.actorId) ?? null : null,
    at: formatDateTime(e.at.toISOString()),
  }));

  const amount = toNumber(req.amount);
  const approve = canApprove({ status: req.status, amount }, req.pieces);
  const resubmit = canResubmit(req, req.pieces);

  return (
    <div className="space-y-5">
      <BackLink href="/validations/paiements"><ArrowLeft className="h-4 w-4" /> Demandes de paiement</BackLink>
      <PageHeader title={req.title} description={`Réf. ${req.reference} · ${req.payee}`}>
        <StatusBadge map={PAYMENT_REQUEST_STATUS} value={req.status} />
        {isOverdue(req) && <Badge tone="danger" dot={false}>en retard</Badge>}
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Le paiement demandé</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Info label="Montant" value={formatCurrency(amount)} />
          <Info label="Bénéficiaire" value={req.payee} />
          <Info label="Échéance" value={deadlineLabel(req, PAYMENT_URGENCY)} />
          <Info label="Demandeur" value={names.get(req.requesterId) ?? "—"} />
          <Info label="Destinataire (Finances)" value={req.recipientId ? names.get(req.recipientId) : "Tout le pôle"} />
          <Info label="Entité" value={req.company?.name} />
          <Info label="Décidé par" value={req.decidedById ? names.get(req.decidedById) : null} />
          <Info label="Décidé le" value={req.decidedAt ? formatDate(req.decidedAt.toISOString()) : null} />
          {req.link && (
            <Info
              label="Se rattache à"
              value={<Link href={req.link} className="inline-flex items-center gap-1 text-primary hover:underline">
                {req.entityType ? ENTITY_TYPE_LABELS[req.entityType] ?? req.entityType : "l'objet d'origine"} <ExternalLink className="h-3 w-3" />
              </Link>}
            />
          )}
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
        status={req.status}
        isRequester={isRequester}
        isFinance={isFinance}
        pieces={pieces}
        events={events}
        people={people.filter((p) => p.id !== user.id)}
        canApproveNow={approve.ok}
        approveBlocker={approve.ok ? null : approve.reason ?? null}
        resubmitBlocker={resubmit.ok ? null : resubmit.reason ?? null}
      />
    </div>
  );
}
