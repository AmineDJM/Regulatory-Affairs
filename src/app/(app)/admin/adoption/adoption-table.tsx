"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime, cn } from "@/lib/utils";
import type { AdoptionScore } from "@/lib/adoption";

const TONE_TEXT: Record<AdoptionScore["tone"], string> = {
  success: "text-success", info: "text-sky-600", warning: "text-warning", danger: "text-destructive", neutral: "text-muted-foreground",
};
const TONE_BAR: Record<AdoptionScore["tone"], string> = {
  success: "bg-success", info: "bg-sky-500", warning: "bg-warning", danger: "bg-destructive", neutral: "bg-muted-foreground",
};
const badgeTone: Record<AdoptionScore["tone"], React.ComponentProps<typeof Badge>["tone"]> = {
  success: "success", info: "info", warning: "warning", danger: "danger", neutral: "neutral",
};

export function AdoptionTable({ scores }: { scores: AdoptionScore[] }) {
  const [open, setOpen] = React.useState<string | null>(null);

  if (scores.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun utilisateur à évaluer.</p>;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {scores.map((s, i) => {
        const expanded = open === s.userId;
        return (
          <div key={s.userId} className={cn(!s.isActive && "opacity-60")}>
            <button
              onClick={() => setOpen(expanded ? null : s.userId)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 sm:px-4"
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <Avatar name={s.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[s.role] ?? s.role}</p>
              </div>

              {/* Tendance (jours actifs vs période précédente) */}
              <span className="hidden w-16 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
                {s.trend > 0 ? <><TrendingUp className="h-3.5 w-3.5 text-success" />+{s.trend}</>
                  : s.trend < 0 ? <><TrendingDown className="h-3.5 w-3.5 text-destructive" />{s.trend}</>
                  : <><Minus className="h-3.5 w-3.5" />0</>}
              </span>

              {/* Barre + score */}
              <div className="hidden w-40 items-center gap-2 md:flex">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-full", TONE_BAR[s.tone])} style={{ width: `${s.score}%` }} />
                </div>
              </div>
              <span className={cn("w-10 shrink-0 text-right text-lg font-bold tabular-nums", TONE_TEXT[s.tone])}>{s.score}</span>
              {/* Évolution du score (vs semaine précédente) — monte ET descend */}
              <span className="hidden w-12 shrink-0 items-center justify-center gap-0.5 text-xs font-medium tabular-nums sm:flex" title="Évolution du score sur 7 jours">
                {s.scoreTrend > 0 ? <span className="flex items-center gap-0.5 text-success"><TrendingUp className="h-3.5 w-3.5" />+{s.scoreTrend}</span>
                  : s.scoreTrend < 0 ? <span className="flex items-center gap-0.5 text-destructive"><TrendingDown className="h-3.5 w-3.5" />{s.scoreTrend}</span>
                  : <span className="flex items-center gap-0.5 text-muted-foreground"><Minus className="h-3.5 w-3.5" /></span>}
              </span>
              <Badge tone={badgeTone[s.tone]} dot={false} className="hidden w-24 justify-center lg:flex">{s.label}</Badge>
              {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>

            {expanded && (
              <div className="space-y-3 border-t border-border bg-secondary/20 px-4 py-3">
                <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {s.components.map((c) => (
                    <div key={c.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{c.label} <span className="text-muted-foreground">· pds {c.weight}</span></span>
                        <span className="tabular-nums text-muted-foreground">{c.score}/100</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className={cn("h-full", c.score >= 67 ? "bg-success" : c.score >= 34 ? "bg-warning" : "bg-destructive")} style={{ width: `${c.score}%` }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Dernière présence : {s.lastSeen ? formatDateTime(s.lastSeen) : "jamais"} · {s.activeDays} jour·s actif·s sur 30.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
