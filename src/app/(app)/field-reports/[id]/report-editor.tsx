"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Mic, Square, Loader2, Sparkles, Check, Trash2, Paperclip, FileText, Download, KeyRound, RotateCcw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { formatBytes } from "../../messages/format";
import {
  updateFieldReport, analyzeFieldReportAction, validateFieldReport, reopenFieldReport, deleteFieldReportAttachment,
} from "@/lib/actions/field-report-actions";
import type { FieldReportDetail } from "@/lib/queries/field-reports";

const STRUCT: [keyof State, string, boolean?][] = [
  ["summary", "Compte rendu (synthèse)", true],
  ["products", "Produits discutés"],
  ["interest", "Intérêt du médecin"],
  ["objection", "Objection"],
  ["medicalQuestion", "Question médicale"],
  ["documentRequest", "Demande de document"],
  ["sponsoringRequest", "Demande de sponsoring"],
  ["careRequest", "Prise en charge / congrès"],
  ["competitorInfo", "Information concurrentielle"],
  ["opportunity", "Opportunité terrain"],
  ["qualitySignal", "Signalement qualité / pharmacovigilance"],
  ["nextAction", "Prochaine action"],
];

interface State {
  visitDate: string; transcript: string; doctorId: string; doctorName: string; institution: string; specialty: string;
  products: string; interest: string; objection: string; medicalQuestion: string; documentRequest: string;
  sponsoringRequest: string; careRequest: string; competitorInfo: string; opportunity: string; qualitySignal: string;
  nextAction: string; summary: string;
}

export function ReportEditor({ detail, doctors }: { detail: FieldReportDetail; doctors: { id: string; name: string }[] }) {
  const router = useRouter();
  const validated = detail.status === "VALIDATED";
  const ro = validated; // lecture seule si validé
  const [s, setS] = React.useState<State>({
    visitDate: detail.visitDate.slice(0, 10),
    transcript: detail.transcript ?? "", doctorId: detail.doctorId ?? "", doctorName: detail.doctorName ?? "",
    institution: detail.institution ?? "", specialty: detail.specialty ?? "", products: detail.products ?? "",
    interest: detail.interest ?? "", objection: detail.objection ?? "", medicalQuestion: detail.medicalQuestion ?? "",
    documentRequest: detail.documentRequest ?? "", sponsoringRequest: detail.sponsoringRequest ?? "",
    careRequest: detail.careRequest ?? "", competitorInfo: detail.competitorInfo ?? "", opportunity: detail.opportunity ?? "",
    qualitySignal: detail.qualitySignal ?? "", nextAction: detail.nextAction ?? "", summary: detail.summary ?? "",
  });
  const [aiNotes, setAiNotes] = React.useState(detail.aiNotes ?? "");
  const set = (k: keyof State, v: string) => setS((p) => ({ ...p, [k]: v }));

  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const mr = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fd = () => {
    const f = new FormData();
    f.set("id", detail.id);
    (Object.keys(s) as (keyof State)[]).forEach((k) => f.set(k, s[k]));
    return f;
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await updateFieldReport(fd());
    setSaving(false);
    if (r.ok) { setSavedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); router.refresh(); }
    else setMsg(r.error ?? "Échec de l'enregistrement.");
  };

  // ── Enregistrement audio (MediaRecorder) → transcription serveur (Whisper)
  const startRec = async () => {
    setMsg(null);
    // L'accès au micro est une question de NAVIGATEUR (contexte sécurisé + permission),
    // indépendante des clés IA : avec les clés posées, la saisie manuelle puis « Analyser »
    // fonctionne parfaitement. On guide précisément selon la cause de l'échec.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMsg("Le micro nécessite une connexion sécurisée (HTTPS) et un navigateur compatible. Vos clés IA sont bien configurées : saisissez la transcription à la main ci-dessous, puis cliquez « Analyser avec l'IA ».");
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
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMsg("Le navigateur a refusé le micro. Cliquez sur l'icône de permissions (🔒 / caméra) dans la barre d'adresse, autorisez le micro pour ce site, puis réessayez — ou saisissez la transcription à la main.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMsg("Aucun micro détecté sur cet appareil. Branchez un micro, ou saisissez la transcription à la main puis « Analyser avec l'IA ».");
      } else {
        setMsg("Micro inaccessible (ce n'est pas lié aux clés IA, qui sont bien posées). Saisissez la transcription à la main ci-dessous, puis cliquez « Analyser avec l'IA ».");
      }
    }
  };
  const stopRec = () => { mr.current?.stop(); setRecording(false); };

  const uploadAudio = async (blob: Blob) => {
    setTranscribing(true); setMsg(null);
    try {
      const f = new FormData(); f.set("file", blob, "audio.webm");
      const res = await fetch(`/api/field-reports/${detail.id}/transcribe`, { method: "POST", body: f });
      const data = await res.json();
      if (data.transcript) set("transcript", data.transcript);
      else if (data.configured === false) setMsg("Transcription vocale non configurée (clé OpenAI à poser sur Render). L'audio est enregistré — saisissez la transcription à la main, puis « Analyser ».");
      else setMsg(data.error ?? "Transcription indisponible.");
    } catch { setMsg("Envoi de l'audio impossible."); }
    finally { setTranscribing(false); }
  };

  // ── Analyse IA de la transcription → remplit les champs (jamais de validation auto)
  const analyze = async () => {
    if (!s.transcript.trim()) { setMsg("Saisissez ou dictez d'abord une transcription."); return; }
    setAnalyzing(true); setMsg(null);
    const f = new FormData(); f.set("id", detail.id); f.set("transcript", s.transcript);
    const r = await analyzeFieldReportAction(f);
    setAnalyzing(false);
    if (r.ok && r.data) {
      const { aiNotes: notes, ...rest } = r.data;
      setS((p) => ({ ...p, ...(rest as Partial<State>) }));
      setAiNotes(notes ?? "");
      setMsg("Champs proposés par l'IA — relisez et corrigez avant de valider.");
    } else if (r.configured === false) {
      setMsg("Analyse IA non configurée (clé ANTHROPIC_API_KEY à poser sur Render). Remplissez les champs à la main.");
    } else setMsg(r.error ?? "Analyse impossible.");
  };

  const validate = async () => {
    const warn = s.qualitySignal.trim()
      ? "⚠ Ce rapport contient un SIGNALEMENT QUALITÉ / PHARMACOVIGILANCE. Confirmez-vous la validation et la transmission ?"
      : "Valider ce rapport ? Il alimentera les vues Direction et Promotion médicale.";
    if (!window.confirm(warn)) return;
    setSaving(true);
    await updateFieldReport(fd());
    const r = await validateFieldReport((() => { const f = new FormData(); f.set("id", detail.id); return f; })());
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
      {/* Barre d'action */}
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <StatusBadge map={FIELD_REPORT_STATUS} value={detail.status} />
        {!ro ? (
          recording ? (
            <Button variant="destructive" size="sm" onClick={stopRec}><Square className="h-4 w-4" /> Arrêter</Button>
          ) : (
            <Button size="sm" onClick={startRec} disabled={transcribing}>
              {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Parler
            </Button>
          )
        ) : null}
        {!ro && <Button variant="outline" size="sm" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analyser avec l'IA</Button>}
        <div className="ml-auto flex items-center gap-2">
          {savedAt && <span className="text-xs text-muted-foreground">Enregistré à {savedAt}</span>}
          {!ro && <Button variant="outline" size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer</Button>}
          {!ro && <Button size="sm" onClick={validate} disabled={saving}><Check className="h-4 w-4" /> Valider</Button>}
          {ro && <Button variant="outline" size="sm" onClick={reopen}><RotateCcw className="h-4 w-4" /> Rouvrir</Button>}
        </div>
      </div>

      {recording && <p className="flex items-center gap-2 text-sm text-destructive"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" /> Enregistrement en cours… parlez naturellement.</p>}
      {msg && <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2 text-sm text-accent-foreground"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" /> {msg}</div>}

      {/* Transcription */}
      <div className="space-y-1.5">
        <Label>Transcription</Label>
        <Textarea value={s.transcript} onChange={(e) => set("transcript", e.target.value)} rows={4} disabled={ro} placeholder="Dictez avec « Parler », ou saisissez ici le compte rendu de la visite…" />
      </div>

      {aiNotes && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span><span className="font-medium">À confirmer (IA) :</span> {aiNotes}</span>
        </div>
      )}

      {/* Identité de la visite */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1.5"><Label>Date de visite</Label><Input type="date" value={s.visitDate} onChange={(e) => set("visitDate", e.target.value)} disabled={ro} /></div>
        <div className="space-y-1.5"><Label>Médecin (annuaire)</Label>
          <Select value={s.doctorId} onChange={(e) => set("doctorId", e.target.value)} disabled={ro}>
            <option value="">— non rattaché —</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Médecin (nom dicté)</Label><Input value={s.doctorName} onChange={(e) => set("doctorName", e.target.value)} disabled={ro} /></div>
        <div className="space-y-1.5"><Label>Spécialité</Label><Input value={s.specialty} onChange={(e) => set("specialty", e.target.value)} disabled={ro} /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Établissement</Label><Input value={s.institution} onChange={(e) => set("institution", e.target.value)} disabled={ro} /></div>
      </div>

      {/* Champs structurés */}
      <div className="grid gap-3 md:grid-cols-2">
        {STRUCT.map(([k, lbl, full]) => (
          <div key={k} className={cn("space-y-1.5", full && "md:col-span-2")}>
            <Label className={k === "qualitySignal" ? "text-destructive" : ""}>{lbl}</Label>
            <Textarea value={s[k]} onChange={(e) => set(k, e.target.value)} rows={k === "summary" ? 2 : 2} disabled={ro}
              className={k === "qualitySignal" && s.qualitySignal ? "border-destructive/40" : ""} />
          </div>
        ))}
      </div>

      {/* Pièces jointes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Pièces jointes ({detail.attachments.length})</Label>
          {!ro && <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Ajouter (photo, carte de visite, PDF…)</Button>}
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
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{a.name}</p><p className="text-[11px] text-muted-foreground">{formatBytes(a.size)}</p></div>
                <a href={`/api/field-reports/attachment/${a.id}?dl=1`} className="rounded p-1 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                {!ro && <button onClick={() => { if (window.confirm("Supprimer ?")) { const f = new FormData(); f.set("id", a.id); deleteFieldReportAttachment(f).then(() => router.refresh()); } }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {validated && <Badge tone="success" dot={false}>Validé{detail.validatedAt ? "" : ""}</Badge>}
    </div>
  );
}
