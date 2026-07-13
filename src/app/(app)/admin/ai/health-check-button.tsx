"use client";

import * as React from "react";
import { Loader2, Activity } from "lucide-react";
import { runAiHealthCheckNow } from "./health-actions";

/** Bouton « Tester maintenant » de la sonde IA — feedback immédiat + rafraîchit la carte. */
export function AiHealthCheckButton() {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; error?: string; latencyMs?: number } | null>(null);

  async function run() {
    setBusy(true);
    try {
      setResult(await runAiHealthCheckNow());
    } catch {
      setResult({ ok: false, error: "Le test n'a pas pu être lancé." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Tester maintenant
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-success" : "text-destructive"}`}>
          {result.ok
            ? `API opérationnelle${result.latencyMs ? ` (${result.latencyMs} ms)` : ""}.`
            : `Échec : ${result.error}`}
        </span>
      )}
    </div>
  );
}
