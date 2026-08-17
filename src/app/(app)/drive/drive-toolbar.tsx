"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2, Maximize2, Minimize2, MoveHorizontal, Settings2 } from "lucide-react";

/**
 * LA BARRE D'OUTILS DU DRIVE — discrète, parce qu'elle n'est pas le sujet.
 *
 * L'en-tête accumulait sept commandes de même poids : « Plein écran », « Nouveau dossier »,
 * « Nouveau document », « Importer », « Accès & réglages », « Corbeille », plus une phrase
 * d'explication. Sept boutons alignés, c'est zéro hiérarchie : l'œil doit tous les lire pour
 * trouver le bon, et le contenu — les fichiers — est repoussé sous la ligne de flottaison.
 *
 * Deux gestes se font tous les jours : **créer** et **importer**. Ils restent visibles. Le reste
 * (plein écran, réglages d'accès, corbeille) se fait une fois par semaine : ça va dans le menu
 * « ⋯ ». Et la phrase d'explication disparaît — on n'explique pas à quelqu'un ce qu'est un
 * dossier partagé chaque fois qu'il l'ouvre.
 */

/** Préférence « plein écran » du Drive — par navigateur, comme dans un explorateur. */
const WIDE_KEY = "amd-drive-wide";

export function DriveToolbar({
  primary, trashHref, trashLabel, settings,
}: {
  /** Les commandes de tous les jours : créer, importer. Rendues telles quelles. */
  primary?: React.ReactNode;
  trashHref: string;
  trashLabel: string;
  /** Bouton « Accès & réglages » de la catégorie, quand il y a lieu. */
  settings?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const [full, setFull] = React.useState(false);

  React.useEffect(() => { setWide(window.localStorage.getItem(WIDE_KEY) === "1"); }, []);

  React.useEffect(() => {
    // Le plafond de 1400 px protège la lecture d'un TEXTE ; appliqué à une arborescence avec son
    // volet et six colonnes, il ne protège rien — il comprime. Reposé en quittant la page, sinon
    // un formulaire hériterait d'une largeur pensée pour des colonnes.
    const root = document.documentElement;
    if (wide) root.style.setProperty("--shell-max", "100%");
    else root.style.removeProperty("--shell-max");
    return () => { root.style.removeProperty("--shell-max"); };
  }, [wide]);

  /**
   * LE VRAI PLEIN ÉCRAN.
   *
   * Relâcher la largeur maximale ne donnait qu'un écran un peu plus large : le menu latéral, la
   * barre du haut et les marges de la coque restaient là, et il manquait précisément la place
   * qu'on cherchait. On demande donc le plein écran au NAVIGATEUR — l'explorateur occupe alors
   * la dalle entière, comme une application. La largeur maximale est relâchée du même coup :
   * l'un sans l'autre laisserait une colonne de 1400 px au milieu d'un écran vide.
   */
  React.useEffect(() => {
    const sync = () => {
      const on = Boolean(document.fullscreenElement);
      setFull(on);
      if (on) document.documentElement.style.setProperty("--shell-max", "100%");
      else if (!wide) document.documentElement.style.removeProperty("--shell-max");
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [wide]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      // On met en plein écran la PAGE entière et non le seul tableau : sinon le volet de
      // navigation et le fil d'Ariane disparaissent, et l'on ne sait plus où l'on est.
      await document.documentElement.requestFullscreen();
    } catch {
      // Refusé (permission, navigateur) : on garde au moins la pleine largeur, qui ne dépend
      // de personne.
      setWide(true);
      try { window.localStorage.setItem(WIDE_KEY, "1"); } catch { /* sans mémoire */ }
    }
  };

  const toggleWide = () => {
    const next = !wide;
    setWide(next);
    try { window.localStorage.setItem(WIDE_KEY, next ? "1" : "0"); } catch { /* refusé : sans mémoire */ }
  };

  return (
    <div className="flex items-center gap-2">
      {primary}
      {/* « Accès & réglages » vit ICI et non dans le menu « ⋯ » : le panneau y était rendu à
          l'intérieur du menu, et le clic qui l'ouvrait fermait le menu — donc démontait le
          panneau dans le même geste. Rien ne se passait, et c'était sans recours. */}
      {settings}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Plus d'actions"
          aria-expanded={open}
          className="inline-flex items-center rounded-lg border border-input p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
              <button
                type="button"
                onClick={() => { void toggleFullscreen(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary"
              >
                {full ? <Minimize2 className="h-4 w-4 text-muted-foreground" /> : <Maximize2 className="h-4 w-4 text-muted-foreground" />}
                {full ? "Quitter le plein écran" : "Plein écran"}
              </button>
              <button
                type="button"
                onClick={() => { toggleWide(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary"
              >
                <MoveHorizontal className="h-4 w-4 text-muted-foreground" />
                {wide ? "Largeur de lecture" : "Pleine largeur"}
              </button>
              <Link
                href={trashHref}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-secondary"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" /> {trashLabel}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Icône neutre pour les écrans qui veulent afficher « réglages » sans importer lucide. */
export const SettingsIcon = Settings2;
