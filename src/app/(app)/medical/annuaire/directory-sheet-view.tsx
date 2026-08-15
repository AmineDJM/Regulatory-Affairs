"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, Loader2, FileSpreadsheet, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importDirectorySheet } from "@/lib/actions/medical-directory-actions";
import { DIRECTORY_COLUMNS, normalizeHeader } from "@/lib/medical/directory-sheet";

export interface DirectorySheetRow {
  id: string;
  /** Les cellules, dans l'ordre de `DIRECTORY_COLUMNS` — déjà écrites en clair par le serveur. */
  cells: string[];
}

/**
 * L'ANNUAIRE EN FEUILLE — tel qu'on le lit et le corrige vraiment.
 *
 * Une liste de cartes est confortable pour dix praticiens ; à quatre cents, on cherche, on trie,
 * on compare des colonnes. Cet écran est donc un TABLEAU, avec les mêmes colonnes que le
 * classeur exporté — ce qui rend l'aller-retour évident : on exporte, on corrige en masse dans
 * Excel, on réimporte, et ce qu'on relit ici est exactement ce qu'on vient d'envoyer.
 *
 * La recherche porte sur TOUTE la ligne : dans un annuaire, on cherche « Mustapha » sans savoir
 * si c'est le nom du praticien ou celui de l'hôpital.
 */
export function DirectorySheetView({ rows, canImport }: { rows: DirectorySheetRow[]; canImport: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const needle = normalizeHeader(q);
  const filtered = needle
    ? rows.filter((r) => normalizeHeader(r.cells.join(" ")).includes(needle))
    : rows;

  const runImport = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    setBusy(true); setMsg(null);
    void importDirectorySheet(fd).then((r) => {
      setBusy(false);
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Annuaire importé.") : (r.error ?? "Import impossible.") });
      if (r.ok) router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un nom, un hôpital, une ville…"
            className="w-72 pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {rows.length} praticien{rows.length > 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/medical/annuaire/export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-2 text-xs font-medium hover:bg-secondary"
            title="Exporter l'annuaire en Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Exporter
          </a>
          {canImport && (
            <>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) runImport(f); }}
              />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Importer un annuaire
              </Button>
            </>
          )}
        </div>
      </div>

      {canImport && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Le fichier n&apos;a pas besoin d&apos;être au format de l&apos;outil : les colonnes sont
            reconnues telles qu&apos;elles sont écrites (« NOM ET PRENOM », « Wilaya », « N° Tél. »…),
            et les grades comme les niveaux sont interprétés. Un praticien déjà présent, au même
            établissement, est <strong>mis à jour</strong> — jamais dupliqué. Le compte rendu indique
            ce qui a été créé, mis à jour, ignoré, et quelle colonne n&apos;a pas été comprise.
          </span>
        </p>
      )}

      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </p>
      )}

      <div className="surface overflow-x-auto">
        <table className="table-clean w-full min-w-[68rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              {DIRECTORY_COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left font-medium">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={DIRECTORY_COLUMNS.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? "L'annuaire est vide. Importez un fichier existant, ou ajoutez les praticiens depuis Promotion médicale."
                    : "Aucun praticien ne correspond à cette recherche."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  {r.cells.map((cell, i) => (
                    <td key={i} className={`px-3 py-2 ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {cell || <span className="text-muted-foreground/50">—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
