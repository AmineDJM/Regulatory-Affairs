import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate } from "@/lib/utils";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { VisaCentreBanniere } from "@/components/ad-pro/visa-centre-banniere";
import { SupprimerDemandeAdPro } from "@/components/ad-pro/supprimer-demande";
import { peutSupprimerUneDemandeAdPro } from "@/lib/queries/ad-pro-suppression";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUpload } from "@/components/documents/document-upload";
import { AD_PRO_DOC_CATEGORIES, categoriesDuDepotDeLaDemande } from "@/lib/ad-pro/doc-categories";
import { contextePiecesLiees } from "@/lib/ad-pro/pieces-liees";
import { LinkedRecords } from "@/components/shared/linked-records";
import type { DocItem } from "@/components/documents/document-list";
import { AD_PRO_OTHER_STATUS } from "@/lib/labels";
import { OtherDecisionPanel } from "./decision-panel";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

export default async function AdProOtherDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("AD_PRO_OTHER");
  const req = await prisma.adProOtherRequest.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });
  if (!req) notFound();

  const [documents, people] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "AD_PRO_OTHER", entityId: req.id },
      include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { id: { in: [req.requesterId, req.decidedById].filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));

  const mine = req.requesterId === user.id || hasGlobalView(user.role);
  const mayDecide = userCan(user, "AD_PRO_OTHER", "VALIDATE");
  const open = req.status !== "DONE" && req.status !== "CANCELLED";
  const canUpload = (userCan(user, "AD_PRO_OTHER", "UPLOAD") || mine) && open;
  const ctxPieces = await contextePiecesLiees(user, "AD_PRO_OTHER");
  // CORRIGER LA DEMANDE (audit 360°, rapport 17 R14) — la MÊME règle que les autres natures du pôle :
  // son demandeur et qui tranche tant qu'elle attend sa décision, la vue globale toujours.
  const demandeDecidee = isAdProDecided("AD_PRO_OTHER", req.status);
  const canEditRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user.role), canManage: mayDecide },
    { requesterId: req.requesterId, decided: demandeDecidee },
  );
  const editValues = canEditRequest ? await adProEditValues("AD_PRO_OTHER", req.id) : null;

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/ad-pro/autres"><ArrowLeft className="h-4 w-4" /> Autres demandes</BackLink>
      <PageHeader title={req.title} description={`Réf. ${req.reference}`}>
        <StatusBadge map={AD_PRO_OTHER_STATUS} value={req.status} />
        {editValues && <AdProEditButton kind="AD_PRO_OTHER" id={req.id} decided={demandeDecidee} values={editValues} />}
        {/* Une nature du pôle qui n'avait AUCUNE suppression (§118.162). */}
        <SupprimerDemandeAdPro kind="AD_PRO_OTHER" id={req.id} name={`${req.reference} — ${req.title}`} enabled={await peutSupprimerUneDemandeAdPro(user, "AD_PRO_OTHER", req.id)} />
      </PageHeader>

      {/* L'ÉTAT DU CENTRE AD & PRO (audit 360°, R07/R10) : en attente, refusée, ou À CORRIGER avec son motif. */}
      <VisaCentreBanniere entityType="AD_PRO_OTHER" entityId={req.id} viewer={user} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>La demande</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 sm:gap-x-6">
              <Info label="Pour qui / avec qui" value={req.beneficiary} />
              <Info label="Montant estimé" value={req.amount != null ? formatCurrency(toNumber(req.amount)) : null} />
              <Info label="Entité" value={req.company?.name} />
              <Info label="Demandeur" value={req.requesterId ? names.get(req.requesterId) : null} />
              <Info label="Décidée par" value={req.decidedById ? names.get(req.decidedById) : null} />
              <Info label="Décidée le" value={req.decidedAt ? formatDate(req.decidedAt.toISOString()) : null} />
              {req.description && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{req.description}</p>
                </div>
              )}
              {req.decisionNote && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Motif de la décision</p>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{req.decisionNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LES PIÈCES LIÉES, comme sur les six autres natures du pôle (§118.161) : le bloc
              générique « Pièces jointes » disparaît au profit de la chaîne devis → bon de commande →
              facture et des engagements ; les pièces de la demande gardent leur place nommée. */}
          <LinkedRecords
            entityType="AD_PRO_OTHER" entityId={req.id} reference={req.reference} canCreate={canUpload}
            acces={ctxPieces.acces} candidatsLegal={ctxPieces.candidatsLegal} suppression
            piecesDeLaDemande={{
              titre: "Pièces de la demande (demande, justificatifs, photos…)",
              documents: docItems,
              televerseur: canUpload
                ? <DocumentUpload entityType="AD_PRO_OTHER" entityId={req.id} categories={categoriesDuDepotDeLaDemande(AD_PRO_DOC_CATEGORIES)} />
                : undefined,
              canDelete: userCan(user, "AD_PRO_OTHER", "DELETE") || hasGlobalView(user.role),
              canRename: canUpload,
              canEdit: onlyofficeConfigured() && canUpload,
              path: `/ad-pro/autres/${req.id}`,
            }}
          />
        </div>

        <OtherDecisionPanel
          id={req.id}
          status={req.status}
          canDecide={mayDecide && req.status === "AWAITING_DECISION"}
          canClose={(mine || mayDecide) && open && req.status !== "AWAITING_DECISION"}
          canResubmit={mine && req.status === "REFUSED"}
          description={req.description ?? ""}
          amount={req.amount != null ? toNumber(req.amount) : null}
        />
      </div>
          {/* LA SECTION DISCUSSION — le fil CANONIQUE, monté sur les sept natures du pôle. */}
      <AdProDiscussionCard entityType="AD_PRO_OTHER" entityId={req.id} user={user} />
</div>
  );
}
