"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, AlertCircle, ShieldCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { runTestCenter, resumeTestCleanup } from "@/lib/actions/test-center-actions";

const MODES = [
  { value: "SAFE_SYNTHETIC_TEST", label: "Test synthétique sûr (recommandé)", hint: "Crée des identités synthétiques, exécute les smoke tests, puis nettoie et vérifie." },
  { value: "READ_ONLY_AUDIT", label: "Audit lecture seule", hint: "Aucune écriture : santé, cohérence RBAC/navigation, formats, ergonomie." },
];

/** Panneau de lancement d'un run (phase 1 : deux modes sûrs). */
export function LaunchPanel() {
  const router = useRouter();
  const [mode, setMode] = React.useState("SAFE_SYNTHETIC_TEST");
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  const launch = () =>
    start(async () => {
      setErr(null); setOkMsg(null);
      const r = await runTestCenter({ mode });
      if (!r.ok) { setErr(r.error ?? "Échec du lancement."); return; }
      setOkMsg(`Run ${r.runId?.slice(0, 8)} terminé.`);
      router.refresh();
    });

  const current = MODES.find((m) => m.value === mode);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Lancer un run</CardTitle>
        <CardDescription>Réservé au Super Admin. Le nettoyage des données synthétiques est garanti et vérifié à la fin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:max-w-md">
          <Label>Mode</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          {current && <p className="text-xs text-muted-foreground">{current.hint}</p>}
        </div>
        {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
        {okMsg && <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> {okMsg}</div>}
        <Button onClick={launch} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {pending ? "Exécution…" : "Lancer le run"}
        </Button>
        <p className="text-[11px] text-muted-foreground">Modes avancés (Staging complet, Chaos, Sécurité, Performance) : phases suivantes.</p>
      </CardContent>
    </Card>
  );
}

/** Bouton de reprise de nettoyage pour un run interrompu / incomplet. */
export function ResumeCleanupButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const resume = () =>
    start(async () => {
      const r = await resumeTestCleanup(runId);
      setMsg(r.ok ? "Nettoyage terminé." : (r.error ?? "Nettoyage incomplet."));
      router.refresh();
    });
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={resume} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reprendre le nettoyage
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
