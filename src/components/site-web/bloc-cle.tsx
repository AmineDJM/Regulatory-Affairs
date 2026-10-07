"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * LE BLOC À COLLER dans l'environnement du site (§118.159) — trois lignes, un bouton « Copier ».
 *
 * Pas de sélection à la souris : une clé de 64 caractères se tronque au glisser, et une clé
 * tronquée est refusée sans que rien dise pourquoi. Le bouton copie le bloc ENTIER, retour à la
 * ligne compris ; si le navigateur refuse l'accès au presse-papiers, le bloc est sélectionné pour un
 * Ctrl+C — jamais un « copié » qui ne l'est pas.
 */
export function BlocCle({ bloc, libelle = "Copier le bloc" }: { bloc: string; libelle?: string }) {
  const pre = React.useRef<HTMLPreElement>(null);
  const [etat, setEtat] = React.useState<"repos" | "copie" | "manuel">("repos");

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(bloc);
      setEtat("copie");
      window.setTimeout(() => setEtat("repos"), 4_000);
    } catch {
      const r = document.createRange();
      if (pre.current) {
        r.selectNodeContents(pre.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      setEtat("manuel");
    }
  };

  return (
    <div className="space-y-2">
      <pre
        ref={pre}
        data-testid="bloc-cle"
        className="max-w-full overflow-x-auto whitespace-pre rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {bloc}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void copier()}>
          {etat === "copie" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {etat === "copie" ? "Copié" : libelle}
        </Button>
        {etat === "manuel" && (
          <span role="status" className="text-xs text-muted-foreground">
            Le navigateur refuse la copie automatique : le bloc est sélectionné, faites Ctrl+C (ou ⌘+C).
          </span>
        )}
      </div>
    </div>
  );
}
