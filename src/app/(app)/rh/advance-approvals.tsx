"use client";

import * as React from "react";
import { Loader2, Check, X } from "lucide-react";
import { decideAdvance } from "@/lib/actions/hr-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADVANCE_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export interface AdvanceRow {
  id: string;
  employee: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
}

function DecideButton({ id, decision, label, icon: IconCmp, danger }: { id: string; decision: "APPROVED" | "REJECTED"; label: string; icon: typeof Check; danger?: boolean }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await decideAdvance(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button type="submit" disabled={saving}
        className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50",
          danger ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive" : "border-success/30 text-success hover:bg-success/10")}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconCmp className="h-3.5 w-3.5" />} {label}
      </button>
    </form>
  );
}

export function AdvanceApprovals({ rows }: { rows: AdvanceRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon="Banknote" title="Aucune avance en cours" description="Les demandes d'avance sur salaire à traiter apparaîtront ici." />;
  }
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.employee}</TableCell>
              <TableCell>{formatDate(r.createdAt)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.reason || "—"}</TableCell>
              <TableCell><StatusBadge map={ADVANCE_STATUS} value={r.status} /></TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  {r.status === "PENDING" && (
                    <>
                      <DecideButton id={r.id} decision="APPROVED" label="Approuver" icon={Check} />
                      <DecideButton id={r.id} decision="REJECTED" label="Refuser" icon={X} danger />
                    </>
                  )}
                  {r.status === "APPROVED" && <Badge tone="info" dot={false}>Ordre transmis au comptable</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
