import { describe, it, expect } from "vitest";
import {
  newObligation, applyDelivery, dutyFor, nextToDeliver, staleReason, isOutstanding, isTerminal,
  MAX_DELIVERY_ATTEMPTS, READY_STALE_MS, DELIVERING_STALE_MS,
  type DeliveryObligation,
} from "./delivery";

/**
 * LE BANC DE L'OBLIGATION DE RESTITUER.
 *
 * Il vérifie DEUX invariants, et rien d'autre — mais ces deux-là portent toute la promesse de §10 :
 *
 *   1. ON SORT TOUJOURS. Aucun chemin ne mène au silence. Un travail commencé finit dit, ou dit
 *      échoué. Le test qui compte est celui qui parcourt TOUS les états et vérifie qu'aucun ne
 *      laisse le PDG sans réponse.
 *   2. ON NE DIT QU'UNE FOIS. Deux réveils concurrents (watchdog + fournisseur) ne doivent pas
 *      produire deux fois la même phrase.
 */

const make = (over: Partial<DeliveryObligation> = {}): DeliveryObligation => ({
  ...newObligation({ id: "o1", sessionId: "s1", turnId: "t1", ask: "Deepak a répondu ?" }, 0),
  ...over,
});

const drive = (o: DeliveryObligation, events: Parameters<typeof applyDelivery>[1][], now = 0) => {
  let cur = o;
  for (const e of events) {
    const r = applyDelivery(cur, e, now);
    if (r.ok) cur = r.obligation;
  }
  return cur;
};

describe("le chemin nominal", () => {
  it("RECEIVED → WORKING → RESULT_READY → DELIVERING → DELIVERED", () => {
    const done = drive(make(), [
      { type: "START_WORK" },
      { type: "RESULT", summary: "Oui, trois documents." },
      { type: "BEGIN_DELIVERY" },
      { type: "DELIVERED" },
    ]);
    expect(done.state).toBe("DELIVERED");
    expect(done.summary).toBe("Oui, trois documents.");
    expect(isTerminal(done.state)).toBe(true);
    expect(isOutstanding(done)).toBe(false);
  });

  it("un résultat immédiat saute l'étape de travail", () => {
    const r = applyDelivery(make(), { type: "RESULT", summary: "Envoyé." });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.obligation.state).toBe("RESULT_READY");
  });
});

/**
 * INVARIANT 1 — ON SORT TOUJOURS.
 *
 * Le test balaie chaque état non terminal et exige qu'il existe un chemin vers une PAROLE :
 * restitution ou aveu d'échec. Un état d'où l'on ne peut que se taire serait exactement le bogue
 * que ce module ferme.
 */
describe("invariant : aucune obligation ne s'évapore", () => {
  it("depuis n'importe quel état, l'échec reste dicible", () => {
    for (const state of ["RECEIVED", "WORKING", "RESULT_READY", "DELIVERING"] as const) {
      const r = applyDelivery(make({ state }), { type: "FAIL", error: "Gmail indisponible" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.obligation.state).toBe("FAILED");
        expect(r.obligation.error).toBe("Gmail indisponible");
      }
    }
  });

  it("un résultat prêt qui traîne est signalé comme tel", () => {
    // C'est LA condition qui a fait naître le module : si elle apparaît en production, la
    // promesse est rompue.
    const o = make({ state: "RESULT_READY", summary: "Oui.", updatedAt: 0 });
    expect(staleReason(o, READY_STALE_MS - 1)).toBeNull();
    expect(staleReason(o, READY_STALE_MS + 1)).toBe("résultat prêt non restitué");
  });

  it("un résultat prêt donne toujours le devoir de PARLER", () => {
    const duty = dutyFor(make({ state: "RESULT_READY", summary: "Oui, trois." }));
    expect(duty.do).toBe("SPEAK");
    if (duty.do === "SPEAK") expect(duty.summary).toBe("Oui, trois.");
  });

  it("après trop de tentatives, on DIT l'échec plutôt que de réessayer indéfiniment", () => {
    const duty = dutyFor(make({ state: "RESULT_READY", attempts: MAX_DELIVERY_ATTEMPTS }));
    expect(duty.do).toBe("SPEAK_FAILURE");
  });

  it("une restitution interrompue en vol se reprend au lieu de se perdre", () => {
    const o = make({ state: "DELIVERING", summary: "Oui.", updatedAt: 0, attempts: 1 });
    expect(dutyFor(o, DELIVERING_STALE_MS + 1).do).toBe("RETRY");
    const r = applyDelivery(o, { type: "RECOVER" }, DELIVERING_STALE_MS + 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.obligation.state).toBe("RESULT_READY");
  });
});

/** INVARIANT 2 — ON NE DIT QU'UNE FOIS. */
describe("invariant : exactement une restitution", () => {
  it("deux réveils concurrents ne livrent pas deux fois", () => {
    const livre = drive(make(), [
      { type: "RESULT", summary: "Oui." }, { type: "BEGIN_DELIVERY" }, { type: "DELIVERED" },
    ]);
    // Le watchdog se réveille après coup et retente : la machine refuse, sans casser l'appel.
    const second = applyDelivery(livre, { type: "BEGIN_DELIVERY" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.refusal).toMatch(/déjà restituée/);
    expect(dutyFor(livre).do).toBe("NOTHING");
  });

  it("DELIVERING verrouille : on ne relance pas une livraison en cours", () => {
    const enCours = drive(make(), [{ type: "RESULT", summary: "Oui." }, { type: "BEGIN_DELIVERY" }]);
    expect(applyDelivery(enCours, { type: "BEGIN_DELIVERY" }).ok).toBe(false);
    // …et tant qu'elle n'est pas périmée, il n'y a rien à faire.
    expect(dutyFor(enCours, 100).do).toBe("NOTHING");
  });

  it("un résultat qui arrive deux fois n'écrase pas une livraison faite", () => {
    const livre = drive(make(), [
      { type: "RESULT", summary: "Oui." }, { type: "BEGIN_DELIVERY" }, { type: "DELIVERED" },
    ]);
    expect(applyDelivery(livre, { type: "RESULT", summary: "Autre chose" }).ok).toBe(false);
    expect(livre.summary).toBe("Oui.");
  });

  it("une transition illégale est refusée sans exception — l'appel ne tombe pas", () => {
    const r = applyDelivery(make({ state: "RECEIVED" }), { type: "DELIVERED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toMatch(/illégale/);
  });
});

describe("« Alors ? » — la relance du PDG", () => {
  it("se compte sans changer l'état : c'est un constat de manquement", () => {
    const o = make({ state: "WORKING" });
    const r = applyDelivery(o, { type: "NUDGE" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.obligation.state).toBe("WORKING");
      expect(r.obligation.nudges).toBe(1);
    }
  });

  it("quand il a réclamé pendant le travail, il a droit à un signe court", () => {
    const duty = dutyFor(make({ state: "WORKING", nudges: 1 }));
    expect(duty.do).toBe("SPEAK");
    if (duty.do === "SPEAK") expect(duty.summary.length).toBeLessThan(40);
  });

  it("sans relance, on ne parle pas pour ne rien dire pendant le travail", () => {
    expect(dutyFor(make({ state: "WORKING" })).do).toBe("NOTHING");
  });
});

describe("l'ordre de restitution", () => {
  it("rend d'abord la PLUS ANCIENNE demande, pas le dernier outil terminé", () => {
    // Le PDG raisonne dans l'ordre où il a demandé. Répondre dans l'ordre où les outils
    // finissent donne une conversation qui répond à la question d'avant.
    const vieille = make({ id: "vieille", state: "RESULT_READY", createdAt: 100, updatedAt: 100, summary: "A" });
    const recente = make({ id: "recente", state: "RESULT_READY", createdAt: 900, updatedAt: 900, summary: "B" });
    expect(nextToDeliver([recente, vieille])?.id).toBe("vieille");
  });

  it("reprend aussi une livraison périmée", () => {
    const bloquee = make({ id: "bloquee", state: "DELIVERING", createdAt: 10, updatedAt: 10 });
    expect(nextToDeliver([bloquee], DELIVERING_STALE_MS + 20)?.id).toBe("bloquee");
    expect(nextToDeliver([bloquee], 20)).toBeNull();
  });

  it("ne rend rien quand rien n'attend", () => {
    expect(nextToDeliver([])).toBeNull();
    expect(nextToDeliver([make({ state: "WORKING" }), make({ state: "DELIVERED" })])).toBeNull();
  });
});
