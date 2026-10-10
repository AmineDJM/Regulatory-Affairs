"use client";

import * as React from "react";

/**
 * ARRIVER SUR LA LIGNE, PAS SEULEMENT SUR L'ÉCRAN — la cible d'un lien de notification.
 *
 * Une notification « Bon de commande à signer » qui ouvre une file de quarante lignes laisse
 * chercher celle dont elle parle. Les écrans qui n'ouvraient pas l'objet exact lisent un paramètre
 * d'adresse (`?ligne=…`, `?bc=…`, `?formation=…`) et posent un identifiant sur la ligne visée ;
 * ce composant la fait venir sous les yeux et l'entoure quelques secondes.
 *
 * Il ne rend rien et ne touche à rien d'autre que des classes de mise en évidence : si aucun
 * élément ne porte l'identifiant (ligne déjà traitée, hors de la liste), l'écran reste tel quel.
 * Plusieurs identifiants se donnent par ordre de préférence — le premier présent dans la page gagne.
 */
const MISE_EN_EVIDENCE = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "transition-shadow"];

export function SurlignerCible({ ids }: { ids: ReadonlyArray<string | null | undefined> }) {
  const cle = ids.filter((x): x is string => Boolean(x)).join("|");
  React.useEffect(() => {
    if (!cle) return;
    const el = cle.split("|").map((id) => document.getElementById(id)).find((e): e is HTMLElement => e !== null);
    if (!el) return;
    // Une ligne rangée dans un volet replié (« Historique… ») : on l'ouvre, sinon rien ne se voit.
    for (let p = el.closest("details"); p; p = p.parentElement?.closest("details") ?? null) p.open = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add(...MISE_EN_EVIDENCE);
    const t = window.setTimeout(() => el.classList.remove(...MISE_EN_EVIDENCE), 6000);
    return () => {
      window.clearTimeout(t);
      el.classList.remove(...MISE_EN_EVIDENCE);
    };
  }, [cle]);
  return null;
}
