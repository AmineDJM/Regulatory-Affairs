"use client";

import * as React from "react";
import { Video, ExternalLink } from "lucide-react";

/**
 * Écran de connexion invité (externe) : on demande un nom d'affichage, puis on ouvre la
 * salle Jitsi dans la page. `baseUrl` est calculé côté serveur (aucune dépendance importée
 * côté client) ; on y ajoute simplement le nom choisi.
 */
export function PublicJoin({ baseUrl, title }: { baseUrl: string; title: string }) {
  const [name, setName] = React.useState("");
  const [joined, setJoined] = React.useState(false);

  const url = React.useMemo(() => {
    if (!name.trim()) return baseUrl;
    const sep = baseUrl.includes("#") ? "&" : "#";
    return `${baseUrl}${sep}userInfo.displayName=${encodeURIComponent(`"${name.trim().replace(/"/g, "")}"`)}`;
  }, [baseUrl, name]);

  if (joined) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <iframe src={url} title={title} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" className="h-[70vh] min-h-[440px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Video className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vous êtes invité à rejoindre cette réunion.</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") setJoined(true); }}
        />
        <button type="button" onClick={() => setJoined(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Video className="h-4 w-4" /> Rejoindre
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
          <ExternalLink className="h-4 w-4" /> Ouvrir dans un onglet
        </a>
      </div>
    </div>
  );
}
