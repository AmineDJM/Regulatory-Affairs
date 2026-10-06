"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Send, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import type { MissionAssignmentDTO } from "@/lib/queries/missions";
import { requestMissionOrder, issueMissionOrder, removeMission, addMissionComment, retirerDemandeOrdreMission } from "@/lib/actions/mission-actions";
import { refusRetraitOrdreMission } from "@/lib/annulations/regles";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";
import { CommentThread } from "@/components/shared/comment-thread";
import { MISSION_ROLE, MISSION_ORDER_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const MISSION_DOC_CATEGORIES = ["MISSION_ORDER", "SUPPORTING_DOC", "OTHER"];

export function MissionItem({
  m, canManage, currentUserId, path, showParent = false,
}: {
  m: MissionAssignmentDTO;
  canManage: boolean;
  currentUserId: string;
  path: string;
  showParent?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const isAssignee = m.userId === currentUserId;
  const canUpload = canManage || isAssignee;

  async function run(action: "request" | "issue" | "remove" | "retract") {
    if (action === "remove" && !window.confirm("Retirer cette assignation ? Les pièces et discussions liées seront supprimées.")) return;
    setBusy(action);
    const fd = new FormData(); fd.set("id", m.id);
    if (action === "request") await requestMissionOrder(fd);
    else if (action === "retract") {
      const r = await retirerDemandeOrdreMission(fd);
      if (!r.ok) window.alert(r.error ?? "Retrait impossible.");
    }
    else if (action === "issue") await issueMissionOrder(fd);
    else await removeMission(fd);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Avatar name={m.userName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium">{m.userName}</span>
            <StatusBadge map={MISSION_ROLE} value={m.role} dot={false} />
            {/* Au téléphone, l'état de l'ordre rejoint la ligne du nom : à droite, il écrasait le nom. */}
            <span className="sm:hidden"><StatusBadge map={MISSION_ORDER_STATUS} value={m.orderStatus} dot={false} /></span>
          </div>
          {showParent ? (
            <a href={m.parentPath} className="block truncate py-0.5 text-xs text-primary hover:underline">{m.parentLabel}</a>
          ) : (
            m.note && <p className="truncate text-xs text-muted-foreground">{m.note}</p>
          )}
        </div>
        <span className="hidden shrink-0 sm:inline-flex"><StatusBadge map={MISSION_ORDER_STATUS} value={m.orderStatus} dot={false} /></span>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-md p-2.5 text-muted-foreground hover:bg-secondary sm:p-1" aria-label="Détails" aria-expanded={open}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border bg-secondary/20 px-3 py-3">
          {/* Statut + actions ordre de mission */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {m.orderStatus === "ISSUED" ? (
              <span>Ordre de mission émis{m.issuedByName ? ` par ${m.issuedByName}` : ""}{m.issuedAt ? ` le ${formatDate(m.issuedAt)}` : ""}.</span>
            ) : m.orderStatus === "REQUESTED" ? (
              <span>Ordre de mission demandé{m.requestedAt ? ` le ${formatDate(m.requestedAt)}` : ""}.</span>
            ) : (
              <span>Aucun ordre de mission pour l'instant.</span>
            )}
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              {isAssignee && m.orderStatus === "NONE" && (
                <Button size="sm" variant="outline" onClick={() => run("request")} disabled={busy !== null}>
                  {busy === "request" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander un ordre de mission
                </Button>
              )}
              {/* RETIRER SA DEMANDE (décision du 04/10) — tant que l'ordre n'est pas émis. */}
              {isAssignee && refusRetraitOrdreMission(m.orderStatus) === null && (
                <Button size="sm" variant="outline" onClick={() => run("retract")} disabled={busy !== null}>
                  {busy === "retract" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Retirer ma demande
                </Button>
              )}
              {canManage && m.orderStatus !== "ISSUED" && (
                <Button size="sm" onClick={() => run("issue")} disabled={busy !== null}>
                  {busy === "issue" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Émettre l'ordre de mission
                </Button>
              )}
              {canManage && (
                <button onClick={() => run("remove")} disabled={busy !== null} title="Retirer" aria-label="Retirer" className="rounded-md p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:p-1.5">
                  {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Pièces (ordre de mission + justificatifs) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ordre de mission & pièces</p>
            {canUpload && <DocumentUpload entityType="MISSION_ASSIGNMENT" entityId={m.id} categories={MISSION_DOC_CATEGORIES} compact />}
            <DocumentList documents={m.documents} canDelete={canManage} canRename={canUpload} canEdit={false} path={path} />
          </div>

          {/* Discussion */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discussion</p>
            <CommentThread
              comments={m.comments}
              action={addMissionComment}
              hiddenFields={{ assignmentId: m.id }}
              currentUserId={currentUserId}
              canModerate={canManage}
              updateAction={updateComment}
              deleteAction={deleteComment}
              path={path}
            />
          </div>
        </div>
      )}
    </div>
  );
}
