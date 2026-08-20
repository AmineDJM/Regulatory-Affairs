"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import { FileGlyph } from "@/components/drive/file-glyph";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import {
  sortRows, fileTypeLabel, explorerSize, type ExplorerRow, type SortKey, type SortDir,
} from "@/lib/drive/explorer";

export interface QuickRow extends ExplorerRow {
  /** Dossier où le fichier est rangé — c'est justement ce qu'on avait oublié. */
  folderName: string | null;
  href: string;
}

/**
 * LA VUE « DÉTAILS » D'UN EXPLORATEUR — nom, date, type, taille, en colonnes triables.
 *
 * On clique sur un titre de colonne pour trier, on reclique pour inverser : c'est le geste que
 * tout le monde connaît, et il ne s'apprend pas. Les dossiers restent en tête quel que soit le
 * sens, comme partout.
 *
 * La bascule « grandes icônes » sert aux dossiers d'images et de scans, où le nom ne dit rien.
 */
export function QuickAccessList({
  rows, emptyTitle, emptyHint, showFolder = true, showFilter = true, summary, folderHeading = "Emplacement",
}: {
  rows: QuickRow[];
  emptyTitle: string;
  emptyHint: string;
  showFolder?: boolean;
  /** Le filtre local. Coupé sur la page de RECHERCHE : deux champs de saisie côte à côte, dont
   *  l'un cherche dans tout le Drive et l'autre dans la liste affichée, ne se distinguent pas. */
  showFilter?: boolean;
  /** Phrase affichée à la place du décompte brut (« 3 résultats pour « contrat » »). */
  summary?: string;
  folderHeading?: string;
}) {
  const [key, setKey] = React.useState<SortKey>("updatedAt");
  const [dir, setDir] = React.useState<SortDir>("desc");
  const [tiles, setTiles] = React.useState(false);
  const [q, setQ] = React.useState("");

  const needle = q.trim().toLowerCase();
  const filtered = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
  const sorted = React.useMemo(() => sortRows(filtered, key, dir), [filtered, key, dir]);

  const head = (k: SortKey, label: string, className = "") => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground ${className}`}
      onClick={() => {
        if (k === key) setDir(dir === "asc" ? "desc" : "asc");
        else { setKey(k); setDir(k === "name" || k === "type" ? "asc" : "desc"); }
      }}
      aria-sort={k === key ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {k === key && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showFilter && (
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans cette liste…" className="w-64" />
        )}
        <span className="text-xs text-muted-foreground">
          {summary ?? `${sorted.length} élément${sorted.length > 1 ? "s" : ""}`}
        </span>
        <button
          type="button"
          onClick={() => setTiles(!tiles)}
          title={tiles ? "Affichage en liste" : "Grandes icônes"}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-2 text-xs text-muted-foreground hover:bg-secondary"
        >
          {tiles ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          {tiles ? "Liste" : "Grandes icônes"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : tiles ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {sorted.map((r) => (
            <Link key={r.id} href={r.href} className="surface flex flex-col items-center gap-2 p-3 text-center hover:bg-secondary/60">
              <FileGlyph name={r.name} isFile={r.isFile} size="lg" />
              <span className="line-clamp-2 break-all text-xs font-medium">{r.name}</span>
              <span className="text-[0.6875rem] text-muted-foreground">{explorerSize(r.size, r.isFile)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="table-clean w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {head("name", "Nom")}
                {head("updatedAt", "Modifié le", "w-48")}
                {head("type", "Type", "w-48")}
                {head("size", "Taille", "w-28")}
                {showFolder && <th className="px-3 py-2 text-left font-medium w-48">{folderHeading}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-1.5">
                    <Link href={r.href} className="inline-flex items-center gap-2 font-medium hover:underline">
                      <FileGlyph name={r.name} isFile={r.isFile} />
                      <span className="truncate">{r.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{formatDateTime(r.updatedAt)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{fileTypeLabel(r.name, r.isFile)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{explorerSize(r.size, r.isFile)}</td>
                  {showFolder && (
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {r.folderName ?? <span className="text-muted-foreground/60">Racine</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
