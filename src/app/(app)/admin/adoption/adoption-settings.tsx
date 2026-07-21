"use client";

import * as React from "react";
import { Loader2, Check, SlidersHorizontal, RotateCcw, TimerReset } from "lucide-react";
import { saveAdoptionSettings, resetActivityTime } from "@/lib/actions/adoption-actions";
import {
  ADOPTION_WEIGHT_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_TARGET_FIELDS, DEFAULT_ADOPTION_SETTINGS,
  type AdoptionSettings,
} from "@/lib/adoption";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const FIELD_KEY: Record<string, string> = {
  regularity: "wRegularity", time: "wTime", breadth: "wBreadth", diversity: "wDiversity",
  durable: "wDurable", interaction: "wInteraction", recency: "wRecency", cycle: "wCycle",
  champion: "tChampion", active: "tActive", moderate: "tModerate", weak: "tWeak",
};
// Champs « cibles » → nom de l'input (clé de colonne tgt*).
const TARGET_NAME: Record<string, string> = {
  timeHours: "tgtTimeHours", activeDays: "tgtActiveDays", diversity: "tgtDiversity",
  durable: "tgtDurable", interaction: "tgtInteraction", modules: "tgtModules", cycleHours: "tgtCycleHours",
};

/** Réglage (Super Admin) des poids et seuils du score d'adoption. */
export function AdoptionSettingsForm({ settings }: { settings: AdoptionSettings }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Total des poids (affiché en direct) — le score est normalisé par ce total.
  const [weights, setWeights] = React.useState<Record<string, number>>(
    () => Object.fromEntries(ADOPTION_WEIGHT_FIELDS.map((f) => [f.key, settings.weights[f.key]])),
  );
  const total = Object.values(weights).reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);

  function reset() {
    setWeights(Object.fromEntries(ADOPTION_WEIGHT_FIELDS.map((f) => [f.key, DEFAULT_ADOPTION_SETTINGS.weights[f.key]])));
  }

  return (
    <form
      action={async (fd) => {
        setSaving(true); setError(null);
        const r = await saveAdoptionSettings(fd);
        setSaving(false);
        if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
        else setError(r.error ?? "Échec de l'enregistrement.");
      }}
      className="space-y-4"
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Poids des dimensions <span className="text-muted-foreground">(relatifs — le score est normalisé sur le total = {total})</span></p>
          <Button type="button" variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Valeurs par défaut</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ADOPTION_WEIGHT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={FIELD_KEY[f.key]} title={f.help}>{f.label}</Label>
              <Input
                id={FIELD_KEY[f.key]} name={FIELD_KEY[f.key]} type="number" min="0" max="100" step="1"
                value={weights[f.key]}
                onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Objectifs « 100 % » par dimension</p>
        <p className="mb-2 text-xs text-muted-foreground">Combien d'heures / d'actions / de jours sont nécessaires pour atteindre le plein sous-score. Les heures de temps d'activité ne comptent que lorsque l'onglet est au <strong>premier plan</strong> (visible &amp; actif).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ADOPTION_TARGET_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={TARGET_NAME[f.key]} title={f.help}>{f.label} <span className="text-muted-foreground">({f.unit})</span></Label>
              <Input id={TARGET_NAME[f.key]} name={TARGET_NAME[f.key]} type="number" min="0" step="1" defaultValue={settings.targets[f.key]} title={f.help} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Seuils de libellé <span className="text-muted-foreground">(0–100, strictement décroissants)</span></p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ADOPTION_THRESHOLD_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={FIELD_KEY[f.key]}>{f.label}</Label>
              <Input id={FIELD_KEY[f.key]} name={FIELD_KEY[f.key]} type="number" min="0" max="100" step="1" defaultValue={settings.thresholds[f.key]} />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : <SlidersHorizontal className="h-4 w-4" />}
          {saved ? "Enregistré" : "Enregistrer le réglage"}
        </Button>
      </div>
    </form>
  );
}

/** Remet à zéro les temps d'activité (Super Admin) pour repartir sur le comptage précis. */
export function ResetActivityTimeButton() {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    if (!window.confirm("Remettre à zéro les temps d'activité de tous les comptes ?\n\nLes relevés (appareil, géoloc, page) sont conservés ; seule la durée est remise à 0. Le nouveau comptage précis (temps au premier plan) prend le relais. Action irréversible.")) return;
    setBusy(true); setErr(null); setMsg(null);
    const r = await resetActivityTime();
    setBusy(false);
    if (r.ok) setMsg(r.message ?? "Temps d'activité remis à zéro."); else setErr(r.error ?? "Échec.");
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />} Remettre les temps d'activité à zéro
      </Button>
      {msg && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
