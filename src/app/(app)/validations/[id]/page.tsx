import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Paperclip } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { VALIDATION_STATUS, VALIDATION_STEP_STATE, VALIDATION_MODE, PRIORITY } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/utils";
import { WithdrawRequestButton } from "./withdraw";

export const dynamic = "force-dynamic";

/**
 * LA FICHE D'UNE DEMANDE DE VALIDATION — ce qu'on a demandé, à qui, où ça en est.
 *
 * Le tableau des demandes disait le statut ; il ne permettait pas d'OUVRIR. On ne pouvait donc
 * ni relire ce qu'on avait écrit, ni rouvrir la pièce envoyée, ni voir qui bloquait — il fallait
 * demander au validateur, ce qui est précisément le coup de fil que ce module doit éviter.
 *
 * QUI PEUT LA VOIR : le demandeur, les validateurs désignés, et le Super Admin. Une demande de
 * validation porte souvent une pièce sensible (un contrat, une facture) : la rendre lisible à
 * tout le module l'aurait ouverte bien plus largement que la file de validation elle-même.
 */
export default async function ValidationRequestPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const req = await prisma.validationRequest.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { id: true, name: true } },
      steps: {
        orderBy: [{ order: "asc" }],
        include: { validator: { select: { id: true, name: true } } },
      },
    },
  });
  if (!req) notFound();

  const estDemandeur = req.requesterId === user.id;
  const estValidateur = req.steps.some((e) => e.validatorId === user.id);
  if (!estDemandeur && !estValidateur && user.role !== "SUPER_ADMIN") notFound();

  // LES PIÈCES : celles attachées à la demande, et celle qu'elle VISE quand la validation porte
  // sur un document précis d'un autre dossier.
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { entityType: "VALIDATION_REQUEST", entityId: req.id },
        ...(req.documentId ? [{ id: req.documentId }] : []),
      ],
    },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  // Le retrait n'est possible que tant que PERSONNE ne s'est prononcé : l'accord d'un tiers est
  // un fait, il ne s'efface pas. L'action revérifie — ceci n'est que l'affichage.
  const vierge = req.status === "PENDING" && req.steps.every((e) => e.status === "PENDING");

  return (
    <div className="space-y-5">
      <BackLink href="/validations">
        <ArrowLeft className="h-4 w-4" /> Demandes de validations
      </BackLink>

      <PageHeader title={req.title} description={`${req.reference} · ${req.module}`}>
        {(estDemandeur || user.role === "SUPER_ADMIN") && (
          <WithdrawRequestButton id={req.id} reference={req.reference} canWithdraw={vierge} />
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>La demande</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Info label="Statut"><StatusBadge map={VALIDATION_STATUS} value={req.status} /></Info>
              <Info label="Priorité"><StatusBadge map={PRIORITY} value={req.priority} dot={false} /></Info>
              <Info label="Circuit"><span className="font-medium">{VALIDATION_MODE[req.mode] ?? req.mode}</span></Info>
              <Info label="Demandeur"><span className="font-medium">{req.requester.name}</span></Info>
              <Info label="Déposée le"><span className="font-medium">{formatDateTime(req.createdAt)}</span></Info>
              <Info label="Échéance"><span className="font-medium">{req.deadline ? formatDate(req.deadline) : "—"}</span></Info>
              {req.amount !== null && (
                <Info label="Montant"><span className="font-semibold">{formatCurrency(toNumber(req.amount))}</span></Info>
              )}
              {req.link && (
                <div className="col-span-2 min-w-0 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Objet visé</p>
                  <Link href={req.link} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Ouvrir l&apos;objet d&apos;origine <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {req.description && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Détails</p>
                  <p className="whitespace-pre-wrap">{req.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Pièces
                <span className="text-sm font-normal text-muted-foreground">({docItems.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune pièce jointe à cette demande.</p>
              ) : (
                <DocumentList documents={docItems} canDelete={false} canEdit={false} path={`/validations/${req.id}`} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Le circuit</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {req.steps.length === 0 ? (
              <p className="text-muted-foreground">Aucun validateur désigné.</p>
            ) : req.steps.map((e) => (
              <div key={e.id} className="space-y-1 border-b border-border pb-2.5 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.validator?.name ?? "—"}</span>
                  <StatusBadge map={VALIDATION_STEP_STATE} value={e.status} dot={false} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Étape {e.order}
                  {e.decidedAt ? ` · ${formatDateTime(e.decidedAt)}` : " · en attente"}
                </p>
                {/* LE MOTIF EST CE QU'ON VIENT LIRE : « refusé » sans raison fait redéposer la
                    même demande, à l'identique. */}
                {e.reason && <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs">{e.reason}</p>}
              </div>
            ))}
            {req.status === "PENDING" && req.mode === "SEQUENTIAL" && (
              <p className="text-xs text-muted-foreground">
                Circuit séquentiel : chacun décide à son tour — l&apos;étape {req.currentOrder} est active.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
