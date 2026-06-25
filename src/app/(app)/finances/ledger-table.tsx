"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { FINANCE_CATEGORY, FINANCE_METHOD, FINANCE_STATUS, FINANCE_DIRECTION } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { LedgerRow } from "@/lib/queries/finance";

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  const columns: Column<LedgerRow>[] = [
    { key: "date", header: "Date", sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: "reference", header: "Réf.", sortable: true, accessor: (r) => r.reference, render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
    { key: "label", header: "Libellé", sortable: true, accessor: (r) => r.label, render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "category", header: "Catégorie", sortable: true, accessor: (r) => FINANCE_CATEGORY[r.category] ?? r.category, render: (r) => FINANCE_CATEGORY[r.category] ?? r.category },
    { key: "direction", header: "Sens", sortable: true, accessor: (r) => r.direction, render: (r) => <StatusBadge map={FINANCE_DIRECTION} value={r.direction} dot={false} /> },
    { key: "account", header: "Compte", sortable: true, accessor: (r) => r.account },
    { key: "counterparty", header: "Tiers", accessor: (r) => r.counterparty },
    { key: "method", header: "Moyen", accessor: (r) => FINANCE_METHOD[r.method] ?? r.method },
    { key: "amount", header: "Montant", align: "right", sortable: true, accessor: (r) => r.signedAmount,
      render: (r) => (
        <span className={r.direction === "IN" ? "font-semibold text-success" : "font-semibold text-destructive"}>
          {r.direction === "IN" ? "+" : "−"} {formatCurrency(r.amount)}
        </span>
      ) },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => FINANCE_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={FINANCE_STATUS} value={r.status} /> },
  ];

  return (
    <DataTable rows={rows} columns={columns} filename="livre-comptable" pageSize={20}
      searchPlaceholder="Rechercher libellé, tiers, référence…"
      emptyTitle="Aucune écriture" emptyDescription="Ajoutez une recette ou une dépense." />
  );
}
