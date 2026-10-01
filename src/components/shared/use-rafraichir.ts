"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * RAFRAÎCHIR SANS LAISSER OUVRIR UNE FICHE PÉRIMÉE (§118.172).
 *
 * ── LE DÉFAUT QUE CE CROCHET FERME ──────────────────────────────────────────────────────────
 *
 * Après une écriture, un écran redemande ses données (`router.refresh()`). Entre la fin de
 * l'action et l'arrivée des nouvelles données, il montre l'état d'AVANT — et ses boutons sont
 * déjà de nouveau cliquables. Trouvé par le banc navigateur des annuaires, sur un écran ordinaire :
 *
 *   décocher « actif », enregistrer, rouvrir la fiche aussitôt → la case est encore COCHÉE ;
 *   enregistrer cette fiche-là RÉACTIVE l'établissement qu'on venait de désactiver.
 *
 * Sur le poste du banc, la fenêtre tient en quelques millisecondes ; au téléphone, en secondes.
 * Une fiche s'ouvre sur un INSTANTANÉ de la ligne : ouverte trop tôt, elle porte la valeur
 * d'avant, et l'enregistrer réécrit l'ancien état par-dessus le nouveau — sans erreur, sans signal.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Le rafraîchissement part dans une TRANSITION, et `enCours` reste vrai jusqu'à ce que les
 * nouvelles données soient À L'ÉCRAN. Un écran qui désactive ses gestes pendant `enCours` ne peut
 * plus ouvrir une fiche sur l'état d'avant : le bouton revient quand ce qu'il ouvrira est à jour.
 * C'est l'écran, pas ce crochet, qui sait quels gestes en dépendent.
 */
export function useRafraichir(): { enCours: boolean; rafraichir: () => void } {
  const router = useRouter();
  const [enCours, demarrer] = React.useTransition();
  const rafraichir = React.useCallback(() => {
    demarrer(() => { router.refresh(); });
  }, [router]);
  return { enCours, rafraichir };
}
