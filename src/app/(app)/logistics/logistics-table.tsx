"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LOGISTICS_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, formatNumber, daysUntil } from "@/lib/utils";

export interface LogisticsRow {
  id: string;
  reference: string;
  product: string;
  dci: string;
  supplier: string;
  country: string;
  quantityOrdered: number;
  status: string;
  estimatedArrival: string | null;
  actualArrival: string | null;
  orderValue: number | null;
  currency: string;
}

export function LogisticsTable({ rows }: { rows: LogisticsRow[] }) {
  const columns: Column<LogisticsRow>[] = [
    { key: "reference", header: "Réf.", sortable: true, accessor: (r) => r.reference,
      render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
    { key: "product", header: "Produit", sortable: true, accessor: (r) => r.product,
      render: (r) => (
        <div>
          <p className="font-medium">{r.product}</p>
          {r.dci && <p className="text-xs text-muted-foreground">{r.dci}</p>}
        </div>
      ) },
    { key: "supplier", header: "Fournisseur", sortable: true, accessor: (r) => r.supplier },
    { key: "country", header: "Pays", accessor: (r) => r.country },
    { key: "quantityOrdered", header: "Qté", align: "right", sortable: true, accessor: (r) => r.quantityOrdered,
      render: (r) => formatNumber(r.quantityOrdered) },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => LOGISTICS_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={LOGISTICS_STATUS} value={r.status} /> },
    { key: "estimatedArrival", header: "Arrivée estimée", sortable: true, accessor: (r) => r.estimatedArrival ?? "",
      render: (r) => {
        if (!r.actualArrival && r.estimatedArrival) {
          const d = daysUntil(r.estimatedArrival);
          const late = d !== null && d < 0 && r.status !== "DELIVERED";
          return <span className={late ? "font-medium text-destructive" : ""}>{formatDate(r.estimatedArrival)}</span>;
        }
        return formatDate(r.actualArrival ?? r.estimatedArrival);
      } },
    { key: "orderValue", header: "Valeur", align: "right", sortable: true, accessor: (r) => r.orderValue ?? 0,
      render: (r) => (r.orderValue ? formatCurrency(r.orderValue, r.currency) : "—") },
  ];

  return (
    <DataTable rows={rows} columns={columns} filename="logistique-pch" searchPlaceholder="Rechercher produit, fournisseur, réf…"
      getRowHref={(r) => `/logistics/${r.id}`} emptyTitle="Aucune commande PCH" />
  );
}
