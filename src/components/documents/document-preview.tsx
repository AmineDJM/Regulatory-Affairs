"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Download, Printer, Pencil, Trash2, Check, Loader2, ExternalLink } from "lucide-react";
import { DocxView, XlsxView, PptxView } from "./office-viewers";
import { printDocument } from "@/lib/print-document";
import { deleteDocument, renameDocument } from "@/lib/actions/document-actions";
import { useScrollLock } from "@/lib/use-scroll-lock";

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

const iconBtn = "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

/**
 * Document : **nom cliquable** qui ouvre une fenêtre d'aperçu in-app (PDF, image, Word, Excel,
 * PowerPoint ; sinon message + téléchargement). Toutes les actions vivent DANS l'aperçu, en barre
 * d'outils : **imprimer, modifier (éditeur Office), renommer, enregistrer (télécharger), supprimer**
 * — selon les droits reçus. Plus d'icônes entassées dans la liste : le nom seul suffit à tout ouvrir.
 */
export function DocumentPreview({
  id, name, hasFile, canEdit, canDelete, canRename, path,
}: {
  id: string;
  name: string;
  hasFile: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canRename?: boolean;
  path?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  useScrollLock(open); // l'aperçu est modal : la page ne doit pas défiler derrière
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(name);
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const src = `/api/documents/${id}`;
  const kind = kindFromName(name);
  const canPreview = hasFile && ["image", "pdf", "text", "docx", "xlsx", "pptx"].includes(kind);
  const canEditFile = Boolean(canEdit) && hasFile && OFFICE_EDIT.includes(extOf(name));

  async function saveRename() {
    const v = draft.trim();
    if (!v || v === name) { setRenaming(false); setDraft(name); return; }
    setBusy(true);
    await renameDocument(id, v, path);
    setBusy(false);
    setRenaming(false);
    router.refresh();
  }
  async function onDelete() {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    setDeleting(true);
    await deleteDocument(id, path);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={name}
        className="block w-full truncate text-left text-[13px] font-medium text-foreground transition-colors hover:text-primary hover:underline"
      >
        {name}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="mx-auto flex max-h-full w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              {renaming ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setRenaming(false); setDraft(name); } }}
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-ring"
                  />
                  <button onClick={saveRename} disabled={busy} className="rounded-md p-1.5 text-success hover:bg-success/10" title="Enregistrer le nom">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setRenaming(false); setDraft(name); }} disabled={busy} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" title="Annuler">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>{name}</p>
              )}
              {!renaming && (
                <div className="flex shrink-0 items-center gap-0.5">
                  {hasFile && <button onClick={() => printDocument(id)} className={iconBtn} title="Imprimer"><Printer className="h-4 w-4" /></button>}
                  {canEditFile && <a href={`/documents/${id}/edit`} className={iconBtn} title="Modifier dans l'éditeur Office"><ExternalLink className="h-4 w-4" /></a>}
                  {canRename && <button onClick={() => { setDraft(name); setRenaming(true); }} className={iconBtn} title="Renommer"><Pencil className="h-4 w-4" /></button>}
                  {hasFile && <a href={`${src}?dl=1`} className={iconBtn} title="Enregistrer (télécharger)"><Download className="h-4 w-4" /></a>}
                  {canDelete && (
                    <button onClick={onDelete} disabled={deleting} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Supprimer">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className={iconBtn} title="Fermer"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-muted/20 p-3">
              {canPreview ? (
                kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={name} className="mx-auto max-h-[80vh] rounded-lg object-contain" />
                ) : kind === "pdf" || kind === "text" ? (
                  <iframe src={src} title={name} className="h-[80vh] w-full rounded-lg border border-border bg-white" />
                ) : kind === "docx" ? (
                  <DocxView src={src} name={name} />
                ) : kind === "xlsx" ? (
                  <XlsxView src={src} name={name} />
                ) : kind === "pptx" ? (
                  <PptxView src={src} name={name} />
                ) : null
              ) : (
                <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">{hasFile ? "Aperçu non disponible pour ce type de fichier." : "Aucun fichier — métadonnées uniquement."}</p>
                  {hasFile && <a href={`${src}?dl=1`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" /> Télécharger</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
