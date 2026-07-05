"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { deleteVisit } from "@/lib/actions/medical-actions";
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

function DeleteVisitButton({ id, doctor }: { id: string; doctor: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      title="Supprimer la visite"
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={(e) => {
        e.stopPropagation();
        if (!window.confirm(`Supprimer la visite chez ${doctor} ?`)) return;
        const fd = new FormData(); fd.set("id", id);
        start(async () => { const r = await deleteVisit(fd); if (!r.ok) alert(r.error); router.refresh(); });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function VisitsTable({ rows, canDelete = false }: { rows: VisitRow[]; canDelete?: boolean }) {
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
  if (canDelete) {
    columns.push({ key: "actions", header: "", accessor: () => "", render: (r) => <DeleteVisitButton id={r.id} doctor={r.doctor} /> });
  }
  return <DataTable rows={rows} columns={columns} filename="visites" searchPlaceholder="Rechercher médecin, région…" emptyTitle="Aucune visite planifiée" />;
}
