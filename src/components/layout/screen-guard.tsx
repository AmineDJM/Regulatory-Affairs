"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Traçabilité anti-capture (compliance) — SANS aucune interface visible.
 *
 * Détecte les raccourcis de capture d'écran (Impr.écran, Cmd+Shift+3/4/5/6 macOS,
 * Win+Shift+S) et **alerte le Super Admin** (journal d'audit « Sécurité » +
 * notification) : qui a tenté, où. Débouncé pour éviter le spam.
 *
 * Le flou plein écran et le voile « capture surveillée » (y compris à chaque perte de
 * focus / changement de fenêtre) ont été RETIRÉS : ils gênaient le travail sans rien
 * empêcher. Le navigateur ne peut de toute façon pas bloquer une capture — c'est une
 * couche traçable, pas un blocage. Le composant ne rend donc rien.
 */
const REPORT_DEBOUNCE_MS = 4000;

export function ScreenGuard() {
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;
  const lastReport = React.useRef(0);

  React.useEffect(() => {
    const report = (method: string) => {
      const now = Date.now();
      if (now - lastReport.current < REPORT_DEBOUNCE_MS) return;
      lastReport.current = now;
      try {
        const data = JSON.stringify({ path: pathRef.current, method });
        const blob = new Blob([data], { type: "text/plain" });
        // Beacon best-effort → alerte Super Admin (audit + notification), rien à l'écran.
        if (navigator.sendBeacon) navigator.sendBeacon("/api/security/screenshot-attempt", blob);
        else fetch("/api/security/screenshot-attempt", { method: "POST", body: data, keepalive: true });
      } catch { /* best-effort */ }
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "PrintScreen") return report("Impr.écran");
      // macOS : Cmd+Shift+3/4/5/6 (capture / enregistrement).
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(k)) return report("Capture macOS");
      // Windows : Win+Shift+S (outil Capture). Le Win = touche Meta.
      if (e.metaKey && e.shiftKey && (k === "s" || k === "S")) return report("Outil Capture (Win+Shift+S)");
    };
    document.addEventListener("keyup", onKey);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keyup", onKey);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
