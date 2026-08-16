"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/** Préférence « plein écran » du Drive — par navigateur, comme dans un explorateur. */
const WIDE_KEY = "amd-drive-wide";

/**
 * LE DRIVE EN PLEIN ÉCRAN.
 *
 * Le plafond de 1400 px protège la lecture d'un TEXTE ; appliqué à une arborescence avec son
 * volet de navigation et six colonnes, il ne protège rien — il comprime. On le relève pour cet
 * écran, et pour lui seul : la variable est reposée en quittant la page, sinon un formulaire
 * hériterait d'une largeur pensée pour des colonnes.
 */
export function DriveWideToggle() {
  const [wide, setWide] = React.useState(false);

  React.useEffect(() => {
    setWide(window.localStorage.getItem(WIDE_KEY) === "1");
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (wide) root.style.setProperty("--shell-max", "100%");
    else root.style.removeProperty("--shell-max");
    return () => { root.style.removeProperty("--shell-max"); };
  }, [wide]);

  const toggle = () => {
    const next = !wide;
    setWide(next);
    try { window.localStorage.setItem(WIDE_KEY, next ? "1" : "0"); } catch { /* refusé : sans mémoire */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={wide}
      title={wide ? "Revenir à la largeur de lecture" : "Étendre le Drive à tout l'écran"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors ${
        wide ? "border-primary/50 text-primary" : "border-input text-muted-foreground"
      } hover:bg-secondary`}
    >
      {wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {wide ? "Largeur de lecture" : "Plein écran"}
    </button>
  );
}
