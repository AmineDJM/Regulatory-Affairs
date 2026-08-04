"use client";

import * as React from "react";
import { Loader2, Check, X } from "lucide-react";
import { decideLeave } from "@/lib/actions/hr-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPE } from "@/lib/labels";
import { formatDate, cn } from "@/lib/utils";
import { LeaveEditButton } from "./leave-edit";

export interface PendingLeave {
  id: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
}

function DecideButton({
  id, decision, label, icon: IconCmp, danger,
}: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  label: string;
  icon: typeof Check;
  danger?: boolean;
}) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await decideLeave(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        disabled={saving}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50",
          danger
            ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "border-success/30 text-success hover:bg-success/10",
        )}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconCmp className="h-3.5 w-3.5" />} {label}
      </button>
    </form>
  );
}

export function LeaveApprovals({ leaves, canManage = false }: { leaves: PendingLeave[]; canManage?: boolean }) {
  if (leaves.length === 0) {
    return <EmptyState icon="CheckCheck" title="Aucune demande en attente" description="Les demandes de congés à valider apparaîtront ici." />;
  }
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Jours</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead className="text-right">Décision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.employee}</TableCell>
              <TableCell>{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
              <TableCell>{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
              <TableCell className="text-right">{l.days}</TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">{l.reason || "—"}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  <DecideButton id={l.id} decision="APPROVED" label="Approuver" icon={Check} />
                  <DecideButton id={l.id} decision="REJECTED" label="Refuser" icon={X} danger />
                  {canManage && (
                    <LeaveEditButton leave={{ id: l.id, employee: l.employee, type: l.type, startDate: l.startDate, endDate: l.endDate, days: l.days, reason: l.reason, status: "PENDING", decisionNote: null }} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
