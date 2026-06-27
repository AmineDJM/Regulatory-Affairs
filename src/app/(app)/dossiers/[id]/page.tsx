import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban, MessageSquare, Paperclip } from "lucide-react";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDossier, canViewDossier, isDossierMember, canManageDossier } from "@/lib/queries/dossiers";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { DOSSIER_STATUS, PRIORITY } from "@/lib/labels";
import { DossierStatusControls, DossierAssign, DossierMessageForm } from "./panel";

export const dynamic = "force-dynamic";

const DOSSIER_DOC_CATEGORIES = ["SUPPORTING_DOC", "PRESENTATION", "QUOTE", "ANALYSIS_CERTIFICATE", "OTHER"];

export default async function DossierDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const d = await getDossier(params.id);
  if (!d) notFound();
  if (!canViewDossier(user, d)) notFound();

  const manage = canManageDossier(user, d);
  const member = isDossierMember(user, d);
  const archived = d.status === "ARCHIVED";

  const [documents, allUsers] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "DOSSIER", entityId: d.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    manage ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const docItems: DocItem[] = documents.map((doc) => ({
    id: doc.id, name: doc.name, category: doc.category, version: doc.version, sizeBytes: doc.sizeBytes,
    confidentiality: doc.confidentiality, uploadedBy: doc.uploadedBy?.name ?? null,
    createdAt: doc.createdAt.toISOString(), hasFile: Boolean(doc.fileKey),
  }));

  const participantNames = d.participantIds.length
    ? (await prisma.user.findMany({ where: { id: { in: d.participantIds } }, select: { name: true } })).map((u) => u.name)
    : [];
  const canUpload = userCan(user, "DOSSIERS", "UPLOAD") && member;

  return (
    <div className="space-y-5">
      <Link href="/dossiers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">{d.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{d.reference}</span> · ouvert par {d.createdBy?.name ?? "—"}
            {d.assignedTo && <> · responsable {d.assignedTo.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {d.category && <Badge tone="neutral" dot={false}>{d.category}</Badge>}
          <StatusBadge map={DOSSIER_STATUS} value={d.status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Sujet</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {d.description ? (
                <p className="whitespace-pre-wrap text-sm">{d.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune description.</p>
              )}
              <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Priorité : {PRIORITY[d.priority]?.label ?? d.priority}</span>
                <span>Ouvert le {formatDate(d.createdAt.toISOString())}</span>
                {d.dueDate && <span>Échéance : {formatDate(d.dueDate.toISOString())}</span>}
                {participantNames.length > 0 && <span>Participants : {participantNames.join(", ")}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Fil de discussion */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Suivi & discussion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {d.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun échange pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {d.messages.map((m) => {
                    const mine = m.authorId === user.id;
                    return (
                      <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.author?.name ?? "—"} · {formatDateTime(m.createdAt.toISOString())}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {member && !archived && <DossierMessageForm id={d.id} />}
            </CardContent>
          </Card>

          {/* Pièces (PPT, Excel, PDF, e-mails…) */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Pièces & fichiers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DocumentList documents={docItems} canDelete={false} canEdit={onlyofficeConfigured() && canUpload && !archived} path={`/dossiers/${d.id}`} />
              {canUpload && !archived && <DocumentUpload entityType="DOSSIER" entityId={d.id} categories={DOSSIER_DOC_CATEGORIES} />}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Pilotage</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <DossierStatusControls id={d.id} status={d.status} canManage={manage} />
              {manage && (
                <DossierAssign id={d.id} users={allUsers} currentAssignee={d.assignedToId} currentParticipants={d.participantIds} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
