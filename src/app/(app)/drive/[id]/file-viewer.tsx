"use client";

import { Download } from "lucide-react";

export function FileViewer({ id, name, kind }: { id: string; name: string; kind: string }) {
  const src = `/api/drive/${id}/raw`;

  if (kind === "image") {
    return (
      <div className="flex justify-center rounded-lg bg-muted/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="max-h-[72vh] rounded-lg object-contain" />
      </div>
    );
  }
  if (kind === "video") {
    return <video src={src} controls className="max-h-[72vh] w-full rounded-lg bg-black" />;
  }
  if (kind === "audio") {
    return <audio src={src} controls className="w-full" />;
  }
  if (kind === "pdf" || kind === "text") {
    return <iframe src={src} title={name} className="h-[78vh] w-full rounded-lg border border-border bg-white" />;
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Aperçu non disponible pour ce type de fichier{kind === "office" ? " — l'éditeur Office (Word/Excel/PowerPoint) arrive en Phase 2." : "."}
      </p>
      <a href={`${src}?dl=1`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <Download className="h-4 w-4" /> Télécharger
      </a>
    </div>
  );
}
