"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cleParPersonne, lireMarqueVue } from "@/lib/vue-exacte-ui";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ À L'ÉCRAN — côté navigateur (Direction, 06/10 : « pas de chevauchement possible »).
 *
 * `IdentiteProvider` donne aux écrans la personne EFFECTIVE (celle que la coque a été rendue pour) : les
 * données personnelles gardées dans le navigateur (brouillons, presse-papiers, épingles) se rangent sous
 * son identifiant (`cleParPersonne`) — l'administrateur ne retrouve jamais son brouillon dans l'écran de
 * Leila, ni Leila le sien dans celui de l'administrateur.
 *
 * `GardeIdentite` recharge l'onglet ENTIER dès que la vue a changé ailleurs que par ses boutons : un autre
 * onglet qui entre ou sort, la vue qui expire (4 h), un retour arrière servi par le cache du navigateur.
 * Une navigation douce ne rend que la page — la coque (nom en haut, menu, bandeau) resterait celle d'avant,
 * et l'écran mêlerait deux personnes. Le serveur passe le témoin qu'il a VU ; l'onglet compare au témoin
 * actuel — même source des deux côtés, donc jamais de boucle de rechargement.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface IdentiteEcran {
  /** La personne effective (visualisée en Vue exacte, sinon l'utilisateur réel). */
  id: string;
  /** Vrai en Vue exacte. */
  vue: boolean;
}

const Ctx = React.createContext<IdentiteEcran>({ id: "", vue: false });

export function IdentiteProvider({ id, vue, children }: IdentiteEcran & { children: React.ReactNode }) {
  const valeur = React.useMemo(() => ({ id, vue }), [id, vue]);
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

/** La personne à l'écran — pour ranger ses données navigateur sous SON identifiant. */
export function useIdentiteEcran(): IdentiteEcran {
  return React.useContext(Ctx);
}

/** La clé navigateur d'une donnée personnelle, rangée sous la personne à l'écran (`cleParPersonne`). */
export function useCleParPersonne(base: string): string {
  const { id } = useIdentiteEcran();
  return cleParPersonne(base, id);
}

/**
 * Lit une donnée personnelle du navigateur sous la clé de la personne à l'écran. Hors vue, une valeur
 * rangée sous l'ANCIENNE clé commune (avant le rangement par personne) est reprise — l'utilisateur réel
 * ne perd pas ses préférences ; en vue, jamais : ce serait celles de l'administrateur.
 */
export function lireStockagePersonnel(base: string, ident: IdentiteEcran): string | null {
  try {
    const propre = window.localStorage.getItem(cleParPersonne(base, ident.id));
    if (propre !== null || ident.vue || !ident.id) return propre;
    return window.localStorage.getItem(base);
  } catch {
    return null;
  }
}

/**
 * Un bouton d'entrée/sortie de vue est en train de basculer : il recharge LUI-MÊME vers sa destination
 * (`window.location.assign`). La garde se tait, sinon elle rechargerait la page d'avant sous l'autre identité.
 */
let basculeEnCours = false;
export function annoncerBasculeDeVue(): void {
  basculeEnCours = true;
}
export function annulerBasculeDeVue(): void {
  basculeEnCours = false;
}

export function GardeIdentite({ marque }: { marque: string }) {
  const pathname = usePathname();
  const recharge = React.useRef(false);

  const verifier = React.useCallback(() => {
    if (recharge.current || basculeEnCours) return;
    let actuelle: string;
    try { actuelle = lireMarqueVue(document.cookie); } catch { return; }
    if (actuelle === marque) return;
    recharge.current = true;
    window.location.reload();
  }, [marque]);

  // À chaque navigation : une page rendue pour une autre personne ne s'affiche pas sous cette coque.
  React.useEffect(() => { verifier(); }, [pathname, verifier]);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") verifier(); };
    // `pageshow` persistant = page ressortie du cache arrière du navigateur, figée avant le changement.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { recharge.current = false; basculeEnCours = false; verifier(); } };
    window.addEventListener("focus", verifier);
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    // Un onglet resté au premier plan (deux fenêtres côte à côte) : sondage léger, sans réseau.
    const t = window.setInterval(() => { if (document.visibilityState === "visible") verifier(); }, 3000);
    return () => {
      window.removeEventListener("focus", verifier);
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(t);
    };
  }, [verifier]);

  return null;
}
