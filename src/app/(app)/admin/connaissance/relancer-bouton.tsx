"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { relancerBoiteMorte } from "@/lib/actions/knowledge-actions";

/**
 * « RELANCER » — un groupe de la boîte morte (sa clé), ou toute la boîte (`cle` absente).
 *
 * L'écran ne transmet que la CLÉ du groupe : l'action recalcule les travaux depuis la base, et
 * n'agit que sur ceux qui sont encore morts. Le résultat se DIT ici (combien, et ce qu'il reste) —
 * un bouton qui ne répond rien laisse croire que rien ne s'est passé, et invite au second clic.
 */
export function RelancerBouton({ cle, libelle, nombre }: { cle?: string; libelle: string; nombre: number }) {
  const { enCours, rafraichir } = useRafraichir();
  const [pending, start] = React.useTransition();
  const [retour, setRetour] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const relancer = () => {
    setRetour(null);
    start(async () => {
      const fd = new FormData();
      if (cle) fd.set("cle", cle);
      const r = await relancerBoiteMorte(fd);
      setRetour({ ok: r.ok, texte: r.ok ? (r.message ?? "Relancé.") : (r.error ?? "Relance impossible.") });
      if (r.ok) rafraichir();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={relancer}
        disabled={pending || enCours || nombre === 0}
        aria-label={cle ? `${libelle} — ${nombre} travaux` : libelle}
      >
        <RotateCcw className="h-3.5 w-3.5" /> {libelle}
      </Button>
      {retour ? (
        <p role="status" className={retour.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {retour.texte}
        </p>
      ) : null}
    </div>
  );
}
