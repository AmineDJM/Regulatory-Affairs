"use client";

import * as React from "react";
import { Mic, MicOff, PhoneOff, Loader2, ChevronDown, ChevronUp, Minimize2, Maximize2, AudioLines } from "lucide-react";
import {
  OpenAIGptRealtime21Provider,
  type VoiceCallState, type VoiceToolUi, type VoiceSessionGrant,
} from "./realtime-voice";

/**
 * MODE APPEL — la conversation SPEECH-TO-SPEECH temps réel avec My Chief of Staff.
 *
 * Plus de chaîne « enregistrer → transcrire → prompt → attendre → TTS » : une session
 * Realtime (WebRTC direct navigateur ↔ OpenAI, secret éphémère fourni par notre serveur).
 * On parle, il répond à voix haute IMMÉDIATEMENT, on l'interrompt en parlant (barge-in
 * serveur + purge locale du tampon), on enchaîne les sujets — et tout reste LA MÊME
 * conversation que le texte : chaque tour est persisté dans le même fil, chaque outil est
 * exécuté par le même backend avec les mêmes droits, chaque action passe par les mêmes
 * cartes de confirmation À L'ÉCRAN (jamais exécutée à la voix seule).
 *
 * L'écran est un COMPAGNON : la voix résume, l'interface affiche (cartes, sources, détail).
 * L'appel se réduit en barre discrète pour consulter un document sans raccrocher.
 */

const STATE_LABEL: Record<VoiceCallState, string> = {
  IDLE: "Prêt.",
  CONNECTING: "Connexion à la session vocale…",
  LISTENING: "Je vous écoute.",
  USER_SPEAKING: "Je vous entends…",
  THINKING: "Un instant…",
  ASSISTANT_SPEAKING: "Je vous réponds — parlez pour m'interrompre.",
  RECONNECTING: "Reconnexion…",
  ERROR: "Erreur de session.",
  ENDED: "Appel terminé.",
};

interface TranscriptLine { role: "user" | "assistant"; text: string; final: boolean }

export function VoiceMode({
  threadId, onThreadId, onTurn, onToolUi, registerTextSender, onClose,
}: {
  /** Le fil de conversation COURANT — l'appel le continue (le serveur retombe sur le fil principal sinon). */
  threadId: string | null;
  onThreadId: (tid: string) => void;
  /** Un tour vocal complet (transcriptions) — le parent l'ajoute au fil affiché. */
  onTurn: (user: string, assistant: string) => void;
  /** Charge utile visuelle d'un outil (cartes d'action, sources, réponse détaillée). */
  onToolUi: (ui: VoiceToolUi) => void;
  /** Pendant l'appel, le texte tapé dans le chat entre DANS la session vocale. */
  registerTextSender: (fn: ((text: string) => void) | null) => void;
  onClose: () => void;
}) {
  const [state, setState] = React.useState<VoiceCallState>("CONNECTING");
  const [error, setError] = React.useState<string | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [lines, setLines] = React.useState<TranscriptLine[]>([]);

  const providerRef = React.useRef<OpenAIGptRealtime21Provider | null>(null);
  const threadRef = React.useRef<string | null>(threadId);
  const aliveRef = React.useRef(true);
  const reconnectsRef = React.useRef(0);
  const metricsRef = React.useRef({ startedAt: 0, connectMs: 0, firstAudioMs: 0, toolCalls: 0, toolErrors: 0, interruptions: 0, turns: 0 });

  /** La dernière ligne (partielle) par rôle est REMPLACÉE, pas empilée — un transcript lisible. */
  const upsertLine = React.useCallback((role: "user" | "assistant", text: string, final: boolean) => {
    if (!text.trim()) return;
    setLines((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === role && !last.final) next[next.length - 1] = { role, text, final };
      else next.push({ role, text, final });
      return next.slice(-30);
    });
  }, []);

  const logEvent = React.useCallback((event: string, extra: Record<string, unknown> = {}) => {
    void fetch("/api/assistant/voice/log", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, ...extra }),
    }).catch(() => undefined);
  }, []);

  const buildProvider = React.useCallback(() => {
    const m = metricsRef.current;
    return new OpenAIGptRealtime21Provider({
      getGrant: async (): Promise<VoiceSessionGrant> => {
        const res = await fetch("/api/assistant/voice/session", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ threadId: threadRef.current }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<VoiceSessionGrant> & { error?: string; reasonCode?: string };
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error ?? "Le mode vocal temps réel est momentanément indisponible.");
        }
        if (data.threadId) { threadRef.current = data.threadId; onThreadId(data.threadId); }
        return data as VoiceSessionGrant;
      },
      callTool: async (name, input) => {
        const res = await fetch("/api/assistant/voice/tool", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, input, threadId: threadRef.current }),
        });
        if (!res.ok) throw new Error("tool");
        return (await res.json()) as { output: string; ui?: VoiceToolUi | null };
      },
      callbacks: {
        onState: (s) => { if (aliveRef.current) setState(s); },
        onUserTranscript: (text, final) => upsertLine("user", text, final),
        onAssistantTranscript: (text, final) => upsertLine("assistant", text, final),
        onTurnComplete: ({ user, assistant }) => {
          m.turns += 1;
          onTurn(user, assistant);
          // Persistance : le tour vocal rejoint LE MÊME fil que le texte, côté serveur.
          void fetch("/api/assistant/voice/turn", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ threadId: threadRef.current, user, assistant }),
          }).then(async (r) => {
            const d = (await r.json().catch(() => ({}))) as { threadId?: string | null };
            if (d.threadId && d.threadId !== threadRef.current) { threadRef.current = d.threadId; onThreadId(d.threadId); }
          }).catch(() => undefined);
        },
        onToolUi: (ui) => onToolUi(ui),
        onError: (message) => { if (aliveRef.current) setError(message); },
        onMetric: (name) => {
          if (name === "first_audio_out" && !m.firstAudioMs) { m.firstAudioMs = Math.round(performance.now() - m.startedAt); logEvent("voice_first_audio_out", { firstAudioMs: m.firstAudioMs }); }
          if (name === "interruption") m.interruptions += 1;
          if (name === "tool_call") m.toolCalls += 1;
          if (name === "tool_error") m.toolErrors += 1;
        },
        onConnectionChange: (cs) => {
          // La session est tombée (réseau) : une reconnexion PROPRE — nouveau secret éphémère,
          // MÊME fil de conversation (le serveur réinjecte le contexte récent), jamais un
          // nouveau Chief of Staff. Deux tentatives, puis on le dit.
          if (!aliveRef.current) return;
          if ((cs === "disconnected" || cs === "failed") && reconnectsRef.current < 2) {
            reconnectsRef.current += 1;
            setState("RECONNECTING");
            logEvent("voice_reconnect", { detail: cs });
            providerRef.current?.disconnect();
            const p = buildProvider();
            providerRef.current = p;
            p.connect().catch(() => {
              if (aliveRef.current) { setState("ERROR"); setError("La connexion vocale n'a pas pu être rétablie."); }
            });
          } else if (cs === "failed") {
            setState("ERROR");
            setError("La connexion vocale est perdue.");
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onThreadId, onTurn, onToolUi, upsertLine, logEvent]);

  // ── Cycle de vie : connexion au montage, raccrochage propre au démontage.
  React.useEffect(() => {
    aliveRef.current = true;
    const m = metricsRef.current;
    m.startedAt = performance.now();
    const p = buildProvider();
    providerRef.current = p;
    p.connect()
      .then(() => {
        m.connectMs = Math.round(performance.now() - m.startedAt);
        logEvent("voice_session_connected", { connectMs: m.connectMs });
      })
      .catch((err: unknown) => {
        if (!aliveRef.current) return;
        setState("ERROR");
        const msg = err instanceof Error ? err.message : "";
        setError(
          msg === "MIC_UNSUPPORTED" ? "Le micro nécessite une connexion sécurisée (HTTPS) et un navigateur récent."
          : msg.startsWith("SDP_") ? "Le mode vocal temps réel est momentanément indisponible (connexion refusée)."
          : /NotAllowedError|Permission/i.test(String(err)) ? "Micro refusé — autorisez-le dans le navigateur, ou utilisez la dictée."
          : msg || "Impossible de démarrer la conversation vocale.",
        );
        logEvent("voice_session_error", { reasonCode: msg || "CONNECT_FAILED" });
      });

    return () => {
      aliveRef.current = false;
      registerTextSender(null);
      providerRef.current?.disconnect();
      providerRef.current = null;
      logEvent("voice_session_closed", {
        sessionMs: Math.round(performance.now() - m.startedAt),
        connectMs: m.connectMs || null, firstAudioMs: m.firstAudioMs || null,
        toolCalls: m.toolCalls, toolErrors: m.toolErrors, interruptions: m.interruptions, turns: m.turns,
      });
    };
    // Montage UNIQUE — la reconnexion vit dans onConnectionChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le texte tapé pendant l'appel entre dans LA session vocale (réponse parlée).
  React.useEffect(() => {
    const ready = state === "LISTENING" || state === "USER_SPEAKING" || state === "THINKING" || state === "ASSISTANT_SPEAKING";
    registerTextSender(ready ? (t: string) => providerRef.current?.sendText(t) : null);
    return () => registerTextSender(null);
  }, [state, registerTextSender]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    providerRef.current?.setMuted(next);
  };

  const busy = state === "CONNECTING" || state === "RECONNECTING";
  const label = error ?? STATE_LABEL[state];
  const lastLine = lines[lines.length - 1];

  // ── L'ORBE : un seul élément, des états visuels sobres (écoute / réflexion / parole).
  const orb = (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br from-primary to-purple-500 transition-all duration-500 ${
          state === "ASSISTANT_SPEAKING" ? "opacity-90 scale-100"
          : state === "USER_SPEAKING" ? "opacity-80 scale-95"
          : state === "THINKING" ? "opacity-60 scale-90"
          : "opacity-70 scale-90"
        }`}
      />
      {(state === "LISTENING" || state === "USER_SPEAKING") && (
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40" style={{ animationDuration: "2.2s" }} />
      )}
      {state === "ASSISTANT_SPEAKING" && (
        <span className="relative z-10 flex items-end gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-1.5 animate-pulse rounded-full bg-white/90" style={{ height: `${14 + (i % 2) * 10}px`, animationDelay: `${i * 140}ms`, animationDuration: "700ms" }} />
          ))}
        </span>
      )}
      {busy && <Loader2 className="relative z-10 h-8 w-8 animate-spin text-white" />}
      {(state === "LISTENING" || state === "USER_SPEAKING" || state === "THINKING") && !busy && (
        <AudioLines className="relative z-10 h-8 w-8 text-white/95" />
      )}
    </div>
  );

  // ── RÉDUIT : une barre discrète — l'appel continue, l'écran reste libre (documents, cartes).
  if (minimized) {
    return (
      <div className="mb-2 flex items-center gap-3 rounded-xl border border-primary/40 bg-accent/40 px-3 py-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${state === "ASSISTANT_SPEAKING" ? "bg-primary animate-pulse" : state === "ERROR" ? "bg-destructive" : "bg-primary/70"}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">Appel en cours — My Chief of Staff</p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">{label}</p>
        </div>
        <button type="button" onClick={toggleMute} title={muted ? "Réactiver le micro" : "Couper le micro"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${muted ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-secondary"}`}>
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setMinimized(false)} title="Agrandir l'appel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} title="Raccrocher"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition hover:bg-destructive/20">
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Conversation vocale avec My Chief of Staff">
      <button type="button" aria-label="Réduire l'appel" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMinimized(true)} />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 pb-6 pt-8 shadow-2xl">
        <div className="flex w-full items-center justify-between">
          <p className="text-sm font-semibold">My Chief of Staff</p>
          <button type="button" onClick={() => setMinimized(true)} title="Réduire — l'appel continue"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {orb}

        <p className={`text-center text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{label}</p>

        {/* Le transcript est SECONDAIRE : la dernière réplique en un coup d'œil, le fil sur demande. */}
        {state !== "ERROR" && lastLine && !showTranscript && (
          <p className="line-clamp-2 w-full text-center text-xs text-muted-foreground/80">
            {lastLine.role === "user" ? "Vous : " : ""}{lastLine.text}
          </p>
        )}
        {showTranscript && (
          <div className="max-h-40 w-full space-y-1.5 overflow-y-auto rounded-xl bg-secondary/50 p-3">
            {lines.length === 0 && <p className="text-xs text-muted-foreground">La conversation s&apos;affichera ici.</p>}
            {lines.map((l, i) => (
              <p key={i} className={`text-xs ${l.role === "user" ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {l.role === "user" ? "Vous — " : ""}{l.text}
              </p>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setShowTranscript((s) => !s)}
          className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground transition hover:text-foreground">
          {showTranscript ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          {showTranscript ? "Masquer le transcript" : "Voir le transcript"}
        </button>

        {error && (
          <p className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-center text-xs text-muted-foreground">
            La dictée reste disponible (icône micro du chat) — elle transcrit sans conversation temps réel.
          </p>
        )}

        <div className="flex items-center gap-4">
          <button type="button" onClick={toggleMute} disabled={busy || state === "ERROR"}
            title={muted ? "Réactiver le micro" : "Couper le micro"}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-40 ${
              muted ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border text-foreground hover:bg-secondary"
            }`}>
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button type="button" onClick={onClose} title="Raccrocher"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition hover:opacity-90">
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
