"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { saveTourPlanningSettings } from "@/lib/actions/sales-planning-actions";
import {
  GRANULARITES, GRANULARITE_LABELS, JOURS_AVANT_ECHEANCE_MAX, type Granularite, type ReglageTournee,
} from "@/lib/sfe/tournee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inputCls = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60";

/**
 * LA MAILLE ET L'ÉCHÉANCE DES PLANS DE TOURNÉE — le formulaire qui manquait.
 *
 * Le réglage (`SfeSettings.tourPlanning`) était LU par l'action qui ouvre un plan et par l'écran
 * du KAM, qui annonçait « réglée par le Super Admin (Administration › Réglages) » — et aucun
 * écran ne l'écrivait, pas même celui-là. La liste des mailles vient du module pur : ajouter une
 * maille est une décision de revue de code, pas une option tapée ici.
 */
export function TourPlanningForm({ reglage, canEdit }: { reglage: ReglageTournee; canEdit: boolean }) {
  const router = useRouter();
  const [granularite, setGranularite] = React.useState<Granularite>(reglage.granularite);
  const [jours, setJours] = React.useState<string>(String(reglage.joursAvant));
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    if (!canEdit) return;
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("granularity", granularite);
    fd.set("submissionLeadDays", jours);
    const r = await saveTourPlanningSettings(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Enregistrement impossible."); return; }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Planification de tournée (Super Admin)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          La <strong>maille</strong> est la période qu&apos;un KAM planifie d&apos;un coup — mensuelle par défaut. L&apos;<strong>échéance de
          soumission</strong> tombe le nombre de jours indiqué avant la fin du mois qui précède la période, ramenée au dernier
          jour ouvré (15 par défaut). Les plans déjà ouverts gardent l&apos;échéance figée à leur création ; seuls les plans à
          venir suivent le nouveau réglage.
        </p>
        {!canEdit && (
          <p className="text-xs text-muted-foreground">Lecture seule — ce réglage est réservé au Super Admin.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Maille de planification</span>
            <select
              className={inputCls} disabled={!canEdit} value={granularite}
              onChange={(e) => setGranularite(e.target.value as Granularite)}
            >
              {GRANULARITES.map((g) => <option key={g} value={g}>{GRANULARITE_LABELS[g]}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Échéance de soumission (jours avant la fin du mois précédent)</span>
            <input
              className={inputCls} disabled={!canEdit} inputMode="numeric" value={jours}
              min={0} max={JOURS_AVANT_ECHEANCE_MAX} type="number" step={1}
              onChange={(e) => setJours(e.target.value)}
            />
            <span className="block text-[0.6875rem] text-muted-foreground/80">Entier de 0 à {JOURS_AVANT_ECHEANCE_MAX}.</span>
          </label>
        </div>
        {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        {canEdit && (
          <button
            type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {done ? "Enregistré" : "Enregistrer la planification"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
