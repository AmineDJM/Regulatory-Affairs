"use client";

import * as React from "react";

/**
 * LES INTITULÉS DES CARTES MOBILES, REPRIS DE L'EN-TÊTE — sans qu'on ait à les recopier cellule par cellule.
 *
 * En mode `mobileCards`, sous 640 px, l'en-tête du tableau disparaît et chaque cellule affiche son intitulé (`data-label`)
 * à gauche de sa valeur. Ce mode exigeait d'écrire `label="…"` sur CHAQUE `TableCell` : la plupart des tableaux ne le
 * faisaient pas, et leurs cartes alignaient des valeurs sans dire ce qu'elles étaient (« 12 », « En attente », « 3 j »).
 *
 * Ce témoin lit les intitulés de l'en-tête (`thead th`, colonnes fusionnées comprises) et les pose sur les cellules qui n'en
 * ont pas. Un intitulé écrit à la main l'emporte toujours ; une colonne SANS intitulé (actions, case à cocher) reste sans
 * étiquette — sa cellule occupe la largeur de la carte, comme avant. Les lignes ajoutées ensuite (filtre, chargement)
 * sont étiquetées à leur arrivée.
 */
export function EtiquettesMobiles() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const table = ref.current?.parentElement?.querySelector("table");
    if (!table) return;

    const etiqueter = () => {
      const entetes: string[] = [];
      const ligneEntete = table.querySelector("thead tr");
      ligneEntete?.querySelectorAll("th, td").forEach((th) => {
        const texte = (th.getAttribute("data-label") ?? th.textContent ?? "").replace(/\s+/g, " ").trim();
        const span = Math.max(1, Number((th as HTMLTableCellElement).colSpan) || 1);
        for (let i = 0; i < span; i++) entetes.push(i === 0 ? texte : "");
      });
      if (entetes.every((e) => !e)) return;
      table.querySelectorAll("tbody tr").forEach((tr) => {
        let colonne = 0;
        Array.from(tr.children).forEach((cellule) => {
          const td = cellule as HTMLTableCellElement;
          const texte = entetes[colonne];
          if (texte && !td.hasAttribute("data-label") && !td.hasAttribute("data-sans-etiquette")) td.setAttribute("data-label", texte);
          colonne += Math.max(1, Number(td.colSpan) || 1);
        });
      });
    };

    etiqueter();
    const observateur = new MutationObserver(etiqueter);
    observateur.observe(table, { childList: true, subtree: true });
    return () => observateur.disconnect();
  }, []);

  return <span ref={ref} hidden />;
}
