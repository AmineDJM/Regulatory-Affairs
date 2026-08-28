import { describe, expect, it } from "vitest";
import {
  MISSION_STATES,
  MISSION_TRANSITIONS,
  MissionState,
  STEP_STATES,
  STEP_TERMINAL,
  STEP_TRANSITIONS,
  StepSnapshot,
  StepState,
  TERMINAL_STATES,
  WAITING_STATES,
  assertStepTransition,
  assertTransition,
  canStepTransition,
  canTransition,
  deduireEtat,
  toutTermine,
} from "./state";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA TABLE DE TRANSITIONS EST TESTÉE EXHAUSTIVEMENT — 13 × 13 = 169 couples.
 *
 * Ce n'est pas de la ferveur : c'est le SEUL moyen d'affirmer qu'une mission annulée ne peut
 * pas se remettre à tourner. Un test qui vérifie trois cas heureux laisse les 166 autres à la
 * découverte en production, un mardi, sur une mission de trois jours.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const etape = (status: StepState, extra: Partial<StepSnapshot> = {}): StepSnapshot => ({
  status,
  nodeType: "CAPABILITY",
  attempt: 0,
  maxAttempts: 3,
  ...extra,
});

describe("machine à états de mission — intégrité de la table", () => {
  it("couvre tous les états, et ne cible que des états connus", () => {
    for (const s of MISSION_STATES) {
      expect(MISSION_TRANSITIONS[s], `${s} n'a pas d'entrée`).toBeDefined();
      for (const cible of MISSION_TRANSITIONS[s]) {
        expect(MISSION_STATES, `${s} → ${cible} cible un état inconnu`).toContain(cible);
      }
    }
    expect(Object.keys(MISSION_TRANSITIONS).sort()).toEqual([...MISSION_STATES].sort());
  });

  it("ne se cite jamais soi-même dans la table (la ré-écriture est traitée à part)", () => {
    for (const s of MISSION_STATES) expect(MISSION_TRANSITIONS[s]).not.toContain(s);
  });

  it("ne contient aucun doublon", () => {
    for (const s of MISSION_STATES) {
      expect(new Set(MISSION_TRANSITIONS[s]).size).toBe(MISSION_TRANSITIONS[s].length);
    }
  });
});

describe("machine à états de mission — les invariants qui protègent la production", () => {
  it("un état terminal n'a AUCUNE sortie : un événement en retard ne réveille pas une mission finie", () => {
    for (const s of MISSION_STATES) {
      if (!TERMINAL_STATES.has(s)) continue;
      expect(MISSION_TRANSITIONS[s]).toEqual([]);
      for (const cible of MISSION_STATES) {
        if (cible === s) continue;
        expect(canTransition(s, cible), `${s} → ${cible} devrait être interdit`).toBe(false);
      }
    }
  });

  it("on peut TOUJOURS annuler depuis un état non terminal — « arrête tout » doit marcher partout", () => {
    for (const s of MISSION_STATES) {
      if (TERMINAL_STATES.has(s)) continue;
      expect(canTransition(s, "CANCELLED"), `impossible d'annuler depuis ${s}`).toBe(true);
    }
  });

  it("toute attente revient à RUNNING : une pause connaît sa condition de sortie", () => {
    for (const s of WAITING_STATES) {
      expect(canTransition(s, "RUNNING"), `${s} ne peut pas repartir`).toBe(true);
    }
  });

  it("COMPLETED n'est atteignable que depuis RUNNING et PARTIAL", () => {
    const depuis = MISSION_STATES.filter((s) => MISSION_TRANSITIONS[s].includes("COMPLETED"));
    expect([...depuis].sort()).toEqual(["PARTIAL", "RUNNING"]);
  });

  it("on ne conclut jamais depuis une attente, un blocage ou un échec", () => {
    const interdits: MissionState[] = [
      "PLANNING", "READY", "AWAITING_APPROVAL", "WAITING_EVENT", "WAITING_INPUT",
      "WAITING_DEPENDENCY", "RETRYING", "BLOCKED", "FAILED",
    ];
    for (const s of interdits) {
      expect(canTransition(s, "COMPLETED"), `${s} ne doit pas pouvoir conclure`).toBe(false);
    }
  });

  it("un échec n'est PAS une fin (§74) : FAILED peut replanifier et reprendre", () => {
    expect(canTransition("FAILED", "PLANNING")).toBe(true);
    expect(canTransition("FAILED", "RUNNING")).toBe(true);
    expect(TERMINAL_STATES.has("FAILED")).toBe(false);
  });

  it("tout état non terminal peut atteindre un état terminal — aucun cul-de-sac", () => {
    for (const depart of MISSION_STATES) {
      const vus = new Set<MissionState>([depart]);
      const file: MissionState[] = [depart];
      let atteint = false;
      while (file.length > 0) {
        const s = file.shift()!;
        if (TERMINAL_STATES.has(s)) { atteint = true; break; }
        for (const c of MISSION_TRANSITIONS[s]) if (!vus.has(c)) { vus.add(c); file.push(c); }
      }
      expect(atteint, `${depart} ne mène à aucun état terminal`).toBe(true);
    }
  });

  it("réécrire le même état est un no-op, y compris depuis un terminal", () => {
    for (const s of MISSION_STATES) expect(canTransition(s, s)).toBe(true);
  });

  it("assertTransition nomme l'état de départ et ce qui était possible", () => {
    expect(() => assertTransition("COMPLETED", "RUNNING")).toThrow(/COMPLETED → RUNNING/);
    expect(() => assertTransition("WAITING_EVENT", "COMPLETED")).toThrow(/RUNNING/);
    expect(() => assertTransition("RUNNING", "COMPLETED")).not.toThrow();
  });
});

describe("machine à états d'étape", () => {
  it("couvre tous les états et ne cible que des états connus", () => {
    for (const s of STEP_STATES) {
      expect(STEP_TRANSITIONS[s], `${s} n'a pas d'entrée`).toBeDefined();
      for (const c of STEP_TRANSITIONS[s]) expect(STEP_STATES).toContain(c);
    }
  });

  it("UNE ÉTAPE TERMINÉE NE REPART JAMAIS — l'invariant qui empêche le double envoi", () => {
    for (const cible of STEP_STATES) {
      if (cible === "DONE") continue;
      expect(canStepTransition("DONE", cible), `DONE → ${cible} rejouerait une étape faite`).toBe(false);
    }
    expect(() => assertStepTransition("DONE", "RUNNING")).toThrow(/DONE → RUNNING/);
  });

  it("une étape ÉCHOUÉE peut repartir : c'est le retry", () => {
    expect(canStepTransition("FAILED", "READY")).toBe(true);
    expect(canStepTransition("FAILED", "RUNNING")).toBe(true);
  });

  it("les trois états terminaux d'étape n'ont aucune sortie", () => {
    for (const s of STEP_STATES) {
      if (STEP_TERMINAL.has(s)) expect(STEP_TRANSITIONS[s]).toEqual([]);
      else expect(STEP_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §37 — LA RÈGLE LA PLUS COÛTEUSE À RATER.
 *
 * Une branche qui attend une approbation ne doit pas geler les branches qui peuvent tourner.
 * Sans ce test, la régression est invisible : la mission a l'air « en attente », ce qui est
 * plausible — et on ne s'aperçoit qu'au bout de trois jours que rien n'avançait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("déduction de l'état depuis les étapes", () => {
  it("aucune étape ⇒ la mission planifie encore", () => {
    expect(deduireEtat([])).toBe("PLANNING");
  });

  it("§37 — une branche EN ATTENTE D'APPROBATION ne gèle pas une branche exécutable", () => {
    expect(deduireEtat([
      etape("WAITING", { nodeType: "APPROVAL" }),
      etape("READY"),
    ])).toBe("RUNNING");

    expect(deduireEtat([
      etape("WAITING", { nodeType: "APPROVAL" }),
      etape("RUNNING"),
    ])).toBe("RUNNING");
  });

  it("§37 — une attente d'ÉVÉNEMENT de dix jours ne gèle pas le reste non plus", () => {
    expect(deduireEtat([
      etape("WAITING", { nodeType: "WAIT_EVENT" }),
      etape("DONE"),
      etape("READY"),
    ])).toBe("RUNNING");
  });

  it("quand PLUS RIEN ne tourne, le type d'attente vient du nœud qui attend", () => {
    expect(deduireEtat([etape("DONE"), etape("WAITING", { nodeType: "APPROVAL" })]))
      .toBe("AWAITING_APPROVAL");
    expect(deduireEtat([etape("DONE"), etape("WAITING", { nodeType: "WAIT_INPUT" })]))
      .toBe("WAITING_INPUT");
    expect(deduireEtat([etape("DONE"), etape("WAITING", { nodeType: "WAIT_EVENT" })]))
      .toBe("WAITING_EVENT");
  });

  it("l'approbation prime sur l'événement : c'est la seule attente qu'un humain peut débloquer", () => {
    expect(deduireEtat([
      etape("WAITING", { nodeType: "WAIT_EVENT" }),
      etape("WAITING", { nodeType: "APPROVAL" }),
    ])).toBe("AWAITING_APPROVAL");
  });

  it("un échec avec des tentatives restantes est un RETRYING, pas un échec de mission", () => {
    expect(deduireEtat([etape("FAILED", { attempt: 1, maxAttempts: 3 })])).toBe("RETRYING");
  });

  it("un échec à bout de tentatives, sans rien de fait, est un FAILED", () => {
    expect(deduireEtat([etape("FAILED", { attempt: 3, maxAttempts: 3 })])).toBe("FAILED");
  });

  it("un échec à bout de tentatives, avec du travail fait, est un PARTIAL", () => {
    expect(deduireEtat([
      etape("DONE"),
      etape("FAILED", { attempt: 3, maxAttempts: 3 }),
    ])).toBe("PARTIAL");
  });

  it("le retry prime sur l'attente : ce qui est réparable se répare avant qu'on dorme", () => {
    expect(deduireEtat([
      etape("FAILED", { attempt: 1, maxAttempts: 3 }),
      etape("WAITING", { nodeType: "WAIT_EVENT" }),
    ])).toBe("RETRYING");
  });

  it("des étapes en attente de dépendances, sans rien de prêt, sont une attente de dépendance", () => {
    expect(deduireEtat([etape("DONE"), etape("PENDING")])).toBe("WAITING_DEPENDENCY");
  });

  it("des dépendances qui n'arriveront jamais (échec définitif en amont) sont un BLOCAGE", () => {
    expect(deduireEtat([
      etape("FAILED", { attempt: 3, maxAttempts: 3 }),
      etape("PENDING"),
    ])).toBe("BLOCKED");
  });

  it("toutes les étapes terminées ne vaut PAS conclusion — la satisfaction est un contrôle à part (§20)", () => {
    expect(deduireEtat([etape("DONE"), etape("DONE"), etape("SKIPPED")])).toBe("RUNNING");
  });

  it("ne rend jamais un état terminal : conclure est une décision, pas une déduction", () => {
    const combinaisons: StepSnapshot[][] = [
      [etape("DONE")],
      [etape("CANCELLED")],
      [etape("SKIPPED"), etape("CANCELLED")],
      [etape("FAILED", { attempt: 9, maxAttempts: 1 })],
      [etape("PENDING"), etape("WAITING", { nodeType: "APPROVAL" })],
    ];
    for (const c of combinaisons) {
      expect(TERMINAL_STATES.has(deduireEtat(c)), JSON.stringify(c)).toBe(false);
    }
  });

  it("rend toujours un état de la machine", () => {
    for (const s of STEP_STATES) expect(MISSION_STATES).toContain(deduireEtat([etape(s)]));
  });
});

describe("toutTermine", () => {
  it("est faux sur une liste vide : rien à conclure sur une mission sans étapes", () => {
    expect(toutTermine([])).toBe(false);
  });

  it("accepte les trois fins d'étape, refuse tout le reste", () => {
    expect(toutTermine([etape("DONE"), etape("SKIPPED"), etape("CANCELLED")])).toBe(true);
    expect(toutTermine([etape("DONE"), etape("FAILED")])).toBe(false);
    expect(toutTermine([etape("DONE"), etape("WAITING")])).toBe(false);
    expect(toutTermine([etape("DONE"), etape("PENDING")])).toBe(false);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN PLAN ABANDONNÉ NE DÉCIDE PLUS
 *
 * Un run Render l'a chiffré : le plan v1 laisse une étape en échec, tentatives épuisées ; le
 * plan v2 contourne et ses neuf étapes aboutissent ; la mission reste BLOCKED et le juge n'est
 * jamais atteint. Trois plans successifs mouraient d'une erreur du premier.
 *
 * La règle est simple à énoncer et c'est elle qu'on garde ici : une obligation appartient au
 * PLAN COURANT. Ce qui l'a précédée est une pièce du dossier, pas une dette.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("les étapes CONTOURNÉES par un replan ne décident plus de l'état", () => {
  const contournee = (status: StepState) => etape(status, { contournee: true, attempt: 3 });

  it("un échec contourné ne bloque plus — c'est le défaut mesuré sur Render", () => {
    // Le contre-exemple d'abord : le MÊME échec, NON contourné, bloque toujours. Sans lui, ce
    // test passerait aussi si `deduireEtat` avait cessé de regarder les échecs tout court.
    expect(deduireEtat([etape("DONE"), etape("FAILED", { attempt: 3 })])).toBe("PARTIAL");
    expect(deduireEtat([etape("DONE"), contournee("FAILED")])).toBe("RUNNING");
  });

  it("une étape contournée n'empêche pas de conclure", () => {
    expect(toutTermine([etape("DONE"), contournee("PENDING")])).toBe(true);
    // Contre-exemple : la même étape PENDING, non contournée, empêche bien de conclure.
    expect(toutTermine([etape("DONE"), etape("PENDING")])).toBe(false);
  });

  it("une mission dont TOUT est contourné n'est pas « finie » : elle n'a plus de plan", () => {
    // `PLANNING` est la réponse honnête — il n'y a plus aucune obligation à regarder. Rendre
    // `RUNNING` laisserait croire qu'il reste du travail ; rendre `COMPLETED` serait pire.
    expect(deduireEtat([contournee("FAILED"), contournee("DONE")])).toBe("PLANNING");
    expect(toutTermine([contournee("DONE")])).toBe(false);
  });
});
