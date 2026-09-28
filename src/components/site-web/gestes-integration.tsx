"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlugZap, RefreshCw, RotateCcw, ShieldOff } from "lucide-react";
import {
  leverBlocageSite, rapprocherSiteMaintenant, relancerEnvoiSite, verifierConnexionSite,
} from "@/lib/actions/site-web-actions";
import type { ActionResult } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";

/**
 * LES GESTES D'EXPLOITATION DE L'INTÉGRATION (§118.158) — vérifier la connexion, rapprocher,
 * lever le blocage, relancer un envoi. Chaque geste dit ce qui s'est RÉELLEMENT passé : la phrase
 * vient de l'action serveur, jamais d'un « OK » écrit ici. L'écran ne montre que les boutons que la
 * règle permet (`lib/site-web/acces.ts`) ; l'action la revérifie.
 */
type Geste = "verifier" | "rapprocher" | "lever" | "relancer";

const LIBELLE: Record<Geste, string> = {
  verifier: "Vérifier la connexion",
  rapprocher: "Rapprocher maintenant",
  lever: "Lever le blocage",
  relancer: "Relancer",
};

function Icone({ geste }: { geste: Geste }) {
  if (geste === "verifier") return <PlugZap className="h-4 w-4" />;
  if (geste === "rapprocher") return <RefreshCw className="h-4 w-4" />;
  if (geste === "lever") return <ShieldOff className="h-4 w-4" />;
  return <RotateCcw className="h-4 w-4" />;
}

export function GesteIntegration({
  geste, publicationId, taille = "sm", variante = "outline",
}: {
  geste: Geste;
  publicationId?: string;
  taille?: "sm" | "md";
  variante?: "outline" | "primary" | "ghost";
}) {
  const router = useRouter();
  const [enCours, setEnCours] = React.useState(false);
  const [retour, setRetour] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const agir = async () => {
    if (geste === "lever" && !window.confirm(
      "Lever le blocage ?\n\nLes envois reprennent immédiatement. Si le site refuse toujours la clé, le blocage se reposera au premier envoi — mieux vaut d'abord « Vérifier la connexion ».",
    )) return;
    setEnCours(true); setRetour(null);
    let r: ActionResult;
    try {
      if (geste === "verifier") r = await verifierConnexionSite();
      else if (geste === "rapprocher") r = await rapprocherSiteMaintenant();
      else if (geste === "lever") r = await leverBlocageSite();
      else {
        const fd = new FormData();
        fd.set("publicationId", publicationId ?? "");
        r = await relancerEnvoiSite(fd);
      }
    } catch {
      r = { ok: false, error: "Le serveur n'a pas répondu. Rechargez la page avant de recommencer : le geste a peut-être eu lieu." };
    }
    setEnCours(false);
    setRetour(r.ok ? { ok: true, texte: r.message ?? "Fait." } : { ok: false, texte: r.error ?? "Action impossible." });
    router.refresh();
  };

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <Button size={taille} variant={variante} onClick={() => void agir()} disabled={enCours}>
        {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icone geste={geste} />}
        {LIBELLE[geste]}
      </Button>
      {retour && (
        <span role={retour.ok ? "status" : "alert"} className={retour.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {retour.texte}
        </span>
      )}
    </span>
  );
}
