"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { stopImpersonation } from "@/lib/actions/impersonation-actions";
import { annoncerBasculeDeVue, annulerBasculeDeVue } from "@/components/layout/identite-vue";
import { cn } from "@/lib/utils";

/**
 * QUITTER LA VUE EXACTE — et recharger TOUTE la page : une navigation douce garderait la coque (barre du haut, menu,
 * bandeau) rendue pour la personne visualisée, d'où « je dois tout rafraîchir » (Direction, 06/10). C'est le SEUL
 * chemin de retour au profil réel depuis l'écran (bandeau et menu du compte).
 */
export function QuitterVueBouton({ libelle = "Quitter", className }: { libelle?: string; className?: string }) {
  const [enCours, demarrer] = React.useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(async () => {
        annoncerBasculeDeVue();
        try {
          const r = await stopImpersonation();
          window.location.assign(r.ok ? (r.message ?? "/admin") : "/admin");
        } catch {
          annulerBasculeDeVue();
        }
      })}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20 disabled:opacity-60",
        className,
      )}
    >
      {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {libelle}
    </button>
  );
}
