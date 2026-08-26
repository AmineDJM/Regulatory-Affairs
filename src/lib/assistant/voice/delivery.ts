/**
 * L'OBLIGATION DE RESTITUER — pour que le PDG n'ait plus jamais à dire « Alors ? ».
 *
 * LE DÉFAUT QU'ON FERME. Le PDG demande, Adam part chercher, l'outil rend son résultat… et rien
 * ne sort. Le résultat existe, il est correct, il est là — et il reste là. Au bout de vingt
 * secondes le PDG demande « Alors ? », et c'est LUI qui fait le travail de relance. Ce n'est pas
 * une lenteur : c'est une promesse non tenue. Un chef de cabinet qui oublie de rendre ce qu'on
 * lui a demandé n'est pas lent, il n'est pas fiable.
 *
 * LA CAUSE N'EST PAS LE MODÈLE. À l'oral, la conversation et le travail avancent sur DEUX rythmes
 * différents : la parole est synchrone, l'outil ne l'est pas. Quand le résultat arrive, le tour
 * qui l'avait demandé est souvent clos — plus personne ne le « porte ». Sans état explicite, le
 * résultat n'appartient à personne, et ce qui n'appartient à personne ne sort jamais.
 *
 * D'OÙ UNE MACHINE À ÉTATS EXPLICITE, dont le seul rôle est de garantir qu'un travail commencé a
 * exactement une fin visible :
 *
 *     RECEIVED ──▶ WORKING ──▶ RESULT_READY ──▶ DELIVERING ──▶ DELIVERED
 *         │            │             │               │
 *         └────────────┴─────────────┴───────────────┴────▶ FAILED (dit, lui aussi)
 *
 * DEUX INVARIANTS PORTENT TOUT LE RESTE :
 *
 *   1. ON SORT TOUJOURS. `FAILED` est un état TERMINAL QUI PARLE : « je n'ai pas pu » est une
 *      restitution. Le silence n'en est pas une. Une obligation ne s'évapore pas.
 *   2. ON NE DIT QU'UNE FOIS. `DELIVERING` est le verrou qui rend la livraison exactement-une-fois :
 *      sans lui, un réveil concurrent (watchdog + réponse du fournisseur) dirait deux fois la même
 *      chose — le défaut symétrique, et tout aussi visible.
 *
 * Pur, sans base ni réseau : la même machine tourne dans le navigateur qui parle et sur le
 * serveur qui persiste, et elle se teste sans décor.
 */

export type DeliveryState =
  /** La demande est entendue et reconnue. Rien n'a encore été fait. */
  | "RECEIVED"
  /** Le travail est en cours (outil, recherche, rédaction). */
  | "WORKING"
  /** Le résultat existe et attend d'être dit. C'EST L'ÉTAT DANGEREUX — celui où l'on oublie. */
  | "RESULT_READY"
  /** La restitution est en train de sortir. Verrou d'unicité. */
  | "DELIVERING"
  /** Dit. Terminal. */
  | "DELIVERED"
  /** Échoué — et l'échec DOIT être dit. Terminal. */
  | "FAILED";

export type DeliveryEvent =
  | { type: "START_WORK" }
  | { type: "RESULT"; summary: string }
  | { type: "BEGIN_DELIVERY" }
  | { type: "DELIVERED" }
  | { type: "FAIL"; error: string }
  /** Le PDG a réclamé : « Alors ? ». Ne change pas l'état, mais se compte. */
  | { type: "NUDGE" }
  /** Le fil s'est coupé et l'on reprend : la livraison en vol redevient à faire. */
  | { type: "RECOVER" };

export interface DeliveryObligation {
  id: string;
  sessionId: string;
  /** Le tour de parole qui a créé l'obligation — sert à la rattacher au bon contexte. */
  turnId: string;
  /** Ce que le PDG a demandé, en une ligne, pour pouvoir le lui rappeler s'il faut. */
  ask: string;
  state: DeliveryState;
  /** Le résultat, prêt à dire. Renseigné à partir de RESULT_READY. */
  summary?: string | null;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
  /** Nombre de tentatives de livraison — au-delà d'un seuil, on dit l'échec plutôt que réessayer. */
  attempts: number;
  /** Combien de fois le PDG a dû réclamer. Doit rester à zéro : c'est la métrique de §10. */
  nudges: number;
}

const TERMINAL: ReadonlySet<DeliveryState> = new Set<DeliveryState>(["DELIVERED", "FAILED"]);

export const isTerminal = (s: DeliveryState): boolean => TERMINAL.has(s);

/** Une obligation qui doit encore sortir — la question que se pose le superviseur à chaque réveil. */
export const isOutstanding = (o: DeliveryObligation): boolean => !isTerminal(o.state);

/**
 * LES TRANSITIONS LÉGALES.
 *
 * Écrites en table plutôt qu'en `switch` imbriqués : la table SE LIT, et un état oublié se voit à
 * l'œil nu. C'est ce qui rend l'invariant « on sort toujours » vérifiable par lecture, pas
 * seulement par test.
 */
const LEGAL: Record<DeliveryState, Partial<Record<DeliveryEvent["type"], DeliveryState>>> = {
  RECEIVED:     { START_WORK: "WORKING", RESULT: "RESULT_READY", FAIL: "FAILED" },
  WORKING:      { RESULT: "RESULT_READY", FAIL: "FAILED" },
  RESULT_READY: { BEGIN_DELIVERY: "DELIVERING", FAIL: "FAILED" },
  // RECOVER ramène une livraison interrompue à l'état « à dire » : la coupure réseau ne doit pas
  // faire disparaître un résultat qui existe.
  DELIVERING:   { DELIVERED: "DELIVERED", FAIL: "FAILED", RECOVER: "RESULT_READY" },
  DELIVERED:    {},
  FAILED:       {},
};

export type TransitionResult =
  | { ok: true; obligation: DeliveryObligation; changed: boolean }
  | { ok: false; obligation: DeliveryObligation; refusal: string };

/**
 * APPLIQUER UN ÉVÉNEMENT.
 *
 * Une transition illégale n'est PAS une exception : à l'oral, les événements arrivent en désordre
 * (le watchdog et le fournisseur peuvent livrer le même résultat). Refuser en silence et le dire
 * dans `refusal` est exactement ce qui rend la livraison unique sans faire tomber l'appel.
 */
export function applyDelivery(
  o: DeliveryObligation,
  event: DeliveryEvent,
  now: number = Date.now(),
): TransitionResult {
  if (event.type === "NUDGE") {
    // Réclamer ne change pas l'état — cela CONSTATE un manquement, et cela se compte.
    return { ok: true, changed: true, obligation: { ...o, nudges: o.nudges + 1, updatedAt: now } };
  }

  const next = LEGAL[o.state][event.type];
  if (!next) {
    return {
      ok: false,
      obligation: o,
      refusal: isTerminal(o.state)
        ? `Obligation déjà ${o.state === "DELIVERED" ? "restituée" : "close"} — événement ${event.type} ignoré.`
        : `Transition illégale ${o.state} → ${event.type}.`,
    };
  }

  const updated: DeliveryObligation = { ...o, state: next, updatedAt: now };
  if (event.type === "RESULT") updated.summary = event.summary;
  if (event.type === "FAIL") updated.error = event.error;
  if (event.type === "BEGIN_DELIVERY") updated.attempts = o.attempts + 1;
  return { ok: true, obligation: updated, changed: true };
}

export function newObligation(
  input: { id: string; sessionId: string; turnId: string; ask: string },
  now: number = Date.now(),
): DeliveryObligation {
  return {
    ...input, state: "RECEIVED", summary: null, error: null,
    createdAt: now, updatedAt: now, attempts: 0, nudges: 0,
  };
}

/** Au-delà, on cesse de réessayer et l'on DIT l'échec : le silence n'est pas une option. */
export const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * Une livraison partie et jamais confirmée — le fil a lâché en plein milieu. Après ce délai, on
 * la reprend (`RECOVER`) au lieu de l'attendre indéfiniment.
 */
export const DELIVERING_STALE_MS = 8_000;

/**
 * Un résultat prêt qui n'est toujours pas sorti. C'est LA condition qui a fait naître ce module :
 * si elle est vraie ne serait-ce qu'une fois en production, le produit a manqué à sa promesse.
 */
export const READY_STALE_MS = 3_000;

export function staleReason(o: DeliveryObligation, now: number = Date.now()): string | null {
  const age = now - o.updatedAt;
  if (o.state === "RESULT_READY" && age > READY_STALE_MS) return "résultat prêt non restitué";
  if (o.state === "DELIVERING" && age > DELIVERING_STALE_MS) return "restitution interrompue";
  return null;
}

/**
 * CE QU'IL FAUT FAIRE MAINTENANT, pour une obligation donnée. Le superviseur (watchdog, réveil de
 * session, fin d'outil) appelle ceci et n'a plus à raisonner : la machine décide.
 */
export type DeliveryDuty =
  | { do: "NOTHING" }
  | { do: "SPEAK"; summary: string }
  | { do: "SPEAK_FAILURE"; message: string }
  | { do: "RETRY" };

export function dutyFor(o: DeliveryObligation, now: number = Date.now()): DeliveryDuty {
  if (isTerminal(o.state)) return { do: "NOTHING" };

  if (o.state === "RESULT_READY") {
    if (o.attempts >= MAX_DELIVERY_ATTEMPTS) {
      return { do: "SPEAK_FAILURE", message: `Je n'ai pas réussi à te rendre « ${o.ask} ». Je réessaie ?` };
    }
    return { do: "SPEAK", summary: o.summary ?? "" };
  }

  if (o.state === "DELIVERING" && staleReason(o, now)) return { do: "RETRY" };

  // RECEIVED / WORKING : le travail est en cours, on ne parle pas pour ne rien dire. Mais si le
  // PDG a réclamé, il a droit à un signe — un seul, court.
  if (o.nudges > 0 && (o.state === "WORKING" || o.state === "RECEIVED")) {
    return { do: "SPEAK", summary: "J'y suis, deux secondes." };
  }
  return { do: "NOTHING" };
}

/**
 * Parmi plusieurs obligations ouvertes, laquelle rendre d'abord ? La PLUS ANCIENNE prête.
 *
 * Le PDG raisonne dans l'ordre où il a demandé, pas dans l'ordre où les outils ont fini. Rendre
 * d'abord ce qui vient d'arriver donnerait une conversation qui répond à la question d'avant.
 */
export function nextToDeliver(list: DeliveryObligation[], now: number = Date.now()): DeliveryObligation | null {
  const ready = list.filter((o) => o.state === "RESULT_READY" || (o.state === "DELIVERING" && staleReason(o, now)));
  if (ready.length === 0) return null;
  return ready.reduce((oldest, o) => (o.createdAt < oldest.createdAt ? o : oldest));
}
