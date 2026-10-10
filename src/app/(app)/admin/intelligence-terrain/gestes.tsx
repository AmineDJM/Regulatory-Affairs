"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { relancerAnalyseInfluence, deciderLienInfluence } from "@/lib/actions/intelligence-terrain-actions";
import { Button } from "@/components/ui/button";
import { useRafraichir } from "@/components/shared/use-rafraichir";

/** « Relancer l'analyse » — structure, nouveaux rapports (Luna), scores. Le bilan s'affiche en une ligne. */
export function RelancerAnalyse() {
  const { rafraichir } = useRafraichir();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const lancer = async () => {
    setBusy(true); setMsg(null);
    const r = await relancerAnalyseInfluence();
    setBusy(false);
    if (!r.ok) { setMsg(r.error ?? "Analyse impossible."); return; }
    const b = r.bilan;
    if (b) setMsg(`${b.rapportsLus} rapport(s) lu(s) · ${b.liensProposes} lien(s) proposé(s)${b.luna === "INDISPONIBLE" ? " · Luna indisponible" : b.luna === "ECHEC" ? " · Luna n'a pas répondu" : ""}${b.resteALire ? " · reste à lire" : ""}`);
    rafraichir();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={lancer} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Relancer l&apos;analyse
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

/** Confirmer / rejeter un lien proposé par Luna. */
export function DecisionLien({ relationId }: { relationId: string }) {
  const { rafraichir } = useRafraichir();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const decider = async (decision: "CONFIRMEE" | "REJETEE") => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("relationId", relationId);
    fd.set("decision", decision);
    const r = await deciderLienInfluence(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
    rafraichir();
  };
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={() => decider("CONFIRMEE")} disabled={busy} aria-label="Confirmer le lien">
        <Check className="h-4 w-4" /> Confirmer
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decider("REJETEE")} disabled={busy} aria-label="Rejeter le lien">
        <X className="h-4 w-4" /> Rejeter
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
