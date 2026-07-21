"use client";

import * as React from "react";
import { Download, FileArchive, File as FileIcon, Folder, Loader2, AlertCircle, Search, Eye, ChevronRight, House } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VISIONNEUSE D'ARCHIVE ZIP — dans le Drive, on ouvre un .zip et on le PARCOURT comme un vrai
 * dossier (à la Filez / explorateur de fichiers) : dossier par dossier, fil d'Ariane, double-clic
 * pour entrer, aperçu inline du fichier choisi (image, PDF, texte, vidéo, audio) ou téléchargement.
 * Une recherche balaie toute l'archive. L'archive reste entière ; le serveur extrait UNE entrée à
 * la demande (voir /api/drive/[id]/zip). Rien n'est décompressé sur le disque.
 */

interface ZipEntry { path: string; size: number | null }
interface ZipList { ok: boolean; name?: string; count?: number; truncated?: boolean; entries?: ZipEntry[]; error?: string }

const humanSize = (n: number | null) => (n == null ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : n >= 1024 ? `${Math.round(n / 1024)} Ko` : `${n} o`);
const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

function previewKind(name: string): "image" | "pdf" | "text" | "video" | "audio" | "none" {
  const e = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(e)) return "image";
  if (e === "pdf") return "pdf";
  if (["txt", "csv", "json", "xml", "md", "log", "html", "htm"].includes(e)) return "text";
  if (["mp4", "webm", "mov"].includes(e)) return "video";
  if (["mp3", "wav", "ogg"].includes(e)) return "audio";
  return "none";
}

/** Enfants immédiats (sous-dossiers + fichiers) d'un préfixe de chemin dans l'archive. */
function childrenOf(entries: ZipEntry[], prefix: string): { folders: { name: string; count: number }[]; files: ZipEntry[] } {
  const folderCounts = new Map<string, number>();
  const files: ZipEntry[] = [];
  for (const e of entries) {
    if (prefix && !e.path.startsWith(prefix)) continue;
    const rest = e.path.slice(prefix.length);
    if (rest === "") continue; // l'entrée-dossier elle-même
    const segs = rest.split("/");
    if (segs.length === 1) {
      if (segs[0]) files.push(e); // fichier directement dans ce dossier
    } else {
      folderCounts.set(segs[0], (folderCounts.get(segs[0]) ?? 0) + 1);
    }
  }
  const folders = [...folderCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { folders, files };
}

export function ZipViewer({ id, name }: { id: string; name: string }) {
  const [list, setList] = React.useState<ZipList | null>(null);
  const [q, setQ] = React.useState("");
  const [path, setPath] = React.useState<string[]>([]); // dossier courant DANS l'archive
  const [sel, setSel] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(`/api/drive/${id}/zip`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ZipList) => { if (alive) setList(d); })
      .catch(() => { if (alive) setList({ ok: false, error: "Lecture de l'archive impossible." }); });
    return () => { alive = false; };
  }, [id]);

  if (!list) {
    return <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lecture de l'archive…</div>;
  }
  if (!list.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{list.error ?? "Archive illisible."}</p>
        <a href={`/api/drive/${id}/raw?dl=1`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" /> Télécharger l'archive</a>
      </div>
    );
  }

  const entries = list.entries ?? [];
  const term = q.trim().toLowerCase();
  const prefix = path.length ? path.join("/") + "/" : "";
  const { folders, files } = childrenOf(entries, prefix);
  // Recherche : liste plate de toutes les entrées correspondantes (on quitte la navigation).
  const searchResults = term ? entries.filter((e) => e.path.toLowerCase().includes(term) && !e.path.endsWith("/")) : [];
  const selUrl = sel ? `/api/drive/${id}/zip?path=${encodeURIComponent(sel)}` : null;
  const kind = sel ? previewKind(sel) : "none";
  const openFile = (p: string) => setSel(p);
  const enterFolder = (folderName: string) => { setPath((p) => [...p, folderName]); setSel(null); };
  const goTo = (depth: number) => { setPath((p) => p.slice(0, depth)); setSel(null); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <FileArchive className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 truncate font-medium" title={name}>{name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{list.count} fichier·s{list.truncated ? " (aperçu limité)" : ""}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Explorateur de l'archive (navigation dossier par dossier) */}
        <div className="rounded-lg border border-border">
          <div className="relative border-b border-border p-2">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans toute l'archive…" className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary" />
          </div>

          {term ? (
            // ── Résultats de recherche (plats) ──
            <ul className="max-h-[62vh] divide-y divide-border overflow-y-auto">
              {searchResults.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune entrée pour « {q} ».</li>
              ) : searchResults.map((e) => (
                <li key={e.path} className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", sel === e.path && "bg-accent/60")}>
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button type="button" onClick={() => openFile(e.path)} className="min-w-0 flex-1 truncate text-left hover:text-primary" title={e.path}>{e.path}</button>
                  <span className="shrink-0 text-xs text-muted-foreground">{humanSize(e.size)}</span>
                  <a href={`/api/drive/${id}/zip?path=${encodeURIComponent(e.path)}&dl=1`} className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary" title="Télécharger"><Download className="h-3.5 w-3.5" /></a>
                </li>
              ))}
            </ul>
          ) : (
            <>
              {/* Fil d'Ariane dans l'archive */}
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-1.5 text-xs">
                <button type="button" onClick={() => goTo(0)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><House className="h-3.5 w-3.5" /> Archive</button>
                {path.map((seg, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button type="button" onClick={() => goTo(i + 1)} className="rounded px-1 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground">{seg}</button>
                  </span>
                ))}
              </div>
              <ul className="max-h-[58vh] divide-y divide-border overflow-y-auto">
                {folders.length === 0 && files.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">Dossier vide.</li>
                ) : (
                  <>
                    {folders.map((f) => (
                      <li key={`d:${f.name}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                        <button type="button" onDoubleClick={() => enterFolder(f.name)} onClick={() => enterFolder(f.name)} className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary" title={f.name}>{f.name}</button>
                        <span className="shrink-0 text-xs text-muted-foreground">{f.count} élément·s</span>
                      </li>
                    ))}
                    {files.map((e) => {
                      const base = e.path.split("/").pop() ?? e.path;
                      return (
                        <li key={e.path} className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", sel === e.path && "bg-accent/60")}>
                          <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <button type="button" onClick={() => openFile(e.path)} className="min-w-0 flex-1 truncate text-left hover:text-primary" title={base}>{base}</button>
                          <span className="shrink-0 text-xs text-muted-foreground">{humanSize(e.size)}</span>
                          <a href={`/api/drive/${id}/zip?path=${encodeURIComponent(e.path)}&dl=1`} className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary" title="Télécharger"><Download className="h-3.5 w-3.5" /></a>
                        </li>
                      );
                    })}
                  </>
                )}
              </ul>
            </>
          )}
        </div>

        {/* Aperçu de l'entrée sélectionnée */}
        <div className="rounded-lg border border-border p-2">
          {!sel ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Eye className="h-5 w-5" /> Sélectionnez un fichier pour l'afficher.
            </div>
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selUrl!} alt={sel} className="mx-auto max-h-[62vh] rounded object-contain" />
          ) : kind === "pdf" || kind === "text" ? (
            <iframe src={selUrl!} title={sel} className="h-[62vh] w-full rounded border border-border bg-white" />
          ) : kind === "video" ? (
            <video src={selUrl!} controls className="max-h-[62vh] w-full rounded bg-black" />
          ) : kind === "audio" ? (
            <div className="flex h-full min-h-[40vh] items-center justify-center p-4"><audio src={selUrl!} controls className="w-full" /></div>
          ) : (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce type. Téléchargez le fichier pour l'ouvrir.</p>
              <a href={`${selUrl}&dl=1`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" /> Télécharger « {sel.split("/").pop()} »</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
