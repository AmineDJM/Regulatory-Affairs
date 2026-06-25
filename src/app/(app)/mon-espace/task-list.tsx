"use client";

import * as React from "react";
import { Loader2, Play, Check } from "lucide-react";
import { updateTaskStatus } from "@/lib/actions/task-actions";
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
}

function StatusButton({
  id, status, label, icon: IconCmp,
}: {
  id: string;
  status: "IN_PROGRESS" | "DONE";
  label: string;
  icon: typeof Play;
}) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await updateTaskStatus(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconCmp className="h-3.5 w-3.5" />} {label}
      </button>
    </form>
  );
}

export function TaskList({ tasks, showAssignee = false }: { tasks: TaskItem[]; showAssignee?: boolean }) {
  if (tasks.length === 0) {
    return <EmptyState icon="CheckCheck" title="Aucune tâche en cours" description="Tout est à jour de ce côté." />;
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const due = t.dueDate ? daysUntil(t.dueDate) : null;
        const overdue = due !== null && due < 0;
        return (
          <li key={t.id} className="surface flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{t.title}</span>
                <Badge tone={PRIORITY[t.priority]?.tone ?? "neutral"} dot={false}>{PRIORITY[t.priority]?.label ?? t.priority}</Badge>
                <StatusBadge map={TASK_STATUS} value={t.status} />
                {showAssignee && t.assignee && (
                  <span className="text-xs text-muted-foreground">→ {t.assignee}</span>
                )}
              </div>
              {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
              {t.dueDate && (
                <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                  Échéance&nbsp;: {formatDate(t.dueDate)}{overdue ? " — en retard" : ""}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {t.status === "TODO" && <StatusButton id={t.id} status="IN_PROGRESS" label="Démarrer" icon={Play} />}
              {t.status !== "DONE" && <StatusButton id={t.id} status="DONE" label="Terminer" icon={Check} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
