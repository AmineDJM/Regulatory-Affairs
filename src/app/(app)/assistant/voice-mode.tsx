"use client";

import * as React from "react";
import { Mic, Loader2, Volume2, X, Ear } from "lucide-react";

/**
 * MODE CONVERSATION VOCALE — on parle, il répond À VOIX HAUTE, on peut l'INTERROMPRE.
 *
 * La boucle : ÉCOUTE (détection d'activité vocale sur le micro) → l'utilisateur parle → silence
 * → TRANSCRIPTION (Whisper) → RÉFLEXION (le même flux SSE que le chat — le texte s'écrit à
 * l'écran en parallèle) → VOIX (la réponse est découpée en phrases, synthétisées et jouées AU
 * FIL DE L'EAU — la voix démarre à la première phrase, pas à la fin) → retour à l'écoute.
 *
 * BARGE-IN : parler PENDANT que l'assistant parle (ou réfléchit) l'arrête net — la file audio
 * est vidée, la génération est interrompue, et ce que l'utilisateur dit devient le tour suivant.
 * C'est la différence entre une conversation et un répondeur.
 *
 * Tout le raisonnement reste CÔTÉ SERVEUR (mêmes outils, mêmes permissions, mêmes cartes de
 * confirmation — une action proposée s'affiche dans le chat et s'y confirme À LA MAIN, jamais à
 * la voix). Ce composant ne fait que : écouter, transcrire, faire parler.
 */

type Phase = "listening" | "capturing" | "transcribing" | "thinking" | "speaking";

const PHASE_LABEL: Record<Phase, string> = {
  listening: "Je vous écoute — parlez.",
  capturing: "Je vous entends…",
  transcribing: "Transcription…",
  thinking: "Je réfléchis… (parlez pour m'interrompre)",
  speaking: "Je réponds — parlez pour m'interrompre.",
};

/** Découpe une réponse en phrases courtes pour la synthèse (la voix démarre plus tôt). */
export function sentencesOf(text: string, maxLen = 240): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?…])\s+/);
  const out: string[] = [];
  let acc = "";
  for (const p of parts) {
    if ((acc + " " + p).trim().length > maxLen && acc) { out.push(acc.trim()); acc = p; }
    else acc = acc ? `${acc} ${p}` : p;
  }
  if (acc.trim()) out.push(acc.trim());
  return out;
}

export function VoiceMode({
  onUtterance, onInterrupt, onClose,
}: {
  /** Envoie le tour de parole au chat et rend la réponse finale (null si échec). */
  onUtterance: (text: string) => Promise<string | null>;
  /** Interrompt la génération en cours (barge-in pendant la réflexion). */
  onInterrupt: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("listening");
  const [error, setError] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState(0);

  const phaseRef = React.useRef<Phase>("listening");
  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const streamRef = React.useRef<MediaStream | null>(null);
  const ctxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number>(0);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const silenceMsRef = React.useRef(0);
  const voiceMsRef = React.useRef(0);
  const lastTickRef = React.useRef(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const queueRef = React.useRef<string[]>([]);
  const speakingRef = React.useRef(false);
  const aliveRef = React.useRef(true);

  /** Vide la file audio et coupe la voix — le geste du barge-in. */
  const stopSpeaking = React.useCallback(() => {
    queueRef.current = [];
    speakingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const startCapture = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recRef.current) return;
    try {
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start();
      recRef.current = rec;
      setPhaseBoth("capturing");
    } catch {
      setError("Enregistrement impossible sur ce navigateur.");
    }
  }, []);

  const finishCapture = React.useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    if (!aliveRef.current) return;
    // Un souffle de 300 ms n'est pas une phrase : on ne transcrit pas le silence.
    if (blob.size < 2_000) { setPhaseBoth("listening"); return; }

    setPhaseBoth("transcribing");
    let text = "";
    try {
      const f = new FormData();
      f.set("file", blob, "audio.webm");
      const res = await fetch("/api/assistant/transcribe", { method: "POST", body: f });
      const data = await res.json();
      text = typeof data.transcript === "string" ? data.transcript.trim() : "";
      if (!text && data.error) setError(data.error);
    } catch {
      setError("Transcription impossible (réseau).");
    }
    if (!aliveRef.current) return;
    if (!text) { setPhaseBoth("listening"); return; }

    setError(null);
    setPhaseBoth("thinking");
    const reply = await onUtterance(text);
    if (!aliveRef.current) return;
    if (!reply) { setPhaseBoth("listening"); return; }

    // La voix : phrase par phrase, la lecture démarre dès la première synthétisée.
    queueRef.current = sentencesOf(reply);
    setPhaseBoth("speaking");
    speakingRef.current = true;
    while (aliveRef.current && speakingRef.current && queueRef.current.length > 0) {
      const sentence = queueRef.current.shift()!;
      try {
        const res = await fetch("/api/assistant/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: sentence }),
        });
        if (!res.ok) break; // TTS indisponible : le texte reste à l'écran, on n'insiste pas.
        const buf = await res.blob();
        if (!aliveRef.current || !speakingRef.current) break;
        const url = URL.createObjectURL(buf);
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onpause = () => resolve(); // barge-in : pause = fin de cette phrase
          void audio.play().catch(() => resolve());
        });
      } catch {
        break;
      }
    }
    speakingRef.current = false;
    if (aliveRef.current && phaseRef.current === "speaking") setPhaseBoth("listening");
  }, [onUtterance]);

  // ── La boucle VAD : niveau micro → début / fin de parole, barge-in compris.
  React.useEffect(() => {
    aliveRef.current = true;
    let analyser: AnalyserNode | null = null;
    const data = new Uint8Array(2048);

    const tick = (now: number) => {
      if (!aliveRef.current) return;
      const dt = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;
      if (analyser) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) { const d = (data[i] - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms);
        const voiced = rms > 0.045; // seuil : au-dessus du souffle, en dessous d'une voix posée

        if (voiced) {
          voiceMsRef.current += dt;
          silenceMsRef.current = 0;
          // 150 ms de voix soutenue = quelqu'un parle vraiment (pas un claquement de porte).
          if (voiceMsRef.current > 150) {
            const p = phaseRef.current;
            if (p === "speaking") {
              // BARGE-IN : couper la voix et capter ce que la personne dit.
              stopSpeaking();
              startCapture();
            } else if (p === "thinking") {
              // Interrompre la génération : ce qui est écrit reste, la voix n'aura pas lieu.
              onInterrupt();
              stopSpeaking();
              startCapture();
            } else if (p === "listening") {
              startCapture();
            }
          }
        } else {
          silenceMsRef.current += dt;
          if (silenceMsRef.current > 250) voiceMsRef.current = 0;
          // 900 ms de silence après une prise de parole : la phrase est finie.
          if (phaseRef.current === "capturing" && silenceMsRef.current > 900) {
            void finishCapture();
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Le micro nécessite une connexion sécurisée (HTTPS).");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
        const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError("Micro inaccessible — autorisez-le dans le navigateur.");
      }
    })();

    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      stopSpeaking();
      try { recRef.current?.stop(); } catch { /* déjà arrêté */ }
      recRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
    // La boucle se monte UNE fois : les callbacks lisent des refs, pas des états périmés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase === "transcribing" || phase === "thinking";
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-primary/40 bg-accent/40 px-3 py-2.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {phase === "speaking" ? <Volume2 className="h-5 w-5" />
          : busy ? <Loader2 className="h-5 w-5 animate-spin" />
          : phase === "capturing" ? <Ear className="h-5 w-5" />
          : <Mic className="h-5 w-5" />}
        {(phase === "listening" || phase === "capturing") && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-primary/50"
            style={{ transform: `scale(${1 + Math.min(level * 6, 0.6)})`, opacity: 0.5, transition: "transform 80ms linear" }}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Conversation vocale</p>
        <p className="truncate text-xs text-muted-foreground">{error ?? PHASE_LABEL[phase]}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        title="Quitter la conversation vocale"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
