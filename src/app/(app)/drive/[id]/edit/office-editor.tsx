"use client";

import * as React from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// L'API du Document Server est injectée globalement par api.js.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DocsAPI?: { DocEditor: new (el: string, config: unknown) => { destroyEditor?: () => void } };
  }
}

/** Origine du Document Server (pour préconnecter et accélérer le chargement des assets). */
function originOf(url: string): string | null {
  try { return new URL(url).origin; } catch { return null; }
}

export function OfficeEditor({ apiJs, config, name, backHref = "/drive", backLabel = "Retour au Drive" }: { apiJs: string; config: unknown; name: string; backHref?: string; backLabel?: string }) {
  const editorRef = React.useRef<{ destroyEditor?: () => void } | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const origin = originOf(apiJs);

  const init = React.useCallback(() => {
    if (!window.DocsAPI || editorRef.current) return;
    editorRef.current = new window.DocsAPI.DocEditor("onlyoffice-editor", config);
    setReady(true);
  }, [config]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.DocsAPI) init();
    return () => {
      try { editorRef.current?.destroyEditor?.(); } catch { /* ignore */ }
      editorRef.current = null;
    };
  }, [init]);

  // Synchronise l'état du bouton avec le plein écran natif (Échap, F11…).
  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <div ref={wrapRef} className={cn("flex flex-col bg-background", fullscreen ? "h-screen" : "h-[calc(100vh-3.5rem)]")}>
      {/* Préconnexion au Document Server : réduit la latence de chargement des assets. */}
      {origin && (
        <>
          <link rel="preconnect" href={origin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={origin} />
        </>
      )}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <span className="truncate text-sm font-medium">{name}</span>
        <button
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          title={fullscreen ? "Quitter le plein écran" : "Éditer en plein écran"}
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{fullscreen ? "Quitter" : "Plein écran"}</span>
        </button>
      </div>
      <div className="relative flex-1">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> <span className="ml-2 text-sm">Chargement de l'éditeur…</span>
          </div>
        )}
        <div id="onlyoffice-editor" className="h-full w-full" />
      </div>
      <Script src={apiJs} strategy="afterInteractive" onLoad={init} />
    </div>
  );
}
