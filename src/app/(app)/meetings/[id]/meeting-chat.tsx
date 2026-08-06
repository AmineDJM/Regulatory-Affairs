"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, AlertCircle, Trash2, Paperclip, FileText, Download, X } from "lucide-react";
import { postMeetingMessage, deleteMeetingMessage } from "@/lib/actions/meeting-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatBytes } from "../../messages/format";

export interface ChatAttachment { id: string; name: string; mime: string; size: number }
export interface ChatMessage {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  mine: boolean;
  canDelete: boolean;
  attachments: ChatAttachment[];
}

/** Pièces jointes d'un message (images en vignette, autres fichiers en puce téléchargeable). */
function MessageAttachments({ attachments, onDark }: { attachments: ChatAttachment[]; onDark: boolean }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => a.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a key={a.id} href={`/api/meetings/message-attachment/${a.id}`} target="_blank" rel="noopener noreferrer" title={a.name}>
          <img src={`/api/meetings/message-attachment/${a.id}`} alt={a.name} className="max-h-40 rounded-lg border border-black/10 object-cover" />
        </a>
      ) : (
        <a key={a.id} href={`/api/meetings/message-attachment/${a.id}?dl=1`}
          className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${onDark ? "bg-white/15 hover:bg-white/25" : "border border-border bg-background hover:bg-secondary"}`}>
          <FileText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{a.name}</span>
          <span className="opacity-70">{formatBytes(a.size)}</span>
          <Download className="h-3.5 w-3.5 shrink-0" />
        </a>
      ))}
    </div>
  );
}

/** Bulle d'un message du fil de réunion (suppression pour l'auteur ou l'organisateur/vue globale). */
function MeetingMessageItem({ m }: { m: ChatMessage }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (!window.confirm("Supprimer ce message ?")) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", m.id);
    await deleteMeetingMessage(fd);
    setBusy(false); router.refresh();
  }

  return (
    <div className={`group max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>
      {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
      <MessageAttachments attachments={m.attachments} onDark={m.mine} />
      <p className={`mt-1 flex items-center gap-1.5 text-[0.6875rem] ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        <span>{m.author} · {m.createdAt}</span>
        {m.canDelete && (
          <button type="button" onClick={remove} disabled={busy} title="Supprimer"
            className={`rounded p-0.5 opacity-0 transition group-hover:opacity-100 ${m.mine ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </p>
    </div>
  );
}

/**
 * Fil de discussion (chat) d'une réunion : texte + pièces jointes (comme la messagerie).
 * Les messages sont fournis par le serveur ; l'envoi/suppression rafraîchit la page.
 */
export function MeetingChat({ meetingId, messages }: { meetingId: string; messages: ChatMessage[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    setSaving(true); setErr(null);
    const fd = new FormData();
    fd.set("id", meetingId);
    fd.set("body", body);
    files.forEach((f) => fd.append("files", f));
    (async () => {
      const r = await postMeetingMessage(fd);
      setSaving(false);
      if (r.ok) { setBody(""); setFiles([]); router.refresh(); }
      else setErr(r.error ?? "Envoi impossible.");
    })();
  };

  return (
    <div className="space-y-3">
      {messages.length > 0 ? (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => <MeetingMessageItem key={m.id} m={m} />)}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Aucun message. Lancez la discussion : partagez l'ordre du jour, un document, un compte rendu…
        </p>
      )}

      <form onSubmit={submit} className="space-y-2 border-t border-border pt-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écrivez un message… Joignez un document si besoin." className="min-h-[64px]" />

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs">
                <FileText className="h-3.5 w-3.5" /> <span className="max-w-[10rem] truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}

        {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {err}</div>}

        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden"
            onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) setFiles((arr) => [...arr, ...fs]); e.target.value = ""; }} />
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="Joindre un fichier"><Paperclip className="h-4 w-4" /></Button>
          <Button type="submit" size="sm" disabled={saving || (!body.trim() && files.length === 0)} className="ml-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
          </Button>
        </div>
      </form>
    </div>
  );
}
