"use client";

import * as React from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

// L'API du Document Server est injectée globalement par api.js.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DocsAPI?: { DocEditor: new (el: string, config: unknown) => { destroyEditor?: () => void } };
  }
}

export function OfficeEditor({ apiJs, config, name, backHref = "/drive", backLabel = "Retour au Drive" }: { apiJs: string; config: unknown; name: string; backHref?: string; backLabel?: string }) {
  const editorRef = React.useRef<{ destroyEditor?: () => void } | null>(null);
  const [ready, setReady] = React.useState(false);

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="w-24" />
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
