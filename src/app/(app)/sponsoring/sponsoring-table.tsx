"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SPONSORING_STATUS, PRIORITY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface SponsoringRow {
  id: string;
  reference: string;
  requestDate: string;
  institution: string;
  doctor: string;
  type: string;
  city: string;
  amountRequested: number | null;
  amountGranted: number | null;
  strategicImportance: string;
  status: string;
  requester: string;
}

export function SponsoringTable({ rows }: { rows: SponsoringRow[] }) {
  const columns: Column<SponsoringRow>[] = [
    { key: "reference", header: "Réf.", sortable: true, accessor: (r) => r.reference,
      render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
    { key: "requestDate", header: "Date", sortable: true, accessor: (r) => r.requestDate,
      render: (r) => formatDate(r.requestDate) },
    { key: "institution", header: "Institution", sortable: true, accessor: (r) => r.institution,
      render: (r) => (
        <div>
          <p className="font-medium">{r.institution}</p>
          {r.doctor && <p className="text-xs text-muted-foreground">{r.doctor}</p>}
        </div>
      ) },
    { key: "type", header: "Type", accessor: (r) => r.type },
    { key: "city", header: "Ville", accessor: (r) => r.city },
    { key: "amountRequested", header: "Demandé", align: "right", sortable: true,
      accessor: (r) => r.amountRequested ?? 0, render: (r) => formatCurrency(r.amountRequested) },
    { key: "amountGranted", header: "Accordé", align: "right", sortable: true,
      accessor: (r) => r.amountGranted ?? 0, render: (r) => formatCurrency(r.amountGranted) },
    { key: "strategicImportance", header: "Importance", sortable: true, accessor: (r) => r.strategicImportance,
      render: (r) => <StatusBadge map={PRIORITY} value={r.strategicImportance} /> },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => SPONSORING_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={SPONSORING_STATUS} value={r.status} /> },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      filename="sponsoring"
      searchPlaceholder="Rechercher institution, médecin, produit…"
      getRowHref={(r) => `/sponsoring/${r.id}`}
      emptyTitle="Aucune demande de sponsoring"
    />
  );
}
