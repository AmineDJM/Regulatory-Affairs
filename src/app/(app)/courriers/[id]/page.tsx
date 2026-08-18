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
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { MAIL_DIRECTION, AUDIT_ACTION } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { renderTraceValue } from "@/lib/mail-register/trace";
import { sourceHref, sourceCaption } from "@/lib/links/source-link";
import { mailFields, dateInput, dateTimeInput } from "../mail-fields";
import { EditMailButton, DeleteMailButton } from "./edit-mail";

export const dynamic = "force-dynamic";

/** Les natures de pièce qu'on joint à un pli — pas les 40 du référentiel complet. */
const MAIL_DOC_CATEGORIES = [
  "REQUEST_LETTER", "CONVENTION", "INVOICE", "PURCHASE_ORDER",
  "SUPPORTING_DOC", "QUOTE", "DELIVERY_NOTE", "PHOTO", "OTHER",
];

/**
 * LA FICHE D'UN COURRIER — le pli, ses pièces, et son journal.
 *
 * Le tableau du registre sert à RETROUVER ; la fiche sert à travailler dessus : y joindre le
 * scan du pli et l'accusé signé, corriger une date qu'on avait notée de mémoire, et relire qui
 * a corrigé quoi. Les trois vont ensemble — une correction sans trace, sur un registre qu'on
 * oppose (« le pli est bien parti le 12 »), ne vaudrait rien.
 *
 * Les pièces passent par la table `Document` commune : même stockage, même contrôle d'accès,
 * même réplication dans le Drive de celui qui importe, et même journalisation que partout.
 */
export default async function MailEntryPage({ params }: { params: { id: string } }) {
  const user = await requireModule("MAIL_REGISTER");

  // Le cloisonnement par entité s'applique ICI aussi : deviner un identifiant ne doit pas ouvrir
  // le registre d'une autre société du groupe.
  const entry = await prisma.mailEntry.findFirst({
    where: { AND: [{ id: params.id }, await platformScope(user.id)] },
    include: {
      createdBy: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      driveNode: { select: { id: true, name: true } },
    },
  });
  if (!entry) notFound();

  const canEdit = userCan(user, "MAIL_REGISTER", "UPDATE");
  const canDelete = userCan(user, "MAIL_REGISTER", "DELETE");
  const canUpload = userCan(user, "MAIL_REGISTER", "UPLOAD") || canEdit;

  const [documents, history] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "MAIL_ENTRY", entityId: entry.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "MAIL_ENTRY", entityId: entry.id },
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

  const dir = MAIL_DIRECTION[entry.direction];
  const fields = mailFields({
    title: entry.title,
    direction: entry.direction,
    reference: entry.reference ?? undefined,
    sender: entry.sender ?? undefined,
    recipient: entry.recipient ?? undefined,
    sentAt: dateTimeInput(entry.sentAt),
    receivedAt: dateInput(entry.receivedAt),
    acknowledgedAt: dateInput(entry.acknowledgedAt),
    carrier: entry.carrier ?? undefined,
    notes: entry.notes ?? undefined,
  });

  return (
    <div className="space-y-5">
      <BackLink href="/courriers">
        <ArrowLeft className="h-4 w-4" /> Retour au registre
      </BackLink>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={dir?.tone ?? "neutral"} dot={false}>{dir?.label ?? entry.direction}</Badge>
            {entry.reference && <span className="font-mono text-xs text-muted-foreground">{entry.reference}</span>}
            {entry.company && (
              <span className="text-xs text-muted-foreground">{entry.company.shortName || entry.company.name}</span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{entry.title}</h1>
          <p className="text-sm text-muted-foreground">
            Enregistré par {entry.createdBy?.name ?? "—"} le {formatDate(entry.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          {canEdit && <EditMailButton id={entry.id} fields={fields} />}
          {canDelete && <DeleteMailButton id={entry.id} title={entry.title} attachments={documents.length} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Le pli</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Info label="Expéditeur" value={entry.sender} />
              <Info label="Destinataire" value={entry.recipient} />
              <Info label="Porteur" value={entry.carrier} />
              {/* Le départ garde son HEURE : deux plis du même jour ne partent pas ensemble. */}
              <Info label="Départ" value={entry.sentAt ? formatDateTime(entry.sentAt) : null} />
              <Info label="Arrivée" value={entry.receivedAt ? formatDate(entry.receivedAt) : null} />
              <Info label="Accusé de réception" value={entry.acknowledgedAt ? formatDate(entry.acknowledgedAt) : null} />
              {/* D'OÙ ÇA VIENT : le chemin de retour vers l'affaire qui a motivé ce pli. */}
              {entry.sourceType && (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Rattaché à</p>
                  {sourceHref(entry.sourceType, entry.sourceId) ? (
                    <Link href={sourceHref(entry.sourceType, entry.sourceId)!} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {sourceCaption(entry.sourceType)} <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="font-medium">{sourceCaption(entry.sourceType)}</p>
                  )}
                </div>
              )}
              {/* LE FICHIER DU DRIVE, RÉFÉRENCÉ — associé à la création ou depuis le Drive. Il n'a
                  pas été recopié : on renvoie vers lui, et c'est sa version courante qui fait foi. */}
              {entry.driveNode && (
                <div className="col-span-2 min-w-0 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Pièce de référence (dans le Drive)</p>
                  <Link href={`/drive?node=${entry.driveNode.id}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{entry.driveNode.name}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                  </Link>
                </div>
              )}
              {entry.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Pièces jointes
                <span className="text-sm font-normal text-muted-foreground">({documents.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canUpload && (
                <DocumentUpload entityType="MAIL_ENTRY" entityId={entry.id} categories={MAIL_DOC_CATEGORIES} />
              )}
              <DocumentList documents={docItems} canDelete={canEdit} canEdit={canEdit} canRename={canEdit} path={`/courriers/${entry.id}`} />
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
                {/* Le champ touché et ses deux valeurs : c'est ce qui distingue un journal utile
                    d'un « courrier modifié » qui ne répond à aucune question. */}
                {h.field ? (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{h.field}</span>{" : "}
                    {renderTraceValue(h.oldValue)} → <span className="text-foreground">{renderTraceValue(h.newValue)}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">{h.summary ?? "—"}</p>
                )}
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
