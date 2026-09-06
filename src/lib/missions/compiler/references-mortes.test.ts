import { describe, expect, it } from "vitest";
import { compile } from "./compile";
import { sortieAttendue, verdictChemin } from "./sorties";
import { formeDe } from "@/lib/missions/registry/formes";
import { SCHEMA_WORKER_MINIMAL } from "@/lib/missions/runtime/sorties";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉFÉRENCE MORTE EST REFUSÉE AVANT L'EXÉCUTION — et l'ignorance ne refuse rien.
 *
 * ── LE DÉFAUT, ET SON COÛT EXACT ────────────────────────────────────────────────────────
 *
 * Le compilateur vérifiait qu'une référence `{{a.b}}` désigne une étape existante, jamais que
 * « b » existe. Le moteur, lui, le détectait parfaitement — mais À L'EXÉCUTION : `INVALID_STEP`,
 * `retryable: false`, mission morte, après l'accord du dirigeant et après que toutes les étapes
 * amont ont tourné et coûté. Sur le banc des deux cents missions, la famille COMPOSITION faisait
 * 1/13, et c'était la première cause.
 *
 * ── LES DEUX MOITIÉS DU CONTRAT, ET LA SECONDE EST LA PLUS IMPORTANTE ───────────────────
 *
 *   1. Ce que le compilateur SAIT faux, il le refuse — avec les champs réellement disponibles.
 *   2. Ce qu'il IGNORE, il le laisse passer. Un refus à tort serait strictement pire : il
 *      frapperait d'abord les capacités neuves, celles qui n'ont jamais tourné, c'est-à-dire
 *      exactement celles qu'un ERP en croissance ajoute. On aurait échangé un défaut mesuré
 *      contre un défaut invisible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const pdg: MissionActor = { userId: "u-pdg", label: "PDG", isAgent: false };

const CONNUES = ["directory_list", "inspect_record", "send_message", "run_analysis"];

function catalogueAvec(formes: Record<string, unknown[]> = {}): CapabilityCatalog {
  return {
    has: (n) => CONNUES.includes(n),
    allowed: () => true,
    meta: (n) => capabilityMeta(n),
    brief: () => [],
    entrees: () => null,
    sortie: (n) => (formes[n] ? formeDe(formes[n]) : null),
  };
}

function plan(steps: PlannedStep[]): MissionPlan {
  return {
    objective: "Composer",
    complexity: "B",
    scale: "S",
    workstreams: [{ id: "default", title: "Défaut", outcome: "fait" }],
    steps,
    acceptance: ["le livrable existe"],
  };
}

const messages = (r: ReturnType<typeof compile>): string[] =>
  r.ok ? [] : r.issues.map((i) => `${i.code} ${i.stepKey ?? "plan"} ${i.message}`);

describe("un worker rend EXACTEMENT ce que son schéma annonce", () => {
  it("LE CAS QUI DOMINAIT LE BANC : {{worker.total}} sur un worker sans champs déclarés est refusé", () => {
    // Un worker sans `outputFields` hérite de SCHEMA_WORKER_MINIMAL, fermé (`additionalProperties:
    // false`) et imposé au fournisseur en mode strict. `total` ne peut donc PAS exister. Ce refus
    // n'est pas une heuristique : c'est une déduction.
    const r = compile(plan([
      { key: "lecture", title: "Lire", capability: "directory_list", input: {} },
      { key: "calcul", title: "Calculer", nodeType: "WORKER", dependsOn: ["lecture"] },
      { key: "envoi", title: "Écrire", capability: "send_message", input: { recipientName: "PDG", body: "Total : {{calcul.total}}" } },
    ]), catalogueAvec(), pdg);
    expect(r.ok).toBe(false);
    const m = messages(r).join(" | ");
    expect(m).toContain("INVALID_INPUT");
    expect(m).toContain("« total »");
    // LE REFUS DIT LA SORTIE. Sans cette phrase, le planificateur devine une seconde fois.
    expect(m).toContain("resultat, faits, incertitudes");
  });

  it("le même plan compile dès que le worker DÉCLARE le champ", () => {
    const r = compile(plan([
      { key: "lecture", title: "Lire", capability: "directory_list", input: {} },
      {
        key: "calcul", title: "Calculer", nodeType: "WORKER", dependsOn: ["lecture"],
        expectedOutputSchema: {
          type: "object", properties: { total: { type: "number" } },
          required: ["total"], additionalProperties: false,
        },
      },
      { key: "envoi", title: "Écrire", capability: "send_message", input: { recipientName: "PDG", body: "Total : {{calcul.total}}" } },
    ]), catalogueAvec(), pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("un schéma OUVERT ne fait rien refuser : déclarer n'est pas fermer", () => {
    // `additionalProperties` absent = le schéma n'interdit pas les autres champs. On ne peut donc
    // pas affirmer qu'un champ non listé sera absent, et on ne refuse pas.
    const s = sortieAttendue({
      nodeType: "WORKER",
      expectedOutputSchema: { type: "object", properties: { a: { type: "string" } } },
    });
    expect(s.certitude).toBe("PARTIELLE");
    expect(verdictChemin(s, "b")).toBeNull();
  });
});

describe("une jonction ne porte aucune donnée, et le dit", () => {
  it("{{jonction.lignes}} est refusé, en nommant la vraie solution", () => {
    const r = compile(plan([
      { key: "a", title: "Lire A", capability: "directory_list", input: {} },
      { key: "b", title: "Lire B", capability: "directory_list", input: {} },
      { key: "jonction", title: "Rassembler", nodeType: "JOIN", dependsOn: ["a", "b"] },
      { key: "envoi", title: "Écrire", capability: "send_message", input: { recipientName: "PDG", body: "{{jonction.lignes}}" } },
    ]), catalogueAvec(), pdg);
    expect(r.ok).toBe(false);
    expect(messages(r).join(" | ")).toContain("Lis directement l'étape qui produit les données");
  });
});

describe("la forme APPRISE refuse ce qu'elle a mesuré, et rien de plus", () => {
  // L'erreur exacte du banc m6 : `.id` alors que la capacité rend `driveNodeId`.
  const observees = {
    directory_list: [{ salaries: [{ id: "1", nom: "n", emails: [] }], total: 1 }],
  };

  it("un champ racine jamais observé sur une capacité mesurée est refusé", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{liste.effectif}}" } },
    ]), catalogueAvec(observees), pdg);
    expect(r.ok).toBe(false);
    expect(messages(r).join(" | ")).toContain("salaries, total");
  });

  it("descendre dans la liste principale reste permis, index compris", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{liste.salaries.0.nom}}" } },
    ]), catalogueAvec(observees), pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("LE TEST QUI COMPTE : une capacité JAMAIS observée ne fait rien refuser", () => {
    // C'est la moitié du contrat qui protège l'existant. Sans elle, toute capacité neuve — donc
    // tout skill dynamique fraîchement branché — verrait ses plans refusés à la compilation.
    const r = compile(plan([
      { key: "analyse", title: "Analyser", capability: "run_analysis", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{analyse.nimporte.quoi.0.jamais_vu}}" } },
    ]), catalogueAvec(), pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("un catalogue SANS `sortie()` se comporte comme avant — l'absence de mesure n'est pas un refus", () => {
    const sansSortie: CapabilityCatalog = {
      has: (n) => CONNUES.includes(n), allowed: () => true,
      meta: (n) => capabilityMeta(n), brief: () => [],
    };
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{liste.effectif}}" } },
    ]), sansSortie, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });
});

describe("mesure consignée — les références mortes attrapées à la compilation", () => {
  it("les formes de référence morte du banc sont refusées AVANT l'exécution", () => {
    /**
     * Chaque cas est une référence que le moteur aurait détectée à l'exécution, en tuant la
     * mission. On vérifie qu'elles n'y arrivent plus — et, dans la seconde moitié, que les
     * références LICITES passent toujours. Un contrôle qui refuserait tout aurait un score
     * parfait sur la première moitié et serait une catastrophe.
     */
    const observees = { directory_list: [{ salaries: [{ nom: "n", reference: "r" }], total: 1 }] };
    const cat = catalogueAvec(observees);
    const mortes: [string, PlannedStep[]][] = [
      ["worker minimal → champ inventé", [
        { key: "w", title: "W", nodeType: "WORKER" },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{w.total}}" } },
      ]],
      ["worker minimal → liste inventée", [
        { key: "w", title: "W", nodeType: "WORKER" },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{w.lignes.0.nom}}" } },
      ]],
      ["worker déclaré → champ hors déclaration", [
        {
          key: "w", title: "W", nodeType: "WORKER",
          expectedOutputSchema: { type: "object", properties: { marge: { type: "number" } }, required: ["marge"], additionalProperties: false },
        },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{w.chiffreAffaires}}" } },
      ]],
      ["jonction → données", [
        { key: "a", title: "A", capability: "directory_list", input: {} },
        { key: "j", title: "J", nodeType: "JOIN", dependsOn: ["a"] },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{j.salaries.0.reference}}" } },
      ]],
      ["capacité observée → champ absent", [
        { key: "a", title: "A", capability: "directory_list", input: {} },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{a.employes.0.reference}}" } },
      ]],
      ["capacité observée → mauvais champ dans la liste (l'erreur m6)", [
        { key: "a", title: "A", capability: "directory_list", input: {} },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{a.salaries.0.id}}" } },
      ]],
    ];
    const licites: [string, PlannedStep[]][] = [
      ["worker minimal → resultat", [
        { key: "w", title: "W", nodeType: "WORKER" },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{w.resultat}}" } },
      ]],
      ["capacité observée → chemin réel", [
        { key: "a", title: "A", capability: "directory_list", input: {} },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{a.salaries.0.reference}}" } },
      ]],
      ["capacité jamais observée → n'importe quel chemin", [
        { key: "a", title: "A", capability: "run_analysis", input: {} },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{a.resultats.0.valeur}}" } },
      ]],
      ["la sortie entière, sans chemin", [
        { key: "w", title: "W", nodeType: "WORKER" },
        { key: "x", title: "X", capability: "inspect_record", input: { reference: "{{w}}" } },
      ]],
    ];

    const attrapees = mortes.filter(([, steps]) => !compile(plan(steps), cat, pdg).ok).length;
    const passees = licites.filter(([, steps]) => compile(plan(steps), cat, pdg).ok).length;

    consignerMesure("reference_morte_avant_execution", { n: mortes.length, ok: attrapees },
      "lib/missions/compiler/references-mortes.test.ts",
      "références mortes refusées à la COMPILATION au lieu de tuer la mission à l'exécution");
    consignerMesure("reference_licite_jamais_refusee", { n: licites.length, ok: passees },
      "lib/missions/compiler/references-mortes.test.ts",
      "références correctes — dont une capacité jamais observée — qui compilent toujours");

    expect(mortes.filter(([, s]) => compile(plan(s), cat, pdg).ok).map(([n]) => n)).toEqual([]);
    expect(licites.filter(([, s]) => !compile(plan(s), cat, pdg).ok).map(([n]) => n)).toEqual([]);
  });
});

describe("une seule définition de la forme des nœuds fabriqués par le code", () => {
  it("le schéma minimal du worker est bien fermé — sans quoi tout ce contrôle serait faux", () => {
    // La déduction « un worker rend exactement ces trois champs » repose ENTIÈREMENT sur ce
    // `false`. Le jour où quelqu'un l'ouvre, ce test tombe au lieu que les refus deviennent faux.
    expect(SCHEMA_WORKER_MINIMAL.additionalProperties).toBe(false);
    expect(Object.keys(SCHEMA_WORKER_MINIMAL.properties as object)).toEqual(["resultat", "faits", "incertitudes"]);
  });
});
