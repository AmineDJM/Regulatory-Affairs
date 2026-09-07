import { describe, expect, it, vi } from "vitest";
import type { EtatEtape, EtatMission } from "@/lib/missions/runtime/store";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN CONTRÔLE JUGE CE QU'IL PEUT VOIR : SES ANCÊTRES.
 *
 * ── LE DÉFAUT, MESURÉ SUR LA CHAÎNE HUMAINE LIVE ────────────────────────────────────────
 *
 * Le plan avait placé « Vérifier la présence des deux livrables » AU MILIEU du graphe, et
 * « Informer Yacine » APRÈS. Le contrôle a compté cette étape d'aval — qui DÉPEND DE LUI et ne
 * peut donc pas être finie avant qu'il ait rendu son verdict — parmi les manquantes :
 * « 15/16 étapes effectives abouties. 1 manquante ». Mission BLOQUÉE, alors que les deux
 * fichiers étaient produits et s'ouvraient.
 *
 * Un nœud QA placé ailleurs qu'en dernier était donc STRUCTURELLEMENT condamné : il se
 * reprochait son propre aval. Ce n'est pas une tolérance qu'on ajoute — c'est une portée qu'on
 * corrige. Un contrôle affirme « tout ce dont je dépends a abouti », jamais « la mission est
 * finie », ce qu'il n'est pas en position de savoir.
 *
 * ── ET LA PRÉSÉANCE NÉGATIVE NE BOUGE PAS ───────────────────────────────────────────────
 *
 * Dans sa portée, il refuse toujours. Le second cas du test le vérifie : une étape AMONT en
 * échec bloque, exactement comme avant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { missionArtifact: { findMany: async () => [] } },
}));

const etape = (o: Partial<EtatEtape> & { key: string; status: string }): EtatEtape => ({
  id: o.key, title: o.key, workstream: "default", nodeType: "CAPABILITY", capability: "read_x",
  input: {}, attempt: 1, maxAttempts: 3, idempotencyKey: null, result: null, receipt: null,
  recu: null, error: null, errorKind: null, waitFor: null, forEach: null, spec: null,
  ...o,
} as unknown as EtatEtape);

const mission = (steps: EtatEtape[]): EtatMission => ({
  id: "m1", status: "RUNNING", ownerId: "u", planVersion: 1, maxConcurrency: 4,
  acceptance: ["c'est fait"], goalRaw: "o", objective: "o", planMeta: {}, steps,
} as unknown as EtatMission);

describe("le nœud QA juge ses ancêtres, pas la mission entière", () => {
  const graphe = () => mission([
    etape({ key: "collecte", status: "DONE", dependsOn: [] }),
    etape({ key: "consolide", status: "DONE", dependsOn: ["collecte"] }),
    etape({ key: "controle", status: "RUNNING", nodeType: "QA", capability: null, dependsOn: ["consolide"] }),
    // EN AVAL DU CONTRÔLE : PENDING par construction, il ne peut pas en être autrement.
    etape({ key: "notifie", status: "PENDING", dependsOn: ["controle"] }),
  ] as unknown as EtatEtape[]);

  it("une étape EN AVAL du contrôle ne lui est pas reprochée", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const portee = new Set(["collecte", "consolide", "controle"]);

    const dansPortee = await controleComplet(graphe(), { portee });
    expect(dansPortee.ok, dansPortee.resume).toBe(true);

    // SANS portée — le contrôle de FIN de mission — la même étape compte, et doit compter :
    // là, « la mission est-elle finie ? » est bien la question posée.
    const fin = await controleComplet(graphe());
    expect(fin.ok).toBe(false);
    expect(fin.base.manquants.map((m) => m.key)).toEqual(["notifie"]);
  });

  /**
   * LE MÊME DÉFAUT, UN CRAN PLUS LOIN — trouvé sur la chaîne budgétaire, pas sur celle-ci.
   *
   * La complétude était corrigée ; les ARTEFACTS ne l'étaient pas, parce que ce contrôle-là ne
   * lit pas les étapes mais `planMeta`. Un QA au milieu du graphe réclamait donc le document
   * Word que produit une étape située APRÈS lui : « 2/2 étapes effectives abouties » et
   * pourtant « 1 anomalie — ARTEFACTS », sur un fichier qui existait et s'ouvrait.
   */
  it("un livrable produit APRÈS le contrôle ne lui est pas réclamé", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const m = mission([
      etape({ key: "collecte", status: "DONE", dependsOn: [] }),
      etape({ key: "controle", status: "RUNNING", nodeType: "QA", capability: null, dependsOn: ["collecte"] }),
      etape({ key: "doc", status: "PENDING", nodeType: "ARTIFACT", capability: null, dependsOn: ["controle"] }),
    ] as unknown as EtatEtape[]);
    (m as { planMeta: Record<string, unknown> }).planMeta = {
      expectedArtifacts: [{ key: "synthese", format: "DOCX", title: "Synthèse", fromStep: "doc" }],
    };

    const dansPortee = await controleComplet(m, { portee: new Set(["collecte", "controle"]) });
    expect(dansPortee.ok, dansPortee.resume).toBe(true);

    // À la FIN, le même livrable est exigible — et manque, puisque rien ne l'a produit.
    const fin = await controleComplet(m);
    expect(fin.ok).toBe(false);
    expect(fin.constats.find((c) => c.controle === "ARTEFACTS")?.ok).toBe(false);
  });

  it("la préséance négative ne bouge pas : un AMONT en échec bloque toujours", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const casse = mission([
      etape({ key: "collecte", status: "FAILED", dependsOn: [] }),
      etape({ key: "controle", status: "RUNNING", nodeType: "QA", capability: null, dependsOn: ["collecte"] }),
      etape({ key: "notifie", status: "PENDING", dependsOn: ["controle"] }),
    ] as unknown as EtatEtape[]);
    const r = await controleComplet(casse, { portee: new Set(["collecte", "controle"]) });
    expect(r.ok).toBe(false);
    expect(r.base.manquants.map((m) => m.key)).toEqual(["collecte"]);
  });
});
