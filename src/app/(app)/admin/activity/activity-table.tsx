"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { BadgeTone } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

const TYPE: Record<string, { label: string; tone: BadgeTone }> = {
  PAGE_VIEW: { label: "Page vue", tone: "info" },
  LOGIN: { label: "Connexion", tone: "success" },
  LOGOUT: { label: "Déconnexion", tone: "neutral" },
};

export interface ActivityRow {
  id: string;
  user: string;
  type: string;
  path: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  lat: number | null;
  lng: number | null;
  ip: string;
  duration: string;
  durationValue: number;
  createdAt: string;
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const columns: Column<ActivityRow>[] = [
    { key: "createdAt", header: "Date / Heure", sortable: true, accessor: (r) => r.createdAt, render: (r) => formatDateTime(r.createdAt) },
    { key: "user", header: "Utilisateur", sortable: true, accessor: (r) => r.user },
    { key: "type", header: "Type", sortable: true, accessor: (r) => TYPE[r.type]?.label ?? r.type, render: (r) => <StatusBadge map={TYPE} value={r.type} dot={false} /> },
    { key: "path", header: "Page", accessor: (r) => r.path, render: (r) => <span className="font-mono text-xs">{r.path || "—"}</span> },
    { key: "duration", header: "Temps", align: "right", sortable: true, accessor: (r) => r.durationValue, render: (r) => r.duration },
    { key: "device", header: "Appareil", sortable: true, accessor: (r) => r.device },
    { key: "browser", header: "Navigateur", accessor: (r) => `${r.browser} · ${r.os}` },
    {
      key: "location", header: "Localisation", accessor: (r) => r.location,
      render: (r) =>
        r.lat != null && r.lng != null ? (
          <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {r.location} ↗
          </a>
        ) : (
          <span>{r.location || "—"}</span>
        ),
    },
    { key: "ip", header: "IP", accessor: (r) => r.ip },
  ];
  return (
    <DataTable rows={rows} columns={columns} filename="activite" pageSize={20}
      searchPlaceholder="Rechercher utilisateur, page, appareil, localisation…"
      emptyTitle="Aucune activité enregistrée"
      emptyDescription="Les connexions et pages visitées apparaîtront ici." />
  );
}
