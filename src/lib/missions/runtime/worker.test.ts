import { describe, expect, it } from "vitest";
import { hydraterEventail, specifier } from "@/lib/missions/runtime/worker";
import type { EtatEtape, EtatMission } from "@/lib/missions/runtime/store";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SPÉCIFICATION D'UN WORKER — et le défaut de CÉCITÉ que le Run 3 a révélé.
 *
 * Un worker ne reçoit que les résultats de ses dépendances DIRECTES. Or le parent d'un
 * ÉVENTAIL ne porte que son déploiement ({expanded, keys}) : les contenus lus vivent sur ses
 * FILLES. Un « répondre » branché sur « lire » recevait donc « expanded=3 » et RIEN des trois
 * lectures — la synthèse était structurellement aveugle, et le juge la trouvait « honnête mais
 * insuffisante ». Ces bancs épinglent l'hydratation qui recompose ce que l'aval doit voir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const etape = (over: Partial<EtatEtape>): EtatEtape => ({
  id: `id-${over.key ?? "x"}`,
  key: "x", title: "X", workstream: "principal", nodeType: "CAPABILITY", capability: null,
  input: {}, status: "DONE", attempt: 1, maxAttempts: 3, idempotencyKey: null,
  result: null, receipt: null, recu: null, error: null, errorKind: null,
  waitFor: null, forEach: null, spec: null, recovery: null,
  needsIdempotencyKey: false, planVersion: 1, contournee: false, dependsOn: [],
  ...over,
});

const mission = (steps: EtatEtape[]): EtatMission => ({
  id: "m-1", status: "RUNNING", ownerId: "u-1", planVersion: 1, maxConcurrency: 4,
  acceptance: [], goalRaw: "objectif", objective: "objectif", planMeta: {}, steps,
});

describe("hydraterEventail — le parent déployé rend les résultats de ses filles", () => {
  it("recompose {resultats} depuis les filles, et garde les manques nommés (echecs)", () => {
    const m = mission([
      etape({
        key: "lire",
        result: { expanded: 2, done: 1, failed: 1, keys: ["lire#a", "lire#b"], echecs: [{ key: "lire#b", error: "404" }] },
      }),
      etape({ key: "lire#a", result: { contenu: "le contrat dit X" } }),
      etape({ key: "lire#b", status: "FAILED", result: null }),
    ]);
    const h = hydraterEventail(m.steps[0], m)!;
    expect(h.resultats).toEqual({ "lire#a": { contenu: "le contrat dit X" } });
    expect(h.echecs).toEqual([{ key: "lire#b", error: "404" }]);
    expect(h.expanded).toBe(2);
  });

  it("rend null pour un résultat ORDINAIRE — l'hydratation ne touche que les éventails", () => {
    const m = mission([etape({ key: "a", result: { texte: "réponse" } })]);
    expect(hydraterEventail(m.steps[0], m)).toBeNull();
  });
});

describe("specifier — ce que le worker VOIT réellement", () => {
  it("un worker branché sur un éventail reçoit les LECTURES, pas seulement le compte", () => {
    const m = mission([
      etape({ key: "lire", result: { expanded: 1, done: 1, failed: 0, keys: ["lire#a"] } }),
      etape({ key: "lire#a", result: { contenu: "dossier REG-12 : étape 3/5, en attente ANPP" } }),
      etape({ key: "repondre", nodeType: "WORKER", dependsOn: ["lire"] }),
    ]);
    const spec = specifier(m, m.steps[2]);
    const amont = spec.specific.amont as Record<string, Record<string, unknown>>;
    expect(amont.lire.resultats).toEqual({ "lire#a": { contenu: "dossier REG-12 : étape 3/5, en attente ANPP" } });
  });

  it("les dépendances ordinaires passent telles quelles — l'hydratation n'écrase rien", () => {
    const m = mission([
      etape({ key: "chercher", result: { items: [{ id: "t-1", titre: "tâche" }] } }),
      etape({ key: "repondre", nodeType: "WORKER", dependsOn: ["chercher"] }),
    ]);
    const spec = specifier(m, m.steps[1]);
    expect(spec.specific.amont).toEqual({ chercher: { items: [{ id: "t-1", titre: "tâche" }] } });
  });
});
