"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Inbox, Send as SendIcon, RefreshCw, Loader2, Paperclip, PenSquare, X,
  ChevronLeft, AlertCircle, Trash2, Mail as MailIcon, Reply, Maximize2, Minimize2,
  FolderKanban, Check, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { sendMailAction, disconnectMailbox } from "@/lib/actions/mail-actions";
import { listLinkableDossiers, linkEmailToDossier } from "@/lib/actions/dossier-actions";

interface Folder { path: string; name: string; role: string; unseen: number; total: number }
interface Envelope { uid: number; subject: string; from: string; fromAddr: string; date: string | null; seen: boolean }
interface AttMeta { index: number; filename: string; contentType: string; size: number }
interface MsgDetail { uid: number; subject: string; from: string; fromAddr: string; to: string; date: string | null; html: string | null; text: string | null; attachments: AttMeta[] }
export interface Contact { name: string; address: string; source?: string }

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
  const [fullscreen, setFullscreen] = React.useState(false);

  // Plein écran : verrouille le défilement de la page derrière + sortie au clavier (Échap).
  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !compose && !sel) setFullscreen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, compose, sel]);

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
    <div className={cn("flex overflow-hidden", fullscreen ? "fixed inset-0 z-[60] bg-background" : "surface min-h-0 flex-1")}>
      {/* Dossiers */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-gradient-to-b from-secondary/40 to-secondary/10 p-3 md:flex">
        <button
          onClick={() => setCompose({ to: "", cc: "", subject: "", body: "" })}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-purple-600 px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:shadow-lg hover:brightness-105 active:scale-95"
        >
          <PenSquare className="h-4 w-4" /> Nouveau message
        </button>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {folders.length === 0 && loadingList ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Chargement…</p>
          ) : folders.map((f) => {
            const Icon = folderIcon(f.role);
            const active = f.path === mailbox;
            return (
              <button key={f.path} onClick={() => selectFolder(f.path)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors", active ? "bg-card font-semibold text-primary shadow-sm ring-1 ring-primary/10" : "text-foreground hover:bg-card/60")}>
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} /><span className="flex-1 truncate text-left">{folderLabel(f)}</span>
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
          <div className="flex items-center gap-0.5">
            <button onClick={() => loadList(mailbox)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title="Actualiser"><RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} /></button>
            <button onClick={() => setFullscreen((v) => !v)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title={fullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {err && !loadingList && <div className="m-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}</div>}
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : messages.length === 0 && !err ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucun message.</p>
          ) : messages.map((m) => (
            <button key={m.uid} onClick={() => openMessage(m.uid)} className={cn("flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent/40", sel?.uid === m.uid ? "bg-accent/60" : !m.seen && "bg-primary/[0.03]")}>
              <Avatar name={m.from || m.fromAddr || "?"} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", !m.seen ? "font-semibold text-foreground" : "text-foreground/90")}>{m.from || m.fromAddr || "—"}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(m.date)}</span>
                </div>
                <span className={cn("block truncate text-sm", !m.seen ? "font-medium text-foreground" : "text-muted-foreground")}>{m.subject || "(sans objet)"}</span>
              </div>
              {!m.seen && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
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
      <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-accent/30 to-transparent px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary md:hidden"><ChevronLeft className="h-4 w-4" /></button>
        <Avatar name={msg.from || msg.fromAddr || "?"} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{msg.subject || "(sans objet)"}</p>
          <p className="truncate text-xs text-muted-foreground">{msg.from} &lt;{msg.fromAddr}&gt; · {fmtDate(msg.date)}</p>
        </div>
        <LinkToDossier msg={msg} />
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

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rattache l'e-mail affiché à un dossier de suivi (existant ou nouveau). */
function LinkToDossier({ msg }: { msg: MsgDetail }) {
  const [open, setOpen] = React.useState(false);
  const [dossiers, setDossiers] = React.useState<{ id: string; reference: string; title: string }[] | null>(null);
  const [target, setTarget] = React.useState(""); // id d'un dossier, ou "" = nouveau
  const [newTitle, setNewTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<null | { id: string; reference: string }>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && dossiers === null) {
      listLinkableDossiers().then((d) => { setDossiers(d); setTarget(d[0]?.id ?? ""); }).catch(() => setDossiers([]));
    }
  }, [open, dossiers]);
  // Repart à zéro quand on change de message.
  React.useEffect(() => { setOpen(false); setDone(null); setErr(null); setNewTitle(""); }, [msg.uid]);

  async function submit() {
    setBusy(true); setErr(null);
    const body = msg.text || (msg.html ? stripHtml(msg.html) : "");
    const r = await linkEmailToDossier({
      dossierId: target || null,
      newTitle: target ? null : (newTitle || msg.subject),
      from: msg.from || msg.fromAddr, subject: msg.subject, date: msg.date, body,
    });
    setBusy(false);
    if (r.ok) setDone({ id: r.dossierId!, reference: r.reference ?? "" });
    else setErr(r.error ?? "Échec du rattachement.");
  }

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}><FolderKanban className="h-4 w-4" /> <span className="hidden sm:inline">Lier à un dossier</span></Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
          {done ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-success"><Check className="h-4 w-4" /> E-mail lié{done.reference ? ` à ${done.reference}` : ""}.</p>
              <a href={`/dossiers/${done.id}`} className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir le dossier</a>
            </div>
          ) : dossiers === null ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : (
            <div className="space-y-2">
              <Label>Dossier</Label>
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                {dossiers.map((d) => <option key={d.id} value={d.id}>{d.reference} — {d.title}</option>)}
                <option value="">➕ Nouveau dossier…</option>
              </Select>
              {target === "" && (
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={msg.subject || "Intitulé du dossier"} />
              )}
              {err && <p className="text-xs text-destructive">{err}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button size="sm" onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />} Lier</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({ email, initial, onClose }: { email: string; initial: { to: string; cc: string; subject: string; body: string }; onClose: () => void }) {
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [showCc, setShowCc] = React.useState(Boolean(initial.cc));
  // Verrou synchrone : empêche tout double-envoi (double-clic / double soumission)
  // même avant que l'état `saving` ne soit re-rendu.
  const inFlight = React.useRef(false);

  async function send(fd: FormData) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true); setErr(null);
    try {
      const r = await sendMailAction(fd);
      if (r.ok) setSent(true);
      else setErr(r.error ?? "Envoi impossible.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  // Carnet d'adresses (collègues + correspondants récents) chargé une fois.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/mail/contacts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((d) => { if (alive) setContacts(d.contacts ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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
        <form action={send} className="flex min-h-0 flex-1 flex-col gap-2 p-4">
          <p className="text-xs text-muted-foreground">De : {email}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>À</Label>
              {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-xs text-primary hover:underline">+ Cc</button>}
            </div>
            <AddressInput name="to" defaultValue={initial.to} contacts={contacts} required placeholder="Commencez à taper un nom ou une adresse…" />
          </div>
          {showCc && <div className="space-y-1"><Label>Cc</Label><AddressInput name="cc" defaultValue={initial.cc} contacts={contacts} placeholder="cc@exemple.com" /></div>}
          <div className="space-y-1"><Label>Objet</Label><Input name="subject" defaultValue={initial.subject} /></div>
          <div className="flex min-h-0 flex-1 flex-col space-y-1"><Label>Message</Label><Textarea name="body" defaultValue={initial.body} className="min-h-0 flex-1 resize-none" /></div>
          {err && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}</div>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />} Envoyer</Button></div>
        </form>
      )}
    </div>
  );
}

/** Champ d'adresse avec autocomplétion (collègues + correspondants récents). Gère
 *  plusieurs destinataires séparés par des virgules : seul le dernier est complété. */
function AddressInput({ name, defaultValue, contacts, required, placeholder }: { name: string; defaultValue?: string; contacts: Contact[]; required?: boolean; placeholder?: string }) {
  const [value, setValue] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);

  const token = (value.split(",").pop() ?? "").trim().toLowerCase();
  const chosen = new Set(value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  const suggestions = token.length >= 1
    ? contacts.filter((c) => !chosen.has(c.address) && (c.address.includes(token) || c.name.toLowerCase().includes(token))).slice(0, 8)
    : [];

  const pick = (addr: string) => {
    const parts = value.split(",");
    parts[parts.length - 1] = ` ${addr}`;
    setValue(parts.join(",").replace(/^\s+/, "") + ", ");
    setOpen(false); setHi(0);
  };

  return (
    <div className="relative">
      <Input
        name={name} required={required} autoComplete="off" value={value} placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" || e.key === "Tab") {
            if (e.key === "Enter") e.preventDefault();
            pick(suggestions[hi].address);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-lg">
          {suggestions.map((c, i) => (
            <li key={c.address}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(c.address); }}
                className={cn("flex w-full flex-col px-3 py-1.5 text-left hover:bg-secondary", i === hi && "bg-secondary")}>
                <span className="truncate text-sm font-medium">{c.name || c.address}</span>
                {c.name && <span className="truncate text-xs text-muted-foreground">{c.address}{c.source === "interne" ? " · collègue" : ""}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
