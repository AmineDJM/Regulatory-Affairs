"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, FolderUp, FileUp, FileArchive, UploadCloud, CheckCircle2, X } from "lucide-react";

type Mode = "files" | "folder" | "zip";

const MODES: { key: Mode; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "files", label: "Fichier(s)", icon: <FileUp className="h-4 w-4" />, hint: "Un ou plusieurs fichiers." },
  { key: "folder", label: "Dossier", icon: <FolderUp className="h-4 w-4" />, hint: "Un dossier entier — l'arborescence est conservée." },
  { key: "zip", label: "Archive ZIP", icon: <FileArchive className="h-4 w-4" />, hint: "Un .zip — décompressé en conservant l'arborescence." },
];

/**
 * Dépôt Regulatory → Drive : fichier(s), dossier (arborescence préservée) ou archive ZIP.
 * Crée automatiquement, dans le Drive, un dossier nommé d'après le produit contenant le dépôt.
 */
export function RegulatoryDriveUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("files");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ href: string; created: number; updated: number; skipped: number; blocked: string[] } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // `webkitdirectory` (choix de dossier) n'est pas typé par React → posé/retiré via l'attribut DOM.
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (mode === "folder") { el.setAttribute("webkitdirectory", ""); el.setAttribute("directory", ""); }
    else { el.removeAttribute("webkitdirectory"); el.removeAttribute("directory"); }
  }, [mode]);

  function pick(mode: Mode) {
    setMode(mode);
    setFiles([]);
    setResult(null);
    setError(null);
  }

  async function submit() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("mode", mode);
      for (const f of files) {
        fd.append("files", f);
        // Chemin relatif pour le mode dossier (l'arborescence vient de webkitRelativePath).
        fd.append("paths", (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
      }
      const res = await fetch(`/api/regulatory/${productId}/drive-mirror`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Le dépôt a échoué.");
      } else {
        setResult({ href: data.href, created: data.created, updated: data.updated, skipped: data.skipped, blocked: data.blocked ?? [] });
        setFiles([]);
        router.refresh();
      }
    } catch {
      setError("Le dépôt a échoué (réseau). Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
      >
        <UploadCloud className="h-4 w-4" /> Déposer dans le Drive
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Déposer dans le Drive du produit</p>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary" aria-label="Fermer"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => pick(m.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${mode === m.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{MODES.find((m) => m.key === mode)!.hint} Un dossier nommé <strong>d'après le produit</strong> est créé dans le Drive.</p>

      <div className="mt-2.5 space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={mode === "zip" ? ".zip,application/zip" : undefined}
          onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setResult(null); setError(null); }}
          className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">{files.length} élément(s) sélectionné(s){mode === "folder" ? " (arborescence incluse)" : ""}.</p>
        )}

        {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>}
        {result && (
          <div className="rounded-md border border-success/30 bg-success/5 p-2 text-xs text-success">
            <p className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Dépôt réussi.</p>
            <p className="mt-0.5 text-foreground/80">
              {result.created} ajouté(s){result.updated ? `, ${result.updated} mis à jour` : ""}{result.skipped ? `, ${result.skipped} ignoré(s)` : ""}
              {result.blocked.length > 0 ? ` · ${result.blocked.length} refusé(s) (sécurité)` : ""}.
              {" "}
              <Link href={result.href} className="font-medium underline">Ouvrir le dossier dans le Drive →</Link>
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={busy || files.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Déposer
          </button>
        </div>
      </div>
    </div>
  );
}
