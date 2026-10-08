"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { supprimerPlanTourneeBrouillon } from "@/lib/actions/tour-plan-actions";

/**
 * SUPPRIMER UN BROUILLON — deux clics : « Supprimer », puis « Confirmer ».
 *
 * Proposé sur les seuls plans en brouillon ; l'action revérifie le statut, le périmètre et les visites déjà
 * rapportées (qui ne se suppriment jamais) et c'est son refus qui s'affiche ici.
 */
export function SupprimerPlan({ planId }: { planId: string }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const supprimer = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("planId", planId);
    const r = await supprimerPlanTourneeBrouillon(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Suppression impossible."); setConfirmer(false); return; }
    router.refresh();
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {err && <span className="text-xs text-destructive">{err}</span>}
      {confirmer ? (
        <>
          <button
            type="button" onClick={() => void supprimer()} disabled={busy}
            className="inline-flex min-h-10 items-center gap-1 rounded-md bg-destructive px-2 text-xs font-medium text-destructive-foreground hover:opacity-90 sm:min-h-0 sm:py-1"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Confirmer la suppression
          </button>
          <button
            type="button" onClick={() => setConfirmer(false)} disabled={busy}
            className="inline-flex min-h-10 items-center text-xs text-muted-foreground hover:underline sm:min-h-0"
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          type="button" onClick={() => { setErr(null); setConfirmer(true); }}
          className="inline-flex min-h-10 items-center gap-1 text-xs text-destructive hover:underline sm:min-h-0"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
      )}
    </span>
  );
}
