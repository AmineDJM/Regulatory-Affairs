"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, CircleDot, ArrowRight, ChevronDown, Paperclip, MessageSquare } from "lucide-react";
import {
  REG_PHASES, REG_STEPS, REG_STEP_STATE, REG_CHECKLIST,
  PRESUB_ANSWER_STEP, REG_PRESUB_OUTCOME, REG_PRESUB_OUTCOME_ORDER, presubOutcome,
  regProgress, regStepStatus, regChecklistProgress,
  type RegWorkflowState, type RegChecklistState, type RegStepState, type RegPresubOutcome,
} from "@/lib/regulatory-workflow";
import { setRegulatoryStepState, setRegulatoryStepNote, setRegulatoryChecklistItem, setRegulatoryPresubOutcome } from "@/lib/actions/regulatory-actions";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";

const STATE_OPTS: RegStepState[] = ["TODO", "DOING", "DONE", "BLOCKED"];

function Bar({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "success" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full ${tone === "success" ? "bg-success" : "bg-primary"} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Processus officiel ANPP : 5 phases / 22 étapes, suivi simple par statut. */
export function RegulatoryProcess({
  productId, workflow, canUpdate, canUpload, canDelete, stepDocs, path,
}: {
  productId: string;
  workflow: RegWorkflowState | null;
  canUpdate: boolean;
  canUpload: boolean;
  canDelete: boolean;
  stepDocs: Record<string, DocItem[]>;
  path: string;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<RegWorkflowState>(workflow ?? {});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const prog = regProgress(state);

  async function setStep(key: string, status: RegStepState) {
    setBusy(key);
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], status, date: status === "DONE" && !prev[key]?.date ? new Date().toISOString().slice(0, 10) : prev[key]?.date },
    }));
    const fd = new FormData();
    fd.set("productId", productId); fd.set("stepKey", key); fd.set("status", status);
    await setRegulatoryStepState(fd);
    setBusy(null);
    router.refresh();
  }

  // Avis de présoumission : favorable → « Fait » (le flux continue) ; défavorable → « Bloqué » ;
  // en attente → « En cours ». Le statut de l'étape est dérivé de l'avis (source unique).
  async function setPresub(outcome: RegPresubOutcome) {
    setBusy(PRESUB_ANSWER_STEP);
    const mapped = REG_PRESUB_OUTCOME[outcome];
    setState((prev) => ({
      ...prev,
      [PRESUB_ANSWER_STEP]: {
        ...prev[PRESUB_ANSWER_STEP], status: mapped.status, outcome,
        date: mapped.status === "DONE" && !prev[PRESUB_ANSWER_STEP]?.date ? new Date().toISOString().slice(0, 10) : prev[PRESUB_ANSWER_STEP]?.date,
      },
    }));
    const fd = new FormData();
    fd.set("productId", productId); fd.set("outcome", outcome);
    await setRegulatoryPresubOutcome(fd);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Où en est-on ? */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Avancement</span>
          <span className="text-muted-foreground">{prog.done}/{prog.total} étapes · {prog.pct}%</span>
        </div>
        <Bar pct={prog.pct} tone={prog.pct === 100 ? "success" : "primary"} />
        {prog.current ? (
          <p className="mt-3 flex items-start gap-1.5 text-sm">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span><span className="font-medium">Prochaine étape :</span> {prog.current.n}. {prog.current.label} <span className="text-muted-foreground">— {prog.current.responsible}</span></span>
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-success"><Check className="h-4 w-4" /> Processus terminé.</p>
        )}
      </div>

      {/* Phases & étapes */}
      {REG_PHASES.map((phase) => {
        const steps = REG_STEPS.filter((s) => s.phase === phase.key);
        const phaseDone = steps.filter((s) => regStepStatus(state, s.key) === "DONE").length;
        return (
          <div key={phase.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phase.label}</h3>
              <span className="text-xs text-muted-foreground">{phaseDone}/{steps.length}</span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {steps.map((s) => {
                const st = regStepStatus(state, s.key);
                const done = st === "DONE";
                const docs = stepDocs[s.key] ?? [];
                const note = state[s.key]?.note ?? "";
                const expanded = openKey === s.key;
                return (
                  <div key={s.key} className={done ? "bg-success/5" : ""}>
                    <div className="flex items-start gap-3 p-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-success text-white" : st === "DOING" ? "bg-primary/15 text-primary" : st === "BLOCKED" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : st === "DOING" ? <CircleDot className="h-3.5 w-3.5" /> : s.n}
                      </span>
                      <button type="button" onClick={() => setOpenKey(expanded ? null : s.key)} className="min-w-0 flex-1 text-left">
                        <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.responsible} · {s.expected}</p>
                        {state[s.key]?.date && done && <p className="text-[0.6875rem] text-success">Fait le {state[s.key]!.date}</p>}
                        <span className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                          {docs.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{docs.length}</span>}
                          {note && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> note</span>}
                          <span className="inline-flex items-center gap-0.5 text-primary"><ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} /> {expanded ? "Réduire" : "Pièces & note"}</span>
                        </span>
                      </button>
                      {s.key === PRESUB_ANSWER_STEP ? (
                        // Réponse de présoumission : AVIS explicite (favorable → le flux continue).
                        canUpdate ? (
                          <Select
                            value={presubOutcome(state) ?? ""}
                            onChange={(e) => setPresub(e.target.value as RegPresubOutcome)}
                            disabled={busy === s.key}
                            className="h-8 w-44 shrink-0 text-xs"
                          >
                            <option value="" disabled>— Avis présoumission —</option>
                            {REG_PRESUB_OUTCOME_ORDER.map((o) => <option key={o} value={o}>{REG_PRESUB_OUTCOME[o].label}</option>)}
                          </Select>
                        ) : presubOutcome(state) ? (
                          <Badge tone={REG_PRESUB_OUTCOME[presubOutcome(state)!].tone} dot={false}>{busy === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : REG_PRESUB_OUTCOME[presubOutcome(state)!].label}</Badge>
                        ) : (
                          <Badge tone={REG_STEP_STATE[st].tone} dot={false}>{REG_STEP_STATE[st].label}</Badge>
                        )
                      ) : canUpdate ? (
                        <Select
                          value={st}
                          onChange={(e) => setStep(s.key, e.target.value as RegStepState)}
                          disabled={busy === s.key}
                          className="h-8 w-32 shrink-0 text-xs"
                        >
                          {STATE_OPTS.map((o) => <option key={o} value={o}>{REG_STEP_STATE[o].label}</option>)}
                        </Select>
                      ) : (
                        <Badge tone={REG_STEP_STATE[st].tone} dot={false}>{busy === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : REG_STEP_STATE[st].label}</Badge>
                      )}
                    </div>

                    {expanded && (
                      <div className="space-y-3 border-t border-border bg-background/60 px-3 py-3 pl-12">
                        <StepNote productId={productId} stepKey={s.key} initial={note} canUpdate={canUpdate} path={path} />
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pièces de l'étape</p>
                          {docs.length > 0 ? (
                            <DocumentList documents={docs} canDelete={canDelete || canUpload} canRename={canUpload} path={path} />
                          ) : (
                            <p className="text-xs text-muted-foreground">Aucune pièce pour cette étape.</p>
                          )}
                          {canUpload && (
                            <div className="mt-2">
                              <DocumentUpload entityType="REGULATORY_PRODUCT" entityId={productId} stepKey={s.key} categories={["SUPPORTING_DOC", "OTHER"]} compact />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Éditeur de commentaire d'une étape (note). Lecture seule si pas de droit d'édition. */
function StepNote({ productId, stepKey, initial, canUpdate, path }: { productId: string; stepKey: string; initial: string; canUpdate: boolean; path: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = value.trim() !== initial.trim();

  React.useEffect(() => { setValue(initial); }, [initial]);

  async function save() {
    setSaving(true); setSaved(false);
    const fd = new FormData();
    fd.set("productId", productId); fd.set("stepKey", stepKey); fd.set("note", value);
    await setRegulatoryStepNote(fd);
    setSaving(false); setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  }

  if (!canUpdate) {
    return initial ? (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Commentaire</p>
        <p className="whitespace-pre-wrap rounded-lg bg-secondary/50 px-3 py-2 text-sm">{initial}</p>
      </div>
    ) : null;
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Commentaire de l'étape</p>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Note interne sur cette étape…" className="min-h-[60px] text-sm" />
      <div className="mt-1.5 flex justify-end">
        <Button size="sm" variant="outline" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-success" /> : null}
          {saved ? "Enregistré" : "Enregistrer la note"}
        </Button>
      </div>
    </div>
  );
}

/** Checklist des documents de présoumission (Module 1) : cases à cocher simples. */
export function RegulatoryChecklist({ productId, checklist, canUpdate }: { productId: string; checklist: RegChecklistState | null; canUpdate: boolean }) {
  const router = useRouter();
  const [state, setState] = React.useState<RegChecklistState>(checklist ?? {});
  const [busy, setBusy] = React.useState<string | null>(null);
  const prog = regChecklistProgress(state);

  async function toggle(key: string, checked: boolean) {
    setBusy(key);
    setState((prev) => ({ ...prev, [key]: { ...prev[key], checked } }));
    const fd = new FormData();
    fd.set("productId", productId); fd.set("itemKey", key); fd.set("checked", checked ? "true" : "false");
    await setRegulatoryChecklistItem(fd);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Documents fournis</span>
          <span className="text-muted-foreground">{prog.checked}/{prog.total} · {prog.pct}%</span>
        </div>
        <Bar pct={prog.pct} tone={prog.pct === 100 ? "success" : "primary"} />
      </div>

      {REG_CHECKLIST.map((group) => {
        const groupChecked = group.items.filter((i) => state[i.key]?.checked).length;
        return (
          <div key={group.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              <span className="text-xs text-muted-foreground">{groupChecked}/{group.items.length}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const checked = state[item.key]?.checked ?? false;
                return (
                  <label key={item.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary/50 ${!canUpdate ? "cursor-default" : ""}`}>
                    <input
                      type="checkbox" checked={checked}
                      onChange={(e) => toggle(item.key, e.target.checked)}
                      disabled={!canUpdate || busy === item.key}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-success"
                    />
                    <span className="text-sm">
                      <span className={checked ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                      {item.hint && <span className="block text-[0.6875rem] text-muted-foreground">{item.hint}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
