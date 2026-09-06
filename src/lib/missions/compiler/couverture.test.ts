import { describe, expect, it } from "vitest";
import { compile } from "./compile";
import { exigencesFermes } from "@/lib/missions/planner/primitives";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLAN COUVRE-T-IL CE QUE LA DEMANDE EXIGE ? (§56)
 *
 * ── LE DÉFAUT, ET C'ÉTAIT LA DERNIÈRE CAUSE BLOQUANTE ───────────────────────────────────
 *
 * Les deux seuls contrôles de couverture du compilateur étaient « au moins une étape » et
 * « au moins un critère d'acceptation ». Un plan « lire → répondre » compilait donc sans
 * réserve pour une demande qui réclamait un chiffre ou une pièce. L'absence n'était constatée
 * qu'à la toute fin, par le contrôle arithmétique, après que toutes les étapes avaient tourné
 * et coûté — et pas du tout si le modèle avait omis d'annoncer un livrable. Au banc :
 * STATISTIQUES 0/17, REPRESENTATION 2/17.
 *
 * ── LES TROIS CONDITIONS, ET CHACUNE ÉVITE UN REFUS À TORT ──────────────────────────────
 *
 *   1. la demande exige la primitive de façon SÛRE ;
 *   2. le catalogue en offre une à CET acteur — sinon c'est un manque à déclarer, pas une
 *      faute de plan, et refuser boucherait la seule issue honnête ;
 *   3. aucune étape ne la porte — un nœud ARTIFACT comptant comme DOCUMENT, puisque c'est
 *      lui qui fabrique le fichier.
 *
 * Le quatrième garde-fou est ailleurs : sous plafond de lecture, DOCUMENT et ACTION ne peuvent
 * pas être exigés. Exiger d'une mission à qui l'on vient d'interdire de produire qu'elle
 * produise serait une contradiction, et une contradiction qui BOUCLE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const pdg: MissionActor = { userId: "u", label: "PDG", isAgent: false };

/** Un catalogue dont chaque capacité porte une primitive explicite — c'est ce qui est jugé. */
function catalogueDe(primitives: Record<string, string>): CapabilityCatalog {
  const noms = Object.keys(primitives);
  const briefs: CapabilityBrief[] = noms.map((id) => ({
    id, domain: "test", primitive: primitives[id], effect: "ANALYZE", batchable: false, summary: id,
  }));
  return {
    has: (n) => noms.includes(n),
    allowed: () => true,
    meta: (n) => ({ ...capabilityMeta(n), primitive: (primitives[n] ?? "INFORMATION") as never }),
    brief: () => briefs,
  };
}

const AVEC_CALCUL = catalogueDe({
  directory_list: "INFORMATION", run_analysis: "CALCUL", chart_advice: "REPRESENTATION",
});
const SANS_CALCUL = catalogueDe({ directory_list: "INFORMATION" });

function plan(steps: PlannedStep[]): MissionPlan {
  return {
    objective: "o", complexity: "B", scale: "S",
    workstreams: [{ id: "default", title: "d", outcome: "fait" }],
    steps, acceptance: ["c'est fait"],
  };
}

const lecture: PlannedStep = { key: "lire", title: "Lire", capability: "directory_list", input: {} };
const calcul: PlannedStep = { key: "calcul", title: "Calculer", capability: "run_analysis", input: {}, dependsOn: ["lire"] };
const messages = (r: ReturnType<typeof compile>): string => (r.ok ? "" : r.issues.map((i) => `${i.code} ${i.message}`).join(" | "));

const DEMANDE_CHIFFREE = "Combien de dossiers réglementaires sont en retard ?";

describe("un plan qui n'a pas l'étape que la demande réclame est refusé", () => {
  it("LE CAS QUI DOMINAIT STATISTIQUES : lire puis répondre, pour une demande chiffrée", () => {
    const r = compile(plan([lecture]), AVEC_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok).toBe(false);
    expect(messages(r)).toContain("MISSING_PRIMITIVE");
    expect(messages(r)).toContain("CALCUL");
    // Le refus laisse TOUJOURS l'issue honnête ouverte : dire le manque plutôt que conclure sans.
    expect(messages(r)).toContain("gaps");
  });

  it("le même plan, avec l'étape de calcul, compile", () => {
    const r = compile(plan([lecture, calcul]), AVEC_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("LE TEST QUI COMPTE : sans capacité de calcul disponible, on n'exige RIEN", () => {
    // Sinon la mission boucle : le refus repart au planificateur, qui ne peut pas y répondre
    // puisque rien dans son catalogue ne calcule. Ce n'est plus une faute de plan, c'est un
    // manque — et le déclarer est la bonne réponse, pas une réécriture de plus.
    const r = compile(plan([lecture]), SANS_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("un nœud ARTIFACT couvre DOCUMENT : c'est LUI qui fabrique le fichier", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const artefact: PlannedStep = { key: "piece", title: "Produire", nodeType: "ARTIFACT", dependsOn: ["lire"], input: {} };
    const r = compile(plan([lecture, artefact]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("sous plafond de LECTURE, on n'exige ni pièce ni action — sans quoi le refus boucle", () => {
    // « Lis ce document et fais-m'en un rapport » en lecture seule : la mission s'est vu dire
    // qu'elle ne produirait AUCUN fichier. Lui reprocher de ne pas en produire n'a pas d'issue.
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const r = compile(plan([lecture]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"], effetMax: "ANALYZE" });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("aucune exigence : le compilateur se comporte exactement comme avant", () => {
    expect(compile(plan([lecture]), AVEC_CALCUL, pdg).ok).toBe(true);
    expect(compile(plan([lecture]), AVEC_CALCUL, pdg, { primitivesRequises: [] }).ok).toBe(true);
  });
});

describe("mesure consignée — de la demande au refus, par le chemin complet", () => {
  it("les demandes qui exigent une primitive absente du plan sont toutes refusées", () => {
    /**
     * On part de la PHRASE, pas d'une liste de primitives écrite à la main : c'est la chaîne
     * réelle (lire la demande → exiger → refuser) qui est mesurée. La seconde moitié du jeu
     * vérifie qu'un plan complet, ou une demande sans exigence, passe toujours.
     */
    const refusables: [string, PlannedStep[]][] = [
      ["Combien de contrats arrivent à échéance ?", [lecture]],
      ["Calcule le total des pénalités", [lecture]],
      ["Quel est le taux de rejet de nos dossiers ?", [lecture]],
      ["Donne-moi la moyenne des délais par service", [lecture]],
      ["Fais un graphique des immatriculations", [lecture, calcul]],
    ];
    const acceptables: [string, PlannedStep[]][] = [
      ["Combien de contrats arrivent à échéance ?", [lecture, calcul]],
      ["Qui est responsable du dossier Mouffok ?", [lecture]],
      ["Retrouve le contrat signé avec Sanofi", [lecture]],
      ["Attends le devis du fournisseur avant de conclure", [lecture]],
    ];
    const opts = (d: string) => ({ primitivesRequises: exigencesFermes(d) });
    const refuses = refusables.filter(([d, st]) => !compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).length;
    const passes = acceptables.filter(([d, st]) => compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).length;

    consignerMesure("plan_couvre_objectif", { n: refusables.length + acceptables.length, ok: refuses + passes },
      "lib/missions/compiler/couverture.test.ts",
      "plans jugés correctement sur la couverture des primitives que la demande exige — refus quand il manque, passage quand tout y est");

    expect(refusables.filter(([d, st]) => compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).map(([d]) => d)).toEqual([]);
    expect(acceptables.filter(([d, st]) => !compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).map(([d]) => d)).toEqual([]);
  });
});
