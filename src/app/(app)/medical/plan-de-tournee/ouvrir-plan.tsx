"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { ouvrirPlanTournee } from "@/lib/actions/tour-plan-actions";
import { GRANULARITE_LABELS, type Granularite } from "@/lib/sfe/tournee";
import { Button } from "@/components/ui/button";

/**
 * OUVRIR LE PLAN DE LA PÉRIODE À VENIR — un seul bouton, une seule question.
 *
 * L'action est IDEMPOTENTE : si le plan existe, c'est celui-là qui s'ouvre. Le bouton ne demande
 * donc pas « créer ou ouvrir ? » — cette question n'a pas de réponse utile pour la personne, et
 * la lui poser ferait deux clics là où un suffit.
 */
export function OuvrirPlan({
  granularite, labelPeriodeSuivante, dateSuivante,
}: {
  granularite: Granularite;
  labelPeriodeSuivante: string;
  dateSuivante: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const ouvrir = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("granularity", granularite);
    fd.set("date", dateSuivante);
    const r = await ouvrirPlanTournee(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Ouverture impossible."); return; }
    if (r.id) router.push(`/medical/plan-de-tournee?plan=${r.id}`);
    else router.refresh();
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      {err && <span className="text-xs text-destructive">{err}</span>}
      <Button size="sm" onClick={() => void ouvrir()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Préparer {GRANULARITE_LABELS[granularite].toLowerCase() === "mensuelle" ? "le mois" : "la période"} {labelPeriodeSuivante}
      </Button>
    </span>
  );
}
