"use client";

import * as React from "react";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { cn, formatMontant } from "@/lib/utils";

/** Ce que partagent les vues de la campagne : le lanceur d'actions, les cellules, les classes. */

export type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>;

export function useActions() {
  const { enCours, rafraichir } = useRafraichir();
  const [occupe, setOccupe] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);
  const run = React.useCallback(async (action: Action, champs: Record<string, string | string[] | File[] | null | undefined>): Promise<{ ok: boolean; message?: string }> => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(champs)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) for (const x of v) fd.append(k, x);
      else fd.set(k, v);
    }
    setOccupe(true);
    setInfo(null);
    const r = await action(fd);
    setOccupe(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return { ok: false }; }
    if (r.message) setInfo(r.message);
    rafraichir();
    return { ok: true, message: r.message };
  }, [rafraichir]);
  return { run, busy: occupe || enCours, info, setInfo };
}

export const th = "whitespace-nowrap border-b border-border bg-secondary/50 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground";
export const td = "whitespace-nowrap border-b border-border px-2.5 py-2 align-top text-sm";
export const num = "text-right tabular-nums";
export const btn = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60";
export const btnPrimaire = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60";
export const champ = "h-9 max-w-full rounded-lg border border-input bg-background px-2 text-sm";

export const m = (n: number | null | undefined) => formatMontant(n ?? 0);

export function Ecart({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">nouveau</span>;
  const ton = Math.abs(pct) > 15 ? "text-destructive" : Math.abs(pct) > 5 ? "text-warning" : "";
  return <span className={cn("tabular-nums", ton)}>{pct > 0 ? "+" : ""}{String(pct).replace(".", ",")} %</span>;
}

/** La barre « demandé / cadrage » — rouge au-delà du cadrage. */
export function BarreCadrage({ demande, cadrage }: { demande: number; cadrage: number | null | undefined }) {
  if (!cadrage || cadrage <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.min(100, Math.round((demande / cadrage) * 100));
  const depasse = demande > cadrage;
  return (
    <div className="h-2 min-w-20 overflow-hidden rounded-full bg-secondary" title={`${m(demande)} / ${m(cadrage)}`}>
      <div className={cn("h-full", depasse ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}
