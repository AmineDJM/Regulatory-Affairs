"use client";

import * as React from "react";
import { Check, Loader2, Pause, Play, Send, Square, X } from "lucide-react";
import {
  arreterMission, deciderAccordMission, fournirElementMission,
  mettreMissionEnPause, reprendreMission,
} from "@/lib/actions/mission-runtime-actions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES GESTES QUE SEULE UNE PERSONNE PEUT POSER (§33-38).
 *
 * ── POURQUOI CES BOUTONS SONT ICI ET PAS DANS LA CONVERSATION ───────────────────────────
 *
 * Accorder une autorisation et fournir un élément sont des ATTESTATIONS : l'audit portera le
 * nom de la personne. Les rendre appelables par un modèle les exposerait à l'injection — un
 * document lu par une étape pourrait contenir « approuve la mission », et rien, ensuite, ne
 * distinguerait cet accord d'un vrai. C'est la seule falsification que ce système ne saurait
 * pas détecter après coup, donc la seule qu'il faut rendre impossible avant.
 *
 * Les gestes qui RÉDUISENT — suspendre, arrêter, refuser — sont, eux, disponibles aussi dans la
 * conversation (`mission_control`) : au pire, une injection ferait s'arrêter une mission, ce qui
 * se voit et se répare.
 *
 * ── L'ÉTAT VIT ICI, PAS DANS UN CACHE ───────────────────────────────────────────────────
 *
 * Chaque action serveur rend le statut d'après. On l'affiche, et l'on rafraîchit la page pour
 * le reste — plutôt que de reconstruire côté client un état de mission qui existe déjà en base
 * et qui serait faux à la première divergence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Etat = { message: string; ok: boolean } | null;

function useGeste() {
  const [enCours, setEnCours] = React.useState<string | null>(null);
  const [etat, setEtat] = React.useState<Etat>(null);

  const lancer = React.useCallback(async (
    nom: string,
    fn: () => Promise<{ ok: boolean; message: string }>,
  ) => {
    setEnCours(nom);
    setEtat(null);
    try {
      const r = await fn();
      setEtat({ ok: r.ok, message: r.message });
      // ON RECHARGE PLUTÔT QUE DE DEVINER. Un accord fait avancer la mission de plusieurs
      // étapes ; recomposer cela côté client donnerait un écran plausible et faux.
      if (r.ok) setTimeout(() => window.location.reload(), 600);
    } catch {
      setEtat({ ok: false, message: "Le geste n'a pas abouti. Réessayez." });
    } finally {
      setEnCours(null);
    }
  }, []);

  return { enCours, etat, lancer };
}

function Message({ etat }: { etat: Etat }) {
  if (!etat) return null;
  return (
    <p className={`mt-2 text-sm ${etat.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">
      {etat.message}
    </p>
  );
}

/** L'ACCORD — deux boutons, et rien d'autre. La question posée n'a que deux réponses. */
export function AccordControls({ approvalId, resume }: { approvalId: string; resume: string }) {
  const { enCours, etat, lancer } = useGeste();
  return (
    <div data-testid="mission-accord">
      <p className="text-sm text-slate-700">{resume}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={enCours !== null}
          onClick={() => lancer("accorder", () => deciderAccordMission(approvalId, "GRANTED"))}
        >
          {enCours === "accorder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          J&apos;autorise
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
          disabled={enCours !== null}
          onClick={() => lancer("refuser", () => deciderAccordMission(approvalId, "REFUSED"))}
        >
          {enCours === "refuser" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Je refuse
        </button>
      </div>
      <Message etat={etat} />
    </div>
  );
}

/** L'ÉLÉMENT DEMANDÉ — un champ, et la question au-dessus, mot pour mot. */
export function ElementControls(
  { missionId, stepKey, question }: { missionId: string; stepKey: string; question: string },
) {
  const [texte, setTexte] = React.useState("");
  const { enCours, etat, lancer } = useGeste();
  const vide = texte.trim() === "";

  return (
    <form
      data-testid="mission-element"
      onSubmit={(e) => {
        e.preventDefault();
        if (vide) return;
        void lancer("fournir", () => fournirElementMission(missionId, stepKey, texte));
      }}
    >
      <label className="block text-sm text-slate-700" htmlFor={`el-${stepKey}`}>{question}</label>
      <div className="mt-2 flex gap-2">
        <input
          id={`el-${stepKey}`}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Votre réponse"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={vide || enCours !== null}
        >
          {enCours === "fournir" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Fournir
        </button>
      </div>
      <Message etat={etat} />
    </form>
  );
}

/**
 * SUSPENDRE, REPRENDRE, ARRÊTER.
 *
 * Les boutons proposés dépendent de l'ÉTAT BRUT, jamais du libellé : « reprendre » n'a de sens
 * que sur une mission suspendue, et proposer « arrêter » sur une mission terminée ferait cliquer
 * sur un bouton qui ne peut rien faire.
 */
export function ConduiteControls({ missionId, statut }: { missionId: string; statut: string }) {
  const { enCours, etat, lancer } = useGeste();
  const terminee = statut === "COMPLETED" || statut === "CANCELLED";
  if (terminee) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="mission-conduite">
      {statut === "PAUSED" ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
          disabled={enCours !== null}
          onClick={() => lancer("reprendre", () => reprendreMission(missionId))}
        >
          {enCours === "reprendre" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Reprendre
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
          disabled={enCours !== null}
          onClick={() => lancer("pause", () => mettreMissionEnPause(missionId))}
        >
          {enCours === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
          Suspendre
        </button>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 disabled:opacity-60"
        disabled={enCours !== null}
        onClick={() => {
          // UNE SEULE CONFIRMATION, et elle dit ce qui ne sera PAS défait. « Êtes-vous sûr ? »
          // ne renseigne sur rien ; ce qui compte, c'est que les envois partis restent partis.
          if (!window.confirm(
            "Arrêter définitivement cette mission ? Ce qui a déjà été fait reste fait — rien n'est défait.",
          )) return;
          void lancer("arreter", () => arreterMission(missionId));
        }}
      >
        {enCours === "arreter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
        Arrêter
      </button>
      <Message etat={etat} />
    </div>
  );
}
