import { describe, expect, it } from "vitest";
import { compile } from "@/lib/missions/compiler/compile";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";

/**
 * L'ÉTAPE CONDITIONNELLE AU COMPILATEUR : la dépendance implicite, le transport dans `spec.when`,
 * et les refus de forme — une condition incohérente ne devient jamais une étape qui ne partirait
 * jamais sans dire pourquoi.
 */
const catalogue: CapabilityCatalog = { has: () => false, allowed: () => true, meta: (n) => capabilityMeta(n), brief: () => [] };
const acteur: MissionActor = { userId: "u1", label: "PDG", isAgent: false };
const SCHEMA = { type: "object", properties: { note: { type: "string", description: "n" } }, required: ["note"], additionalProperties: false };

const worker = (key: string, extra: Partial<PlannedStep> = {}): PlannedStep => ({
  key, title: key, nodeType: "WORKER", dependsOn: [], approvalRequirement: "NONE", reasoningRequirement: "LIGHT", expectedOutputSchema: SCHEMA, ...extra,
});
const plan = (steps: PlannedStep[]): MissionPlan => ({
  objective: "Relancer si silence — objectif d'analyse",
  acceptance: ["[REGLE:AUCUNE_ECRITURE] mission d'analyse pure."],
  complexity: "B", scale: "S", steps, workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
});
/** Les messages d'un résultat de compilation — refus ou avertissements, selon la branche. */
const messages = (r: ReturnType<typeof compile>): string =>
  (r.ok ? r.warnings : r.issues).map((i) => i.message).join(" ");
const missionDe = (r: ReturnType<typeof compile>) => {
  if (!r.ok) throw new Error(`plan refusé : ${messages(r)}`);
  return r.mission;
};

const attente: PlannedStep = {
  key: "attente", title: "Sa réponse ou vendredi", nodeType: "WAIT_EVENT", dependsOn: [], approvalRequirement: "NONE",
  waitFor: { anyOf: [{ event: "MESSAGE_RECEIVED", from: "Raihana" }, { until: "2026-09-12T17:00:00Z" }] },
};

describe("compilateur — l'étape conditionnelle", () => {
  it("transporte la condition dans spec.when et pose la dépendance implicite vers l'étape observée", () => {
    const r = compile(plan([
      attente,
      worker("relancer", { when: { step: "attente", outcome: "TIMEOUT" } }),
      worker("remercier", { when: { step: "attente", outcome: "EVENT" } }),
    ]), catalogue, acteur);
    const mission = missionDe(r);
    const relancer = mission.steps.find((s) => s.key === "relancer")!;
    expect(relancer.dependsOn).toContain("attente");
    expect(relancer.spec?.when).toEqual({ step: "attente", outcome: "TIMEOUT" });
    expect(relancer.wave).toBeGreaterThan(mission.steps.find((s) => s.key === "attente")!.wave);
  });

  it("refuse une condition sur une étape inconnue, sur soi-même, ou vide", () => {
    const inconnue = compile(plan([attente, worker("x", { when: { step: "fantome", outcome: "DONE" } })]), catalogue, acteur);
    expect(inconnue.ok).toBe(false);
    expect(messages(inconnue)).toMatch(/fantome/);
    const soi = compile(plan([worker("x", { when: { step: "x", outcome: "DONE" } })]), catalogue, acteur);
    expect(soi.ok).toBe(false);
    const vide = compile(plan([attente, worker("x", { when: { step: "attente" } })]), catalogue, acteur);
    expect(vide.ok).toBe(false);
    expect(messages(vide)).toMatch(/issue .*ou tester/);
  });

  it("refuse EVENT/TIMEOUT après autre chose qu'une attente, un opérateur sans champ, une comparaison sans valeur", () => {
    const pasAttente = compile(plan([worker("lire"), worker("x", { when: { step: "lire", outcome: "TIMEOUT" } })]), catalogue, acteur);
    expect(pasAttente.ok).toBe(false);
    expect(messages(pasAttente)).toMatch(/attente d'événement/);
    const sansChamp = compile(plan([worker("lire"), worker("x", { when: { step: "lire", op: "gt", value: "5" } })]), catalogue, acteur);
    expect(sansChamp.ok).toBe(false);
    const sansValeur = compile(plan([worker("lire"), worker("x", { when: { step: "lire", path: "prix", op: "gt" } })]), catalogue, acteur);
    expect(sansValeur.ok).toBe(false);
    // exists / empty n'exigent pas de valeur.
    const exists = compile(plan([worker("lire"), worker("x", { when: { step: "lire", path: "items", op: "exists" } })]), catalogue, acteur);
    expect(exists.ok, messages(exists)).toBe(true);
  });
});
