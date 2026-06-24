"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY, ENTITY_TYPE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface DocumentRow {
  id: string;
  name: string;
  category: string;
  entityType: string;
  confidentiality: string;
  version: number;
  sizeKb: number;
  uploadedBy: string;
  createdAt: string;
  hasFile: boolean;
}

export function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  const [moduleFilter, setModuleFilter] = React.useState("");

  const filtered = moduleFilter ? rows.filter((r) => r.entityType === moduleFilter) : rows;

  const moduleOptions = Array.from(new Set(rows.map((r) => r.entityType)));

  const columns: Column<DocumentRow>[] = [
    { key: "name", header: "Document", sortable: true, accessor: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{r.name}</span>
        </span>
      ) },
    { key: "category", header: "Catégorie", sortable: true, accessor: (r) => DOCUMENT_CATEGORY[r.category] ?? r.category,
      render: (r) => DOCUMENT_CATEGORY[r.category] ?? r.category },
    { key: "entityType", header: "Module", sortable: true, accessor: (r) => ENTITY_TYPE_LABELS[r.entityType] ?? r.entityType,
      render: (r) => ENTITY_TYPE_LABELS[r.entityType] ?? r.entityType },
    { key: "confidentiality", header: "Confidentialité", accessor: (r) => r.confidentiality,
      render: (r) => <StatusBadge map={CONFIDENTIALITY} value={r.confidentiality} dot={false} /> },
    { key: "version", header: "Version", align: "center", accessor: (r) => r.version, render: (r) => `v${r.version}` },
    { key: "sizeKb", header: "Taille", align: "right", sortable: true, accessor: (r) => r.sizeKb,
      render: (r) => (r.sizeKb ? `${r.sizeKb} Ko` : "—") },
    { key: "uploadedBy", header: "Par", accessor: (r) => r.uploadedBy },
    { key: "createdAt", header: "Date", sortable: true, accessor: (r) => r.createdAt, render: (r) => formatDate(r.createdAt) },
    { key: "actions", header: "", accessor: () => "",
      render: (r) => (
        <a href={`/api/documents/${r.id}`} className="inline-flex rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Télécharger">
          <Download className="h-4 w-4" />
        </a>
      ) },
  ];

  return (
    <DataTable
      rows={filtered}
      columns={columns}
      filename="documents"
      searchPlaceholder="Rechercher par nom, catégorie, module…"
      emptyTitle="Aucun document"
      pageSize={15}
      toolbar={
        <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-9 w-48 text-sm">
          <option value="">Tous les modules</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>{ENTITY_TYPE_LABELS[m] ?? m}</option>
          ))}
        </Select>
      }
    />
  );
}
