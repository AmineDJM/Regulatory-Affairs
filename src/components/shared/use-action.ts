"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/types";
import { actionFailureMessage, ACTION_TIMEOUT_MS } from "@/lib/action-outcome";

/**
 * APPELER UNE ACTION SERVEUR SANS POUVOIR RESTER BLOQUÉ.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────────────────────
 *
 * Ce crochet était recopié à l'identique dans six écrans (directives, projets, information
 * médicale, recrutement, regulatory, support), et les six portaient le même défaut :
 *
 *     const r = await fn();   // si `fn` LÈVE, la ligne suivante n'existe pas
 *     setSaving(false);
 *
 * Une action qui lève laissait donc le bouton tourner POUR TOUJOURS, sans message. Corriger six
 * copies aurait garanti qu'une septième renaisse : le crochet vit désormais ici, une fois.
 *
 * Deux garde-fous, et le second est indispensable — attraper la levée ne suffit pas si le
 * serveur ne répond JAMAIS (requête suspendue, conteneur redémarré au milieu) : rien ne
 * réveillerait l'attente, et c'est précisément le cas qui bloquait l'écran des courriers.
 *
 * Le message de secours est PUR et testé (`lib/action-outcome.ts`) : il n'invite jamais à
 * réessayer — ce réflexe-là fabrique les doublons.
 */
export function useAction() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // Le composant peut disparaître pendant l'attente (panneau refermé) : écrire dans son état
  // après coup n'a plus de sens.
  const vivant = React.useRef(true);
  React.useEffect(() => () => { vivant.current = false; }, []);

  const run = React.useCallback(
    async (fn: () => Promise<ActionResult>, onOk?: () => void): Promise<boolean> => {
      setSaving(true); setErr(null);
      // Le chronomètre court EN PARALLÈLE de l'action : on ne peut pas annuler une requête
      // serveur, mais on peut cesser de faire attendre la personne sans rien lui dire.
      let fini = false;
      const minuteur = setTimeout(() => {
        if (fini || !vivant.current) return;
        setSaving(false);
        setErr(actionFailureMessage("TIMEOUT"));
      }, ACTION_TIMEOUT_MS);
      try {
        const r = await fn();
        fini = true;
        if (!vivant.current) return r.ok;
        setSaving(false);
        if (r.ok) { onOk?.(); router.refresh(); return true; }
        setErr(r.error ?? "Action impossible.");
        return false;
      } catch (e) {
        fini = true;
        console.error("[action] l'action serveur a levé", e);
        if (vivant.current) { setSaving(false); setErr(actionFailureMessage("THROWN")); }
        return false;
      } finally {
        clearTimeout(minuteur);
      }
    },
    [router],
  );

  // `busy` est l'alias historique de `saving` : les six écrans repris n'utilisaient pas le même
  // nom, et les renommer tous aurait élargi ce lot sans rien corriger.
  return { saving, busy: saving, err, setErr, run };
}

/**
 * LA VARIANTE À CLÉ — quand plusieurs boutons du même écran s'actionnent séparément.
 *
 * `busy` porte alors la clé du bouton en cours plutôt qu'un booléen : sans cela, cliquer
 * « Accepter » ferait tourner aussi « Refuser », et l'on ne saurait plus lequel on a pressé.
 */
export function useKeyedAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const vivant = React.useRef(true);
  React.useEffect(() => () => { vivant.current = false; }, []);

  const run = React.useCallback(
    async (key: string, fn: () => Promise<ActionResult>): Promise<boolean> => {
      setBusy(key); setError(null);
      let fini = false;
      const minuteur = setTimeout(() => {
        if (fini || !vivant.current) return;
        setBusy(null);
        setError(actionFailureMessage("TIMEOUT"));
      }, ACTION_TIMEOUT_MS);
      try {
        const r = await fn();
        fini = true;
        if (!vivant.current) return r.ok;
        setBusy(null);
        if (!r.ok) { setError(r.error ?? "Action impossible."); return false; }
        router.refresh();
        return true;
      } catch (e) {
        fini = true;
        console.error("[action] l'action serveur a levé", e);
        if (vivant.current) { setBusy(null); setError(actionFailureMessage("THROWN")); }
        return false;
      } finally {
        clearTimeout(minuteur);
      }
    },
    [router],
  );

  return { busy, error, run, setError };
}
