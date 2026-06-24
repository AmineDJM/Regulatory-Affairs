"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { BUDGET_CATEGORY, BUDGET_STATUS } from "@/lib/labels";
import { formatCurrency, percent } from "@/lib/utils";

export interface BudgetRow {
  id: string;
  year: number;
  month: number | null;
  department: string;
  label: string;
  initial: number;
  consumed: number;
  remaining: number;
  future: number;
  status: string;
}

const MONTHS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function BudgetsTable({ rows }: { rows: BudgetRow[] }) {
  const columns: Column<BudgetRow>[] = [
    { key: "year", header: "Année", sortable: true, accessor: (r) => r.year },
    { key: "month", header: "Mois", accessor: (r) => (r.month ? MONTHS[r.month] : "Annuel") },
    { key: "department", header: "Département", sortable: true, accessor: (r) => BUDGET_CATEGORY[r.department] ?? r.department,
      render: (r) => BUDGET_CATEGORY[r.department] ?? r.department },
    { key: "label", header: "Ligne budgétaire", sortable: true, accessor: (r) => r.label,
      render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "initial", header: "Initial", align: "right", sortable: true, accessor: (r) => r.initial,
      render: (r) => formatCurrency(r.initial) },
    { key: "consumed", header: "Consommé", align: "right", sortable: true, accessor: (r) => r.consumed,
      render: (r) => formatCurrency(r.consumed) },
    { key: "remaining", header: "Restant", align: "right", sortable: true, accessor: (r) => r.remaining,
      render: (r) => (
        <span className={r.remaining < 0 ? "font-medium text-destructive" : ""}>{formatCurrency(r.remaining)}</span>
      ) },
    { key: "usage", header: "Consommation", accessor: (r) => percent(r.consumed, r.initial),
      render: (r) => {
        const p = percent(r.consumed, r.initial);
        return (
          <div className="flex w-28 items-center gap-2">
            <Progress value={p} tone={p > 100 ? "danger" : p > 80 ? "warning" : "success"} />
            <span className="w-9 text-xs text-muted-foreground">{p}%</span>
          </div>
        );
      } },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => BUDGET_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={BUDGET_STATUS} value={r.status} /> },
  ];

  return (
    <DataTable rows={rows} columns={columns} filename="budgets" searchPlaceholder="Rechercher une ligne, un département…" emptyTitle="Aucune ligne budgétaire" />
  );
}
