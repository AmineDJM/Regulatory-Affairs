"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONGRESS_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface CongressIntlRow {
  id: string;
  name: string;
  country: string;
  city: string;
  startDate: string | null;
  endDate: string | null;
  specialty: string;
  plannedBudget: number | null;
  status: string;
}

export function CongressIntlTable({ rows }: { rows: CongressIntlRow[] }) {
  const columns: Column<CongressIntlRow>[] = [
    { key: "name", header: "Congrès", sortable: true, accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "country", header: "Pays", sortable: true, accessor: (r) => r.country },
    { key: "city", header: "Ville", accessor: (r) => r.city },
    { key: "startDate", header: "Dates", sortable: true, accessor: (r) => r.startDate ?? "",
      render: (r) => (r.startDate ? `${formatDate(r.startDate)}${r.endDate ? " → " + formatDate(r.endDate) : ""}` : "—") },
    { key: "specialty", header: "Spécialité", accessor: (r) => r.specialty },
    { key: "plannedBudget", header: "Budget prévu", align: "right", sortable: true, accessor: (r) => r.plannedBudget ?? 0,
      render: (r) => (r.plannedBudget ? formatCurrency(r.plannedBudget) : "—") },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => CONGRESS_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={CONGRESS_STATUS} value={r.status} /> },
  ];
  return <DataTable rows={rows} columns={columns} filename="congres-internationaux" searchPlaceholder="Rechercher congrès, pays…" emptyTitle="Aucun congrès international" />;
}
