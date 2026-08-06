"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * REVENIR À LA PAGE PRÉCÉDENTE — et pas à la racine du module.
 *
 * Les liens « ← Retour aux dossiers » pointaient en dur vers l'accueil du module. Or on arrive
 * rarement d'une liste vierge : on vient d'une liste **filtrée**, d'une recherche, d'un autre
 * module, d'une notification. Renvoyer à la racine faisait perdre ce contexte à chaque fois —
 * il fallait refiltrer, re-chercher, re-défiler.
 *
 * Le lien remonte donc l'historique **quand il y a un historique dans l'application**, et
 * retombe sur sa destination écrite quand il n'y en a pas — arrivée directe par notification,
 * signet, ou nouvel onglet. Dans ces cas-là, `router.back()` sortirait du site.
 *
 * Le compteur vit en `sessionStorage` : par onglet, effacé à sa fermeture. Un compteur global
 * ferait croire à un historique dans un onglet fraîchement ouvert.
 *
 * Reste un vrai `<Link>` : le clic milieu, « ouvrir dans un nouvel onglet » et la navigation
 * sans JavaScript continuent de fonctionner.
 */

const KEY = "amd-nav-depth";

/** Nombre de navigations effectuées DANS l'application, pour cet onglet. */
function depth(): number {
  try {
    return Number(sessionStorage.getItem(KEY) ?? "0") || 0;
  } catch {
    return 0; // navigation privée stricte : on retombe sur le lien écrit
  }
}

/**
 * Compte les navigations internes. Monté une fois dans la coque de l'application.
 *
 * ⚠️ Ne compte QUE les changements de chemin après le premier rendu : la page d'arrivée n'est
 * pas une navigation, sinon un lien « Retour » ouvert directement croirait pouvoir remonter.
 */
export function NavDepthTracker() {
  const pathname = usePathname();
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      // Nouvel onglet / rechargement : l'historique interne repart de zéro.
      try { sessionStorage.setItem(KEY, "0"); } catch { /* stockage indisponible */ }
      return;
    }
    try { sessionStorage.setItem(KEY, String(depth() + 1)); } catch { /* stockage indisponible */ }
  }, [pathname]);

  return null;
}

export function BackLink({
  href, children, className,
}: {
  /** Destination de repli, utilisée quand il n'y a rien où revenir. */
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // On ne détourne jamais un geste qui veut ouvrir ailleurs (nouvel onglet, nouvelle fenêtre).
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (depth() > 0) {
      e.preventDefault();
      router.back();
    }
    // Sinon : le lien fait son travail normal vers `href`.
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      className={className ?? "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"}
    >
      {children}
    </Link>
  );
}
