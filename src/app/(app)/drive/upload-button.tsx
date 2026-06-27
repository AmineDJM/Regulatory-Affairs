"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Search, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";
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
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Mode simple (nouvelle version, ou pas de liste d'utilisateurs) : envoi immédiat.
  const rich = Boolean(users) && !nodeId;

  // ───────── Mode simple ─────────
  async function onChangeSimple(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true); setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        if (nodeId) fd.append("nodeId", nodeId);
        else if (parentId) fd.append("parentId", parentId);
        const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
        if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? "Échec de l'envoi."); break; }
        if (nodeId) break;
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!rich) {
    return (
      <span className="inline-flex items-center gap-2">
        <input ref={inputRef} type="file" multiple={!nodeId} hidden onChange={onChangeSimple} />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} type="button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label ?? "Importer"}
        </Button>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </span>
    );
  }

  return <RichUpload parentId={parentId ?? null} users={users!} label={label} />;
}

function RichUpload({ parentId, users, label }: { parentId: string | null; users: UserLite[]; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [category, setCategory] = React.useState("");
  const [perm, setPerm] = React.useState<Record<string, Perm>>({});
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const shared = Object.values(perm).filter((p) => p !== "none").length;
  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  function reset() {
    setFiles([]); setCategory(""); setPerm({}); setSearch(""); setErr(null);
  }

  async function submit() {
    if (files.length === 0) { setErr("Choisissez au moins un fichier."); return; }
    setBusy(true); setErr(null);
    const viewers = Object.entries(perm).filter(([, p]) => p === "view").map(([id]) => id);
    const editors = Object.entries(perm).filter(([, p]) => p === "edit").map(([id]) => id);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        if (parentId) fd.append("parentId", parentId);
        if (category.trim()) fd.append("category", category.trim());
        viewers.forEach((id) => fd.append("viewers", id));
        editors.forEach((id) => fd.append("editors", id));
        const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
        if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? "Échec de l'envoi."); setBusy(false); return; }
      }
      setOpen(false); reset(); router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} type="button">
        <Upload className="h-4 w-4" /> {label ?? "Importer"}
      </Button>

      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Importer un document"
        description="Choisissez le classement et qui peut le voir ou le modifier."
        width="lg"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{files.length} fichier·s · partagé avec {shared}</span>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
              <Button type="button" onClick={submit} disabled={busy || files.length === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importer
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
