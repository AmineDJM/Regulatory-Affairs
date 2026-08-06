"use client";

import * as React from "react";

/**
 * VERROU DE DÉFILEMENT — empêcher la page de bouger derrière une couche modale.
 *
 * Pourquoi ce fichier existe : le code verrouillait `document.body`. Or dans cette
 * application, **ce n'est pas le `body` qui défile** — la coque est `h-screen
 * overflow-hidden` et le conteneur défilant est le `<main>`. Le verrou ne faisait donc
 * strictement RIEN : on ouvrait le menu, on faisait glisser le doigt, et c'était la page
 * derrière qui défilait pendant que le menu restait immobile.
 *
 * On verrouille donc **le conteneur réel** (`#app-scroll`), et le `body` en plus pour les
 * écrans hors coque applicative (connexion, portail public, onboarding).
 *
 * **Comptage de références** : deux couches peuvent se superposer (une feuille ouverte
 * depuis un tiroir). Sans compteur, fermer la première rendrait le défilement à la seconde,
 * encore ouverte. On ne déverrouille qu'au dernier relâchement.
 *
 * ⚠️ On ne touche PAS au `scrollTop` : mettre `overflow: hidden` fige la position sans la
 * perdre. Les astuces à base de `position: fixed` sur le body font sauter la page en haut à
 * la fermeture — le défaut classique, et très visible sur iOS.
 */

/** Identifiant du conteneur défilant de la coque applicative (posé sur `<main>`). */
export const APP_SCROLL_ID = "app-scroll";

let holders = 0;
let release: (() => void) | null = null;

function lock(): void {
  holders += 1;
  if (holders > 1) return; // déjà verrouillé par une couche au-dessus

  const targets: { el: HTMLElement; prev: string }[] = [];
  const remember = (el: HTMLElement | null) => {
    if (!el) return;
    targets.push({ el, prev: el.style.overflow });
    el.style.overflow = "hidden";
  };

  remember(document.getElementById(APP_SCROLL_ID));
  remember(document.body);

  release = () => {
    for (const { el, prev } of targets) el.style.overflow = prev;
  };
}

function unlock(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return; // une autre couche tient encore le verrou
  release?.();
  release = null;
}

/**
 * Fige le défilement de l'arrière-plan tant que `active` est vrai.
 *
 * ```tsx
 * useScrollLock(drawerOpen);
 * ```
 */
export function useScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
