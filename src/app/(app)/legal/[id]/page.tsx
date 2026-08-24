import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip, ExternalLink } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { BackLink } from "@/components/shared/back-link";
import { AskChief } from "@/components/shared/ask-chief";
import { realtimeVoiceConfigured, canUseRealtimeVoice } from "@/lib/assistant/voice-realtime";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { LEGAL_DOC_KIND, LEGAL_DOC_STATUS, LEGAL_EXPIRY_LEVEL, AUDIT_ACTION } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/utils";
import { effectiveStatus, expiryLevel, daysLeft } from "@/lib/legal/lifecycle";
import { sourceHref, sourceCaption } from "@/lib/links/source-link";
import { legalFields, dateInput } from "../legal-fields";
import { buildFolderTree, flattenFolders, indentedLabel } from "@/lib/legal/folders";
import { EditLegalButton } from "./edit-legal";
import { RecordDeleteButton } from "@/components/shared/record-delete-button";
import { legalReaderWhere, readersCaption } from "@/lib/legal/readers";
import { loadLegalChain } from "@/lib/queries/legal-chain";
import { LegalChainCard } from "./chain-card";

export const dynamic = "force-dynamic";

/** Les natures de pièce qu'on joint à un engagement — pas les 40 du référentiel complet. */
const LEGAL_DOC_CATEGORIES = [
  "CONVENTION", "PURCHASE_ORDER", "INVOICE", "REQUEST_LETTER",
  "SUPPORTING_DOC", "QUOTE", "DELIVERY_NOTE", "OTHER",
];

/**
 * LA FICHE D'UN ENGAGEMENT — ses dates, sa chaîne de renouvellement, ses pièces, son journal.
 *
 * Le tableau du module sert à RETROUVER (« qu'est-ce qui arrive à échéance ? ») ; la fiche sert à
 * instruire : joindre le contrat signé et ses avenants, corriger une date, et relire ce qu'il est
 * advenu du document. C'est aussi la destination des rappels d'échéance — un rappel qui ne mène
 * nulle part ne vaut rien.
 *
 * Le FICHIER de référence, lui, reste dans le Drive : Legal pointe dessus, ne le duplique pas.
 * Les pièces jointes ici sont les pièces PROPRES à l'engagement, par la table `Document` commune.
 */
export default async function LegalDocumentPage({ params }: { params: { id: string } }) {
  const user = await requireModule("LEGAL");

  // Cloisonnement par entité : deviner un identifiant n'ouvre pas les engagements d'une autre
  // société du groupe.
  const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  const doc = await prisma.legalDocument.findFirst({
    // Deux gardes, et elles se composent : l'ENTITÉ (on ne lit pas les engagements d'une autre
    // société) et les LECTEURS DÉSIGNÉS (un document restreint ne s'ouvre pas parce qu'on en
    // devine l'identifiant). Un refus rend 404, jamais « accès refusé » : dire qu'un document
    // existe, c'est déjà en dire trop.
    where: { AND: [{ id: params.id }, await platformScope(user.id), ...(readerScope ? [readerScope] : [])] },
    include: {
      driveNode: { select: { id: true, name: true } },
      renewedFrom: { select: { id: true, title: true } },
      renewals: { select: { id: true, title: true, endDate: true }, orderBy: { createdAt: "desc" } },
      createdBy: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      readers: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  if (!doc) notFound();

  const canEdit = userCan(user, "LEGAL", "UPDATE");
  const canUpload = userCan(user, "LEGAL", "UPLOAD") || canEdit;

  const [documents, history] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: doc.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: doc.id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  const today = new Date();
  const status = effectiveStatus(doc, today);
  const expiry = expiryLevel(doc, today);
  const left = daysLeft(doc, today);
  const st = LEGAL_DOC_STATUS[status];
  const exp = LEGAL_EXPIRY_LEVEL[expiry];

  // Le classement se corrige depuis la fiche : constater qu'un engagement est au mauvais endroit
  // et devoir revenir à la liste pour le déplacer, c'est ne jamais le déplacer.
  const [folderRows, chainDocs, chain] = await Promise.all([
    prisma.legalFolder.findMany({ select: { id: true, name: true, parentId: true } }),
    // Les pièces amont possibles pour rattacher CE document à sa chaîne d'achat.
    prisma.legalDocument.findMany({
      where: {
        AND: [await platformScope(user.id), ...(readerScope ? [readerScope] : [])],
        kind: { in: ["QUOTE", "PURCHASE_ORDER"] },
        id: { not: doc.id },
      },
      select: { id: true, kind: true, reference: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // La chaîne complète : maillons, validateurs de chacun, règlement au bout.
    loadLegalChain(doc.id),
  ]);
  const folderOptions = flattenFolders(buildFolderTree(folderRows)).map((n) => ({ value: n.id, label: indentedLabel(n) }));
  const chainCandidates = chainDocs.map((r) => ({
    value: r.id,
    label: `${LEGAL_DOC_KIND[r.kind] ?? r.kind} — ${r.reference ? `${r.reference} · ` : ""}${r.title}`,
  }));

  const fields = legalFields({
    title: doc.title,
    reference: doc.reference ?? undefined,
    kind: doc.kind,
    counterparty: doc.counterparty ?? undefined,
    startDate: dateInput(doc.startDate),
    endDate: dateInput(doc.endDate),
    amount: doc.amount !== null ? String(toNumber(doc.amount)) : undefined,
    notes: doc.notes ?? undefined,
    folderId: doc.folderId ?? undefined,
    chainFromId: doc.chainFromId ?? undefined,
  }, "edit", [], folderOptions, chainCandidates);

  return (
    <div className="space-y-5">
      <BackLink href="/legal">
        <ArrowLeft className="h-4 w-4" /> Retour aux engagements
      </BackLink>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st?.tone ?? "neutral"} dot={false}>{st?.label ?? status}</Badge>
            <span className="text-xs text-muted-foreground">{LEGAL_DOC_KIND[doc.kind] ?? doc.kind}</span>
            {doc.reference && <span className="font-mono text-xs text-muted-foreground">{doc.reference}</span>}
            {doc.company && <span className="text-xs text-muted-foreground">{doc.company.shortName || doc.company.name}</span>}
            {userCan(user, "CHIEF_OF_STAFF", "VIEW") && (
              <AskChief reference={doc.reference || doc.title} call={realtimeVoiceConfigured() && canUseRealtimeVoice(user)} />
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            Enregistré par {doc.createdBy?.name ?? "—"} le {formatDate(doc.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          {canEdit && <EditLegalButton id={doc.id} fields={fields} />}
          {/* Le déposant peut retirer son document — suppression réversible (corbeille admin).
              Un contrat effacé par erreur reste récupérable par un administrateur. */}
          <RecordDeleteButton
            kind="LEGAL_DOCUMENT" id={doc.id} name={doc.title} typeLabel="ce document"
            enabled={userCan(user, "LEGAL", "DELETE") || doc.createdById === user.id}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>L&apos;engagement</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Info label="Partie" value={doc.counterparty} />
              <Info label="Début" value={doc.startDate ? formatDate(doc.startDate) : null} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Échéance</p>
                {doc.endDate ? (
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {formatDate(doc.endDate)}
                    {expiry !== "NONE" && expiry !== "SCHEDULED" && (
                      <Badge tone={exp?.tone ?? "neutral"} dot={false}>
                        {left !== null && left >= 0 ? `dans ${left} j` : "dépassée"}
                      </Badge>
                    )}
                  </p>
                ) : (
                  // SANS ÉCHÉANCE : dit explicitement, pour qu'on ne croie pas à un oubli de saisie.
                  <p className="font-medium text-muted-foreground">sans échéance</p>
                )}
              </div>
              <Info label="Montant" value={doc.amount !== null ? formatCurrency(toNumber(doc.amount)) : null} />
              <Info label="Annulé le" value={doc.cancelledAt ? formatDate(doc.cancelledAt) : null} />
              <Info label="Motif d'annulation" value={doc.cancelReason} />
              {/* D'OÙ ÇA VIENT : le chemin de retour vers la demande qui a justifié cet
                  engagement. Sans lui, le lien n'existe que dans un sens et ne sert qu'à moitié. */}
              {doc.sourceType && (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Rattaché à</p>
                  {sourceHref(doc.sourceType, doc.sourceId) ? (
                    <Link href={sourceHref(doc.sourceType, doc.sourceId)!} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {sourceCaption(doc.sourceType)} <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="font-medium">{sourceCaption(doc.sourceType)}</p>
                  )}
                </div>
              )}
              {doc.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{doc.notes}</p>
                </div>
              )}
              {doc.driveNode && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Pièce de référence (dans le Drive)</p>
                  {/* Le fichier vit dans le DRIVE : on y renvoie, on n'en sert pas une copie. */}
                  <Link href={`/drive/${doc.driveNode.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Paperclip className="h-3.5 w-3.5" /> {doc.driveNode.name} <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {/* QUI PEUT L'OUVRIR — dit sur la fiche, avec les noms. Une restriction invisible
                  est une restriction dont on doute, et qu'on contourne « au cas où » en envoyant
                  le fichier par mail — ce qu'elle sert précisément à éviter. */}
              <div className="col-span-2 min-w-0 sm:col-span-3">
                <p className="text-xs text-muted-foreground">Accès</p>
                <p className="font-medium">{readersCaption({ createdById: doc.createdById, readerIds: doc.readers.map((r) => r.userId) })}</p>
                {doc.readers.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.readers.map((r) => r.user.name).join(", ")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* LA CHAÎNE D'ACHAT : devis → BC → facture → règlement, avec les validateurs et les
              délais de chaque maillon. Elle ne s'affiche que si la pièce en fait partie. */}
          <LegalChainCard links={chain.links} settlement={chain.settlement} canSettle={canEdit} />

          {(doc.renewedFrom || doc.renewals.length > 0) && (
            <Card>
              <CardHeader><CardTitle>Chaîne de renouvellement</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {/* Un renouvellement n'efface pas le passé : les deux bouts restent atteignables. */}
                {doc.renewedFrom && (
                  <p>
                    Prend la suite de{" "}
                    <Link href={`/legal/${doc.renewedFrom.id}`} className="font-medium hover:underline">{doc.renewedFrom.title}</Link>
                  </p>
                )}
                {doc.renewals.map((r) => (
                  <p key={r.id}>
                    Renouvelé par{" "}
                    <Link href={`/legal/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    {r.endDate && <span className="text-muted-foreground"> — jusqu&apos;au {formatDate(r.endDate)}</span>}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Pièces jointes
                <span className="text-sm font-normal text-muted-foreground">({documents.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canUpload && (
                <DocumentUpload entityType="LEGAL_DOCUMENT" entityId={doc.id} categories={LEGAL_DOC_CATEGORIES} />
              )}
              <DocumentList documents={docItems} canDelete={canEdit} canEdit={canEdit} canRename={canEdit} path={`/legal/${doc.id}`} />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Journal</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {history.length === 0 ? (
              <p className="text-muted-foreground">Aucun mouvement enregistré.</p>
            ) : history.map((h) => (
              <div key={h.id} className="space-y-0.5 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <StatusBadge map={AUDIT_ACTION} value={h.action} dot={false} />
                  <span className="shrink-0 text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
                <p className="text-muted-foreground">{h.summary ?? h.field ?? "—"}</p>
                <p className="text-muted-foreground">{h.actor?.name ?? "Système"}</p>
              </div>
            ))}
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
      <p className="truncate font-medium" title={value ?? undefined}>{value || "—"}</p>
    </div>
  );
}
