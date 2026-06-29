"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, CircleDot, ArrowRight } from "lucide-react";
import {
  REG_PHASES, REG_STEPS, REG_STEP_STATE, REG_CHECKLIST,
  regProgress, regStepStatus, regChecklistProgress,
  type RegWorkflowState, type RegChecklistState, type RegStepState,
} from "@/lib/regulatory-workflow";
import { setRegulatoryStepState, setRegulatoryChecklistItem } from "@/lib/actions/regulatory-actions";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";

const STATE_OPTS: RegStepState[] = ["TODO", "DOING", "DONE", "BLOCKED"];

function Bar({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "success" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full ${tone === "success" ? "bg-success" : "bg-primary"} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Processus officiel ANPP : 5 phases / 22 étapes, suivi simple par statut. */
export function RegulatoryProcess({ productId, workflow, canUpdate }: { productId: string; workflow: RegWorkflowState | null; canUpdate: boolean }) {
  const router = useRouter();
  const [state, setState] = React.useState<RegWorkflowState>(workflow ?? {});
  const [busy, setBusy] = React.useState<string | null>(null);
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
                return (
                  <div key={s.key} className={`flex items-start gap-3 p-3 ${done ? "bg-success/5" : ""}`}>
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-success text-white" : st === "DOING" ? "bg-primary/15 text-primary" : st === "BLOCKED" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : st === "DOING" ? <CircleDot className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.responsible} · {s.expected}</p>
                      {state[s.key]?.date && done && <p className="text-[11px] text-success">Fait le {state[s.key]!.date}</p>}
                    </div>
                    {canUpdate ? (
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
                );
              })}
            </div>
          </div>
        );
      })}
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
                      {item.hint && <span className="block text-[11px] text-muted-foreground">{item.hint}</span>}
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
