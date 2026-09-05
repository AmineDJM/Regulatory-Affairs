"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * L'ATTENTE A UNE FORME — un fil de progression en haut de l'écran, pendant qu'une page arrive.
 *
 * ── POURQUOI PAS `loading.tsx` ──────────────────────────────────────────────────────────────
 *
 * Le squelette de Next (`app/(app)/loading.tsx`) fait la même chose en apparence, mais il
 * enveloppe CHAQUE page dans une frontière Suspense. Or presque toutes nos pages peuvent
 * répondre par `redirect()` — un module masqué, un droit manquant, un alias d'écran
 * (`/aujourdhui` → `/mon-espace`). Sous une frontière Suspense, ce `redirect()` n'est plus une
 * réponse HTTP 307 : la coque est déjà envoyée, l'erreur de redirection voyage dans le flux et
 * c'est le navigateur qui doit rediriger. Sur Next 14.2 en production, cette hydratation d'une
 * frontière tombée en erreur casse la comptabilité des hooks du routeur (« Rendered more hooks
 * than during the previous render », vercel/next.js#63121) : l'audit navigateur a mesuré
 * VINGT-SIX écrans qui n'affichaient plus qu'« Application error » à la place de leur
 * redirection. Le mode développement ne le montre pas ; seul le build le montre.
 *
 * `src/lib/ui/loading-boundary.test.ts` interdit donc un `loading.tsx` au-dessus d'une page qui
 * peut rediriger, et le retour visuel vit ICI, sans frontière : le clic sur un lien interne
 * lance le fil, l'arrivée de la nouvelle adresse le termine.
 *
 * ── CE QU'IL ÉCOUTE ────────────────────────────────────────────────────────────────────────
 *
 * Le clic est capté AVANT le gestionnaire de `next/link` (phase de capture) : à ce moment,
 * `defaultPrevented` ne dit encore rien, donc les gestes qui ouvrent ailleurs (clic milieu,
 * Ctrl/Cmd, `target="_blank"`, téléchargement, autre origine, ancre dans la même page) sont
 * écartés explicitement. Le fil se termine quand l'adresse a CHANGÉ — le routeur ne la met à
 * jour qu'une fois la page reçue et rendue —, ou au bout d'un délai de sécurité si un lien a été
 * intercepté pour autre chose qu'une navigation.
 */

const SAFETY_MS = 12_000;
/** Temps laissé à la transition « 100 % puis fondu » avant de retirer le fil du DOM. */
const DONE_MS = 420;

type Phase = "idle" | "running" | "done";

/** Le lien pointe-t-il vers une AUTRE page de cette application, dans CET onglet ? */
export function isInternalNavigation(a: { href: string; target: string; hasAttribute(n: string): boolean }, current: string): boolean {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  let url: URL, here: URL;
  try { url = new URL(a.href, current); here = new URL(current); } catch { return false; }
  if (url.origin !== here.origin) return false;
  // Même document (ancre, `href="#"`) : rien à attendre.
  if (url.pathname === here.pathname && url.search === here.search) return false;
  return true;
}

export function NavProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [width, setWidth] = React.useState(0);
  const origin = React.useRef<string | null>(null);
  const reduceMotion = React.useRef(false);

  React.useEffect(() => {
    try { reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* sans importance */ }
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !isInternalNavigation(a, window.location.href)) return;
      origin.current = window.location.href;
      setPhase("running");
    };
    const onPop = () => { origin.current = window.location.href; setPhase("running"); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("popstate", onPop); };
  }, []);

  // Le chemin a changé : la page est là (couvre aussi précédent/suivant).
  React.useEffect(() => { setPhase((p) => (p === "running" ? "done" : p)); }, [pathname]);

  React.useEffect(() => {
    if (phase === "running") {
      setWidth(0);
      // Deux images : la première pose 0 %, la seconde lance la transition vers 88 %.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setWidth(reduceMotion.current ? 60 : 88)));
      // Une navigation vers la même page avec d'autres paramètres (`?y=&m=`) ne change pas le
      // chemin : on surveille l'adresse elle-même, sans `useSearchParams` (qui imposerait une
      // frontière Suspense à toutes les pages — précisément ce qu'on refuse ici).
      const tick = window.setInterval(() => { if (window.location.href !== origin.current) setPhase("done"); }, 120);
      const safety = window.setTimeout(() => setPhase("done"), SAFETY_MS);
      return () => { cancelAnimationFrame(raf); window.clearInterval(tick); window.clearTimeout(safety); };
    }
    if (phase === "done") {
      setWidth(100);
      const t = window.setTimeout(() => { setPhase("idle"); setWidth(0); }, DONE_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  if (phase === "idle") return null;
  const running = phase === "running";
  return (
    <div role="progressbar" aria-label="Chargement de la page" aria-busy={running} className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5">
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
        style={{
          width: `${width}%`,
          opacity: running ? 1 : 0,
          transition: reduceMotion.current
            ? "opacity 200ms ease-out 150ms"
            : running ? "width 9s cubic-bezier(0.1, 0.6, 0.2, 1)" : "width 150ms ease-out, opacity 250ms ease-in 120ms",
        }}
      />
    </div>
  );
}
