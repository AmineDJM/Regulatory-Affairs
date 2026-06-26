"use client";

import * as React from "react";
import { Sparkles, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Carte de synthèse IA — appel à la demande. Dégradé proprement sans clé API. */
export function AiSynthesis({ scope }: { scope: "overview" | "people" }) {
  const [loading, setLoading] = React.useState(false);
  const [text, setText] = React.useState<string | null>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const generate = async () => {
    setLoading(true); setErr(null); setText(null); setNotConfigured(false);
    try {
      const res = await fetch(`/api/process-intelligence/synthesis?scope=${scope}`, { cache: "no-store" });
      const data = await res.json();
      if (data.configured === false) setNotConfigured(true);
      else if (data.text) setText(data.text);
      else setErr(data.error ?? "Synthèse indisponible.");
    } catch {
      setErr("Appel impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface space-y-3 border-primary/30 bg-gradient-to-br from-accent/40 to-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Synthèse IA
        </h2>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {text || notConfigured ? "Regénérer" : "Générer la synthèse"}
        </Button>
      </div>

      {notConfigured && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>IA non configurée. Ajoutez la clé <code className="font-mono">ANTHROPIC_API_KEY</code> dans Render (Settings → Environment) pour activer la synthèse automatique des ralentissements.</span>
        </div>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {text && <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</div>}
      {!text && !notConfigured && !err && !loading && (
        <p className="text-sm text-muted-foreground">Cliquez sur « Générer la synthèse » pour obtenir une analyse des principaux ralentissements et des recommandations.</p>
      )}
    </div>
  );
}
