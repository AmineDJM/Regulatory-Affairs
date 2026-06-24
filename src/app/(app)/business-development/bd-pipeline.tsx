"use client";

import * as React from "react";
import { MoveRight, Loader2 } from "lucide-react";
import { updateBDStatus } from "@/lib/actions/bd-actions";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { BD_STATUS, BD_TYPE, PRIORITY } from "@/lib/labels";
import type { BDRow } from "./bd-table";

const STAGES = ["IDEA", "RESEARCH", "CONTACTED", "NDA", "OFFER_RECEIVED", "NEGOTIATION", "VALIDATED", "ABANDONED"];

export function BDPipeline({ rows, canUpdate }: { rows: BDRow[]; canUpdate: boolean }) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function move(id: string, current: string) {
    const idx = STAGES.indexOf(current);
    const next = STAGES[Math.min(idx + 1, STAGES.length - 2)]; // don't auto-advance into ABANDONED
    if (next === current) return;
    setPendingId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", next);
    await updateBDStatus(fd);
    setPendingId(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((stage) => {
        const items = rows.filter((r) => r.status === stage);
        return (
          <div key={stage} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <StatusBadge map={BD_STATUS} value={stage} dot={false} />
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 rounded-xl bg-muted/40 p-2">
              {items.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">—</p>}
              {items.map((r) => (
                <div key={r.id} className="surface space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{r.name}</p>
                    <StatusBadge map={PRIORITY} value={r.priority} dot={false} />
                  </div>
                  <p className="text-xs text-muted-foreground">{BD_TYPE[r.type] ?? r.type}</p>
                  {r.score != null && (
                    <Badge tone="info" dot={false}>Score {r.score}/100</Badge>
                  )}
                  {r.nextAction && <p className="text-xs text-muted-foreground">→ {r.nextAction}</p>}
                  {canUpdate && stage !== "VALIDATED" && stage !== "ABANDONED" && (
                    <button
                      onClick={() => move(r.id, stage)}
                      disabled={pendingId === r.id}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-secondary"
                    >
                      {pendingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoveRight className="h-3 w-3" />}
                      Étape suivante
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
