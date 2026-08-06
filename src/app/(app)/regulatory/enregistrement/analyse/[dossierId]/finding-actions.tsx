"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Eye, ShieldOff } from "lucide-react";
import { updateFindingStatus } from "@/lib/regulatory/intelligence/actions";

interface Props {
  findingId: string;
  status: string;
  blocker: boolean;
  canEdit: boolean;
  canApprove: boolean;
}

/** Boutons de revue d'un constat : Pris en compte / Résolu / Lever (avec justification). */
export function FindingControls({ findingId, status, blocker, canEdit, canApprove }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [waiving, setWaiving] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function apply(next: string, justification?: string) {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("findingId", findingId);
    fd.set("status", next);
    if (justification) fd.set("note", justification);
    const r = await updateFindingStatus(fd);
    setBusy(false);
    if (r.ok) { setWaiving(false); setNote(""); router.refresh(); }
    else setError(r.error ?? "Échec.");
  }

  if (!canEdit && !canApprove) return null;
  const done = status === "RESOLVED" || status === "WAIVED";

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground/70">{statusLabel(status)}</span>
        {canEdit && status !== "ACKNOWLEDGED" && !done && (
          <button type="button" disabled={busy} onClick={() => apply("ACKNOWLEDGED")} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[0.6875rem] hover:bg-accent disabled:opacity-50"><Eye className="h-3 w-3" /> Pris en compte</button>
        )}
        {canEdit && status !== "RESOLVED" && (
          <button type="button" disabled={busy} onClick={() => apply("RESOLVED")} className="inline-flex items-center gap-1 rounded border border-success/40 px-1.5 py-0.5 text-[0.6875rem] text-success hover:bg-success/10 disabled:opacity-50"><Check className="h-3 w-3" /> Résolu</button>
        )}
        {canApprove && status !== "WAIVED" && (
          <button type="button" disabled={busy} onClick={() => (blocker ? setWaiving((v) => !v) : apply("WAIVED"))} className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-1.5 py-0.5 text-[0.6875rem] text-amber-600 hover:bg-amber-500/10 disabled:opacity-50"><ShieldOff className="h-3 w-3" /> Lever</button>
        )}
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {waiving && (
        <div className="flex flex-col gap-1">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Justification obligatoire pour lever un bloqueur…"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          <div className="flex gap-1.5">
            <button type="button" disabled={busy || !note.trim()} onClick={() => apply("WAIVED", note.trim())} className="rounded bg-amber-500 px-2 py-0.5 text-[0.6875rem] font-medium text-white disabled:opacity-50">Confirmer la levée</button>
            <button type="button" onClick={() => setWaiving(false)} className="rounded border border-border px-2 py-0.5 text-[0.6875rem]">Annuler</button>
          </div>
        </div>
      )}
      {error && <span className="text-[0.6875rem] text-destructive">{error}</span>}
    </div>
  );
}

function statusLabel(s: string): string {
  return { OPEN: "Ouvert", ACKNOWLEDGED: "Pris en compte", RESOLVED: "Résolu", WAIVED: "Levé (justifié)" }[s] ?? s;
}
