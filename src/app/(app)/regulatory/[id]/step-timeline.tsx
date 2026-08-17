"use client";

import * as React from "react";
import { Check, Circle, Clock, Pencil, X, Loader2 } from "lucide-react";
import { updateRegulatoryStep } from "@/lib/actions/regulatory-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { STEP_STATUS, REGULATORY_STEP_TYPE } from "@/lib/labels";
import { formatDate, cn } from "@/lib/utils";

export interface StepItem {
  id: string;
  type: string;
  order: number;
  status: string;
  plannedDate: string | null;
  actualDate: string | null;
  responsible: string | null;
  comment: string | null;
  missingDocs: string | null;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  DONE: <Check className="h-3.5 w-3.5" />,
  IN_PROGRESS: <Clock className="h-3.5 w-3.5" />,
  BLOCKED: <X className="h-3.5 w-3.5" />,
  LATE: <Clock className="h-3.5 w-3.5" />,
  NOT_STARTED: <Circle className="h-3 w-3" />,
};

const STATUS_RING: Record<string, string> = {
  DONE: "bg-success text-success-foreground",
  IN_PROGRESS: "bg-primary text-primary-foreground",
  BLOCKED: "bg-destructive text-destructive-foreground",
  LATE: "bg-warning text-warning-foreground",
  NOT_STARTED: "bg-secondary text-muted-foreground",
};

export function StepTimeline({ steps, canUpdate }: { steps: StepItem[]; canUpdate: boolean }) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  return (
    <ol className="relative space-y-1">
      {steps.map((step, i) => (
        <li key={step.id} className="relative pl-9">
          {i < steps.length - 1 && (
            <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-px bg-border" />
          )}
          <span
            className={cn(
              "absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full",
              STATUS_RING[step.status],
            )}
          >
            {STATUS_ICON[step.status]}
          </span>

          <div className="rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  <span className="mr-1.5 text-xs text-muted-foreground">{step.order}.</span>
                  {REGULATORY_STEP_TYPE[step.type] ?? step.type}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {step.plannedDate && <span>Prévu&nbsp;: {formatDate(step.plannedDate)}</span>}
                  {step.actualDate && <span>Réel&nbsp;: {formatDate(step.actualDate)}</span>}
                  {step.responsible && <span>· {step.responsible}</span>}
                  {step.missingDocs && (
                    <span className="text-warning">⚠ Manque&nbsp;: {step.missingDocs}</span>
                  )}
                </div>
                {step.comment && <p className="mt-1 text-xs text-muted-foreground">{step.comment}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge map={STEP_STATUS} value={step.status} />
                {canUpdate && (
                  <button
                    onClick={() => setEditing(editing === step.id ? null : step.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                    title="Modifier l'étape"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {editing === step.id && (
              <form
                action={async (fd) => {
                  setSaving(true);
                  await updateRegulatoryStep(fd);
                  setSaving(false);
                  setEditing(null);
                }}
                className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2"
              >
                <input type="hidden" name="stepId" value={step.id} />
                <div className="space-y-1">
                  <Label htmlFor={`status-${step.id}`}>Statut</Label>
                  <Select id={`status-${step.id}`} name="status" defaultValue={step.status}>
                    {Object.entries(STEP_STATUS).map(([v, d]) => (
                      <option key={v} value={v}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`resp-${step.id}`}>Responsable</Label>
                  <Input id={`resp-${step.id}`} name="responsible" defaultValue={step.responsible ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`planned-${step.id}`}>Date prévue</Label>
                  <Input
                    id={`planned-${step.id}`}
                    name="plannedDate"
                    type="date"
                    defaultValue={step.plannedDate?.slice(0, 10) ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`actual-${step.id}`}>Date réelle</Label>
                  <Input
                    id={`actual-${step.id}`}
                    name="actualDate"
                    type="date"
                    defaultValue={step.actualDate?.slice(0, 10) ?? ""}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor={`missing-${step.id}`}>Pièces manquantes</Label>
                  <Input id={`missing-${step.id}`} name="missingDocs" defaultValue={step.missingDocs ?? ""} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor={`comment-${step.id}`}>Commentaire</Label>
                  <Textarea
                    id={`comment-${step.id}`}
                    name="comment"
                    defaultValue={step.comment ?? ""}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Annuler
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
