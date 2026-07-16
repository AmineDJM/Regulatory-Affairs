"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { PRIORITY, REGULATORY_STATUS, MANUFACTURING_STATUS, REGULATORY_CATEGORY } from "@/lib/labels";
import { formatDate, daysUntil } from "@/lib/utils";

export interface RegulatoryRow {
  id: string;
  reference: string;
  dci: string;
  brandName: string;
  dosage: string;
  form: string;
  therapeuticClass: string;
  supplier: string;
  category: string;
  manufacturingStatus: string;
  status: string;
  priority: string;
  responsible: string;
  assistant: string;
  targetDate: string | null;
  progress: number;
  stepsDone: number;
  stepsTotal: number;
}

export function RegulatoryTable({ rows }: { rows: RegulatoryRow[] }) {
  const columns: Column<RegulatoryRow>[] = [
    {
      key: "reference",
      header: "Référence",
      sortable: true,
      accessor: (r) => r.reference,
      render: (r) => <span className="font-mono text-xs font-medium">{r.reference}</span>,
    },
    {
      key: "dci",
      header: "DCI",
      sortable: true,
      accessor: (r) => r.dci,
      render: (r) => (
        <div>
          <p className="font-medium">{r.dci}</p>
          {r.brandName && <p className="text-xs text-muted-foreground">{r.brandName}</p>}
        </div>
      ),
    },
    {
      key: "dosage",
      header: "Dosage / Forme",
      accessor: (r) => `${r.dosage} ${r.form}`,
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {[r.dosage, r.form].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Catégorie",
      sortable: true,
      accessor: (r) => REGULATORY_CATEGORY[r.category]?.label ?? r.category,
      render: (r) => <StatusBadge map={REGULATORY_CATEGORY} value={r.category} dot={false} />,
    },
    {
      key: "manufacturingStatus",
      header: "Statut fab.",
      sortable: true,
      accessor: (r) => MANUFACTURING_STATUS[r.manufacturingStatus] ?? r.manufacturingStatus,
      render: (r) => <span className="text-sm">{MANUFACTURING_STATUS[r.manufacturingStatus] ?? r.manufacturingStatus}</span>,
    },
    {
      key: "supplier",
      header: "Fournisseur",
      sortable: true,
      accessor: (r) => r.supplier,
      render: (r) => <span className="text-sm">{r.supplier || "—"}</span>,
    },
    {
      key: "priority",
      header: "Priorité",
      sortable: true,
      accessor: (r) => r.priority,
      render: (r) => <StatusBadge map={PRIORITY} value={r.priority} />,
    },
    {
      key: "status",
      header: "Statut",
      sortable: true,
      accessor: (r) => REGULATORY_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={REGULATORY_STATUS} value={r.status} />,
    },
    {
      key: "responsible",
      header: "Responsable",
      accessor: (r) => r.responsible,
    },
    {
      key: "assistant",
      header: "Assistante",
      accessor: (r) => r.assistant,
    },
    {
      key: "progress",
      header: "Avancement",
      sortable: true,
      accessor: (r) => r.progress,
      render: (r) => (
        <div className="flex w-32 items-center gap-2">
          <Progress
            value={r.progress}
            tone={r.progress >= 100 ? "success" : r.progress > 0 ? "primary" : "warning"}
          />
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            {r.stepsDone}/{r.stepsTotal}
          </span>
        </div>
      ),
    },
    {
      key: "targetDate",
      header: "Date cible",
      sortable: true,
      accessor: (r) => r.targetDate ?? "",
      render: (r) => {
        if (!r.targetDate) return <span className="text-muted-foreground">—</span>;
        const d = daysUntil(r.targetDate);
        const late = d !== null && d < 0;
        return (
          <span className={late ? "text-destructive" : ""}>
            {formatDate(r.targetDate)}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      filename="regulatory"
      searchPlaceholder="Rechercher une DCI, référence, responsable…"
      getRowHref={(r) => `/regulatory/${r.id}`}
      emptyTitle="Aucun dossier réglementaire"
      emptyDescription="Les dossiers que vous créez ou qui vous sont assignés apparaîtront ici."
    />
  );
}
