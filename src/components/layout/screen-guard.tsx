"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

/**
 * Protection anti-capture (dissuasion + compliance) :
 *  - **Flou** de l'interface quand une **capture est détectée** (Impr.écran, raccourcis
 *    macOS/Windows) et quand la fenêtre **perd le focus** (regard indiscret, enregistrement).
 *  - **Alerte le Super Admin** (journal d'audit + notification) : qui a tenté, où.
 *
 * ⚠ Le navigateur ne peut PAS rendre une capture « toute noire » (seule une app bureau
 * native le pourrait) — ceci est une couche dissuasive + traçable, pas un blocage absolu.
 */
const REPORT_DEBOUNCE_MS = 4000;

export function ScreenGuard() {
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;

  const [flash, setFlash] = React.useState(false); // capture détectée (flou bref)
  const [hidden, setHidden] = React.useState(false); // fenêtre non focalisée / masquée
  const lastReport = React.useRef(0);
  const flashTimer = React.useRef<number | null>(null);

  const report = React.useCallback((method: string) => {
    setFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1400);
    // Écrase le presse-papier (best-effort : souvent refusé par le navigateur → ignoré).
    try { navigator.clipboard?.writeText?.(" ").catch(() => undefined); } catch { /* ignore */ }
    const now = Date.now();
    if (now - lastReport.current < REPORT_DEBOUNCE_MS) return;
    lastReport.current = now;
    try {
      const data = JSON.stringify({ path: pathRef.current, method });
      const blob = new Blob([data], { type: "text/plain" });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/security/screenshot-attempt", blob);
      else fetch("/api/security/screenshot-attempt", { method: "POST", body: data, keepalive: true });
    } catch { /* best-effort */ }
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "PrintScreen") return report("Impr.écran");
      // macOS : Cmd+Shift+3/4/5 (capture / enregistrement).
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(k)) return report("Capture macOS");
      // Windows : Win+Shift+S (outil Capture d'écran). Le Win = touche Meta.
      if (e.metaKey && e.shiftKey && (k === "s" || k === "S")) return report("Outil Capture (Win+Shift+S)");
    };
    document.addEventListener("keyup", onKey);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keyup", onKey); document.removeEventListener("keydown", onKey); };
  }, [report]);

  // Flou quand l'application perd le focus / l'onglet est masqué (auto-levé au retour).
  React.useEffect(() => {
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!flash && !hidden) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[999] flex items-center justify-center bg-background/95 backdrop-blur-2xl">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-lg">
        <ShieldAlert className="h-4 w-4 text-destructive" /> Contenu confidentiel — capture d&apos;écran surveillée
      </div>
    </div>
  );
}
