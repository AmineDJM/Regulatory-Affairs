"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Inbox, Send as SendIcon, RefreshCw, Loader2, Paperclip, PenSquare, X,
  ChevronLeft, AlertCircle, Trash2, Mail as MailIcon, Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendMailAction, disconnectMailbox } from "@/lib/actions/mail-actions";

interface Folder { path: string; name: string; role: string; unseen: number; total: number }
interface Envelope { uid: number; subject: string; from: string; fromAddr: string; date: string | null; seen: boolean }
interface AttMeta { index: number; filename: string; contentType: string; size: number }
interface MsgDetail { uid: number; subject: string; from: string; fromAddr: string; to: string; date: string | null; html: string | null; text: string | null; attachments: AttMeta[] }

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const folderIcon = (role: string) => (role === "Sent" ? SendIcon : role === "Trash" ? Trash2 : Inbox);
const folderLabel = (f: Folder) => ({ Sent: "Envoyés", Trash: "Corbeille", Drafts: "Brouillons", Junk: "Indésirables", Archive: "Archives" }[f.role] || (f.path === "INBOX" ? "Réception" : f.name));

export function MailClient({ email }: { email: string }) {
  const router = useRouter();
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [mailbox, setMailbox] = React.useState("INBOX");
  const [messages, setMessages] = React.useState<Envelope[]>([]);
  const [sel, setSel] = React.useState<MsgDetail | null>(null);
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingMsg, setLoadingMsg] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [compose, setCompose] = React.useState<null | { to: string; cc: string; subject: string; body: string }>(null);

  const loadList = React.useCallback(async (mb: string, withFolders = false) => {
    setLoadingList(true); setErr(null); setSel(null);
    try {
      const res = await fetch(`/api/mail/messages?mailbox=${encodeURIComponent(mb)}&limit=40${withFolders ? "&folders=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Connexion à la boîte impossible."); setMessages([]); }
      else { setMessages(data.messages ?? []); if (data.mailboxes) setFolders(data.mailboxes); }
    } catch { setErr("Connexion à la boîte impossible."); }
    finally { setLoadingList(false); }
  }, []);

  React.useEffect(() => { loadList("INBOX", true); }, [loadList]);

  const openMessage = async (uid: number) => {
    setLoadingMsg(true); setErr(null);
    try {
      const res = await fetch(`/api/mail/message?mailbox=${encodeURIComponent(mailbox)}&uid=${uid}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Lecture impossible.");
      else { setSel(data.message); setMessages((m) => m.map((x) => (x.uid === uid ? { ...x, seen: true } : x))); }
    } catch { setErr("Lecture impossible."); }
    finally { setLoadingMsg(false); }
  };

  const selectFolder = (mb: string) => { setMailbox(mb); loadList(mb); };

  return (
    <div className="surface flex min-h-0 flex-1 overflow-hidden">
      {/* Dossiers */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-secondary/30 p-2 md:flex">
        <Button size="sm" className="mb-2 w-full" onClick={() => setCompose({ to: "", cc: "", subject: "", body: "" })}><PenSquare className="h-4 w-4" /> Nouveau message</Button>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {folders.length === 0 && loadingList ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Chargement…</p>
          ) : folders.map((f) => {
            const Icon = folderIcon(f.role);
            const active = f.path === mailbox;
            return (
              <button key={f.path} onClick={() => selectFolder(f.path)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm", active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-secondary")}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 truncate text-left">{folderLabel(f)}</span>
                {f.unseen > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{f.unseen}</span>}
              </button>
            );
          })}
        </nav>
        <button onClick={async () => { if (confirm("Déconnecter cette boîte mail ?")) { await disconnectMailbox(); router.refresh(); } }} className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-destructive">
          <X className="h-3.5 w-3.5" /> Déconnecter la boîte
        </button>
      </aside>

      {/* Liste des messages */}
      <div className={cn("flex min-h-0 w-full flex-col border-r border-border md:w-80", sel && "hidden md:flex")}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{folders.find((f) => f.path === mailbox) ? folderLabel(folders.find((f) => f.path === mailbox)!) : mailbox}</p>
          <button onClick={() => loadList(mailbox)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title="Actualiser"><RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {err && !loadingList && <div className="m-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}</div>}
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : messages.length === 0 && !err ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucun message.</p>
          ) : messages.map((m) => (
            <button key={m.uid} onClick={() => openMessage(m.uid)} className={cn("flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left hover:bg-secondary/50", sel?.uid === m.uid && "bg-secondary", !m.seen && "border-l-2 border-l-primary")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", !m.seen ? "font-semibold" : "")}>{m.from || m.fromAddr || "—"}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(m.date)}</span>
              </div>
              <span className={cn("truncate text-sm", !m.seen ? "font-medium" : "text-muted-foreground")}>{m.subject}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lecteur / composeur */}
      <div className="flex min-h-0 flex-1 flex-col">
        {compose ? (
          <Composer email={email} initial={compose} onClose={() => setCompose(null)} />
        ) : sel ? (
          <Reader msg={sel} mailbox={mailbox} loading={loadingMsg} onBack={() => setSel(null)} onReply={() => setCompose({ to: sel.fromAddr, cc: "", subject: `Re: ${sel.subject}`, body: `\n\n--- Le ${fmtDate(sel.date)}, ${sel.from} a écrit ---\n${(sel.text || "").slice(0, 2000)}` })} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MailIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sélectionnez un message{loadingMsg ? "…" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Reader({ msg, mailbox, loading, onBack, onReply }: { msg: MsgDetail; mailbox: string; loading: boolean; onBack: () => void; onReply: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <button onClick={onBack} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary md:hidden"><ChevronLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{msg.subject}</p>
          <p className="truncate text-xs text-muted-foreground">{msg.from} &lt;{msg.fromAddr}&gt; · {fmtDate(msg.date)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onReply}><Reply className="h-4 w-4" /> Répondre</Button>
      </div>
      {msg.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
          {msg.attachments.map((a) => (
            <a key={a.index} href={`/api/mail/attachment?mailbox=${encodeURIComponent(mailbox)}&uid=${msg.uid}&index=${a.index}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-xs hover:bg-secondary">
              <Paperclip className="h-3.5 w-3.5" /> {a.filename}
            </a>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/10 p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : msg.html ? (
          <iframe title="message" sandbox="" className="h-full min-h-[60vh] w-full rounded-lg border border-border bg-white" srcDoc={msg.html} />
        ) : (
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-white p-4 text-sm text-neutral-900">{msg.text || "(message vide)"}</pre>
        )}
      </div>
    </div>
  );
}

function Composer({ email, initial, onClose }: { email: string; initial: { to: string; cc: string; subject: string; body: string }; onClose: () => void }) {
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="font-semibold">Nouveau message</p>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-success">
          <SendIcon className="h-10 w-10" /><p className="font-medium">Message envoyé !</p>
          <Button size="sm" variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      ) : (
        <form
          action={async (fd) => { setSaving(true); setErr(null); const r = await sendMailAction(fd); setSaving(false); if (r.ok) setSent(true); else setErr(r.error ?? "Envoi impossible."); }}
          className="flex min-h-0 flex-1 flex-col gap-2 p-4"
        >
          <p className="text-xs text-muted-foreground">De : {email}</p>
          <div className="space-y-1"><Label>À</Label><Input name="to" required defaultValue={initial.to} placeholder="destinataire@exemple.com" /></div>
          <div className="space-y-1"><Label>Cc (optionnel)</Label><Input name="cc" defaultValue={initial.cc} /></div>
          <div className="space-y-1"><Label>Objet</Label><Input name="subject" defaultValue={initial.subject} /></div>
          <div className="flex min-h-0 flex-1 flex-col space-y-1"><Label>Message</Label><Textarea name="body" defaultValue={initial.body} className="min-h-0 flex-1 resize-none" /></div>
          {err && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}</div>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />} Envoyer</Button></div>
        </form>
      )}
    </div>
  );
}
