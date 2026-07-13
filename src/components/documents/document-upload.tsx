"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileUp, FolderUp, X } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  entityType: EntityType;
  entityId: string;
  categories?: string[]; // restreint les catégories proposées pour le module
  stepKey?: string; // rattache les documents à une étape (Regulatory)
  compact?: boolean; // version condensée (par étape)
}

type Status = "pending" | "uploading" | "done" | "error";
interface Item { id: string; file: File; path: string; status: Status; error?: string }

const humanSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

/** Exécute des tâches par lots **parallèles** (concurrence bornée) → téléversement rapide. */
async function runPool<T>(items: T[], worker: (t: T) => Promise<void>, concurrency = 4) {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  });
  await Promise.all(runners);
}

let uid = 0;

/**
 * Téléversement de documents **en lot** : plusieurs fichiers **ou un dossier entier**,
 * tous types (sauf exécutables), **sans limite de nombre**, envoyés **en parallèle** via
 * la route `/api/documents/upload` (rapide, en flux). File d'attente avec état par fichier.
 */
export function DocumentUpload({ entityType, entityId, categories, stepKey, compact }: DocumentUploadProps) {
  const router = useRouter();
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  // Active la sélection d'un dossier entier (attribut non standard posé via ref).
  React.useEffect(() => {
    const el = folderRef.current;
    if (el) { el.setAttribute("webkitdirectory", ""); el.setAttribute("directory", ""); }
  }, []);

  const categoryEntries = categories
    ? categories.map((c) => [c, DOCUMENT_CATEGORY[c] ?? c] as const)
    : Object.entries(DOCUMENT_CATEGORY);
  const [category, setCategory] = React.useState(categoryEntries[0]?.[0] ?? "OTHER");
  const [confidentiality, setConfidentiality] = React.useState("INTERNAL");

  const pending = items.filter((it) => it.status === "pending" || it.status === "error");
  const doneCount = items.filter((it) => it.status === "done").length;

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next: Item[] = Array.from(list)
      .filter((f) => f.size > 0)
      .map((file) => ({
        id: `u${uid++}`,
        file,
        // Chemin relatif si on a choisi un dossier (webkitRelativePath), sinon le nom.
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        status: "pending" as Status,
      }));
    setItems((cur) => [...cur, ...next]);
  }

  const removeItem = (id: string) => setItems((cur) => cur.filter((it) => it.id !== id));

  async function uploadOne(it: Item) {
    setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: "uploading", error: undefined } : x)));
    // Nombre de fichiers ILLIMITÉ : chaque fichier est un envoi indépendant, RÉESSAYÉ en cas
    // d'échec TRANSITOIRE (réseau, 5xx, 429) avec backoff → un gros lot / dossier entier se
    // termine de façon fiable (plus de « l'import s'arrête »). Un 4xx clair (droit, taille) échoue
    // vite, sans réessai inutile.
    const attempts = 4;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const fd = new FormData();
        fd.set("entityType", entityType);
        fd.set("entityId", entityId);
        fd.set("category", category);
        fd.set("confidentiality", confidentiality);
        if (stepKey) fd.set("stepKey", stepKey);
        fd.append("files", it.file, it.file.name);
        const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: "done" } : x)));
          return;
        }
        const msg = data.errors?.[0]?.error ?? data.error ?? "Échec du téléversement.";
        const retryable = res.status >= 500 || res.status === 429;
        if (!retryable || attempt === attempts - 1) {
          setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: "error", error: msg } : x)));
          return;
        }
      } catch {
        if (attempt === attempts - 1) {
          setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, status: "error", error: "Réseau indisponible." } : x)));
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt)); // backoff : 0,4s → 0,8s → 1,6s
    }
  }

  async function uploadAll() {
    const toSend = items.filter((it) => it.status === "pending" || it.status === "error");
    if (toSend.length === 0) return;
    setBusy(true);
    // Concurrence élevée : plusieurs fichiers montent en parallèle → lot bien plus rapide.
    await runPool(toSend, uploadOne, 6);
    setBusy(false);
    router.refresh();
    // On retire les réussis (ils apparaissent dans la liste ci-dessous) ; on garde les échecs pour réessai.
    setItems((cur) => cur.filter((it) => it.status !== "done"));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={cn(
          "rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "px-3 py-2.5" : "px-4 py-5",
          dragOver ? "border-primary bg-accent/50" : "border-border bg-muted/30",
        )}
      >
        <div className={cn("flex items-center justify-center gap-2", compact ? "" : "flex-col")}>
          <UploadCloud className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-6 w-6")} />
          {!compact && <span className="text-sm font-medium text-foreground">Glissez des fichiers ici, ou :</span>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => filesRef.current?.click()}>
              <FileUp className="h-4 w-4" /> Fichiers
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => folderRef.current?.click()}>
              <FolderUp className="h-4 w-4" /> Dossier
            </Button>
          </div>
        </div>
        {!compact && <p className="mt-1.5 text-xs text-muted-foreground">Tous types (sauf exécutables) · plusieurs fichiers ou un dossier entier · sans limite de nombre</p>}
        <input ref={filesRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={folderRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm">
            {categoryEntries.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)} className="text-sm">
            {Object.entries(CONFIDENTIALITY).map(([value, v]) => (
              <option key={value} value={value}>{v.label}</option>
            ))}
          </Select>
        </div>
      )}

      {items.length > 0 && (
        <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs">
              {it.status === "uploading" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                : it.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                : it.status === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                : <FileUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate" title={it.path}>{it.path}</span>
              <span className="shrink-0 text-muted-foreground">{humanSize(it.file.size)}</span>
              {it.status === "error" && <span className="shrink-0 max-w-[10rem] truncate text-destructive" title={it.error}>{it.error}</span>}
              {(it.status === "pending" || it.status === "error") && !busy && (
                <button type="button" onClick={() => removeItem(it.id)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label="Retirer"><X className="h-3 w-3" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs">
          {doneCount > 0 && (
            <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> {doneCount} document·s ajouté·s</span>
          )}
        </div>
        <Button type="button" size="sm" onClick={uploadAll} disabled={busy || pending.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Téléverser{pending.length > 0 ? ` (${pending.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
