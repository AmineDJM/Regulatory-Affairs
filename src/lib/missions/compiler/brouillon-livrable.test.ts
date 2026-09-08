import { describe, expect, it } from "vitest";
import { compile } from "@/lib/missions/compiler/compile";
import type { MissionPlan } from "@/lib/missions/planner/contract";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN LIVRABLE SE PRODUIT UNE FOIS, QUAND LES DONNÉES SONT LÀ (§88).
 *
 * MESURÉ live (chaîne budget) : le plan écrit deux étapes ARTIFACT au même format — un dossier
 * Word AVANT les réponses, un second APRÈS, le second descendant du premier. En base : deux
 * fichiers, 1 519 et 2 735 octets. Le premier ne porte AUCUN des chiffres collectés — il ne
 * pouvait pas, ils n'étaient pas encore arrivés. Le dirigeant se retrouve avec un brouillon et
 * un livrable sans rien pour les distinguer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const CONNUES = ["directory_list", "inspect_record", "send_message"];
const catalogue: CapabilityCatalog = {
  has: (n) => CONNUES.includes(n),
  allowed: () => true,
  meta: (n) => capabilityMeta(n),
  brief: () => [],
};
const acteur: MissionActor = {
  initiatedBy: "u1", executedBy: "u1", label: "PDG",
  can: () => true, effetMax: "EXTERNAL_COMMUNICATION",
} as unknown as MissionActor;

const plan = (steps: MissionPlan["steps"], artefacts: MissionPlan["expectedArtifacts"]): MissionPlan => ({
  objective: "réviser le budget",
  acceptance: ["le dossier est produit"],
  complexity: "B", scale: "M", steps, expectedArtifacts: artefacts,
});

describe("le compilateur refuse un brouillon déguisé en livrable", () => {
  it("DEUX pièces du MÊME format, la seconde descendant de la première, sont refusées", () => {
    const r = compile(plan([
      { key: "collecte", title: "Collecter", capability: "directory_list" },
      { key: "doc:tot", title: "Dossier (avant réponses)", nodeType: "ARTIFACT", dependsOn: ["collecte"] },
      { key: "doc:final", title: "Dossier (après réponses)", nodeType: "ARTIFACT", dependsOn: ["doc:tot"] },
    ] as MissionPlan["steps"], [
      { key: "d1", format: "DOCX", title: "Dossier", fromStep: "doc:tot" },
      { key: "d2", format: "DOCX", title: "Dossier", fromStep: "doc:final" },
    ]), catalogue, acteur);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    const faute = r.issues.find((i) => i.message.includes("BROUILLON"));
    expect(faute, r.issues.map((i) => `${i.code} ${i.message}`).join(" | ")).toBeDefined();
    expect(faute!.code).toBe("CARDINALITY");
    // Le refus NOMME le remède (§118.30) : un état intermédiaire est un WORKER.
    expect(faute!.message).toContain("WORKER");
  });

  it("DEUX pièces du même format INDÉPENDANTES restent légitimes — deux contrats, deux comptes rendus", () => {
    const r = compile(plan([
      { key: "collecte", title: "Collecter", capability: "directory_list" },
      { key: "doc:a", title: "Contrat A", nodeType: "ARTIFACT", dependsOn: ["collecte"] },
      { key: "doc:b", title: "Contrat B", nodeType: "ARTIFACT", dependsOn: ["collecte"] },
    ] as MissionPlan["steps"], [
      { key: "a", format: "DOCX", title: "Contrat A", fromStep: "doc:a" },
      { key: "b", format: "DOCX", title: "Contrat B", fromStep: "doc:b" },
    ]), catalogue, acteur);

    expect(r.ok, r.ok ? "" : r.issues.map((i) => `${i.code} ${i.message}`).join(" | ")).toBe(true);
  });

  it("DEUX pièces enchaînées de formats DIFFÉRENTS restent légitimes — l'Excel puis le deck", () => {
    const r = compile(plan([
      { key: "collecte", title: "Collecter", capability: "directory_list" },
      { key: "doc:xls", title: "Classeur", nodeType: "ARTIFACT", dependsOn: ["collecte"] },
      { key: "doc:ppt", title: "Présentation", nodeType: "ARTIFACT", dependsOn: ["doc:xls"] },
    ] as MissionPlan["steps"], [
      { key: "x", format: "XLSX", title: "Classeur", fromStep: "doc:xls" },
      { key: "p", format: "PPTX", title: "Présentation", fromStep: "doc:ppt" },
    ]), catalogue, acteur);

    expect(r.ok, r.ok ? "" : r.issues.map((i) => `${i.code} ${i.message}`).join(" | ")).toBe(true);
  });

  it("la descendance INDIRECTE compte aussi : un WORKER entre les deux ne blanchit rien", () => {
    const r = compile(plan([
      { key: "collecte", title: "Collecter", capability: "directory_list" },
      { key: "doc:tot", title: "Dossier provisoire", nodeType: "ARTIFACT", dependsOn: ["collecte"] },
      { key: "relire", title: "Relire", nodeType: "WORKER", dependsOn: ["doc:tot"] },
      { key: "doc:final", title: "Dossier final", nodeType: "ARTIFACT", dependsOn: ["relire"] },
    ] as MissionPlan["steps"], [
      { key: "d1", format: "DOCX", title: "Dossier", fromStep: "doc:tot" },
      { key: "d2", format: "DOCX", title: "Dossier", fromStep: "doc:final" },
    ]), catalogue, acteur);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((i) => i.message.includes("BROUILLON"))).toBe(true);
  });
});
