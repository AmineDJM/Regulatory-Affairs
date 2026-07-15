"use client";

import * as React from "react";
import { FolderUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackgroundUpload } from "@/components/layout/background-upload";
import { ensureDriveFolders } from "@/lib/actions/drive-actions";

/**
 * Import d'un DOSSIER depuis l'ordinateur (façon Google Drive) : on choisit un dossier, toute son
 * **arborescence exacte** (dossiers dans dossiers…) est recréée dans le Drive, puis chaque fichier
 * est téléversé en arrière-plan dans le bon sous-dossier. Pas besoin de compresser en ZIP.
 */
export function ImportFolderButton({ parentId }: { parentId?: string | null }) {
  const { enqueue } = useBackgroundUpload();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  // `webkitdirectory` n'est pas typé par React → on le pose sur l'élément via le ref.
  React.useEffect(() => {
    const el = inputRef.current;
    if (el) { el.setAttribute("webkitdirectory", ""); el.setAttribute("directory", ""); }
  }, []);

  const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  const dirOf = (p: string) => { const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(0, i) : ""; };

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    const files = Array.from(list ?? []).filter((f) => f.size > 0);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    setBusy(true);
    // Crée d'abord l'arborescence de dossiers (chemins relatifs uniques) côté serveur.
    const dirs = [...new Set(files.map((f) => dirOf(rel(f))).filter(Boolean))];
    const r = await ensureDriveFolders(parentId ?? null, dirs);
    setBusy(false);
    if (!r.ok || !r.map) { window.alert(r.error ?? "Import du dossier impossible."); return; }
    const map = r.map;
    const rootName = rel(files[0]).split("/")[0] || "dossier";
    enqueue({
      label: `Dossier « ${rootName} » (${files.length} fichier${files.length > 1 ? "s" : ""})`,
      files,
      concurrency: 6,
      makeRequest: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        const dir = dirOf(rel(file));
        const pid = dir ? map[dir] : (parentId ?? undefined);
        if (pid) fd.append("parentId", pid);
        return { url: "/api/drive/upload", formData: fd };
      },
    });
  }

  return (
    <span className="inline-flex">
      <input ref={inputRef} type="file" hidden multiple onChange={onChange} />
      <Button variant="outline" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderUp className="h-4 w-4" />} Importer un dossier
      </Button>
    </span>
  );
}
