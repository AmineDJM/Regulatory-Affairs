"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, Bot, CheckCircle2, AlertTriangle, KeyRound,
  Search, ArrowRight, X, Wand2, Paperclip, FolderOpen, FileText, Mic, Square,
  History, Plus, Trash2, Lock, AudioLines, Link2, ShieldAlert,
} from "lucide-react";
import { VoiceMode } from "./voice-mode";
import type { VoiceToolUi } from "./realtime-voice";
import { Button } from "@/components/ui/button";
import {
  assistantChat, executeAssistantAction, listAssistantFiles,
  myAssistantThreads, myAssistantThread, deleteMyAssistantThread, forgetMyAssistantMemory,
} from "@/lib/actions/assistant-actions";
import type { ProposedAction, AssistantActionPayload, ChatTurn, AssistantResult, AssistantStreamEvent } from "@/lib/assistant";
import type { AssistantAttachment, AssistantFileOption } from "@/lib/assistant-attachments";
import type { ThreadSummary } from "@/lib/assistant-memory";
import { useScrollLock } from "@/lib/use-scroll-lock";

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
  /** Les actions proposées dans CE tour (souvent une, parfois plusieurs — « crée les trois tâches »). */
  proposals?: ProposedAction[];
  /** État / résultat / lien PAR action, alignés sur `proposals`. */
  actionStates?: ActionState[];
  actionResults?: (string | undefined)[];
  actionLinks?: (string | undefined)[];
}

const SUGGESTIONS = [
  "Où en suis-je ? Résume mon espace de travail.",
  "Crée une tâche : préparer le dossier AMM pour vendredi.",
  "Demande à l'assistante de direction un billet Alger → Paris du 12 au 14 mars.",
  "Quels sont mes médecins à fort potentiel ?",
];

type StreamEvent = AssistantStreamEvent;

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

export function AssistantChat({
  userName, configured, voiceConfigured = false, realtimeVoice = false, memoryEnabled = false,
  executive = false, initialPrompt = null, initialThreadId = null,
}: {
  userName: string; configured: boolean;
  /** Dictée disponible (transcription simple, texte éditable avant envoi). */
  voiceConfigured?: boolean;
  /** APPEL temps réel (speech-to-speech) disponible — siège exécutif + clé Realtime. */
  realtimeVoice?: boolean;
  memoryEnabled?: boolean;
  /** Mode Chief of Staff : panneau CONTEXTE (sources, actions) sur grand écran. */
  executive?: boolean;
  /** Entrée contextuelle (?q=…) : la question est pré-remplie, prête à partir. */
  initialPrompt?: string | null;
  /** LE FIL PRINCIPAL : la conversation continue qui s'ouvre d'office (Chief of Staff). */
  initialThreadId?: string | null;
}) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  /** Les SOURCES consultées pendant la conversation (liens internes), les plus récentes d'abord. */
  const [sources, setSources] = React.useState<{ label: string; href: string }[]>([]);
  /** Conversation vocale continue (VAD + barge-in) — distincte de la dictée. */
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PendingAttach[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  /** Réponse EN COURS d'écriture (texte partiel + étapes de lecture déjà annoncées). */
  const [streaming, setStreaming] = React.useState<{ text: string; trace: string[] } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ── Mémoire personnelle : fil courant + historique de MES conversations.
  //    Le serveur ne renvoie jamais que les fils du demandeur (cf. assistant-memory.ts).
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [histOpen, setHistOpen] = React.useState(false);
  const [loadingThread, setLoadingThread] = React.useState(false);
  useScrollLock(histOpen); // sinon la conversation défile derrière le tiroir d'historique

  const refreshThreads = React.useCallback(async () => {
    if (!memoryEnabled) return;
    setThreads(await myAssistantThreads());
  }, [memoryEnabled]);

  React.useEffect(() => { void refreshThreads(); }, [refreshThreads]);

  // Entrée contextuelle (« Demander au Chief of Staff » depuis une fiche) : la question arrive
  // PRÉ-REMPLIE, jamais envoyée toute seule — on relit avant d'envoyer, même une question.
  React.useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setInput(initialPrompt.trim());
      taRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, streaming?.text]);

  const newConversation = () => {
    setThreadId(null); setMessages([]); setInput(""); setAttachments([]); setHistOpen(false);
    taRef.current?.focus();
  };

  const openThread = async (id: string) => {
    setHistOpen(false);
    if (id === threadId) return;
    setLoadingThread(true);
    try {
      const stored = await myAssistantThread(id);
      if (!stored) { await refreshThreads(); return; } // fil disparu (ou jamais le mien)
      setThreadId(id);
      setMessages(stored.map((m) => ({ id: nextId(), role: m.role, content: m.content })));
    } finally {
      setLoadingThread(false);
    }
  };

  // LE FIL PRINCIPAL s'ouvre d'office : la conversation avec le Chief of Staff CONTINUE dans le
  // temps au lieu de repartir de zéro. Seuls les derniers échanges sont rechargés (plafond côté
  // serveur) — le passé lointain se retrouve par recall_conversation.
  React.useEffect(() => {
    if (initialThreadId && memoryEnabled) void openThread(initialThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId, memoryEnabled]);

  const removeThread = async (id: string) => {
    const r = await deleteMyAssistantThread(id);
    if (r.ok) {
      if (id === threadId) { setThreadId(null); setMessages([]); }
      await refreshThreads();
    }
  };

  const forgetAll = async () => {
    if (!window.confirm("Effacer TOUTE la mémoire de votre assistant (conversations et souvenirs) ? Cette action est définitive.")) return;
    const r = await forgetMyAssistantMemory();
    if (r.ok) { setThreadId(null); setMessages([]); await refreshThreads(); }
  };

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

  // ── APPEL VOCAL : le pont avec la session temps réel.
  //    Pendant un appel, le texte tapé entre DANS la session (réponse parlée) ; les tours
  //    vocaux (transcriptions) et les cartes d'outils reviennent s'afficher ICI — voix et
  //    texte sont deux modalités de la même conversation.
  const voiceTextSenderRef = React.useRef<((text: string) => void) | null>(null);
  const registerVoiceTextSender = React.useCallback((fn: ((text: string) => void) | null) => {
    voiceTextSenderRef.current = fn;
  }, []);
  const onVoiceTurn = React.useCallback((userText: string, assistantText: string) => {
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", content: userText },
      { id: nextId(), role: "assistant", content: assistantText },
    ]);
    void refreshThreads();
  }, [refreshThreads]);
  const onVoiceToolUi = React.useCallback((ui: VoiceToolUi) => {
    if (ui.sources?.length) {
      setSources((prev) => {
        const merged = [...prev];
        for (const s of ui.sources ?? []) if (!merged.some((x) => x.href === s.href)) merged.unshift(s);
        return merged.slice(0, 30);
      });
    }
    const proposals = (ui.proposals ?? null) as ProposedAction[] | null;
    // Le COMPAGNON VISUEL : les actions à confirmer et les analyses détaillées s'affichent
    // dans le fil pendant que la voix résume — la carte de confirmation reste LA porte.
    if (proposals?.length) {
      setMessages((m) => [...m, {
        id: nextId(), role: "assistant",
        content: ui.reply || (proposals.length === 1 ? "Action proposée — à confirmer ci-dessous." : `${proposals.length} actions proposées — à confirmer ci-dessous.`),
        trace: ui.trace,
        proposals,
        actionStates: proposals.map(() => "pending" as ActionState),
        actionResults: proposals.map(() => undefined),
        actionLinks: proposals.map(() => undefined),
      }]);
    } else if (ui.reply && ui.reply.length > 400) {
      // Une analyse déléguée détaillée mérite l'écran ; la voix n'en dit que la synthèse.
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: ui.reply as string, trace: ui.trace }]);
    }
  }, []);

  /** Envoie un tour et REND la réponse finale — la voix en a besoin pour parler. */
  const send = async (text: string): Promise<string | null> => {
    const content = text.trim();
    const pending = attachments;
    if ((!content && pending.length === 0) || sending || !configured) return null;

    // Pendant un APPEL : le message tapé entre dans la session vocale (sans pièces jointes —
    // elles passent par le circuit texte habituel). La réponse arrive parlée ET transcrite.
    if (voiceTextSenderRef.current && pending.length === 0 && content) {
      voiceTextSenderRef.current(content);
      setInput("");
      return null;
    }
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
      // Les pièces jointes passent par l'action serveur (elles doivent être résolues et
      // extraites avant l'appel au modèle) ; une conversation SANS pièce jointe passe par le
      // FLUX, pour que la réponse s'écrive au lieu de tomber d'un bloc.
      if (pending.length > 0) {
        const payload: AssistantAttachment[] = await Promise.all(
          pending.map(async (a) =>
            a.kind === "upload"
              ? ({ kind: "upload", name: a.name, dataB64: await fileToBase64(a.file) } as AssistantAttachment)
              : ({ kind: "drive", nodeId: a.nodeId, name: a.name } as AssistantAttachment),
          ),
        );
        const res = await assistantChat(history, payload, threadId);
        return appendResult(res);
      }
      return await streamAnswer(history);
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "Appel à l'assistant impossible." }]);
      return null;
    } finally {
      setSending(false);
      setStreaming(null);
      if (!voiceOpen) taRef.current?.focus();
    }
  };
  /** Ajoute le résultat d'un tour non diffusé (pièces jointes) à la conversation. */
  const appendResult = (res: AssistantResult): string | null => {
    if (!res.configured) {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "IA non configurée." }]);
      return null;
    }
    if (res.ok) {
      const proposals = res.proposals ?? (res.proposal ? [res.proposal] : []);
      setMessages((m) => [...m, {
        id: nextId(), role: "assistant", content: res.reply, trace: res.trace,
        proposals: proposals.length ? proposals : undefined,
        actionStates: proposals.length ? proposals.map(() => "pending" as ActionState) : undefined,
        actionResults: proposals.length ? proposals.map(() => undefined) : undefined,
        actionLinks: proposals.length ? proposals.map(() => undefined) : undefined,
      }]);
      if (res.threadId) { setThreadId(res.threadId); void refreshThreads(); }
      return res.reply || null;
    }
    setMessages((m) => [...m, { id: nextId(), role: "assistant", content: res.error ?? "Une erreur est survenue." }]);
    return null;
  };

  /**
   * Tour de conversation EN FLUX (Server-Sent Events). On affiche, dans l'ordre où ils
   * arrivent : les étapes de lecture, puis le texte mot à mot. La réponse n'apparaît plus
   * d'un bloc après un long silence.
   */
  const streamAnswer = async (history: ChatTurn[]): Promise<string | null> => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming({ text: "", trace: [] });

    const res = await fetch("/api/assistant/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ history, threadId }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "L'assistant est momentanément indisponible." }]);
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    let reply: string | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        if (!raw.startsWith("data:")) continue;
        let evt: StreamEvent;
        try { evt = JSON.parse(raw.slice(5).trim()) as StreamEvent; } catch { continue; }

        if (evt.type === "delta") {
          setStreaming((s) => ({ text: (s?.text ?? "") + evt.text, trace: s?.trace ?? [] }));
        } else if (evt.type === "trace") {
          setStreaming((s) => ({ text: s?.text ?? "", trace: s?.trace.includes(evt.label) ? s.trace : [...(s?.trace ?? []), evt.label] }));
        } else if (evt.type === "source") {
          // Le panneau CONTEXTE se remplit au moment même où l'assistant consulte.
          setSources((prev) => (prev.some((s) => s.href === evt.href) ? prev : [{ label: evt.label, href: evt.href }, ...prev].slice(0, 30)));
        } else if (evt.type === "reset") {
          // Le texte affiché n'était qu'un préambule à un appel d'outil.
          setStreaming((s) => ({ text: "", trace: s?.trace ?? [] }));
        } else if (evt.type === "done") {
          finished = true;
          reply = appendResult(evt.result);
        }
      }
    }
    if (!finished) {
      // Flux interrompu : on conserve ce qui a été écrit plutôt que de tout perdre.
      setStreaming((s) => {
        if (s?.text) setMessages((m) => [...m, { id: nextId(), role: "assistant", content: s.text, trace: s.trace }]);
        return null;
      });
    }
    return reply;
  };

  /** Interrompt la génération en cours (le texte déjà écrit est conservé). */
  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  /** Met à jour l'état d'UNE action (par son index) dans le message qui la porte. */
  const patchAction = (msgId: number, index: number, patch: { state: ActionState; result?: string; link?: string }) => {
    setMessages((m) => m.map((x) => {
      if (x.id !== msgId || !x.actionStates) return x;
      const actionStates = [...x.actionStates];
      const actionResults = [...(x.actionResults ?? [])];
      const actionLinks = [...(x.actionLinks ?? [])];
      actionStates[index] = patch.state;
      actionResults[index] = patch.result;
      actionLinks[index] = patch.link;
      return { ...x, actionStates, actionResults, actionLinks };
    }));
  };

  const confirm = async (msgId: number, index: number, payload: AssistantActionPayload): Promise<boolean> => {
    patchAction(msgId, index, { state: "running" });
    try {
      const r = await executeAssistantAction(payload);
      patchAction(msgId, index, { state: r.ok ? "done" : "error", result: r.ok ? r.message : r.error, link: r.link });
      return r.ok;
    } catch {
      patchAction(msgId, index, { state: "error", result: "Exécution impossible." });
      return false;
    }
  };

  /** « Tout confirmer » : les actions EN ATTENTE du message, l'une après l'autre — jamais en
   *  parallèle (deux écritures concurrentes sur le même dossier se marcheraient dessus). */
  const confirmingAllRef = React.useRef<Set<number>>(new Set());
  const confirmAll = async (msg: Msg) => {
    if (!msg.proposals || !msg.actionStates) return;
    if (confirmingAllRef.current.has(msg.id)) return; // double-clic = un seul lot
    confirmingAllRef.current.add(msg.id);
    try {
      for (let i = 0; i < msg.proposals.length; i += 1) {
        if (msg.actionStates[i] !== "pending") continue;
        // Une action CRITIQUE (re-saisie du montant) ne s'enchaîne pas : elle se confirme seule.
        if (msg.proposals[i].level === "CRITICAL") continue;
        await confirm(msg.id, i, msg.proposals[i].payload);
      }
    } finally {
      confirmingAllRef.current.delete(msg.id);
    }
  };

  const cancel = (msgId: number, index: number) => {
    patchAction(msgId, index, { state: "cancelled" });
  };

  const rail = memoryEnabled ? (
    <ThreadRail
      threads={threads} current={threadId}
      onNew={newConversation} onOpen={openThread} onDelete={removeThread} onForget={forgetAll}
    />
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 gap-0 lg:gap-4">
      {memoryEnabled && <div className="hidden w-64 shrink-0 lg:block">{rail}</div>}
      {memoryEnabled && histOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer l'historique" className="absolute inset-0 bg-black/40" onClick={() => setHistOpen(false)} />
          <div className="relative z-10 h-full w-72 max-w-[85vw] p-2">{rail}</div>
        </div>
      )}

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {memoryEnabled && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <button type="button" onClick={() => setHistOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:hidden">
            <History className="h-4 w-4" /> Historique
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {loadingThread ? "Ouverture…" : threads.find((t) => t.id === threadId)?.title ?? "Nouvelle conversation"}
          </span>
          <button type="button" onClick={newConversation} title="Nouvelle conversation"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouvelle</span>
          </button>
        </div>
      )}
      {!configured && (
        <div className="flex items-start gap-2 border-b border-border bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>IA non configurée. Ajoutez la clé <code className="font-mono">ANTHROPIC_API_KEY</code> dans Render (Settings → Environment) pour activer l'assistant.</span>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
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
            <MessageBubble key={m.id} msg={m} onConfirm={confirm} onCancel={cancel} onConfirmAll={confirmAll} />
          ))
        )}
        {/* Réponse EN COURS : on montre ce que l'assistant fait, puis ce qu'il écrit — jamais
            un long silence suivi d'un pavé. */}
        {sending && (
          <div className="flex gap-3">
            <Avatar />
            <div className="min-w-0 flex-1 space-y-1.5">
              {streaming && streaming.trace.length > 0 && (
                <ul className="space-y-0.5">
                  {streaming.trace.map((t) => (
                    <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-success" /> {t}
                    </li>
                  ))}
                </ul>
              )}
              {streaming?.text ? (
                <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                  {cleanReply(streaming.text)}
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-foreground align-middle" aria-hidden />
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> L&apos;assistant réfléchit…
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="relative border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <div className="mx-auto w-full max-w-3xl">
        {pickerOpen && <DriveFilePicker onPick={addDriveFile} onClose={() => setPickerOpen(false)} />}

        {/* Pièces jointes en attente */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[180px] truncate">{a.name}</span>
                {a.kind === "drive" && <span className="text-[0.625rem] text-muted-foreground">Drive</span>}
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

        {/* MODE APPEL — conversation speech-to-speech temps réel (WebRTC ↔ API Realtime) :
            barge-in natif, mêmes outils, même fil, cartes de confirmation à l'écran. */}
        {voiceOpen && (
          <VoiceMode
            threadId={threadId}
            onThreadId={(tid) => setThreadId(tid)}
            onTurn={onVoiceTurn}
            onToolUi={onVoiceToolUi}
            registerTextSender={registerVoiceTextSender}
            onClose={() => setVoiceOpen(false)}
          />
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
            {realtimeVoice && (
              <button type="button"
                title={voiceOpen ? "Raccrocher" : "Parler au Chief of Staff — conversation vocale temps réel (interruptible)"}
                onClick={() => setVoiceOpen((o) => !o)} disabled={!configured}
                className={`flex h-[2.75rem] w-9 items-center justify-center rounded-xl transition disabled:opacity-50 ${voiceOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <AudioLines className="h-4 w-4" />
              </button>
            )}
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
          {sending ? (
            <Button type="button" size="lg" variant="outline" onClick={stopStreaming} className="h-[2.75rem] px-4" title="Arrêter la génération">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!configured || (!input.trim() && attachments.length === 0)} className="h-[2.75rem] px-4">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">
          L&apos;assistant peut se tromper. Chaque action qu&apos;il propose vous est soumise avant d&apos;être exécutée.
        </p>
        </div>
      </div>
    </div>

    {/* PANNEAU CONTEXTE (Chief of Staff, grand écran) : les sources consultées et les actions
        du fil — chaque dossier lu devient un lien, sans refaire la recherche. */}
    {executive && <ExecutivePanel sources={sources} messages={messages} />}
    </div>
  );
}

/** Le volet CONTEXTE du Chief of Staff : sources consultées + actions proposées du fil. */
function ExecutivePanel({ sources, messages }: { sources: { label: string; href: string }[]; messages: Msg[] }) {
  const actions = messages
    .flatMap((m) => (m.proposals ?? []).map((p, i) => ({ id: `${m.id}-${i}`, title: p.title, state: m.actionStates?.[i] ?? "pending" })))
    .slice(-6)
    .reverse();
  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-3">
        <div>
          <p className="flex items-center gap-1.5 px-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
            <Link2 className="h-3 w-3" /> Sources consultées
          </p>
          {sources.length === 0 ? (
            <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
              Les dossiers, documents et fiches que l&apos;assistant consulte apparaîtront ici, en liens cliquables.
            </p>
          ) : (
            <div className="mt-1 space-y-0.5">
              {sources.map((s) => (
                <Link key={s.href + s.label} href={s.href}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition hover:bg-secondary">
                  <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate" title={s.label}>{s.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 px-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Actions du fil
            </p>
            <div className="mt-1 space-y-1">
              {actions.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/60 px-2 py-1.5 text-xs">
                  <p className="truncate font-medium" title={a.title}>{a.title}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {a.state === "done" ? "✔ Exécutée" : a.state === "cancelled" ? "Annulée"
                      : a.state === "error" ? "En échec" : a.state === "running" ? "En cours…" : "À confirmer"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-border pt-2">
          <p className="px-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Raccourcis</p>
          <div className="mt-1 space-y-0.5">
            {[
              { href: "/centre-de-paiement", label: "Centre de paiement" },
              { href: "/validations", label: "Demandes de validations" },
              { href: "/legal", label: "Legal" },
              { href: "/rh", label: "Ressources humaines" },
              { href: "/calendar", label: "Calendrier" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Historique de MES conversations. Le serveur ne renvoie jamais les fils d'autrui : cette
 * liste est, par construction, strictement personnelle (cf. `src/lib/assistant-memory.ts`).
 */
/** Regroupe les conversations par ancienneté — c'est ainsi qu'on les retrouve. */
function groupThreads(threads: ThreadSummary[]): { label: string; items: ThreadSummary[] }[] {
  const now = Date.now();
  const day = 86_400_000;
  const buckets: { label: string; max: number; items: ThreadSummary[] }[] = [
    { label: "Aujourd'hui", max: day, items: [] },
    { label: "7 derniers jours", max: 7 * day, items: [] },
    { label: "30 derniers jours", max: 30 * day, items: [] },
    { label: "Plus ancien", max: Infinity, items: [] },
  ];
  for (const t of threads) {
    const age = now - new Date(t.updatedAt).getTime();
    (buckets.find((b) => age < b.max) ?? buckets[buckets.length - 1]).items.push(t);
  }
  return buckets.filter((b) => b.items.length > 0).map(({ label, items }) => ({ label, items }));
}

/**
 * Historique de MES conversations. Le serveur ne renvoie jamais les fils d'autrui : cette
 * liste est, par construction, strictement personnelle (cf. `src/lib/assistant-memory.ts`).
 *
 * Regroupées par ancienneté (aujourd'hui, 7 jours, 30 jours, plus ancien) : au bout de
 * quelques semaines, une liste à plat ne se relit plus.
 */
function ThreadRail({
  threads, current, onNew, onOpen, onDelete, onForget,
}: {
  threads: ThreadSummary[];
  current: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onForget: () => void;
}) {
  const groups = groupThreads(threads);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-2">
        <button
          type="button" onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium transition hover:bg-secondary"
        >
          <Plus className="h-4 w-4" /> Nouvelle conversation
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
            Vos échanges seront conservés ici pour que l&apos;assistant se souvienne de votre contexte.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((t) => (
                  <div key={t.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${t.id === current ? "bg-secondary font-medium text-foreground" : "hover:bg-secondary/60"}`}>
                    <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 truncate text-left" title={t.title}>
                      {t.title}
                    </button>
                    <button type="button" onClick={() => onDelete(t.id)} title="Supprimer cette conversation"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border px-3 py-2.5">
        <p className="flex items-start gap-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          Mémoire strictement personnelle : personne d&apos;autre — pas même un administrateur — n&apos;y a accès.
        </p>
        {threads.length > 0 && (
          <button type="button" onClick={onForget} className="mt-1.5 text-[0.6875rem] text-muted-foreground underline-offset-2 transition hover:text-destructive hover:underline">
            Tout effacer
          </button>
        )}
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
  msg, onConfirm, onCancel, onConfirmAll,
}: {
  msg: Msg;
  onConfirm: (id: number, index: number, payload: AssistantActionPayload) => void;
  onCancel: (id: number, index: number) => void;
  onConfirmAll: (msg: Msg) => void;
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
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
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
        {msg.proposals && msg.proposals.length > 1 && (msg.actionStates ?? []).filter((s) => s === "pending").length > 1 && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-accent/30 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1">{msg.proposals.length} actions proposées — chacune se confirme, ou toutes d&apos;un coup.</span>
            <Button size="sm" onClick={() => onConfirmAll(msg)}>
              <CheckCircle2 className="h-4 w-4" /> Tout confirmer
            </Button>
          </div>
        )}
        {msg.proposals?.map((p, i) => (
          <ActionCard
            key={i}
            proposal={p}
            state={msg.actionStates?.[i] ?? "pending"}
            result={msg.actionResults?.[i]}
            link={msg.actionLinks?.[i]}
            onConfirm={() => onConfirm(msg.id, i, p.payload)}
            onCancel={() => onCancel(msg.id, i)}
          />
        ))}
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
  // CONFIRMATION FORTE (niveau CRITIQUE — paie, salaires) : la carte fait RESSAISIR la valeur
  // exacte avant d'armer le bouton. Un clic réflexe ne suffit pas pour changer un salaire.
  const critical = proposal.level === "CRITICAL" && Boolean(proposal.confirmText);
  const [typed, setTyped] = React.useState("");
  const norm = (s: string) => s.replace(/[\s ]/g, "").replace(",", ".");
  const armed = !critical || norm(typed) === norm(proposal.confirmText ?? "");

  return (
    <div className={`overflow-hidden rounded-xl border shadow-sm ${critical ? "border-destructive/50 bg-gradient-to-br from-destructive/5 to-card" : proposal.level === "SENSITIVE" ? "border-warning/50 bg-gradient-to-br from-warning/5 to-card" : "border-primary/30 bg-gradient-to-br from-accent/40 to-card"}`}>
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        {critical ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <Sparkles className="h-4 w-4 text-primary" />}
        <span className="text-sm font-semibold">{proposal.title}</span>
        {critical ? (
          <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[0.6875rem] font-medium text-destructive">Critique</span>
        ) : proposal.level === "SENSITIVE" ? (
          <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-[0.6875rem] font-medium text-warning">Sensible — à confirmer</span>
        ) : (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium text-primary">À confirmer</span>
        )}
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

      {critical && state === "pending" && (
        <div className="border-t border-border/60 bg-destructive/5 px-4 py-2.5">
          <label className="text-xs font-medium text-destructive">
            Confirmation renforcée : ressaisissez le nouveau montant ({Number(proposal.confirmText).toLocaleString("fr-FR")} DZD)
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            inputMode="numeric"
            placeholder={proposal.confirmText}
            className="mt-1 w-48 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20"
          />
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
        {state === "pending" && (
          <>
            <Button size="sm" onClick={onConfirm} disabled={!armed} variant={critical ? "destructive" : "primary"}>
              <CheckCircle2 className="h-4 w-4" /> Confirmer
            </Button>
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
