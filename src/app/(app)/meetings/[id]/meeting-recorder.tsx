"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Disc, Square, Upload, Loader2 } from "lucide-react";

/**
 * Enregistre la réunion puis l'envoie pour transcription (Whisper).
 * - « Enregistrer » : partage de l'onglet de la réunion AVEC le son (capte tout le monde) ;
 *   repli sur le micro seul si le partage audio n'est pas accordé.
 * - « Importer » : dépose un fichier audio existant (ex. enregistrement Jitsi/téléphone).
 * La transcription obtenue alimente le compte rendu IA.
 */
export function MeetingRecorder({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "recording" | "uploading">("idle");
  const [note, setNote] = React.useState<string | null>(null);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamsRef = React.useRef<MediaStream[]>([]);

  const supported = typeof window !== "undefined" && "MediaRecorder" in window;

  async function upload(blob: Blob, filename: string) {
    setState("uploading"); setNote("Transcription en cours…");
    try {
      const fd = new FormData();
      fd.append("file", blob, filename);
      const res = await fetch(`/api/meetings/${meetingId}/recording`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNote(data?.error ?? "Échec de l'envoi."); setState("idle"); return; }
      if (data?.transcript) { setNote("Transcription ajoutée."); router.refresh(); }
      else setNote(data?.error ?? "Audio enregistré (transcription indisponible). Vous pouvez coller le texte.");
    } catch {
      setNote("Échec de l'envoi de l'enregistrement.");
    } finally {
      setState((s) => (s === "uploading" ? "idle" : s));
    }
  }

  function stopStreams() {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
  }

  async function startRecording() {
    setNote(null);
    try {
      let stream: MediaStream;
      try {
        // Capture l'onglet de la réunion + son (tout le monde) si l'utilisateur l'accepte.
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (stream.getAudioTracks().length === 0) {
          // Pas d'audio partagé → on ajoute le micro.
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamsRef.current.push(mic);
          mic.getAudioTracks().forEach((t) => stream.addTrack(t));
        }
      } catch {
        // Repli : micro seul.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setNote("Enregistrement du micro (le partage d'onglet a été refusé).");
      }
      streamsRef.current.push(stream);
      const rec = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stopStreams();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void upload(blob, `reunion.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      };
      // Si l'utilisateur arrête le partage depuis la barre du navigateur.
      stream.getVideoTracks().forEach((t) => (t.onended = () => { if (recRef.current?.state === "recording") recRef.current.stop(); }));
      rec.start();
      recRef.current = rec;
      setState("recording");
    } catch {
      setNote("Impossible de démarrer l'enregistrement (autorisations refusées).");
      stopStreams();
    }
  }

  function stopRecording() {
    recRef.current?.stop();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await upload(file, file.name);
  }

  if (!supported) return <p className="text-xs text-muted-foreground">L'enregistrement n'est pas pris en charge par ce navigateur.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <button type="button" onClick={stopRecording}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90">
            <Square className="h-4 w-4" /> Arrêter l'enregistrement
          </button>
        ) : (
          <button type="button" onClick={startRecording} disabled={state === "uploading"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Disc className="h-4 w-4" />} Enregistrer la réunion
          </button>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
          <Upload className="h-4 w-4" /> Importer un audio
          <input type="file" accept="audio/*,video/webm" className="hidden" onChange={onFile} disabled={state !== "idle"} />
        </label>
        {state === "recording" && <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Enregistrement…</span>}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "video/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
