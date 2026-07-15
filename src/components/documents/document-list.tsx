"use client";

import { FileText } from "lucide-react";
import { DocumentPreview } from "./document-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
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

/**
 * Liste de documents épurée : une icône, le **nom cliquable** (ouvre l'aperçu, où vivent toutes les
 * actions — imprimer / modifier / renommer / enregistrer / supprimer) et une ligne de méta discrète.
 * Plus de badge « Interne » ni de rangée d'icônes entassées → tient dans les colonnes étroites.
 */
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
  if (documents.length === 0) {
    return <EmptyState icon="FolderOpen" title="Aucun document" description="Téléversez le premier document." />;
  }

  return (
    <ul className="divide-y divide-border">
      {documents.map((doc) => {
        const meta = [DOCUMENT_CATEGORY[doc.category] ?? doc.category, `v${doc.version}`, formatBytes(doc.sizeBytes), formatDate(doc.createdAt), doc.uploadedBy ?? ""]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={doc.id} className="flex items-center gap-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DocumentPreview id={doc.id} name={doc.name} hasFile={doc.hasFile} canEdit={canEdit} canDelete={canDelete} canRename={canRename} path={path} />
              <p className="truncate text-[11px] text-muted-foreground" title={meta}>{meta}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
