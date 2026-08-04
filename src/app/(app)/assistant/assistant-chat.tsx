"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, Bot, CheckCircle2, AlertTriangle, KeyRound,
  Search, ArrowRight, X, Wand2, Paperclip, FolderOpen, FileText, Mic, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistantChat, executeAssistantAction, listAssistantFiles } from "@/lib/actions/assistant-actions";
import type { ProposedAction, AssistantActionPayload, ChatTurn } from "@/lib/assistant";
import type { AssistantAttachment, AssistantFileOption } from "@/lib/assistant-attachments";

/** Pièce jointe en attente d'envoi : fichier local (upload) ou fichier du Drive (référence). */
type PendingAttach =
  | { id: string; kind: "upload"; name: string; file: File }
  | { id: string; kind: "drive"; name: string; nodeId: string };

/** Lit un fichier local en base64 (sans le préfixe data:) pour l'envoyer à l'action serveur. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type ActionState = "pending" | "running" | "done" | "cancelled" | "error";

interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachmentNames?: string[];
  trace?: string[];
  proposal?: ProposedAction;
  actionState?: ActionState;
  actionResult?: string;
  actionLink?: string;
}

const SUGGESTIONS = [
  "Où en suis-je ? Résume mon espace de travail.",
  "Crée une tâche : préparer le dossier AMM pour vendredi.",
  "Demande à l'assistante de direction un billet Alger → Paris du 12 au 14 mars.",
  "Quels sont mes médecins à fort potentiel ?",
];

let counter = 1;
const nextId = () => counter++;

/** Nettoie un éventuel Markdown résiduel (l'assistant doit répondre en texte simple). */
export function cleanReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")        // **gras**
    .replace(/__(.+?)__/g, "$1")              // __gras__
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")    // `code`
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")        // # titres
    .replace(/^(\s*)[*]\s+/gm, "$1- ")          // puces * → -
    .trim();
}

export function AssistantChat({ userName, configured, voiceConfigured = false }: { userName: string; configured: boolean; voiceConfigured?: boolean }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PendingAttach[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...list.map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind: "upload" as const, name: file.name, file })),
    ].slice(0, 6));
  };
  const addDriveFile = (f: AssistantFileOption) => {
    setAttachments((prev) => (prev.some((a) => a.kind === "drive" && a.nodeId === f.id) ? prev : [...prev, { id: f.id, kind: "drive" as const, name: f.name, nodeId: f.id }].slice(0, 6)));
  };
  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  // ── Dictée vocale : on parle, Whisper transcrit, le texte arrive dans la zone de saisie
  //    (ÉDITABLE) — l'utilisateur relit/corrige avant d'envoyer. L'audio n'est pas conservé.
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [voiceMsg, setVoiceMsg] = React.useState<string | null>(null);
  const mr = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);

  const startRec = async () => {
    setVoiceMsg(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceMsg("Le micro nécessite une connexion sécurisée (HTTPS). Vous pouvez aussi écrire votre message.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); await transcribe(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" })); };
      rec.start(); mr.current = rec; setRecording(true);
    } catch {
      setVoiceMsg("Micro inaccessible — autorisez-le dans le navigateur, ou écrivez votre message.");
    }
  };
  const stopRec = () => { mr.current?.stop(); setRecording(false); };

  const transcribe = async (blob: Blob) => {
    setTranscribing(true); setVoiceMsg(null);
    try {
      const f = new FormData(); f.set("file", blob, "audio.webm");
      const res = await fetch("/api/assistant/transcribe", { method: "POST", body: f });
      const data = await res.json();
      if (data.transcript) {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${data.transcript}` : data.transcript));
        taRef.current?.focus();
      } else setVoiceMsg(data.error ?? "Transcription indisponible — vous pouvez écrire à la main.");
    } catch {
      setVoiceMsg("Envoi de l'audio impossible.");
    } finally {
      setTranscribing(false);
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    const pending = attachments;
    if ((!content && pending.length === 0) || sending || !configured) return;
    const userMsg: Msg = { id: nextId(), role: "user", content: content || "(pièces jointes)", attachmentNames: pending.map((a) => a.name) };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setSending(true);
    const history: ChatTurn[] = next
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    try {
      // Conversion des fichiers locaux en base64 ; les fichiers du Drive partent par référence.
      const payload: AssistantAttachment[] = await Promise.all(
        pending.map(async (a) =>
          a.kind === "upload"
            ? ({ kind: "upload", name: a.name, dataB64: await fileToBase64(a.file) } as AssistantAttachment)
            : ({ kind: "drive", nodeId: a.nodeId, name: a.name } as AssistantAttachment),
        ),
      );
      const res = await assistantChat(history, payload.length ? payload : undefined);
      if (!res.configured) {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "IA non configurée." }]);
      } else if (res.ok) {
        setMessages((m) => [...m, {
          id: nextId(), role: "assistant", content: res.reply, trace: res.trace,
          proposal: res.proposal, actionState: res.proposal ? "pending" : undefined,
        }]);
      } else {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", content: res.error ?? "Une erreur est survenue." }]);
      }
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "Appel à l'assistant impossible." }]);
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  };

  const confirm = async (msgId: number, payload: AssistantActionPayload) => {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "running" } : x)));
    try {
      const r = await executeAssistantAction(payload);
      setMessages((m) => m.map((x) =>
        x.id === msgId
          ? { ...x, actionState: r.ok ? "done" : "error", actionResult: r.ok ? r.message : r.error, actionLink: r.link }
          : x,
      ));
    } catch {
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "error", actionResult: "Exécution impossible." } : x)));
    }
  };

  const cancel = (msgId: number) => {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "cancelled" } : x)));
  };

  return (
    <div className="surface flex min-h-0 flex-1 flex-col overflow-hidden">
      {!configured && (
        <div className="flex items-start gap-2 border-b border-border bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>IA non configurée. Ajoutez la clé <code className="font-mono">ANTHROPIC_API_KEY</code> dans Render (Settings → Environment) pour activer l'assistant.</span>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Bonjour {userName.split(" ")[0]} 👋</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Posez une question sur votre travail, ou demandez-moi de préparer une action.
              Je m'appuie sur vos données (selon vos droits) et chaque action vous est soumise pour confirmation.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!configured}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{s}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onConfirm={confirm} onCancel={cancel} />
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2.5">
            <Avatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> L'assistant réfléchit…
            </div>
          </div>
        )}
      </div>

      <div className="relative border-t border-border bg-card/60 p-3">
        {pickerOpen && <DriveFilePicker onPick={addDriveFile} onClose={() => setPickerOpen(false)} />}

        {/* Pièces jointes en attente */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[180px] truncate">{a.name}</span>
                {a.kind === "drive" && <span className="text-[10px] text-muted-foreground">Drive</span>}
                <button type="button" onClick={() => removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}

        {(recording || transcribing || voiceMsg) && (
          <div className="mb-2 space-y-1">
            {recording && <p className="flex items-center gap-2 text-xs text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Enregistrement… parlez, puis cliquez sur le carré pour transcrire.</p>}
            {transcribing && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcription en cours…</p>}
            {voiceMsg && <p className="rounded-lg bg-accent/60 px-3 py-1.5 text-xs text-accent-foreground">{voiceMsg}</p>}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          onDragOver={(e) => { if (configured) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (configured && e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          className={`flex items-end gap-2 rounded-xl ${dragOver ? "ring-2 ring-primary/50" : ""}`}
        >
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <div className="flex items-center gap-1">
            {voiceConfigured && (recording ? (
              <button type="button" title="Arrêter et transcrire" onClick={stopRec}
                className="flex h-[2.75rem] w-9 items-center justify-center rounded-xl text-destructive transition hover:bg-destructive/10">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" title="Dicter — la voix est transcrite en texte, éditable avant l'envoi" onClick={startRec} disabled={!configured || sending || transcribing}
                className="flex h-[2.75rem] w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">
                {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              </button>
            ))}
            <button type="button" title="Joindre un fichier (glisser-déposer possible)" onClick={() => fileRef.current?.click()} disabled={!configured || sending}
              className="flex h-[2.75rem] w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">
              <Paperclip className="h-4 w-4" />
            </button>
            <button type="button" title="Choisir un fichier de mon Drive (sans le re-téléverser)" onClick={() => setPickerOpen((o) => !o)} disabled={!configured || sending}
              className={`flex h-[2.75rem] w-9 items-center justify-center rounded-xl transition hover:bg-secondary disabled:opacity-50 ${pickerOpen ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={configured ? (dragOver ? "Déposez vos fichiers ici…" : "Écrivez votre demande, ou glissez un fichier…  (Entrée pour envoyer)") : "Assistant indisponible — clé IA manquante."}
            disabled={!configured || sending}
            rows={1}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <Button type="submit" size="lg" disabled={!configured || sending || (!input.trim() && attachments.length === 0)} className="h-[2.75rem] px-4">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-primary-foreground">
      <Bot className="h-4 w-4" />
    </div>
  );
}

/** Sélecteur de fichiers du Drive personnel : on référence un fichier existant (aucun
 *  re-téléversement) — recherche par nom, chargée à la demande. */
function DriveFilePicker({ onPick, onClose }: { onPick: (f: AssistantFileOption) => void; onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const [files, setFiles] = React.useState<AssistantFileOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await listAssistantFiles(q);
      if (alive) { setFiles(res); setLoading(false); }
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="absolute bottom-full left-3 right-3 z-20 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Mes fichiers du Drive</span>
        <button type="button" onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Rechercher un fichier…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/60" />
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto px-2 pb-2">
        {loading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Chargement…</p>
        ) : files.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Aucun fichier{q ? " pour cette recherche" : ""}.</p>
        ) : (
          files.map((f) => (
            <button key={f.id} type="button" onClick={() => { onPick(f); onClose(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} Ko</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  msg, onConfirm, onCancel,
}: {
  msg: Msg;
  onConfirm: (id: number, payload: AssistantActionPayload) => void;
  onCancel: (id: number) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        {msg.attachmentNames && msg.attachmentNames.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-1">
            {msg.attachmentNames.map((n, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <FileText className="h-3 w-3" /> <span className="max-w-[160px] truncate">{n}</span>
              </span>
            ))}
          </div>
        )}
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <Avatar />
      <div className="min-w-0 max-w-[85%] space-y-2">
        {msg.trace && msg.trace.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.trace.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Search className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        )}
        {msg.content && (
          <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed">
            {cleanReply(msg.content)}
          </div>
        )}
        {msg.proposal && (
          <ActionCard
            proposal={msg.proposal}
            state={msg.actionState ?? "pending"}
            result={msg.actionResult}
            link={msg.actionLink}
            onConfirm={() => onConfirm(msg.id, msg.proposal!.payload)}
            onCancel={() => onCancel(msg.id)}
          />
        )}
      </div>
    </div>
  );
}

export function ActionCard({
  proposal, state, result, link, onConfirm, onCancel,
}: {
  proposal: ProposedAction;
  state: ActionState;
  result?: string;
  link?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-accent/40 to-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{proposal.title}</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">À confirmer</span>
      </div>

      <dl className="divide-y divide-border/50">
        {proposal.fields.map((f) => (
          <div key={f.label} className="flex gap-3 px-4 py-2 text-sm">
            <dt className="w-28 shrink-0 text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      {proposal.warnings.length > 0 && state === "pending" && (
        <div className="space-y-1 border-t border-border/60 bg-warning/5 px-4 py-2">
          {proposal.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
        {state === "pending" && (
          <>
            <Button size="sm" onClick={onConfirm}><CheckCircle2 className="h-4 w-4" /> Confirmer</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Annuler</Button>
          </>
        )}
        {state === "running" && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Exécution…</span>
        )}
        {state === "done" && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {result ?? "Action effectuée."}
            {link && <Link href={link} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Ouvrir <ArrowRight className="h-3 w-3" /></Link>}
          </span>
        )}
        {state === "cancelled" && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><X className="h-4 w-4" /> Action annulée.</span>}
        {state === "error" && <span className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {result ?? "Échec de l'action."}</span>}
      </div>
    </div>
  );
}
