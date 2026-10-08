import * as React from "react";
import { cn } from "@/lib/utils";
import { pointsSparkline } from "@/lib/force-de-vente/calculs";
import type { Couleur } from "@/lib/kpi/score";

/**
 * LES PETITES PIÈCES DES KPI — la pastille colorée d'une valeur, la courbe des six dernières périodes, le score.
 * Rien ici ne lit la base : tout arrive calculé du serveur.
 */

const TON: Record<Couleur, string> = {
  ok: "bg-success/10 text-success",
  w: "bg-warning/10 text-warning",
  ko: "bg-destructive/10 text-destructive",
  m: "bg-secondary text-muted-foreground",
};

export function PastilleKpi({ couleur, children, titre, className }: { couleur: Couleur; children: React.ReactNode; titre?: string; className?: string }) {
  return (
    <span title={titre} className={cn("inline-flex min-w-[2.75rem] items-center justify-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums", TON[couleur], className)}>
      {children}
    </span>
  );
}

/** La couleur d'un score global (0..120) : vert à partir de 85, orange à partir de 65. */
export function couleurScore(score: number | null): Couleur {
  if (score === null) return "m";
  return score >= 85 ? "ok" : score >= 65 ? "w" : "ko";
}

/** La tendance : les notes des six dernières périodes (0..120), ramenées à 0..1 pour la courbe. */
export function SparklineKpi({ notes }: { notes: readonly (number | null)[] }) {
  const pts = pointsSparkline(notes.map((n) => (n === null ? null : Math.min(1, n / 120))), 80, 20, 2);
  if (!pts) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <svg width="80" height="20" viewBox="0 0 80 20" aria-hidden className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export const LIBELLE_STATUT_REVUE: Record<"SIGNEE" | "BROUILLON" | "AUCUNE", { texte: string; ton: "success" | "warning" | "neutral" }> = {
  SIGNEE: { texte: "signée", ton: "success" },
  BROUILLON: { texte: "à signer", ton: "warning" },
  AUCUNE: { texte: "à signer", ton: "neutral" },
};
