"use client";

import * as React from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileArchive, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCtdUpload } from "@/components/layout/upload-manager";

const humanSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

/**
 * Téléversement d'un dossier CTD (ZIP). L'envoi tourne dans le GESTIONNAIRE GLOBAL (persiste à
 * travers la navigation → on peut faire autre chose dans l'app pendant l'upload) ; cette zone
 * lance l'envoi et reflète l'état de CE dossier (progression réelle, puis manifeste de sécurité).
 */
export function CtdUpload({ dossierId }: { dossierId: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { jobs, start } = useCtdUpload();
  const job = jobs[dossierId];
  const [dragOver, setDragOver] = React.useState(false);
  const busy = job?.phase === "uploading" || job?.phase === "processing";

  const pick = (files: FileList | null) => { const f = files?.[0]; if (f) start(dossierId, f); };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) pick(e.dataTransfer.files); }}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-primary bg-accent/50" : "border-border bg-muted/30",
          busy && "opacity-70",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <FileArchive className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Déposez l'archive CTD (.zip) ici, ou :</p>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> Choisir un fichier ZIP
          </Button>
          <p className="text-xs text-muted-foreground">
            Envoi en arrière-plan — vous pouvez continuer à travailler dans l'app · décompression sécurisée · archive figée
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      </div>

      {busy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {job?.phase === "uploading" ? `Téléversement de ${job?.fileName}…` : "Inspection & extraction sécurisées…"}
            </span>
            {job?.phase === "uploading" && <span>{job?.progress}%</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: job?.phase === "processing" ? "100%" : `${job?.progress ?? 0}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Vous pouvez quitter cette page — l'envoi continue (voir la pastille en bas à droite).</p>
        </div>
      )}

      {job?.phase === "error" && job.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{job.error}</span>
        </div>
      )}

      {job?.phase === "done" && job.summary && (
        <div className="space-y-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Dossier ingéré — {job.summary.stored} fichier·s conservé·s ({humanSize(job.summary.totalBytes)}).
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" /> {job.summary.stored} sain·s</span>
            {job.summary.suspicious > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><ShieldAlert className="h-3.5 w-3.5" /> {job.summary.suspicious} à vérifier</span>}
            {job.summary.blocked > 0 && <span className="inline-flex items-center gap-1 text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> {job.summary.blocked} non lu·s</span>}
          </div>
          {job.summary.blocked > 0 && (
            <p className="text-xs text-muted-foreground">Les fichiers non lus (protégés, corrompus ou d'un format non pris en charge) sont listés dans le dossier avec leur raison — corrigez-les puis renvoyez le même ZIP pour les compléter.</p>
          )}
        </div>
      )}
    </div>
  );
}
