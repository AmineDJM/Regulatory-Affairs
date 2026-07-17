"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Trash2, CheckCircle2, PlayCircle, XCircle } from "lucide-react";
import { postRegRequestMessage, setRegRequestStatus, deleteRegRequest } from "@/lib/actions/regulatory-request-actions";
import type { RegRequestDetail } from "@/lib/queries/regulatory-requests";

type Res = { ok: boolean; error?: string };

export function RequestThread({ request, canAnswer, canDelete }: { request: RegRequestDetail; canAnswer: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [text, setText] = React.useState("");

  async function run(fn: () => Promise<Res>, clear = false) {
    if (busy) return;
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    if (clear) setText("");
    router.refresh();
  }

  function send() {
    if (!text.trim()) return;
    const fd = new FormData(); fd.set("id", request.id); fd.set("body", text.trim());
    run(() => postRegRequestMessage(fd), true);
  }
  function status(s: string) {
    const fd = new FormData(); fd.set("id", request.id); fd.set("status", s);
    run(() => setRegRequestStatus(fd));
  }

  return (
    <div className="space-y-4">
      {canAnswer && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Statut :</span>
          <button type="button" disabled={busy || request.status === "IN_PROGRESS"} onClick={() => status("IN_PROGRESS")} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"><PlayCircle className="h-3.5 w-3.5" /> Prendre en charge</button>
          <button type="button" disabled={busy || request.status === "ANSWERED"} onClick={() => status("ANSWERED")} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Marquer répondue</button>
          <button type="button" disabled={busy || request.status === "CLOSED"} onClick={() => status("CLOSED")} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Clôturer</button>
        </div>
      )}

      <div className="space-y-2">
        {request.messages.length === 0 && <p className="text-sm text-muted-foreground">Aucun échange pour l'instant.</p>}
        {request.messages.map((m) => (
          <div key={m.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.authorName ?? "—"}</span>
              <span>{new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      {request.status !== "CLOSED" ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={canAnswer ? "Répondre à la demande…" : "Ajouter un message / une précision…"}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <div className="flex items-center justify-between">
            <button type="button" onClick={send} disabled={busy || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
            </button>
            {canDelete && (
              <button type="button" disabled={busy} onClick={() => { if (window.confirm("Supprimer cette demande ?")) { const fd = new FormData(); fd.set("id", request.id); run(async () => { const r = await deleteRegRequest(fd); if (r.ok) router.push("/regulatory/requests"); return r; }); } }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"><Trash2 className="h-4 w-4" /> Supprimer</button>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">Demande clôturée.</p>
      )}
    </div>
  );
}
