"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Check, RotateCcw } from "lucide-react";
import { saveSfeSettings } from "@/lib/actions/sales-planning-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Config {
  positionWeights: Record<string, number>;
  capacity: { daysPerMonth: number; visitsPerDay: number; fieldPct: number };
  frequencyByTier: Record<string, number>;
}

const DEFAULTS: Config = {
  positionWeights: { "1": 1, "2": 0.5, "3": 0.25 },
  capacity: { daysPerMonth: 20, visitsPerDay: 7, fieldPct: 80 },
  frequencyByTier: { VERY_HIGH: 3, HIGH: 2, MEDIUM: 1, LOW: 1, VERY_LOW: 0 },
};

const TIERS: { key: string; label: string; hint: string }[] = [
  { key: "VERY_HIGH", label: "Très fort potentiel", hint: "Cibles prioritaires" },
  { key: "HIGH", label: "Fort potentiel", hint: "" },
  { key: "MEDIUM", label: "Potentiel moyen", hint: "" },
  { key: "LOW", label: "Faible potentiel", hint: "" },
  { key: "VERY_LOW", label: "Très faible potentiel", hint: "Hors cible" },
];

const inputCls = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const num = (v: string, fallback: number) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : fallback; };

/**
 * Paramètres SFE 100% configurables (capacité terrain, poids des positions, fréquences par palier).
 * Un seul bouton « Enregistrer » applique l'ensemble. Prévisualisation de la capacité en direct.
 */
export function SettingsForm({ config, canEdit }: { config: Config; canEdit: boolean }) {
  const router = useRouter();
  const [cap, setCap] = React.useState(config.capacity);
  const [pw, setPw] = React.useState({
    p1: config.positionWeights["1"] ?? 1,
    p2: config.positionWeights["2"] ?? 0.5,
    p3: config.positionWeights["3"] ?? 0.25,
  });
  const [freq, setFreq] = React.useState<Record<string, number>>(() => {
    const f: Record<string, number> = {};
    for (const t of TIERS) f[t.key] = config.frequencyByTier[t.key] ?? DEFAULTS.frequencyByTier[t.key];
    return f;
  });
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const capacityPreview = Math.round(cap.daysPerMonth * cap.visitsPerDay * (cap.fieldPct / 100));

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("daysPerMonth", String(cap.daysPerMonth));
    fd.set("visitsPerDay", String(cap.visitsPerDay));
    fd.set("fieldPct", String(cap.fieldPct));
    fd.set("p1", String(pw.p1));
    fd.set("p2", String(pw.p2));
    fd.set("p3", String(pw.p3));
    for (const t of TIERS) fd.set(`freq_${t.key}`, String(freq[t.key]));
    const r = await saveSfeSettings(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Enregistrement impossible."); return; }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
    router.refresh();
  }

  function resetDefaults() {
    setCap(DEFAULTS.capacity);
    setPw({ p1: 1, p2: 0.5, p3: 0.25 });
    setFreq({ ...DEFAULTS.frequencyByTier });
  }

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {node}
      {hint && <span className="block text-[0.6875rem] text-muted-foreground/80">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-5">
      {!canEdit && <p className="text-sm text-muted-foreground">Accès en lecture seule — seuls les éditeurs peuvent modifier les paramètres.</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ─────────── Capacité terrain ─────────── */}
        <Card>
          <CardHeader><CardTitle>Capacité terrain (par délégué / mois)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {field("Jours terrain / mois", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={cap.daysPerMonth} onChange={(e) => setCap({ ...cap, daysPerMonth: num(e.target.value, cap.daysPerMonth) })} />)}
              {field("Visites / jour", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={cap.visitsPerDay} onChange={(e) => setCap({ ...cap, visitsPerDay: num(e.target.value, cap.visitsPerDay) })} />)}
              {field("% temps terrain", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={cap.fieldPct} onChange={(e) => setCap({ ...cap, fieldPct: num(e.target.value, cap.fieldPct) })} />)}
            </div>
            <div className="rounded-lg bg-primary/5 px-3 py-2.5 text-sm">
              Capacité nette : <span className="font-bold">{capacityPreview}</span> visites / délégué / mois
              <span className="block text-[0.6875rem] text-muted-foreground">= {cap.daysPerMonth} j × {cap.visitsPerDay} visites × {cap.fieldPct}%</span>
            </div>
          </CardContent>
        </Card>

        {/* ─────────── Poids des positions ─────────── */}
        <Card>
          <CardHeader><CardTitle>Poids des positions de détail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Une visite compte selon le rang du produit dans le détail. P1 = produit prioritaire.</p>
            <div className="grid grid-cols-3 gap-3">
              {field("Position 1 (P1)", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={pw.p1} onChange={(e) => setPw({ ...pw, p1: num(e.target.value, pw.p1) })} />)}
              {field("Position 2 (P2)", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={pw.p2} onChange={(e) => setPw({ ...pw, p2: num(e.target.value, pw.p2) })} />)}
              {field("Position 3 (P3)", <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={pw.p3} onChange={(e) => setPw({ ...pw, p3: num(e.target.value, pw.p3) })} />)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─────────── Fréquence par palier de potentiel ─────────── */}
      <Card>
        <CardHeader><CardTitle>Fréquence cible par palier de potentiel (visites / cycle)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((t) => (
              <div key={t.key}>
                {field(t.label, <input disabled={!canEdit} inputMode="decimal" className={inputCls} value={freq[t.key]} onChange={(e) => setFreq({ ...freq, [t.key]: num(e.target.value, freq[t.key]) })} />, t.hint || undefined)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {done ? "Enregistré" : "Enregistrer les paramètres"}
          </button>
          <button type="button" onClick={resetDefaults} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            <RotateCcw className="h-4 w-4" /> Valeurs par défaut
          </button>
        </div>
      )}
    </div>
  );
}
