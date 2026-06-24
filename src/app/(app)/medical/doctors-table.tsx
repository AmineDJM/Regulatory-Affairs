"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { INFLUENCE_LEVEL, PRIORITY } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  institution: string;
  city: string;
  region: string;
  influenceLevel: string;
  prescriptionPotential: string;
  lastVisit: string | null;
  nextVisit: string | null;
  delegate: string;
}

export function DoctorsTable({ rows }: { rows: DoctorRow[] }) {
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
    { key: "influenceLevel", header: "Influence", sortable: true, accessor: (r) => r.influenceLevel,
      render: (r) => <StatusBadge map={INFLUENCE_LEVEL} value={r.influenceLevel} /> },
    { key: "prescriptionPotential", header: "Potentiel", sortable: true, accessor: (r) => r.prescriptionPotential,
      render: (r) => <StatusBadge map={PRIORITY} value={r.prescriptionPotential} /> },
    { key: "lastVisit", header: "Dernière visite", sortable: true, accessor: (r) => r.lastVisit ?? "",
      render: (r) => formatDate(r.lastVisit) },
    { key: "nextVisit", header: "Prochaine", sortable: true, accessor: (r) => r.nextVisit ?? "",
      render: (r) => formatDate(r.nextVisit) },
    { key: "delegate", header: "Délégué", accessor: (r) => r.delegate },
  ];
  return <DataTable rows={rows} columns={columns} filename="medecins" searchPlaceholder="Rechercher médecin, ville, spécialité…" emptyTitle="Aucun médecin" />;
}
