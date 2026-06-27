"use client";

import * as React from "react";
import { Download, Trash2, FileText, Loader2 } from "lucide-react";
import { deleteDocument } from "@/lib/actions/document-actions";
import { DocumentPreview } from "./document-preview";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface DocItem {
  id: string;
  name: string;
  category: string;
  version: number;
  sizeBytes: number | null;
  confidentiality: string;
  uploadedBy: string | null;
  createdAt: string;
  hasFile: boolean;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["o", "Ko", "Mo", "Go"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DocumentList({
  documents,
  canDelete,
  path,
}: {
  documents: DocItem[];
  canDelete?: boolean;
  path?: string;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (documents.length === 0) {
    return <EmptyState icon="FolderOpen" title="Aucun document" description="Téléversez le premier document." />;
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    setPendingId(id);
    await deleteDocument(id, path);
    setPendingId(null);
  }

  return (
    <ul className="divide-y divide-border">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center gap-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{DOCUMENT_CATEGORY[doc.category] ?? doc.category}</span>
              <span>·</span>
              <span>v{doc.version}</span>
              <span>·</span>
              <span>{formatBytes(doc.sizeBytes)}</span>
              <span>·</span>
              <span>{formatDate(doc.createdAt)}</span>
              {doc.uploadedBy && (
                <>
                  <span>·</span>
                  <span>{doc.uploadedBy}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge map={CONFIDENTIALITY} value={doc.confidentiality} dot={false} />
          <DocumentPreview id={doc.id} name={doc.name} hasFile={doc.hasFile} />
          <a
            href={`/api/documents/${doc.id}?dl=1`}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={doc.hasFile ? "Télécharger" : "Métadonnées uniquement"}
          >
            <Download className="h-4 w-4" />
          </a>
          {canDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              disabled={pendingId === doc.id}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Supprimer"
            >
              {pendingId === doc.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
