"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { AUDIT_ACTION } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

export interface AuditRow {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  module: string;
  summary: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const columns: Column<AuditRow>[] = [
    { key: "createdAt", header: "Date / Heure", sortable: true, accessor: (r) => r.createdAt, render: (r) => formatDateTime(r.createdAt) },
    { key: "actor", header: "Utilisateur", sortable: true, accessor: (r) => r.actor },
    { key: "action", header: "Action", sortable: true, accessor: (r) => AUDIT_ACTION[r.action]?.label ?? r.action,
      render: (r) => <StatusBadge map={AUDIT_ACTION} value={r.action} dot={false} /> },
    { key: "module", header: "Module", sortable: true, accessor: (r) => r.module },
    { key: "summary", header: "Détail", accessor: (r) => r.summary },
    { key: "change", header: "Changement", accessor: (r) => (r.field ? `${r.field}: ${r.oldValue} → ${r.newValue}` : ""),
      render: (r) => r.field ? (
        <span className="text-xs text-muted-foreground">
          <span className="font-medium">{r.field}</span>: {r.oldValue || "∅"} → {r.newValue || "∅"}
        </span>
      ) : <span className="text-muted-foreground">—</span> },
  ];

  return (
    <DataTable rows={rows} columns={columns} filename="audit-log" searchPlaceholder="Rechercher dans le journal…" emptyTitle="Aucune activité enregistrée" pageSize={15} />
  );
}
