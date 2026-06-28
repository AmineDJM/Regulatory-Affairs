"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Loader2, Check, X, Link2, Play, Square, Trash2 } from "lucide-react";
import {
  saveMeetingTranscript, summarizeMeeting, acceptMeetingProposal, dismissMeetingProposal,
  setMeetingLive, endMeeting, deleteMeeting,
} from "@/lib/actions/meeting-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/** Transcription (collable/éditable) + génération du compte rendu IA. */
export function TranscriptPanel({ meetingId, transcript, canSummarize }: { meetingId: string; transcript: string; canSummarize: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState(transcript);
  const [saving, setSaving] = React.useState(false);
  const [summarizing, setSummarizing] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function save() {
    setSaving(true); setMsg(null);
    const fd = new FormData(); fd.set("id", meetingId); fd.set("transcript", text);
    const r = await saveMeetingTranscript(fd);
    setSaving(false);
    setMsg(r.ok ? "Transcription enregistrée." : r.error ?? "Erreur.");
    if (r.ok) router.refresh();
  }

  async function summarize() {
    setSummarizing(true); setMsg(null);
    const fd = new FormData(); fd.set("id", meetingId);
    const r = await summarizeMeeting(fd);
    setSummarizing(false);
    setMsg(r.ok ? (r.message ?? "Compte rendu généré.") : r.error ?? "Erreur.");
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder="Collez ou corrigez ici la transcription de la réunion (ou enregistrez l'audio ci-dessus pour une transcription automatique)…" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={save} disabled={saving || text === transcript}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </Button>
        {canSummarize && (
          <Button type="button" onClick={summarize} disabled={summarizing || !text.trim()}>
            {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer le compte rendu IA
          </Button>
        )}
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

/** Boutons Accepter / Écarter d'une tâche proposée par l'IA. */
export function ProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"accept" | "dismiss" | null>(null);

  async function run(kind: "accept" | "dismiss") {
    setBusy(kind);
    const fd = new FormData(); fd.set("proposalId", proposalId);
    const r = kind === "accept" ? await acceptMeetingProposal(fd) : await dismissMeetingProposal(fd);
    setBusy(null);
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={() => run("accept")} disabled={busy !== null} title="Créer la tâche"
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy === "accept" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Créer
      </button>
      <button type="button" onClick={() => run("dismiss")} disabled={busy !== null} title="Écarter"
        className="inline-flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary disabled:opacity-60">
        {busy === "dismiss" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** Copie du lien externe partageable. */
export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground" />
      <button type="button" onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
        {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />} {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/** Barre de gestion (organisateur) : démarrer / clôturer / supprimer. */
export function ManageBar({ meetingId, status }: { meetingId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(kind: "live" | "end" | "delete") {
    if (kind === "delete" && !confirm("Supprimer définitivement cette réunion ?")) return;
    setBusy(kind);
    const fd = new FormData(); fd.set("id", meetingId);
    const r = kind === "live" ? await setMeetingLive(fd) : kind === "end" ? await endMeeting(fd) : await deleteMeeting(fd);
    setBusy(null);
    if (r.ok) { if (kind === "delete") router.push("/meetings"); else router.refresh(); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "SCHEDULED" && (
        <Button type="button" variant="outline" onClick={() => act("live")} disabled={busy !== null}>
          {busy === "live" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Démarrer
        </Button>
      )}
      {status !== "ENDED" && (
        <Button type="button" variant="outline" onClick={() => act("end")} disabled={busy !== null}>
          {busy === "end" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Clôturer
        </Button>
      )}
      <button type="button" onClick={() => act("delete")} disabled={busy !== null} title="Supprimer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
        {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer
      </button>
    </div>
  );
}
