"use client";

import * as React from "react";

/**
 * OUVRIR UN FORMULAIRE À L'ARRIVÉE, depuis un lien.
 *
 * Quand on choisit la nature de sa demande ailleurs — « Nouvelle demande » d'Ad & Pro — et qu'on
 * atterrit sur une liste avec un bouton à retrouver, on a exactement perdu ce qu'on venait de
 * gagner. Le formulaire s'ouvre donc tout seul.
 *
 * Le paramètre est ensuite RETIRÉ de l'URL : sans cela, un rafraîchissement, un retour arrière ou
 * un lien mis en favori rouvriraient le formulaire indéfiniment — et l'on finit par cliquer
 * « Annuler » à chaque visite.
 */
export function useAutoOpen(param: string | undefined, open: () => void): void {
  // `open` change à chaque rendu si l'appelant passe une lambda : on garde la dernière version
  // dans une référence pour que l'effet ne se redéclenche pas à chaque rendu.
  const latest = React.useRef(open);
  latest.current = open;

  React.useEffect(() => {
    if (!param) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(param) !== "1") return;
      latest.current();
      url.searchParams.delete(param);
      window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    } catch {
      /* hors navigateur : rien à ouvrir */
    }
  }, [param]);
}
