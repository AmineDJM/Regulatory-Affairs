"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, Send, Paperclip, FileText, Download, Trash2, RotateCcw, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { formatBytes } from "../../messages/format";
import { submitFieldReport, reopenFieldReport, deleteFieldReportAttachment } from "@/lib/actions/field-report-actions";
import type { FieldReportDetail } from "@/lib/queries/field-reports";

/**
 * Vue **délégué** ultra-simple : on parle (ou on écrit), on envoie. L'IA comprend et
 * classe seule en arrière-plan ; le délégué ne remplit aucun champ structuré. Une fois
 * envoyé, le compte rendu est en lecture seule (réouverture possible pour corriger).
 */
export function SimpleReportEditor({ detail, doctors }: { detail: FieldReportDetail; doctors: { id: string; name: string }[] }) {
  const router = useRouter();
  const sent = detail.status === "VALIDATED";

  const [transcript, setTranscript] = React.useState(detail.transcript ?? "");
  const [visitDate, setVisitDate] = React.useState(detail.visitDate.slice(0, 10));
  const [doctorId, setDoctorId] = React.useState(detail.doctorId ?? "");
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const mr = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const startRec = async () => {
    setMsg(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMsg("Le micro nécessite une connexion sécurisée (HTTPS). Vous pouvez aussi écrire votre compte rendu ci-dessous.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await uploadAudio(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start(); mr.current = rec; setRecording(true);
    } catch {
      setMsg("Micro inaccessible — autorisez-le dans le navigateur, ou écrivez votre compte rendu ci-dessous.");
    }
  };
  const stopRec = () => { mr.current?.stop(); setRecording(false); };

  const uploadAudio = async (blob: Blob) => {
    setTranscribing(true); setMsg(null);
    try {
      const f = new FormData(); f.set("file", blob, "audio.webm");
      const res = await fetch(`/api/field-reports/${detail.id}/transcribe`, { method: "POST", body: f });
      const data = await res.json();
      if (data.transcript) setTranscript((prev) => (prev ? `${prev}\n${data.transcript}` : data.transcript));
      else setMsg(data.error ?? "Transcription indisponible — vous pouvez écrire à la main.");
    } catch { setMsg("Envoi de l'audio impossible."); }
    finally { setTranscribing(false); }
  };

  const send = async () => {
    if (!transcript.trim()) { setMsg("Dictez ou écrivez d'abord votre compte rendu."); return; }
    setSending(true); setMsg(null);
    const f = new FormData();
    f.set("id", detail.id); f.set("transcript", transcript); f.set("visitDate", visitDate); f.set("doctorId", doctorId);
    const r = await submitFieldReport(f);
    setSending(false);
    if (r.ok) router.push("/field-reports"); else setMsg(r.error ?? "Envoi impossible.");
  };

  const reopen = async () => { const f = new FormData(); f.set("id", detail.id); await reopenFieldReport(f); router.refresh(); };

  const uploadAttachment = async (file: File) => {
    const f = new FormData(); f.set("file", file);
    const res = await fetch(`/api/field-reports/${detail.id}/upload`, { method: "POST", body: f });
    if (res.ok) router.refresh(); else { const d = await res.json(); setMsg(d.error ?? "Échec de la pièce jointe."); }
  };

  // ───────────── Envoyé : vue lecture seule, simple ─────────────
  if (sent) {
    return (
      <div className="space-y-4">
        <div className="surface flex flex-wrap items-center gap-3 p-3">
          <StatusBadge map={FIELD_REPORT_STATUS} value={detail.status} />
          <span className="inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Envoyé — l'IA a classé votre compte rendu pour la Direction.</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={reopen}><RotateCcw className="h-4 w-4" /> Corriger / renvoyer</Button>
        </div>
        {detail.summary && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Synthèse (IA)</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.summary}</p>
          </div>
        )}
        <div>
          <Label>Ce que vous avez dicté</Label>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-3 text-sm">{detail.transcript || "—"}</p>
        </div>
        <Attachments detail={detail} readOnly />
      </div>
    );
  }

  // ───────────── Brouillon : parler / écrire → envoyer ─────────────
  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <StatusBadge map={FIELD_REPORT_STATUS} value={detail.status} />
        {recording ? (
          <Button variant="destructive" size="sm" onClick={stopRec}><Square className="h-4 w-4" /> Arrêter</Button>
        ) : (
          <Button size="sm" onClick={startRec} disabled={transcribing}>
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Parler
          </Button>
        )}
        <Button size="sm" className="ml-auto" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer mon compte rendu
        </Button>
      </div>

      {recording && <p className="flex items-center gap-2 text-sm text-destructive"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" /> Enregistrement… parlez naturellement (médecin, produits, demandes, prochaine action…).</p>}
      {msg && <p className="rounded-lg bg-accent/60 px-3 py-2 text-sm text-accent-foreground">{msg}</p>}

      <div className="space-y-1.5">
        <Label>Votre compte rendu</Label>
        <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={7}
          placeholder="Dictez avec « Parler », ou écrivez ici : qui vous avez vu, ce qui s'est dit, les demandes, la prochaine action… L'IA s'occupe du reste." />
        <p className="text-xs text-muted-foreground">Pas besoin de remplir des cases : l'IA comprend et classe automatiquement pour la Direction.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Date de visite</Label><Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Médecin (optionnel)</Label>
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">— l'IA le déduira si vous le citez —</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Photos / pièces jointes (optionnel)</Label>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Ajouter</Button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ""; }} />
        </div>
        <Attachments detail={detail} onDeleted={() => router.refresh()} />
      </div>
    </div>
  );
}

function Attachments({ detail, readOnly, onDeleted }: { detail: FieldReportDetail; readOnly?: boolean; onDeleted?: () => void }) {
  if (detail.attachments.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {detail.attachments.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
          {a.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={`/api/field-reports/attachment/${a.id}`} target="_blank" rel="noopener noreferrer"><img src={`/api/field-reports/attachment/${a.id}`} alt={a.name} className="h-10 w-10 rounded object-cover" /></a>
          ) : <FileText className="h-8 w-8 shrink-0 text-primary" />}
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{a.name}</p><p className="text-[11px] text-muted-foreground">{formatBytes(a.size)}</p></div>
          <a href={`/api/field-reports/attachment/${a.id}?dl=1`} className="rounded p-1 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
          {!readOnly && (
            <button onClick={() => { if (window.confirm("Supprimer ?")) { const f = new FormData(); f.set("id", a.id); deleteFieldReportAttachment(f).then(() => onDeleted?.()); } }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      ))}
    </div>
  );
}
