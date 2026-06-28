"use client";

import * as React from "react";
import { Video, ExternalLink } from "lucide-react";

/**
 * Salle Jitsi intégrée. On ne charge l'iframe (et donc on n'active caméra/micro) qu'au
 * clic « Rejoindre » — pas d'auto-démarrage. Un lien « nouvel onglet » sert de repli si
 * l'intégration est bloquée par le navigateur.
 */
export function JitsiRoom({ url, title }: { url: string; title: string }) {
  const [joined, setJoined] = React.useState(false);

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/30 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Video className="h-7 w-7 text-primary" />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          La salle s'ouvre dans cette page. Votre caméra et votre micro ne s'activent qu'après avoir cliqué.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button" onClick={() => setJoined(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Video className="h-4 w-4" /> Rejoindre la réunion
          </button>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            <ExternalLink className="h-4 w-4" /> Ouvrir dans un onglet
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <iframe
        src={url}
        title={title}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        className="h-[60vh] min-h-[420px] w-full"
      />
    </div>
  );
}
