import { describe, it, expect } from "vitest";
import { TRIAGE_RULE, observedLevel, delegationLooksReflexive, LEVEL_LABEL } from "./triage";
import { VOICE_FAST_TOOL_NAMES, realtimeToolsFor, DELEGATE_TOOL_NAME } from "./voice-realtime";
import { withTurn, recordModelCall, summarize, currentTurn } from "@/lib/models/telemetry";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";

/** Même montage que `voice-realtime.test.ts` : un compte réel a un accès résolu, pas un objet nu. */
function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"]): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id: "triage-test", name: "T", email: "triage@t.dz", role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRIAGE A / B / C — ce que ces tests protègent.
 *
 * La règle n'est pas « c'est gros donc je délègue » mais « je ne sais pas encore quoi faire ».
 * C'est une doctrine facile à réécrire par accident dans un prompt, et dont la dérive ne se voit
 * pas : un Adam qui délègue tout marche encore — il est juste lent et cher. Ces tests gèlent
 * donc le CRITÈRE, pas une formulation.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("la règle du triage dit le bon critère", () => {
  it("nomme les trois niveaux", () => {
    expect(TRIAGE_RULE).toContain("A — DIRECT");
    expect(TRIAGE_RULE).toContain("B — MULTI-ACTION DIRECT");
    expect(TRIAGE_RULE).toContain("C — COGNITIF");
  });

  /** Le point qui distingue cette doctrine de l'intuition ordinaire. */
  it("dit EXPLICITEMENT que le nombre d'actions ne fait pas la complexité", () => {
    expect(TRIAGE_RULE).toMatch(/NOMBRE D'ACTIONS ne définit PAS la complexité/i);
    expect(TRIAGE_RULE).toMatch(/CONNAISSANCE DU PLAN/i);
  });

  it("donne l'exemple à trois opérations qui reste un B", () => {
    // C'est le cas que tout le monde classe C par réflexe : trois gestes, donc « compliqué ».
    expect(TRIAGE_RULE).toMatch(/trois opérations, aucune découverte → B/);
  });

  it("assume l'asymétrie : dans le doute, déléguer", () => {
    expect(TRIAGE_RULE).toMatch(/DANS LE DOUTE, DÉLÈGUE/);
    // …mais sans en faire un réflexe, sinon B disparaît.
    expect(TRIAGE_RULE).toMatch(/ne délègue JAMAIS par réflexe/i);
  });
});

describe("la session vocale reçoit bien cette règle", () => {
  const user = userWith(
    { RH: ["VIEW"], REGULATORY: ["VIEW"], FINANCES: ["VIEW"], WORKSPACE: ["VIEW"], CHIEF_OF_STAFF: ["VIEW"] },
    "DIRECTION",
  );

  it("l'outil de délégation est proposé", () => {
    const names = realtimeToolsFor(user).map((t) => t.name);
    expect(names).toContain(DELEGATE_TOOL_NAME);
  });

  /**
   * Le motif est ce qui rend la décision AUDITABLE. Sans lui, on ne peut pas distinguer un C
   * jugé d'un C réflexe — donc pas mesurer le sur-recours.
   */
  it("la délégation demande CE QU'IL FAUT DÉCOUVRIR", () => {
    const tool = realtimeToolsFor(user).find((t) => t.name === DELEGATE_TOOL_NAME);
    const props = (tool?.parameters as { properties?: Record<string, unknown> }).properties ?? {};
    expect(Object.keys(props)).toContain("reason");
    expect(JSON.stringify(props.reason)).toMatch(/DÉCOUVRIR/);
  });

  it("sa description interdit de déléguer un B", () => {
    const tool = realtimeToolsFor(user).find((t) => t.name === DELEGATE_TOOL_NAME);
    expect(tool?.description).toMatch(/NE DÉLÈGUE PAS/);
    expect(tool?.description).toMatch(/niveau B/);
  });

  it("les lectures rapides restent nombreuses — un B doit pouvoir s'exécuter sans déléguer", () => {
    // Si la liste des fast paths se vidait, tout deviendrait un C par construction.
    expect(VOICE_FAST_TOOL_NAMES.length).toBeGreaterThanOrEqual(20);
  });
});

describe("lecture APRÈS COUP de ce qui s'est passé", () => {
  it("une délégation est un C, quel que soit le reste", () => {
    expect(observedLevel({ toolCalls: 0, delegated: true })).toBe("C");
    expect(observedLevel({ toolCalls: 5, delegated: true })).toBe("C");
  });

  it("plusieurs lectures sans délégation = un B exécuté seul — le cas qu'on veut voir grandir", () => {
    expect(observedLevel({ toolCalls: 3, delegated: false })).toBe("B");
  });

  it("une seule lecture = A", () => {
    expect(observedLevel({ toolCalls: 1, delegated: false })).toBe("A");
    expect(observedLevel({ toolCalls: 0, delegated: false })).toBe("A");
  });

  it("les libellés couvrent les trois niveaux", () => {
    expect(Object.keys(LEVEL_LABEL).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("un motif de délégation creux se repère", () => {
  it("un motif vide ou trop court est un réflexe", () => {
    expect(delegationLooksReflexive(undefined)).toBe(true);
    expect(delegationLooksReflexive("")).toBe(true);
    expect(delegationLooksReflexive("il faut")).toBe(true);
  });

  it("un motif qui ne fait que répéter la demande n'explique aucune découverte", () => {
    expect(delegationLooksReflexive("envoyer le fichier à Amine et créer une tâche")).toBe(true);
  });

  it("un vrai besoin de découverte est reconnu", () => {
    expect(delegationLooksReflexive("il faut comprendre la cause du retard sur Regulatory")).toBe(false);
    expect(delegationLooksReflexive("croiser plusieurs sources : dossiers, mails et validations")).toBe(false);
    expect(delegationLooksReflexive("analyser les blocages avant de proposer quoi que ce soit")).toBe(false);
  });

  /** On SIGNALE, on ne bloque pas : une mesure qui devient une panne fait perdre une demande. */
  it("le repérage est un signal, pas un verrou — il rend un booléen, il ne lève rien", () => {
    expect(() => delegationLooksReflexive("x")).not.toThrow();
  });
});

describe("un tour reste UN tour, même quand la voix délègue au texte", () => {
  const usage = (role: "orchestrator" | "realtime") => ({
    role,
    model: "m",
    provider: "openai" as const,
    inputTokens: 10,
    outputTokens: 5,
    cachedInputTokens: 0,
    costUsd: null,
    ms: 1,
    attempts: 1,
  });

  /**
   * LE PIÈGE ÉVITÉ. Si le moteur texte ouvrait son propre tour à l'intérieur du tour vocal, les
   * appels de l'orchestrateur seraient comptés ailleurs — et le tour vocal afficherait zéro appel
   * d'orchestrateur sur un niveau C. On cacherait la preuve qu'on cherche.
   */
  it("le tour texte REJOINT le tour vocal au lieu d'en ouvrir un second", async () => {
    const s = await withTurn("voice-deep", async (outer) => {
      recordModelCall(usage("realtime"));
      await withTurn("text", async (inner) => {
        expect(inner.turnId).toBe(outer.turnId); // le même tour, pas un second
        recordModelCall(usage("orchestrator"));
      });
      return summarize(outer);
    });
    expect(s.route).toBe("voice-deep");
    expect(s.callsByRole.orchestrator).toBe(1);
    expect(s.callsByRole.realtime).toBe(1);
  });

  it("un tour texte seul reste un tour texte", async () => {
    const s = await withTurn("text", async (t) => {
      recordModelCall(usage("orchestrator"));
      return summarize(t);
    });
    expect(s.route).toBe("text");
    // §2 : le texte NE PASSE PAS par le temps réel.
    expect(s.callsByRole.realtime).toBe(0);
  });

  it("le tour se referme — rien ne fuit sur l'appel suivant", async () => {
    await withTurn("text", async () => { recordModelCall(usage("orchestrator")); });
    expect(currentTurn()).toBeUndefined();
  });
});
