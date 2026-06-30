"use client";

import * as React from "react";
import { Eye, X, Download, Printer, Pencil } from "lucide-react";
import { DocxView, XlsxView, PptxView } from "./office-viewers";
import { printDocument } from "@/lib/print-document";

const IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const TEXTLIKE = ["txt", "md", "log", "json", "xml"];
// Extensions ouvrables/modifiables dans l'éditeur Office (alignées sur onlyofficeDocType côté serveur).
const OFFICE_EDIT = ["doc", "docx", "odt", "rtf", "txt", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp"];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function kindFromName(name: string): string {
  const ext = extOf(name);
  if (IMAGE.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (TEXTLIKE.includes(ext)) return "text";
  if (ext === "docx") return "docx";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "pptx") return "pptx";
  return "other";
}

/** Aperçu in-app d'un document (PDF, image, Word, Excel, PowerPoint), partout où
 *  un document est listé. Réutilise les viewers du Drive (libs embarquées, aucune
 *  dépendance externe). Pour les fichiers Office, si `canEdit` est vrai (éditeur
 *  configuré + droit de modifier), un bouton « Modifier » ouvre l'éditeur plein
 *  écran OnlyOffice. Sans aperçu ni édition possible, rien ne s'affiche. */
export function DocumentPreview({ id, name, hasFile, canEdit }: { id: string; name: string; hasFile: boolean; canEdit?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const src = `/api/documents/${id}`;
  const kind = kindFromName(name);
  const canPreview = hasFile && ["image", "pdf", "text", "docx", "xlsx", "pptx"].includes(kind);
  const canEditFile = Boolean(canEdit) && hasFile && OFFICE_EDIT.includes(extOf(name));
  if (!canPreview && !canEditFile) return null;

  return (
    <>
      {canEditFile && (
        <a
          href={`/documents/${id}/edit`}
          title="Modifier dans l'éditeur Office"
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </a>
      )}
      {canPreview && (
        <button
          onClick={() => setOpen(true)}
          title="Aperçu dans l'application"
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="mx-auto flex max-h-full w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="truncate text-sm font-medium">{name}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => printDocument(id)} title="Imprimer" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Printer className="h-4 w-4" /></button>
                <a href={`${src}?dl=1`} title="Télécharger" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Download className="h-4 w-4" /></a>
                <button onClick={() => setOpen(false)} title="Fermer" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted/20 p-3">
              {kind === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={src} alt={name} className="mx-auto max-h-[80vh] rounded-lg object-contain" />
              ) : kind === "pdf" || kind === "text" ? (
                <iframe src={src} title={name} className="h-[80vh] w-full rounded-lg border border-border bg-white" />
              ) : kind === "docx" ? (
                <DocxView src={src} name={name} />
              ) : kind === "xlsx" ? (
                <XlsxView src={src} name={name} />
              ) : kind === "pptx" ? (
                <PptxView src={src} name={name} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
