"use client";

import * as React from "react";
import { UploadCloud, CheckCircle2, FileUp, X } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY } from "@/lib/labels";
import { useBackgroundUpload } from "@/components/layout/background-upload";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  entityType: EntityType;
  entityId: string;
  categories?: string[]; // restreint les catégories proposées pour le module
  stepKey?: string; // rattache les documents à une étape (Regulatory)
  compact?: boolean; // version condensée (par étape)
}

interface Item { id: string; file: File; path: string }

const humanSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

let uid = 0;

/**
 * Téléversement de documents : un ou plusieurs **fichiers de tout type**, **ou une archive ZIP**
 * (pour envoyer un dossier entier, on le compresse en .zip), **sans limite de nombre**. L'envoi est
 * confié au **gestionnaire d'envois global** (arrière-plan) : dès qu'on clique « Téléverser », on
 * peut **changer de module et continuer à travailler** — les fichiers montent en parallèle et la
 * pastille flottante suit la progression partout. En contexte Regulatory, tout est en plus répliqué
 * dans le **dossier Drive du produit** (le ZIP y reste entier et navigable). File d'attente locale
 * seulement pour la sélection.
 */
export function DocumentUpload({ entityType, entityId, categories, stepKey, compact }: DocumentUploadProps) {
  const { enqueue } = useBackgroundUpload();
  const filesRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [queued, setQueued] = React.useState(0); // dernier lot confié à l'arrière-plan

  const categoryEntries = categories
    ? categories.map((c) => [c, DOCUMENT_CATEGORY[c] ?? c] as const)
    : Object.entries(DOCUMENT_CATEGORY);
  const [category, setCategory] = React.useState(categoryEntries[0]?.[0] ?? "OTHER");
  const [confidentiality, setConfidentiality] = React.useState("INTERNAL");

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next: Item[] = Array.from(list)
      .filter((f) => f.size > 0)
      .map((file) => ({
        id: `u${uid++}`,
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }));
    setItems((cur) => [...cur, ...next]);
    setQueued(0);
  }

  const removeItem = (id: string) => setItems((cur) => cur.filter((it) => it.id !== id));

  /** Confie le lot au gestionnaire global : l'envoi continue même si on quitte la page. */
  function uploadAll() {
    if (items.length === 0) return;
    const files = items.map((it) => it.file);
    const cat = category, conf = confidentiality;
    enqueue({
      label: `${files.length} document${files.length > 1 ? "s" : ""}`,
      files,
      concurrency: 6,
      makeRequest: (file) => {
        const fd = new FormData();
        fd.set("entityType", entityType);
        fd.set("entityId", entityId);
        fd.set("category", cat);
        fd.set("confidentiality", conf);
        if (stepKey) fd.set("stepKey", stepKey);
        fd.append("files", file, file.name);
        return { url: "/api/documents/upload", formData: fd };
      },
    });
    setQueued(files.length);
    setItems([]);
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
          {!compact && <span className="text-sm font-medium text-foreground">Glissez un fichier ou un ZIP ici, ou :</span>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => filesRef.current?.click()}>
              <FileUp className="h-4 w-4" /> Choisir un fichier ou un ZIP
            </Button>
          </div>
        </div>
        {!compact && <p className="mt-1.5 text-xs text-muted-foreground">Un ou plusieurs <strong>fichiers de tout type</strong>, ou une archive <strong>.ZIP</strong> · sans limite de nombre · envoi en arrière-plan</p>}
        <input ref={filesRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
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
              <FileUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={it.path}>{it.path}</span>
              <span className="shrink-0 text-muted-foreground">{humanSize(it.file.size)}</span>
              <button type="button" onClick={() => removeItem(it.id)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label="Retirer"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs">
          {queued > 0 && items.length === 0 && (
            <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> {queued} document·s en envoi — vous pouvez continuer à travailler.</span>
          )}
        </div>
        <Button type="button" size="sm" onClick={uploadAll} disabled={items.length === 0}>
          <UploadCloud className="h-4 w-4" />
          Téléverser{items.length > 0 ? ` (${items.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
