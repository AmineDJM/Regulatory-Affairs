"use client";

import * as React from "react";
import { Loader2, Check, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateAiSettings } from "@/lib/actions/ai-settings-actions";
import { cn } from "@/lib/utils";

export interface AiSettings {
  masterEnabled: boolean;
  assistantEnabled: boolean;
  proactiveNudgesEnabled: boolean;
  brainEnabled: boolean;
  processIntelEnabled: boolean;
  fieldReportAiEnabled: boolean;
  voiceTranscriptEnabled: boolean;
}

type FeatureKey = Exclude<keyof AiSettings, "masterEnabled">;

const FEATURES: { key: FeatureKey; label: string; desc: string }[] = [
  { key: "assistantEnabled", label: "Assistant IA (chatbot + bulle flottante)", desc: "Conversation, recherche et actions à confirmer." },
  { key: "proactiveNudgesEnabled", label: "Suggestions proactives", desc: "Analyse des messages non lus et propositions d'actions." },
  { key: "brainEnabled", label: "Adventum Brain", desc: "Briefing de direction, copilote et synthèses de risques." },
  { key: "processIntelEnabled", label: "Process Intelligence", desc: "Synthèse IA des ralentissements et de la charge." },
  { key: "fieldReportAiEnabled", label: "Analyse des rapports terrain", desc: "Structuration IA des comptes rendus de visite." },
  { key: "voiceTranscriptEnabled", label: "Transcription vocale (Whisper)", desc: "Dictée → texte des rapports terrain (OpenAI)." },
];

function Toggle({ checked, onClick, disabled }: { checked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-success" : "bg-border",
      )}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const [s, setS] = React.useState<AiSettings>(initial);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = React.useMemo(() => (Object.keys(s) as (keyof AiSettings)[]).some((k) => s[k] !== initial[k]), [s, initial]);

  const toggle = (k: keyof AiSettings) => {
    setS((prev) => ({ ...prev, [k]: !prev[k] }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(s)) if (v) fd.set(k, "on");
    const r = await updateAiSettings(fd);
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  }

  return (
    <div className="space-y-5">
      {/* Interrupteur général */}
      <div className={cn("flex items-center justify-between rounded-xl border p-4", s.masterEnabled ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
        <div className="flex items-start gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", s.masterEnabled ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            <Power className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">Interrupteur général de l'IA</p>
            <p className="text-sm text-muted-foreground">
              {s.masterEnabled ? "L'IA est active (selon les fonctions ci-dessous)." : "Toute l'IA est coupée, quelles que soient les bascules ci-dessous."}
            </p>
          </div>
        </div>
        <Toggle checked={s.masterEnabled} onClick={() => toggle("masterEnabled")} />
      </div>

      {/* Bascules par fonction */}
      <div className="divide-y divide-border rounded-xl border border-border">
        {FEATURES.map((f) => (
          <div key={f.key} className={cn("flex items-center justify-between gap-4 p-4", !s.masterEnabled && "opacity-60")}>
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Toggle checked={s[f.key]} onClick={() => toggle(f.key)} disabled={!s.masterEnabled} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1.5 text-sm text-success"><Check className="h-4 w-4" /> Enregistré</span>}
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  );
}
