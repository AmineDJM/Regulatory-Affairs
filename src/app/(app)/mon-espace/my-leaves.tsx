"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cancelLeave } from "@/lib/actions/hr-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPE, LEAVE_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface LeaveItem {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}

function CancelButton({ id }: { id: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await cancelLeave(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler
      </button>
    </form>
  );
}

export function MyLeaves({ leaves }: { leaves: LeaveItem[] }) {
  if (leaves.length === 0) {
    return <EmptyState icon="Plane" title="Aucune demande de congé" description="Vos demandes apparaîtront ici." />;
  }
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Jours</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
              <TableCell>{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
              <TableCell className="text-right">{l.days}</TableCell>
              <TableCell><StatusBadge map={LEAVE_STATUS} value={l.status} /></TableCell>
              <TableCell className="text-right">{l.status === "PENDING" ? <CancelButton id={l.id} /> : <span className="text-muted-foreground">—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
