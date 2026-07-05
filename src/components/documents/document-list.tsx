"use client";

import * as React from "react";
import { Download, Printer, Trash2, FileText, Loader2, Pencil, Check, X } from "lucide-react";
import { deleteDocument, renameDocument } from "@/lib/actions/document-actions";
import { DocumentPreview } from "./document-preview";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY } from "@/lib/labels";
import { printDocument } from "@/lib/print-document";
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
  canEdit,
  canRename,
  path,
}: {
  documents: DocItem[];
  canDelete?: boolean;
  canEdit?: boolean;
  canRename?: boolean;
  path?: string;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  if (documents.length === 0) {
    return <EmptyState icon="FolderOpen" title="Aucun document" description="Téléversez le premier document." />;
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    setPendingId(id);
    await deleteDocument(id, path);
    setPendingId(null);
  }

  function startRename(doc: DocItem) {
    setEditingId(doc.id);
    setDraftName(doc.name);
  }
  async function saveRename(id: string) {
    if (!draftName.trim()) return;
    setRenaming(true);
    await renameDocument(id, draftName, path);
    setRenaming(false);
    setEditingId(null);
  }

  return (
    <ul className="divide-y divide-border">
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {editingId === doc.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(doc.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    disabled={renaming}
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-ring"
                  />
                  <button onClick={() => saveRename(doc.id)} disabled={renaming} className="rounded-md p-1.5 text-success hover:bg-success/10" title="Enregistrer">
                    {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setEditingId(null)} disabled={renaming} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" title="Annuler">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="truncate text-sm font-semibold text-foreground" title={doc.name}>{doc.name}</p>
              )}
              {/* Méta sur UNE ligne tronquée : évite l'empilement d'éléments (« · » orphelins)
                  quand la colonne est étroite ; le détail complet reste dans le title. */}
              <p
                className="truncate text-xs text-muted-foreground"
                title={[DOCUMENT_CATEGORY[doc.category] ?? doc.category, `v${doc.version}`, formatBytes(doc.sizeBytes), formatDate(doc.createdAt), doc.uploadedBy ?? ""].filter(Boolean).join(" · ")}
              >
                {[DOCUMENT_CATEGORY[doc.category] ?? doc.category, `v${doc.version}`, formatBytes(doc.sizeBytes), formatDate(doc.createdAt), doc.uploadedBy ?? ""].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
            <StatusBadge map={CONFIDENTIALITY} value={doc.confidentiality} dot={false} />
            {canRename && editingId !== doc.id && (
              <button
                onClick={() => startRename(doc)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Modifier le nom"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <DocumentPreview id={doc.id} name={doc.name} hasFile={doc.hasFile} canEdit={canEdit} />
            {doc.hasFile && (
              <button
                onClick={() => printDocument(doc.id)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Imprimer"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
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
          </div>
        </li>
      ))}
    </ul>
  );
}
