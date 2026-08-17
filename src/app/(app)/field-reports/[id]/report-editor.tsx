"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, Check, Trash2, Paperclip, FileText, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { formatBytes } from "../../messages/format";
import { updateFieldReport, validateFieldReport, reopenFieldReport, deleteFieldReportAttachment } from "@/lib/actions/field-report-actions";
import type { FieldReportDetail } from "@/lib/queries/field-reports";
import { DoctorPicker } from "./doctor-picker";

/**
 * Vue gestionnaire (Direction / chef de produit) : un seul **compte rendu (synthèse)**,
 * dictable à la voix, + médecin(s), établissement, spécialité, date, pièces jointes.
 * Plus de catégories structurées — le compte rendu se suffit à lui-même.
 */
export function ReportEditor({ detail, doctors }: { detail: FieldReportDetail; doctors: { id: string; name: string }[] }) {
  const router = useRouter();
  const ro = detail.status === "VALIDATED"; // lecture seule si validé

  const [summary, setSummary] = React.useState(detail.summary ?? detail.transcript ?? "");
  const [visitDate, setVisitDate] = React.useState(detail.visitDate.slice(0, 10));
  const [doctorIds, setDoctorIds] = React.useState<string[]>(detail.doctorIds);
  const [doctorName, setDoctorName] = React.useState(detail.doctorName ?? "");
  const [institution, setInstitution] = React.useState(detail.institution ?? "");
  const [specialty, setSpecialty] = React.useState(detail.specialty ?? "");

  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const mr = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fd = () => {
    const f = new FormData();
    f.set("id", detail.id);
    f.set("summary", summary); f.set("visitDate", visitDate);
    f.set("doctorIds", doctorIds.join(",")); f.set("doctorName", doctorName);
    f.set("institution", institution); f.set("specialty", specialty);
    return f;
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await updateFieldReport(fd());
    setSaving(false);
    if (r.ok) { setSavedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); router.refresh(); }
    else setMsg(r.error ?? "Échec de l'enregistrement.");
  };

  const startRec = async () => {
    setMsg(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMsg("Le micro nécessite une connexion sécurisée (HTTPS). Vous pouvez aussi écrire le compte rendu ci-dessous.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); await uploadAudio(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" })); };
      rec.start(); mr.current = rec; setRecording(true);
    } catch {
      setMsg("Micro inaccessible — autorisez-le dans le navigateur, ou écrivez le compte rendu ci-dessous.");
    }
  };
  const stopRec = () => { mr.current?.stop(); setRecording(false); };

  const uploadAudio = async (blob: Blob) => {
    setTranscribing(true); setMsg(null);
    try {
      const f = new FormData(); f.set("file", blob, "audio.webm");
      const res = await fetch(`/api/field-reports/${detail.id}/transcribe`, { method: "POST", body: f });
      const data = await res.json();
      if (data.transcript) setSummary((prev) => (prev ? `${prev}\n${data.transcript}` : data.transcript));
      else setMsg(data.error ?? "Transcription indisponible — vous pouvez écrire à la main.");
    } catch { setMsg("Envoi de l'audio impossible."); }
    finally { setTranscribing(false); }
  };

  const validate = async () => {
    if (!window.confirm("Valider ce compte rendu ? Il alimentera les vues Direction et Annuaire.")) return;
    setSaving(true);
    await updateFieldReport(fd());
    const f = new FormData(); f.set("id", detail.id);
    const r = await validateFieldReport(f);
    setSaving(false);
    if (r.ok) router.refresh(); else setMsg(r.error ?? "Validation impossible.");
  };
  const reopen = async () => { const f = new FormData(); f.set("id", detail.id); await reopenFieldReport(f); router.refresh(); };

  const uploadAttachment = async (file: File) => {
    const f = new FormData(); f.set("file", file);
    const res = await fetch(`/api/field-reports/${detail.id}/upload`, { method: "POST", body: f });
    if (res.ok) router.refresh(); else { const d = await res.json(); setMsg(d.error ?? "Échec de la pièce jointe."); }
  };

  return (
    <div className="space-y-5">
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <StatusBadge map={FIELD_REPORT_STATUS} value={detail.status} />
        {!ro && (recording
          ? <Button variant="destructive" size="sm" onClick={stopRec}><Square className="h-4 w-4" /> Arrêter</Button>
          : <Button size="sm" onClick={startRec} disabled={transcribing}>{transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Parler</Button>)}
        <div className="ml-auto flex items-center gap-2">
          {savedAt && <span className="text-xs text-muted-foreground">Enregistré à {savedAt}</span>}
          {!ro && <Button variant="outline" size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer</Button>}
          {!ro && <Button size="sm" onClick={validate} disabled={saving}><Check className="h-4 w-4" /> Valider</Button>}
          {ro && <Button variant="outline" size="sm" onClick={reopen}><RotateCcw className="h-4 w-4" /> Rouvrir</Button>}
        </div>
      </div>

      {recording && <p className="flex items-center gap-2 text-sm text-destructive"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" /> Enregistrement… parlez naturellement.</p>}
      {msg && <div className="rounded-lg bg-accent/60 px-3 py-2 text-sm text-accent-foreground">{msg}</div>}

      <div className="space-y-1.5">
        <Label>Compte rendu (synthèse)</Label>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} disabled={ro} placeholder="Dictez avec « Parler », ou saisissez le compte rendu de la visite…" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Date de visite</Label><Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} disabled={ro} /></div>
        <div className="space-y-1.5"><Label>Spécialité</Label><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={ro} placeholder="Ex. Cardiologie" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Médecin(s) — annuaire</Label><DoctorPicker doctors={doctors} value={doctorIds} onChange={setDoctorIds} disabled={ro} /></div>
        <div className="space-y-1.5"><Label>Médecin (nom libre)</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} disabled={ro} placeholder="Si absent de l'annuaire" /></div>
        <div className="space-y-1.5"><Label>Établissement</Label><Input value={institution} onChange={(e) => setInstitution(e.target.value)} disabled={ro} placeholder="Ex. CHU Mustapha" /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Pièces jointes ({detail.attachments.length})</Label>
          {!ro && <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Ajouter (photo, PDF, tout type…)</Button>}
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ""; }} />
        </div>
        {detail.attachments.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detail.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                {a.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={`/api/field-reports/attachment/${a.id}`} target="_blank" rel="noopener noreferrer"><img src={`/api/field-reports/attachment/${a.id}`} alt={a.name} className="h-10 w-10 rounded object-cover" /></a>
                ) : <FileText className="h-8 w-8 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{a.name}</p><p className="text-[0.6875rem] text-muted-foreground">{formatBytes(a.size)}</p></div>
                <a href={`/api/field-reports/attachment/${a.id}?dl=1`} className="rounded p-1 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                {!ro && <button onClick={() => { if (window.confirm("Supprimer ?")) { const f = new FormData(); f.set("id", a.id); deleteFieldReportAttachment(f).then(() => router.refresh()); } }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {ro && <Badge tone="success" dot={false}>Validé</Badge>}
    </div>
  );
}
