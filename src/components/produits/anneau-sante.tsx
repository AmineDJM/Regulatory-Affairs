"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { tonSante, type DetailComposante } from "@/lib/products/sante";

const COULEUR = { success: "hsl(var(--success))", warning: "hsl(var(--warning))", danger: "hsl(var(--destructive))", neutral: "hsl(var(--muted-foreground))" } as const;
const TEXTE = { success: "text-success", warning: "text-warning", danger: "text-destructive", neutral: "text-muted-foreground" } as const;

/**
 * L'ANNEAU DE SANTÉ — la note sur 100 d'un produit ; un clic ouvre le détail des cinq composantes (note, poids, le fait
 * qui la porte, la règle). Une composante sans donnée est « n/d » : exclue, ses poids renormalisés. Échap ou un clic
 * ailleurs referme. N'importe que le module PUR `products/sante.ts`.
 */
export function AnneauSante({ score, composantes, taille = "lg" }: { score: number | null; composantes: DetailComposante[]; taille?: "lg" | "sm" }) {
  const [ouvert, setOuvert] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", ailleurs);
    document.addEventListener("touchstart", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", ailleurs);
      document.removeEventListener("touchstart", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const ton = tonSante(score);
  const pct = score ?? 0;
  const grand = taille === "lg";
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        aria-label={score === null ? "Santé du produit : non disponible — voir le détail" : `Santé du produit : ${score} sur 100 — voir le détail`}
        className={cn("flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105", grand ? "h-[74px] w-[74px]" : "h-9 w-9")}
        style={{ background: `conic-gradient(${COULEUR[ton]} 0 ${pct}%, hsl(var(--muted)) ${pct}% 100%)` }}
      >
        <span className={cn("flex items-center justify-center rounded-full bg-card font-bold tabular-nums", grand ? "h-[58px] w-[58px] text-lg" : "h-7 w-7 text-[11px]", TEXTE[ton])}>
          {score ?? "n/d"}
        </span>
      </button>
      {ouvert && (
        <span role="dialog" aria-label="Détail de la note de santé"
          className="absolute right-0 top-full z-30 mt-2 block w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-foreground shadow-lg">
          <span className="mb-2 block text-sm font-semibold">Santé {score === null ? "n/d" : `${score} / 100`}</span>
          <span className="block divide-y divide-border">
            {composantes.map((c) => (
              <span key={c.cle} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5">
                <span className="min-w-0">
                  <b className="font-medium">{c.libelle}</b>
                  <span className="text-muted-foreground"> · poids {c.poids}{c.poidsEffectif !== null && c.poidsEffectif !== c.poids ? ` → ${c.poidsEffectif} %` : ""}</span>
                  <span className="block text-muted-foreground">{c.fait ?? c.regle}</span>
                </span>
                <span className={cn("self-center text-sm font-semibold tabular-nums", c.note === null ? "text-muted-foreground" : TEXTE[tonSante(c.note)])}>{c.note ?? "n/d"}</span>
              </span>
            ))}
          </span>
          <span className="mt-2 block text-muted-foreground">Une composante sans donnée est exclue ; les poids restants sont renormalisés.</span>
        </span>
      )}
    </span>
  );
}
