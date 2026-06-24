"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { VISIT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface VisitRow {
  id: string;
  date: string;
  doctor: string;
  delegate: string;
  region: string;
  objective: string;
  presentedProducts: string;
  status: string;
}

export function VisitsTable({ rows }: { rows: VisitRow[] }) {
  const columns: Column<VisitRow>[] = [
    { key: "date", header: "Date", sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: "doctor", header: "Médecin", sortable: true, accessor: (r) => r.doctor, render: (r) => <span className="font-medium">{r.doctor}</span> },
    { key: "delegate", header: "Délégué", sortable: true, accessor: (r) => r.delegate },
    { key: "region", header: "Région", accessor: (r) => r.region },
    { key: "objective", header: "Objectif", accessor: (r) => r.objective },
    { key: "presentedProducts", header: "Produits", accessor: (r) => r.presentedProducts },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => VISIT_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={VISIT_STATUS} value={r.status} /> },
  ];
  return <DataTable rows={rows} columns={columns} filename="visites" searchPlaceholder="Rechercher médecin, région…" emptyTitle="Aucune visite planifiée" />;
}
