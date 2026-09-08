import { describe, expect, it, vi } from "vitest";
import type { EtatEtape, EtatMission } from "@/lib/missions/runtime/store";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DEUX MÉCANISMES DU MÊME DÉPÔT, EN DÉSACCORD SUR L'IDENTITÉ D'UNE PIÈCE.
 *
 * MESURÉ live (chaîne regulatory, mission cmtsjgpf3…). Le plan v1 annonce
 * `excel-consolidation` ; après trois replanifications, le plan v4 le rebaptise
 * `excel-consolidation-final`. La FABRIQUE, elle, ne crée PAS un second fichier — c'est
 * `identiteDuLivrable` (#88), et c'est voulu : elle réécrit la pièce existante, qui garde donc
 * sa clé v1. Le contrôle qualité, lui, réclamait la clé v4.
 *
 * Verdict : « 2 livrable(s) annoncés ne sont pas produits » — sur DEUX fichiers présents,
 * complets, vérifiés, et portant 6/6 des chiffres collectés. Un contrôle arithmétique qui ne
 * peut plus PASSER est aussi nuisible qu'un contrôle qui ne peut pas échouer (§118.17) : il
 * bloque une mission juste, et trois replanifications à 0,30 $ n'y changent rien.
 *
 * Le raccord se fait par le lien CAUSAL — `MissionArtifact.stepId` — jamais par un
 * rapprochement de noms : la pièce écrite par l'étape `fromStep` satisfait l'attente que cette
 * étape devait honorer, et une pièce périmée d'un plan précédent ne le peut pas, puisqu'elle
 * pointe vers l'ancienne étape.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let ARTEFACTS: unknown[] = [];
vi.mock("@/lib/prisma", () => ({
  prisma: { missionArtifact: { findMany: async () => ARTEFACTS } },
}));

const etape = (o: Partial<EtatEtape> & { key: string; status: string }): EtatEtape => ({
  id: o.key, title: o.key, workstream: "default", nodeType: "CAPABILITY", capability: "read_x",
  input: {}, attempt: 1, maxAttempts: 3, idempotencyKey: null, result: null, receipt: null,
  recu: null, error: null, errorKind: null, waitFor: null, forEach: null, spec: null,
  ...o,
} as unknown as EtatEtape);

const missionAvecPlanV4 = (): EtatMission => ({
  id: "m1", status: "RUNNING", ownerId: "u", planVersion: 4, maxConcurrency: 4,
  acceptance: ["c'est fait"], goalRaw: "o", objective: "o",
  planMeta: {
    expectedArtifacts: [
      { key: "excel-consolidation-final", format: "XLSX", title: "Consolidation", fromStep: "artifact:excel-controle" },
    ],
  },
  steps: [
    etape({ key: "collecte", status: "DONE", dependsOn: [] }),
    etape({ key: "artifact:excel-controle", status: "DONE", nodeType: "ARTIFACT", capability: null, dependsOn: ["collecte"] }),
  ] as unknown as EtatEtape[],
} as unknown as EtatMission);

describe("un livrable RENOMMÉ par un replan reste le même fichier", () => {
  it("la pièce écrite par l'étape attendue satisfait l'attente, même sous son ancienne clé", async () => {
    ARTEFACTS = [{
      key: "excel-consolidation", status: "VERIFIED", byteSize: 14039,
      title: "Consolidation", step: { key: "artifact:excel-controle" },
    }];
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(missionAvecPlanV4());
    expect(r.constats.find((c) => c.controle === "ARTEFACTS")?.ok, r.resume).toBe(true);
  });

  it("UNE PIÈCE PÉRIMÉE NE SUFFIT PAS : écrite par une AUTRE étape, elle ne satisfait rien", async () => {
    // Le cas qui ferait de ce raccord un faux succès : un fichier du plan précédent, que
    // l'étape attendue n'a jamais réécrit.
    ARTEFACTS = [{
      key: "excel-consolidation", status: "VERIFIED", byteSize: 13818,
      title: "Consolidation", step: { key: "produire:excel" },
    }];
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(missionAvecPlanV4());
    expect(r.constats.find((c) => c.controle === "ARTEFACTS")?.ok).toBe(false);
  });

  it("un fichier VIDE ou non vérifié ne satisfait rien, quel que soit son nom", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    ARTEFACTS = [{ key: "excel-consolidation", status: "VERIFIED", byteSize: 0, title: "C", step: { key: "artifact:excel-controle" } }];
    expect((await controleComplet(missionAvecPlanV4())).constats.find((c) => c.controle === "ARTEFACTS")?.ok).toBe(false);
    ARTEFACTS = [{ key: "excel-consolidation", status: "PENDING", byteSize: 999, title: "C", step: { key: "artifact:excel-controle" } }];
    expect((await controleComplet(missionAvecPlanV4())).constats.find((c) => c.controle === "ARTEFACTS")?.ok).toBe(false);
  });

  it("aucune pièce du tout : le contrôle refuse, comme avant", async () => {
    ARTEFACTS = [];
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(missionAvecPlanV4());
    expect(r.constats.find((c) => c.controle === "ARTEFACTS")?.ok).toBe(false);
  });
});
