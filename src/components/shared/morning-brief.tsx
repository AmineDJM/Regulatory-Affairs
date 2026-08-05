"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sunrise } from "lucide-react";
import { refreshMyBrief } from "@/lib/actions/assistant-actions";

/**
 * Le point du matin, écrit par l'assistant à partir des seules données de la personne.
 * Le texte arrive déjà calculé côté serveur (cache journalier) ; le bouton ne sert qu'à
 * forcer une régénération quand la journée a bougé.
 */
export function MorningBrief({ initial }: { initial: string }) {
  const [text, setText] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await refreshMyBrief();
      if (r.text) setText(r.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="flex items-center gap-2">
        <Sunrise className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Votre point du matin</span>
        <button
          type="button" onClick={refresh} disabled={busy} title="Régénérer"
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </button>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{text}</p>
    </div>
  );
}
