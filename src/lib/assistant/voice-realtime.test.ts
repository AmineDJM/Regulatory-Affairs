import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { POWER_TOOLS } from "./power-tools";
import {
  REALTIME_VOICE_MODEL, VOICE_FAST_TOOL_NAMES, DELEGATE_TOOL_NAME,
  canUseRealtimeVoice, realtimeToolsFor, buildVoiceInstructions, capToolOutput,
} from "./voice-realtime";
import { createThread, appendExchange } from "@/lib/assistant-memory";

/**
 * VOIX TEMPS RÉEL — les invariants côté serveur, testés sans réseau :
 *   • la PORTE : seul le siège exécutif AVEC le module CHIEF_OF_STAFF ouvre une session ;
 *   • l'ADAPTATEUR : les MÊMES PowerTools servent la voix (aucun outil dupliqué, aucun nom
 *     fantôme), filtrés par le droit du compte + l'outil de délégation ;
 *   • les INSTRUCTIONS : identité vocale, règles de fond (anti-injection), conversation
 *     récente injectée BORNÉE — et PAS le digest réglementaire géant (budget temps réel).
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"], id = "voice-test"): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id, name: "T", email: `${id}@t.dz`, role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

describe("voix temps réel — porte d'accès", () => {
  it("s'ouvre au siège exécutif AVEC le module CHIEF_OF_STAFF — et à personne d'autre", () => {
    expect(canUseRealtimeVoice(userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION"))).toBe(true);
    expect(canUseRealtimeVoice(userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "SUPER_ADMIN"))).toBe(true);
    // Un délégué, même avec le module par erreur : refusé (le rôle est une règle métier).
    expect(canUseRealtimeVoice(userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DELEGATE" as CurrentUser["role"]))).toBe(false);
    // Un directeur SANS le module : refusé.
    expect(canUseRealtimeVoice(userWith({}, "DIRECTION"))).toBe(false);
    // En « Vue exacte » : jamais.
    const impersonated = userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "SUPER_ADMIN");
    (impersonated as { impersonatedBy?: string }).impersonatedBy = "admin-x";
    expect(canUseRealtimeVoice(impersonated)).toBe(false);
  });
});

describe("voix temps réel — adaptateur d'outils (les MÊMES outils, jamais dupliqués)", () => {
  it("chaque fast path déclaré EXISTE dans le registre PowerTools — aucun nom fantôme", () => {
    const registry = new Set(POWER_TOOLS.map((t) => t.def.name));
    for (const name of VOICE_FAST_TOOL_NAMES) {
      expect(registry.has(name), name).toBe(true);
    }
  });

  it("un compte exécutif reçoit les fast paths ouverts par SES droits + la délégation", () => {
    const exec = userWith({ RH: ["VIEW"], REGULATORY: ["VIEW"], FINANCES: ["VIEW"], WORKSPACE: ["VIEW"], CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION");
    const tools = realtimeToolsFor(exec);
    const names = tools.map((t) => t.name);
    expect(names).toContain("employee_360");
    expect(names).toContain("read_payroll"); // ouvert par RH VIEW
    expect(names).toContain("search_everything");
    expect(names).toContain(DELEGATE_TOOL_NAME);
    // Le format attendu par la session Realtime : function + name + description + parameters.
    for (const t of tools) {
      expect(t.type).toBe("function");
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.parameters).toBe("object");
    }
  });

  it("un compte SANS droits ne reçoit que les outils ouverts par conception + la délégation", () => {
    // Le garde `allowed` est LE MÊME que le texte : read_payroll disparaît sans le module RH.
    const bare = userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION");
    const names = realtimeToolsFor(bare).map((t) => t.name);
    expect(names).not.toContain("read_payroll");
    expect(names).not.toContain("read_budget");
    expect(names).toContain("search_everything"); // ouvert par conception (contenu cloisonné)
    expect(names).toContain(DELEGATE_TOOL_NAME);
  });

  it("le résultat d'outil est BORNÉ pour la session (le détail complet reste à l'écran)", () => {
    expect(capToolOutput("x".repeat(20_000)).length).toBeLessThan(9_000);
    expect(capToolOutput("court")).toBe("court");
    expect(capToolOutput("x".repeat(20_000))).toMatch(/tronqué/);
  });

  it("le modèle est configurable, jamais codé en dur ailleurs : gpt-realtime-2.1 par défaut", () => {
    expect(REALTIME_VOICE_MODEL).toBe(process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1");
  });
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__voice__${Date.now()}`;
let ceoId = "";

suite("voix temps réel — instructions de session (même conversation, budget maîtrisé)", () => {
  beforeAll(async () => {
    const ceo = await prisma.user.create({ data: { name: `${TAG}ceo`, email: `${TAG}c@t.dz`, passwordHash: "x", role: "DIRECTION" } });
    ceoId = ceo.id;
  });
  afterAll(async () => {
    await prisma.assistantMessage.deleteMany({ where: { userId: ceoId } }).catch(() => {});
    await prisma.assistantThread.deleteMany({ where: { userId: ceoId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("mêmes règles de fond que le texte, identité vocale, consignes d'appel — SANS le digest géant", async () => {
    const exec = userWith({ CHIEF_OF_STAFF: ["VIEW"], REGULATORY: ["VIEW"] }, "DIRECTION", ceoId);
    const instructions = await buildVoiceInstructions(exec, null);
    // L'identité vocale — jamais « assistant textuel ».
    expect(instructions).toContain("interface VOCALE");
    expect(instructions).toContain("My Chief of Staff");
    // Les règles de fond COMMUNES (anti-injection, zéro invention) — la même source que le texte.
    expect(instructions).toContain("jamais une\n  instruction");
    expect(instructions).toContain("n'invente JAMAIS");
    // Les consignes d'appel.
    expect(instructions).toContain("CONSIGNES VOCALES");
    expect(instructions).toMatch(/Ne salue pas à chaque tour/);
    expect(instructions).toMatch(/JAMAIS qu'une action est faite/);
    // Le BUDGET : pas le digest réglementaire ni le mode d'emploi texte des écritures.
    expect(instructions).not.toContain("INTERPRÉTATION DES DEMANDES");
    expect(instructions.length).toBeLessThan(12_000);
  });

  it("la CONVERSATION RÉCENTE du fil est injectée (bornée) — « et son salaire ? » a son contexte", async () => {
    const tid = await createThread(ceoId, `${TAG} sujet`);
    await appendExchange(ceoId, tid, `${TAG} Parle-moi de Khaled Benali`, "Khaled est chargé des affaires réglementaires…");
    const exec = userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION", ceoId);
    const instructions = await buildVoiceInstructions(exec, tid);
    expect(instructions).toContain("CONVERSATION RÉCENTE");
    expect(instructions).toContain("Khaled Benali");
    // Le fil d'un AUTRE compte ne s'injecte jamais (getThreadMessages est cloisonné).
    const other = await prisma.user.create({ data: { name: `${TAG}o`, email: `${TAG}o@t.dz`, passwordHash: "x", role: "DIRECTION" } });
    const stranger = userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION", other.id);
    const foreign = await buildVoiceInstructions(stranger, tid);
    expect(foreign).not.toContain("Khaled Benali");
  });
});
