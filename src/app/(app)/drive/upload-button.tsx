"use client";

import * as React from "react";
import { Upload, Search, Eye, Pencil, FolderUp, FileUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";
import { useBackgroundUpload } from "@/components/layout/background-upload";
import { ensureDriveFolders } from "@/lib/actions/drive-actions";
import { cn } from "@/lib/utils";

type Perm = "none" | "view" | "edit";
interface UserLite { id: string; name: string }

const CATEGORY_SUGGESTIONS = ["Contrat", "Facture", "Réglementaire", "Présentation", "Analyse", "Compte rendu", "RH", "Marché PCH", "Autre"];

export function UploadButton({
  parentId, nodeId, label, users,
}: {
  parentId?: string | null;
  nodeId?: string;
  label?: string;
  /** Si fourni (import d'un nouveau fichier), ouvre le choix catégorie + permissions. */
  users?: UserLite[];
}) {
  const { enqueue } = useBackgroundUpload();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Mode simple (nouvelle version, ou pas de liste d'utilisateurs) : envoi en arrière-plan.
  const rich = Boolean(users) && !nodeId;

  // ───────── Mode simple (envoi non bloquant, global) ─────────
  function onChangeSimple(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => f.size > 0);
    if (files.length === 0) return;
    if (nodeId) {
      enqueue({
        label: "Nouvelle version",
        files: [files[0]],
        makeRequest: (file) => { const fd = new FormData(); fd.append("file", file); fd.append("nodeId", nodeId); return { url: "/api/drive/upload", formData: fd }; },
      });
    } else {
      enqueue({
        label: `${files.length} fichier${files.length > 1 ? "s" : ""} (Drive)`,
        files,
        concurrency: 6,
        makeRequest: (file) => { const fd = new FormData(); fd.append("file", file); if (parentId) fd.append("parentId", parentId); return { url: "/api/drive/upload", formData: fd }; },
      });
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  if (!rich) {
    return (
      <span className="inline-flex items-center gap-2">
        <input ref={inputRef} type="file" multiple={!nodeId} hidden onChange={onChangeSimple} />
        <Button variant="outline" onClick={() => inputRef.current?.click()} type="button">
          <Upload className="h-4 w-4" /> {label ?? "Importer"}
        </Button>
      </span>
    );
  }

  return <RichUpload parentId={parentId ?? null} users={users!} label={label} />;
}

function RichUpload({ parentId, users, label }: { parentId: string | null; users: UserLite[]; label?: string }) {
  const { enqueue } = useBackgroundUpload();
  const [open, setOpen] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [category, setCategory] = React.useState("");
  const [perm, setPerm] = React.useState<Record<string, Perm>>({});
  const [search, setSearch] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  // ───────── Import de DOSSIER (arborescence exacte recréée) ─────────
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [folderBusy, setFolderBusy] = React.useState(false);
  // `webkitdirectory` n'est pas typé par React → posé sur l'élément via le ref.
  React.useEffect(() => {
    const el = folderInputRef.current;
    if (el) { el.setAttribute("webkitdirectory", ""); el.setAttribute("directory", ""); }
  }, []);

  const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  const dirOf = (p: string) => { const i = p.lastIndexOf("/"); return i >= 0 ? p.slice(0, i) : ""; };

  async function onImportFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    const picked = Array.from(list ?? []).filter((f) => f.size > 0);
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (picked.length === 0) return;
    setFolderBusy(true);
    // Crée d'abord l'arborescence de dossiers (chemins relatifs uniques) côté serveur.
    const dirs = [...new Set(picked.map((f) => dirOf(rel(f))).filter(Boolean))];
    const r = await ensureDriveFolders(parentId ?? null, dirs);
    setFolderBusy(false);
    if (!r.ok || !r.map) { window.alert(r.error ?? "Import du dossier impossible."); return; }
    const map = r.map;
    const rootName = rel(picked[0]).split("/")[0] || "dossier";
    enqueue({
      label: `Dossier « ${rootName} » (${picked.length} fichier${picked.length > 1 ? "s" : ""})`,
      files: picked,
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

  const shared = Object.values(perm).filter((p) => p !== "none").length;
  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  function reset() {
    setFiles([]); setCategory(""); setPerm({}); setSearch(""); setErr(null);
  }

  /** Confie l'import (avec classement + permissions) au gestionnaire global : non bloquant. */
  function submit() {
    if (files.length === 0) { setErr("Choisissez au moins un fichier."); return; }
    const viewers = Object.entries(perm).filter(([, p]) => p === "view").map(([id]) => id);
    const editors = Object.entries(perm).filter(([, p]) => p === "edit").map(([id]) => id);
    const cat = category.trim();
    enqueue({
      label: `${files.length} fichier${files.length > 1 ? "s" : ""} (Drive)`,
      files,
      concurrency: 6,
      makeRequest: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        if (parentId) fd.append("parentId", parentId);
        if (cat) fd.append("category", cat);
        viewers.forEach((id) => fd.append("viewers", id));
        editors.forEach((id) => fd.append("editors", id));
        return { url: "/api/drive/upload", formData: fd };
      },
    });
    setOpen(false); reset();
  }

  return (
    <>
      {/* Un seul bouton « Importer » : Fichiers/ZIP OU Dossier (comme Google Drive). */}
      <input ref={folderInputRef} type="file" hidden multiple onChange={onImportFolder} />
      <div className="relative inline-flex">
        <Button variant="outline" type="button" onClick={() => setMenu((v) => !v)} disabled={folderBusy}>
          {folderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label ?? "Importer"}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl border border-border bg-popover p-1 shadow-xl">
              <button type="button" onClick={() => { setMenu(false); setOpen(true); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary">
                <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0"><span className="font-medium">Fichiers ou ZIP</span><span className="block text-xs text-muted-foreground">Un ou plusieurs fichiers (ZIP inclus)</span></span>
              </button>
              <button type="button" onClick={() => { setMenu(false); folderInputRef.current?.click(); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary">
                <FolderUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0"><span className="font-medium">Dossier</span><span className="block text-xs text-muted-foreground">Arborescence exacte recréée dans le Drive</span></span>
              </button>
            </div>
          </>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Importer un document"
        description="Choisissez le classement et qui peut le voir ou le modifier. L'envoi se fait en arrière-plan."
        width="lg"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{files.length} fichier·s · partagé avec {shared}</span>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="button" onClick={submit} disabled={files.length === 0}>
                <Upload className="h-4 w-4" /> Importer
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fichier(s)</Label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.map((f) => f.name).join(", ")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Catégorie</Label>
            <Input id="category" list="drive-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex. Contrat, Facture, Réglementaire…" />
            <datalist id="drive-cats">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Qui peut accéder ?</Label>
              <span className="text-xs text-muted-foreground">Par défaut, vous seul (propriétaire).</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une personne…" className="pl-8" />
            </div>
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">Aucune personne.</p>
              ) : filtered.map((u) => {
                const p = perm[u.id] ?? "none";
                return (
                  <div key={u.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50">
                    <span className="truncate text-sm">{u.name}</span>
                    <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border">
                      <PermBtn active={p === "none"} onClick={() => setPerm((m) => ({ ...m, [u.id]: "none" }))}>Aucun</PermBtn>
                      <PermBtn active={p === "view"} onClick={() => setPerm((m) => ({ ...m, [u.id]: "view" }))}><Eye className="h-3.5 w-3.5" /> Voir</PermBtn>
                      <PermBtn active={p === "edit"} onClick={() => setPerm((m) => ({ ...m, [u.id]: "edit" }))}><Pencil className="h-3.5 w-3.5" /> Modifier</PermBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        </div>
      </Sheet>
    </>
  );
}

function PermBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
