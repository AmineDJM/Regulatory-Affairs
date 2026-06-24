"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONGRESS_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface CongressNationalRow {
  id: string;
  name: string;
  city: string;
  hostInstitution: string;
  date: string | null;
  specialty: string;
  budget: number | null;
  hasBooth: boolean;
  hasSymposium: boolean;
  status: string;
}

export function CongressNationalTable({ rows }: { rows: CongressNationalRow[] }) {
  const columns: Column<CongressNationalRow>[] = [
    { key: "name", header: "Événement", sortable: true, accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "city", header: "Ville", sortable: true, accessor: (r) => r.city },
    { key: "hostInstitution", header: "Hôpital / Association", accessor: (r) => r.hostInstitution },
    { key: "date", header: "Date", sortable: true, accessor: (r) => r.date ?? "", render: (r) => formatDate(r.date) },
    { key: "specialty", header: "Spécialité", accessor: (r) => r.specialty },
    { key: "budget", header: "Budget", align: "right", sortable: true, accessor: (r) => r.budget ?? 0,
      render: (r) => (r.budget ? formatCurrency(r.budget) : "—") },
    { key: "formats", header: "Stand / Symposium", accessor: (r) => `${r.hasBooth ? "Stand" : ""} ${r.hasSymposium ? "Symposium" : ""}`,
      render: (r) => (
        <div className="flex gap-1">
          {r.hasBooth && <Badge tone="info" dot={false}>Stand</Badge>}
          {r.hasSymposium && <Badge tone="purple" dot={false}>Symposium</Badge>}
          {!r.hasBooth && !r.hasSymposium && <span className="text-muted-foreground">—</span>}
        </div>
      ) },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => CONGRESS_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={CONGRESS_STATUS} value={r.status} /> },
  ];
  return <DataTable rows={rows} columns={columns} filename="congres-nationaux" searchPlaceholder="Rechercher événement, ville…" emptyTitle="Aucun congrès national" />;
}
