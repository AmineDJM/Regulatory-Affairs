"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { PAYMENT_STATUS, DELIVERY_STATUS, SALE_TYPE } from "@/lib/labels";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export interface SaleRow {
  id: string;
  date: string;
  saleType: string;
  product: string;
  dci: string;
  client: string;
  institution: string;
  isPch: boolean;
  quantity: number;
  unitPrice: number;
  revenue: number;
  paymentStatus: string;
  deliveryStatus: string;
  salesUser: string;
}

export function SalesTable({ rows }: { rows: SaleRow[] }) {
  const columns: Column<SaleRow>[] = [
    { key: "date", header: "Date", sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: "saleType", header: "Nature", sortable: true, accessor: (r) => SALE_TYPE[r.saleType]?.label ?? r.saleType,
      render: (r) => <StatusBadge map={SALE_TYPE} value={r.saleType} dot={false} /> },
    { key: "product", header: "Désignation", sortable: true, accessor: (r) => r.product,
      render: (r) => (
        <div>
          <p className="font-medium">{r.product}</p>
          {r.dci && <p className="text-xs text-muted-foreground">{r.dci}</p>}
        </div>
      ) },
    { key: "client", header: "Client", sortable: true, accessor: (r) => r.client,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          {r.client}
          {r.isPch && <Badge tone="info" dot={false}>PCH</Badge>}
        </span>
      ) },
    { key: "quantity", header: "Qté", align: "right", sortable: true, accessor: (r) => r.quantity,
      render: (r) => formatNumber(r.quantity) },
    { key: "unitPrice", header: "PU", align: "right", sortable: true, accessor: (r) => r.unitPrice,
      render: (r) => formatCurrency(r.unitPrice) },
    { key: "revenue", header: "CA", align: "right", sortable: true, accessor: (r) => r.revenue,
      render: (r) => <span className="font-medium">{formatCurrency(r.revenue)}</span> },
    { key: "paymentStatus", header: "Paiement", sortable: true, accessor: (r) => PAYMENT_STATUS[r.paymentStatus]?.label ?? r.paymentStatus,
      render: (r) => <StatusBadge map={PAYMENT_STATUS} value={r.paymentStatus} /> },
    { key: "deliveryStatus", header: "Livraison", sortable: true, accessor: (r) => DELIVERY_STATUS[r.deliveryStatus]?.label ?? r.deliveryStatus,
      render: (r) => <StatusBadge map={DELIVERY_STATUS} value={r.deliveryStatus} /> },
    { key: "salesUser", header: "Commercial", accessor: (r) => r.salesUser },
  ];

  return (
    <DataTable rows={rows} columns={columns} filename="ventes" searchPlaceholder="Rechercher produit, client…" emptyTitle="Aucune vente enregistrée" pageSize={15} />
  );
}
