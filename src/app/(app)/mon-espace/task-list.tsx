"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Check, FolderKanban, MapPin, Navigation, Timer, X } from "lucide-react";
import { updateTaskStatus, startTask, respondTaskRequest } from "@/lib/actions/task-actions";
import { createDossierFromTask } from "@/lib/actions/dossier-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { PRIORITY, TASK_STATUS } from "@/lib/labels";
import { formatDate, daysUntil, cn } from "@/lib/utils";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  module: string | null;
  assignee?: string | null;
  // Course / livraison (coordinateur) + demande de tâche.
  address?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  expectedMinutes?: number | null;
  requestedBy?: string | null;
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Durée écoulée + détection de retard pour une tâche « course ». */
function CourseDuration({ t }: { t: TaskItem }) {
  if (!t.startedAt) return null;
  const start = new Date(t.startedAt).getTime();
  const end = t.completedAt ? new Date(t.completedAt).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const late = t.expectedMinutes != null && mins > t.expectedMinutes;
  const label = `${mins} min${t.completedAt ? "" : " (en cours)"}${t.expectedMinutes != null ? ` / ${t.expectedMinutes} prévu` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
      <Timer className="h-3.5 w-3.5" /> {label}{late ? " — en retard" : ""}
    </span>
  );
}

function ActionForm({ action, fields, children, className }: { action: (fd: FormData) => Promise<unknown>; fields: Record<string, string>; children: React.ReactNode; className?: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await action(fd); setSaving(false); }} className="inline">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={saving}
        className={className ?? "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      </button>
    </form>
  );
}

function CreateDossierButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button type="button" disabled={busy} title="Ouvrir un projet à partir de cette tâche"
      onClick={async () => { setBusy(true); const r = await createDossierFromTask(id); if (r.ok && r.dossierId) router.push(`/dossiers/${r.dossierId}`); else setBusy(false); }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderKanban className="h-3.5 w-3.5" />} Projet
    </button>
  );
}

export function TaskList({ tasks, showAssignee = false, canCreateDossier = false }: { tasks: TaskItem[]; showAssignee?: boolean; canCreateDossier?: boolean }) {
  if (tasks.length === 0) {
    return <EmptyState icon="CheckCheck" title="Aucune tâche en cours" description="Tout est à jour de ce côté." />;
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const due = t.dueDate ? daysUntil(t.dueDate) : null;
        const overdue = due !== null && due < 0;
        const requested = t.status === "REQUESTED";
        return (
          <li key={t.id} className={cn("surface flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between", requested && "border-l-2 border-l-primary")}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{t.title}</span>
                <Badge tone={PRIORITY[t.priority]?.tone ?? "neutral"} dot={false}>{PRIORITY[t.priority]?.label ?? t.priority}</Badge>
                <StatusBadge map={TASK_STATUS} value={t.status} />
                {showAssignee && t.assignee && <span className="text-xs text-muted-foreground">→ {t.assignee}</span>}
                {requested && t.requestedBy && <span className="text-xs text-muted-foreground">demandée par {t.requestedBy}</span>}
              </div>
              {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
              {t.address && (
                <a href={mapsUrl(t.address)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <MapPin className="h-3.5 w-3.5" /> {t.address}
                </a>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {t.dueDate && (
                  <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    Échéance&nbsp;: {formatDate(t.dueDate)}{overdue ? " — en retard" : ""}
                  </span>
                )}
                <CourseDuration t={t} />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {requested ? (
                <>
                  <ActionForm action={respondTaskRequest} fields={{ id: t.id, accept: "1" }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" /> Accepter
                  </ActionForm>
                  <ActionForm action={respondTaskRequest} fields={{ id: t.id, accept: "0" }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                    <X className="h-3.5 w-3.5" /> Refuser
                  </ActionForm>
                </>
              ) : (
                <>
                  {/* Course : « Partir » horodate le départ ; sinon « Démarrer » classique. */}
                  {t.status === "TODO" && t.address && !t.startedAt && (
                    <ActionForm action={startTask} fields={{ id: t.id }}><Navigation className="h-3.5 w-3.5" /> Partir</ActionForm>
                  )}
                  {t.status === "TODO" && !t.address && (
                    <ActionForm action={updateTaskStatus} fields={{ id: t.id, status: "IN_PROGRESS" }}><Play className="h-3.5 w-3.5" /> Démarrer</ActionForm>
                  )}
                  {t.status !== "DONE" && (
                    <ActionForm action={updateTaskStatus} fields={{ id: t.id, status: "DONE" }}><Check className="h-3.5 w-3.5" /> {t.address ? "Arrivé / fait" : "Terminer"}</ActionForm>
                  )}
                  {canCreateDossier && <CreateDossierButton id={t.id} />}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
