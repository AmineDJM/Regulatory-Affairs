import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * UNE TUILE DE CHIFFRE — l'intitulé, le chiffre, une ligne de contexte. Rien d'autre : l'explication, si elle est
 * nécessaire, vit derrière un ⓘ (`info`, un `<InfoBulle>` passé par l'écran).
 */
const TON = { defaut: "", ok: "text-success", alerte: "text-warning", danger: "text-destructive" } as const;

export function Tuile({ label, valeur, contexte, ton = "defaut", info, className }: {
  label: string;
  valeur: React.ReactNode;
  contexte?: React.ReactNode;
  ton?: keyof typeof TON;
  info?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface min-w-0 p-3 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-1">
        <span className="min-w-0 text-xs text-muted-foreground sm:text-sm">{label}</span>
        {info}
      </div>
      <p className={cn("mt-1 break-words text-xl font-semibold tabular-nums tracking-tight sm:text-2xl", TON[ton])}>{valeur}</p>
      {contexte && <p className="mt-0.5 text-xs text-muted-foreground">{contexte}</p>}
    </div>
  );
}
