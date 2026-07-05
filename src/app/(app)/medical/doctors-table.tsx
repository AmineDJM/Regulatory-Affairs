"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { deleteDoctor } from "@/lib/actions/medical-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { SEGMENT_LEVEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  institution: string;
  city: string;
  region: string;
  influence: string;
  potential: string;
  affinity: string;
  lastVisit: string | null;
  nextVisit: string | null;
  delegate: string;
}

function DeleteDoctorButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      title="Supprimer le médecin"
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={(e) => {
        e.stopPropagation();
        if (!window.confirm(`Supprimer « ${name} » de l'annuaire ? Ses visites seront supprimées.`)) return;
        const fd = new FormData(); fd.set("id", id);
        start(async () => { const r = await deleteDoctor(fd); if (!r.ok) alert(r.error); router.refresh(); });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function DoctorsTable({ rows, canDelete = false }: { rows: DoctorRow[]; canDelete?: boolean }) {
  const columns: Column<DoctorRow>[] = [
    { key: "name", header: "Médecin", sortable: true, accessor: (r) => r.name,
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          {r.specialty && <p className="text-xs text-muted-foreground">{r.specialty}</p>}
        </div>
      ) },
    { key: "institution", header: "Établissement", accessor: (r) => r.institution },
    { key: "city", header: "Ville", sortable: true, accessor: (r) => r.city },
    { key: "region", header: "Région", sortable: true, accessor: (r) => r.region },
    { key: "influence", header: "Influence", sortable: true, accessor: (r) => r.influence,
      render: (r) => <StatusBadge map={SEGMENT_LEVEL} value={r.influence} /> },
    { key: "potential", header: "Potentiel", sortable: true, accessor: (r) => r.potential,
      render: (r) => <StatusBadge map={SEGMENT_LEVEL} value={r.potential} /> },
    { key: "affinity", header: "Affinité", sortable: true, accessor: (r) => r.affinity,
      render: (r) => <StatusBadge map={SEGMENT_LEVEL} value={r.affinity} /> },
    { key: "lastVisit", header: "Dernière visite", sortable: true, accessor: (r) => r.lastVisit ?? "",
      render: (r) => formatDate(r.lastVisit) },
    { key: "nextVisit", header: "Prochaine", sortable: true, accessor: (r) => r.nextVisit ?? "",
      render: (r) => formatDate(r.nextVisit) },
    { key: "delegate", header: "Délégué", accessor: (r) => r.delegate },
  ];
  if (canDelete) {
    columns.push({ key: "actions", header: "", accessor: () => "", render: (r) => <DeleteDoctorButton id={r.id} name={r.name} /> });
  }
  return <DataTable rows={rows} columns={columns} filename="medecins" searchPlaceholder="Rechercher médecin, ville, spécialité…" emptyTitle="Aucun médecin" />;
}
