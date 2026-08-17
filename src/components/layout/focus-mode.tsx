"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * LE PLEIN ÉCRAN, PARTOUT, ET QUI GARDE LA NAVIGATION.
 *
 * Plein écran veut dire PLEIN ÉCRAN : on récupère la barre du navigateur, l'en-tête de
 * l'application ET la barre latérale. Un tableau de quarante colonnes ne se lit pas dans la
 * largeur qui reste à côté d'un menu de 256 px — c'est précisément pour ces écrans-là qu'on
 * demande le plein écran. La sortie est toujours à portée : le bouton flottant « Quitter », rendu
 * à la racine (hors du chrome masqué), et la touche Échap.
 *
 * L'état vit sur `<html>` (classe `amd-focus`) et non dans un contexte React : c'est ce qui
 * permet à n'importe quel écran d'offrir le bouton — celui de l'en-tête, celui de la barre du
 * Drive — sans se coordonner. Le CSS (globals.css) fait le reste : il replie le chrome, relâche
 * la largeur maximale, et fait apparaître le bouton flottant pour ressortir.
 */

const FOCUS_CLASS = "amd-focus";
const EVENT = "amd:focus-change";

/** Active/désactive le plein écran. Utilisable depuis n'importe quel bouton, sans contexte. */
export function setFocusMode(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(FOCUS_CLASS, on);
  try {
    if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    else if (!on && document.fullscreenElement) void document.exitFullscreen?.();
  } catch {
    // Refusé (permission, navigateur, iframe) : le mode CSS suffit à agrandir, on ne bloque pas.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Suit l'état du plein écran, où qu'il soit basculé (en-tête, Drive, Regulatory, touche Échap). */
export function useFocusState(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setOn(document.documentElement.classList.contains(FOCUS_CLASS));
    sync();
    // La touche Échap sort du plein écran NAVIGATEUR sans passer par nos boutons : on retire
    // alors le mode CSS aussi, sinon le chrome resterait caché sans moyen de le rappeler.
    const onFsChange = () => {
      if (!document.fullscreenElement) document.documentElement.classList.remove(FOCUS_CLASS);
      sync();
    };
    window.addEventListener(EVENT, sync);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener(EVENT, sync);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);
  return on;
}

/** Le bouton de l'en-tête — donc présent sur TOUS les écrans. */
export function FocusToggle() {
  const on = useFocusState();
  return (
    <button
      type="button"
      onClick={() => setFocusMode(!on)}
      title={on ? "Quitter le plein écran" : "Plein écran"}
      aria-label={on ? "Quitter le plein écran" : "Plein écran"}
      className="hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex"
    >
      {on ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}

/**
 * Le bouton flottant pour RESSORTIR — rendu à la racine, hors du chrome qu'on masque.
 * Sans lui, une fois l'en-tête replié, on n'aurait plus aucun bouton pour revenir.
 */
export function FocusExit() {
  const on = useFocusState();
  if (!on) return null;
  return (
    <button
      type="button"
      onClick={() => setFocusMode(false)}
      className="fixed right-3 top-3 z-[60] inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-sm font-medium text-foreground shadow-lg backdrop-blur hover:bg-secondary"
    >
      <Minimize2 className="h-4 w-4" /> Quitter le plein écran
    </button>
  );
}
