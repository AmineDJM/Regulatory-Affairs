"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check, PlayCircle, CheckCircle2, Archive, AlertCircle } from "lucide-react";
import { updateDirectiveStatus, postDirectiveMessage } from "@/lib/actions/directive-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

function useAction() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setSaving(true); setErr(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { onOk?.(); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, run };
}

const set = (id: string, status: string) => { const fd = new FormData(); fd.set("id", id); fd.set("status", status); return updateDirectiveStatus(fd); };

export function StatusActions({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const { saving, err, run } = useAction();
  const done = status === "DONE" || status === "ARCHIVED";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => set(id, "ACKNOWLEDGED"))}><Check className="h-4 w-4" /> Accuser réception</Button>
        )}
        {(status === "OPEN" || status === "ACKNOWLEDGED") && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => set(id, "IN_PROGRESS"))}><PlayCircle className="h-4 w-4" /> En cours</Button>
        )}
        {!done && (
          <Button size="sm" disabled={saving} onClick={() => run(() => set(id, "DONE"))}><CheckCircle2 className="h-4 w-4" /> Marquer traité</Button>
        )}
        {canManage && status !== "ARCHIVED" && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(() => set(id, "ARCHIVED"))}><Archive className="h-4 w-4" /> Archiver</Button>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
      </div>
      {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
    </div>
  );
}

export function MessageForm({ id }: { id: string }) {
  const { saving, err, run } = useAction();
  const ref = React.useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={(fd) => { fd.set("id", id); run(() => postDirectiveMessage(fd), () => ref.current?.reset()); }}
      className="space-y-2"
    >
      <Textarea name="body" required placeholder="Votre retour, une précision, une question…" className="min-h-[70px]" />
      {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
      <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Répondre</Button>
    </form>
  );
}
