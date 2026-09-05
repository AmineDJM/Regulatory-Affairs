import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency, formatDate } from "@/lib/utils";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { CONSULTING_STATUS, CONSULTING_BILLING } from "@/lib/labels";
import { billingSuffix, isOverdue, isContractEditable, isAwaitingDecision, totalCommitment } from "@/lib/ad-pro/consulting";
import { ConsultingActions, type ContractTask } from "./actions-panel";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/**
 * LA FICHE D'UN CONTRAT.
 *
 * À gauche ce qui a été convenu et les pièces signées ; à droite ce qu'on peut FAIRE — et
 * seulement ce qui a un sens à cet instant du cycle de vie. Un bouton qui apparaît puis échoue
 * fait douter de tout le reste de l'écran.
 */
export default async function ConsultingContractPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONSULTING");
  const contract = await prisma.consultingContract.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } }, tasks: { orderBy: { position: "asc" } } },
  });
  if (!contract) notFound();

  const [documents, people] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "CONSULTING_CONTRACT", entityId: contract.id },
      include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const names = new Map(people.map((p) => [p.id, p.name]));
  const mine = contract.requesterId === user.id || contract.createdById === user.id || hasGlobalView(user.role);
  const mayValidate = userCan(user, "CONSULTING", "VALIDATE")
    && (contract.validatorId === null || contract.validatorId === user.id || hasGlobalView(user.role));
  const editable = isContractEditable(contract.status);
  const canUpload = (userCan(user, "CONSULTING", "UPLOAD") || mine) && editable;

  const amount = contract.amount == null ? null : toNumber(contract.amount);
  const total = totalCommitment({
    amount, billing: contract.billing,
    startDate: contract.startDate, endDate: contract.endDate,
  });

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const taskItems: ContractTask[] = contract.tasks.map((t) => ({
    id: t.id, label: t.label,
    dueDate: t.dueDate ? formatDate(t.dueDate.toISOString()) : null,
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/consulting"><ArrowLeft className="h-4 w-4" /> Consulting</BackLink>
      <PageHeader title={contract.title} description={`Réf. ${contract.reference} · ${contract.counterparty}`}>
        <StatusBadge map={CONSULTING_STATUS} value={contract.status} />
        {isOverdue(contract) && <Badge tone="danger" dot={false}>terme dépassé</Badge>}
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Ce qui a été convenu</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Consultant / cabinet" value={contract.counterparty} />
              <Info label="Contact" value={contract.counterpartyContact} />
              <Info label="Entité signataire" value={contract.company?.name} />
              <Info label="Début" value={contract.startDate ? formatDate(contract.startDate.toISOString()) : null} />
              <Info label="Fin" value={contract.endDate ? formatDate(contract.endDate.toISOString()) : null} />
              <Info
                label="Rémunération"
                value={amount != null ? `${formatCurrency(amount)}${billingSuffix(contract.billing)}` : null}
              />
              <Info label="Rythme" value={CONSULTING_BILLING[contract.billing]} />
              {/* L'engagement TOTAL n'apparaît que s'il est CALCULABLE : sans terme connu, un
                  chiffre inventé finirait dans un tableau de budget sans marque d'origine. */}
              {total != null && total !== amount && <Info label="Engagement total estimé" value={formatCurrency(total)} />}
              <Info label="Porteur interne" value={contract.requesterId ? names.get(contract.requesterId) : null} />
              <Info label="Validé par" value={contract.validatedById ? names.get(contract.validatedById) : null} />
              <Info label="Validé le" value={contract.validatedAt ? formatDate(contract.validatedAt.toISOString()) : null} />
              {contract.scope && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Objet de la mission</p>
                  <p className="whitespace-pre-wrap">{contract.scope}</p>
                </div>
              )}
              {contract.paymentTerms && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Modalités de paiement</p>
                  <p className="whitespace-pre-wrap">{contract.paymentTerms}</p>
                </div>
              )}
              {contract.decisionNote && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Note de décision</p>
                  <p className="whitespace-pre-wrap">{contract.decisionNote}</p>
                </div>
              )}
              {contract.notes && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground">Notes internes</p>
                  <p className="whitespace-pre-wrap">{contract.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pièces (contrat signé, avenants, factures, livrables…)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canUpload && <DocumentUpload entityType="CONSULTING_CONTRACT" entityId={contract.id} />}
              <DocumentList
                documents={docItems}
                canDelete={userCan(user, "CONSULTING", "DELETE") || hasGlobalView(user.role)}
                canRename={canUpload}
                canEdit={onlyofficeConfigured() && canUpload}
                path={`/consulting/${contract.id}`}
              />
            </CardContent>
          </Card>
        </div>

        <ConsultingActions
          id={contract.id}
          status={contract.status}
          canSubmit={mine && contract.status === "DRAFT"}
          canDecide={mayValidate && isAwaitingDecision(contract.status)}
          canClose={(mine || mayValidate) && (contract.status === "ACTIVE" || contract.status === "DRAFT" || contract.status === "AWAITING_VALIDATION")}
          canEditTasks={(mine || userCan(user, "CONSULTING", "UPDATE")) && editable}
          validators={people.filter((p) => p.id !== user.id)}
          tasks={taskItems}
        />
      </div>
    </div>
  );
}
