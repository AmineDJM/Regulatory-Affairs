"use client";

import * as React from "react";
import { Loader2, Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateRiskThresholds } from "@/lib/actions/adventum-actions";
import { THRESHOLD_FIELDS, type RiskThresholds } from "@/lib/adventum/risk-settings";

export function RiskThresholdsForm({ initial }: { initial: RiskThresholds }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <details className="surface group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Réglage des seuils du Risk Radar
        </span>
        <span className="text-xs text-muted-foreground">Ajustez quand un risque se déclenche</span>
      </summary>
      <form
        action={async (fd) => { setSaving(true); const r = await updateRiskThresholds(fd); setSaving(false); if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); } }}
        className="border-t border-border px-4 py-4"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {THRESHOLD_FIELDS.map((f) => (
            <label key={f.key} className="space-y-1">
              <span className="block text-xs font-medium">{f.label}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  name={f.key}
                  defaultValue={initial[f.key]}
                  min={f.min}
                  max={f.max}
                  className="h-9 w-24 rounded-lg border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground">{f.suffix}</span>
              </span>
              <span className="block text-[0.6875rem] leading-snug text-muted-foreground">{f.help}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-success"><Check className="h-4 w-4" /> Seuils enregistrés</span>}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer les seuils
          </Button>
        </div>
      </form>
    </details>
  );
}
