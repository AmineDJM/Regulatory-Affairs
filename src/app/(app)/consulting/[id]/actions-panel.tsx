"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check, X, CalendarCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import {
  requestConsultingValidation, decideConsultingContract, closeConsultingContract,
  addConsultingTask, toggleConsultingTask, deleteConsultingTask,
} from "@/lib/actions/consulting-actions";

export interface ContractTask { id: string; label: string; dueDate: string | null; doneAt: string | null }

/**
 * LES GESTES D'UN CONTRAT — et uniquement ceux qui ont un sens ici.
 *
 * Chaque bouton correspond à une transition réelle du cycle de vie (`lib/ad-pro/consulting.ts`).
 * On n'affiche pas un bouton que le serveur refusera : proposer « Valider » sur un brouillon,
 * c'est promettre une action qui échouera, et faire douter de tout le reste de l'écran.
 */
export function ConsultingActions({
  id, status, canSubmit, canDecide, canClose, canEditTasks, validators, tasks,
}: {
  id: string;
  status: string;
  canSubmit: boolean;
  canDecide: boolean;
  canClose: boolean;
  canEditTasks: boolean;
  validators: { id: string; name: string }[];
  tasks: ContractTask[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [validatorId, setValidatorId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [taskLabel, setTaskLabel] = React.useState("");
  const [taskDue, setTaskDue] = React.useState("");

  const run = async (key: string, fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fields: Record<string, string>) => {
    setBusy(key); setErr(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const r = await fn(fd);
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "L'opération a échoué."); return; }
    setNote(""); setTaskLabel(""); setTaskDue("");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {canSubmit && (
        <div className="surface space-y-2 p-4">
          <h3 className="text-sm font-semibold">Soumettre à validation</h3>
          <p className="text-xs text-muted-foreground">
            Désignez la personne qui doit trancher. Sans désignation, la Direction est prévenue.
          </p>
          <Select value={validatorId} onChange={(e) => setValidatorId(e.target.value)}>
            <option value="">— Direction —</option>
            {validators.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          <Button
            className="w-full" disabled={busy !== null}
            onClick={() => run("submit", requestConsultingValidation, { id, validatorId })}
          >
            {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer pour validation
          </Button>
        </div>
      )}

      {canDecide && (
        <div className="surface space-y-2 p-4">
          <h3 className="text-sm font-semibold">Décision</h3>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif ou condition (facultatif)" rows={2} />
          <div className="flex gap-2">
            <Button
              className="flex-1" disabled={busy !== null}
              onClick={() => run("approve", decideConsultingContract, { id, approve: "1", note })}
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
            </Button>
            <Button
              variant="outline" className="flex-1 text-destructive" disabled={busy !== null}
              onClick={() => run("refuse", decideConsultingContract, { id, approve: "0", note })}
            >
              {busy === "refuse" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Refuser
            </Button>
          </div>
        </div>
      )}

      {canClose && (
        <div className="surface space-y-2 p-4">
          <h3 className="text-sm font-semibold">Clore le contrat</h3>
          <p className="text-xs text-muted-foreground">
            {/* Deux fins, et elles ne se confondent pas : l'une a produit ses effets, l'autre non. */}
            « Arrivé à terme » clôt une relation qui est allée jusqu'au bout ; « Annuler » la rompt.
          </p>
          <div className="flex gap-2">
            {status === "ACTIVE" && (
              <Button
                variant="outline" className="flex-1" disabled={busy !== null}
                onClick={() => run("expire", closeConsultingContract, { id, cancel: "0", note })}
              >
                {busy === "expire" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Arrivé à terme
              </Button>
            )}
            <Button
              variant="outline" className="flex-1 text-destructive" disabled={busy !== null}
              onClick={() => run("cancel", closeConsultingContract, { id, cancel: "1", note })}
            >
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">Tâches attendues</h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune tâche listée pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-1">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-secondary/50">
                <input
                  type="checkbox" checked={Boolean(t.doneAt)} disabled={!canEditTasks || busy !== null}
                  onChange={() => run(`task-${t.id}`, toggleConsultingTask, { taskId: t.id })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                />
                <span className={`min-w-0 flex-1 ${t.doneAt ? "text-muted-foreground line-through" : ""}`}>
                  {t.label}
                  {t.dueDate && <span className="ml-1.5 text-xs text-muted-foreground">· {t.dueDate}</span>}
                </span>
                {canEditTasks && (
                  <button
                    type="button" aria-label="Supprimer la tâche" disabled={busy !== null}
                    onClick={() => run(`del-${t.id}`, deleteConsultingTask, { taskId: t.id })}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEditTasks && (
          <div className="space-y-2 border-t border-border pt-3">
            <Label htmlFor="task-label">Ajouter une tâche</Label>
            <Input id="task-label" value={taskLabel} onChange={(e) => setTaskLabel(e.target.value)} placeholder="Ex. Rapport d'audit intermédiaire" />
            <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <Button
              variant="outline" className="w-full" disabled={busy !== null || !taskLabel.trim()}
              onClick={() => run("add-task", addConsultingTask, { contractId: id, label: taskLabel, dueDate: taskDue })}
            >
              {busy === "add-task" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
            </Button>
          </div>
        )}
      </div>

      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
