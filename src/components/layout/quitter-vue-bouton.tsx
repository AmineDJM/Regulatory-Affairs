"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { stopImpersonation } from "@/lib/actions/impersonation-actions";

/**
 * QUITTER LA VUE EXACTE — et recharger TOUTE la page : une navigation douce garderait la coque (barre du haut, menu,
 * bandeau) rendue pour la personne visualisée, d'où « je dois tout rafraîchir » (Direction, 06/10).
 */
export function QuitterVueBouton() {
  const [enCours, demarrer] = React.useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(async () => {
        const r = await stopImpersonation();
        window.location.assign(r.ok ? (r.message ?? "/admin") : "/admin");
      })}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20 disabled:opacity-60"
    >
      {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Quitter la vue
    </button>
  );
}
