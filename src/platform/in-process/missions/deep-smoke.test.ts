import { describe, expect, it } from "vitest";
import {
  genererScenarios, verdictProfond,
  type Echantillons,
} from "@/platform/in-process/missions/deep-smoke";
import type { ResultatMission } from "@/platform/in-process/missions/provider-smoke";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DEEP LIVE SMOKE, SES DEUX FONCTIONS PURES — testées sans base et sans modèle.
 *
 * Le run lui-même coûte de vrais appels : il ne se joue que sur Render. Mais la VARIÉTÉ des
 * missions et la CLASSIFICATION des issues sont du code pur, et c'est là que les mensonges
 * naîtraient : un générateur qui inventerait des données quand la base est vide, un verdict
 * qui compterait un point fixe comme une conclusion honnête. Chaque test épingle un de ces
 * mensonges possibles.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const invPlein: Echantillons = {
  dossiers: Array.from({ length: 6 }, (_, i) => ({ reference: `REG-${i}`, title: `Dossier ${i}` })),
  produits: Array.from({ length: 8 }, (_, i) => ({ dci: `Molecule-${i}`, brandName: null })),
  employes: Array.from({ length: 6 }, (_, i) => ({ fullName: `Employe ${i}` })),
  fichiers: Array.from({ length: 6 }, (_, i) => ({ name: `Fichier-${i}.pdf` })),
  courriers: Array.from({ length: 4 }, (_, i) => ({ title: `Courrier ${i}` })),
  partenaires: Array.from({ length: 3 }, (_, i) => ({ name: `Partenaire ${i}` })),
  legals: Array.from({ length: 4 }, (_, i) => ({ title: `Contrat ${i}` })),
  factures: Array.from({ length: 3 }, (_, i) => ({ title: `Facture ${i}` })),
  paiements: Array.from({ length: 3 }, (_, i) => ({ title: `Paiement ${i}` })),
  taches: Array.from({ length: 4 }, (_, i) => ({ title: `Tache ${i}` })),
  marches: Array.from({ length: 3 }, (_, i) => ({ reference: `PCH-${i}`, title: null })),
  departements: Array.from({ length: 5 }, (_, i) => ({ name: `Departement ${i}` })),
  comptes: { dossiers: 6, produits: 8, employesActifs: 6, auditsSeptJours: 42 },
};

const invVide: Echantillons = {
  dossiers: [], produits: [], employes: [], fichiers: [], courriers: [], partenaires: [],
  legals: [], factures: [], paiements: [], taches: [], marches: [], departements: [],
  comptes: { dossiers: 0, produits: 0, employesActifs: 0, auditsSeptJours: 0 },
};

describe("genererScenarios — la variété vient du réel, jamais du vide", () => {
  it("base pleine, cible 80 : 60-80 missions, plus de quinze genres, tout énoncé cite le réel", () => {
    const { scenarios, ecartes } = genererScenarios(invPlein, "JETONTEST", 80);
    expect(scenarios.length).toBeGreaterThanOrEqual(60);
    expect(scenarios.length).toBeLessThanOrEqual(80);
    expect(new Set(scenarios.map((s) => s.genre)).size).toBeGreaterThanOrEqual(15);
    expect(ecartes).toHaveLength(0);
    for (const s of scenarios) {
      expect(s.demande.length).toBeGreaterThan(20);
      expect(s.verite.length).toBeGreaterThan(5);
    }
    // Les énoncés portent les enregistrements de l'inventaire, pas des noms inventés.
    expect(scenarios.some((s) => s.demande.includes("Molecule-0"))).toBe(true);
    expect(scenarios.some((s) => s.demande.includes("Dossier 0"))).toBe(true);
    expect(scenarios.some((s) => s.demande.includes("Fichier-0.pdf"))).toBe(true);
  });

  it("le jeton du run signe chaque preuve d'absence — et elle seule porte une précondition", () => {
    const { scenarios } = genererScenarios(invPlein, "JETONTEST", 80);
    const absences = scenarios.filter((s) => s.genre === "PREUVE_ABSENCE");
    expect(absences).toHaveLength(3);
    for (const a of absences) {
      expect(a.demande).toContain("JETONTEST");
      expect(a.verifier, "la vérité terrain d'une absence se COMPTE avant de lancer").toBeTypeOf("function");
      expect(a.attendu).toBe("CONCLUT");
    }
    for (const s of scenarios.filter((x) => x.genre !== "PREUVE_ABSENCE")) {
      expect(s.verifier).toBeUndefined();
    }
  });

  it("base VIDE : rien n'est inventé — seuls les genres sans donnée requise subsistent, le reste est ÉCARTÉ et dit", () => {
    const { scenarios, ecartes } = genererScenarios(invVide, "JETONTEST", 80);
    // AGREGATION reste : un compte MESURÉ à zéro est une donnée réelle (« combien ? — zéro »
    // se conclut). C'est le compte NON MESURÉ (-1) qui écarte, jamais le zéro (§78).
    expect(new Set(scenarios.map((s) => s.genre))).toEqual(new Set(["PREUVE_ABSENCE", "RECOURS_SOURCES", "AGREGATION"]));
    expect(scenarios).toHaveLength(7); // 3 absences + 1 recours + 3 agrégations à zéro
    expect(ecartes.length).toBeGreaterThanOrEqual(13);
    for (const e of ecartes) expect(e.raison.length).toBeGreaterThan(5);
    expect(ecartes.map((e) => e.genre)).toContain("POINT_DOSSIER");
  });

  it("un compte NON MESURÉ (-1) écarte l'agrégation — l'absence de mesure n'est pas un zéro (§78)", () => {
    const inv = { ...invVide, comptes: { dossiers: -1, produits: -1, employesActifs: -1, auditsSeptJours: -1 } };
    const { scenarios, ecartes } = genererScenarios(inv, "JETONTEST", 80);
    expect(scenarios.map((s) => s.genre)).not.toContain("AGREGATION");
    expect(ecartes.map((e) => e.genre)).toContain("AGREGATION");
  });

  it("la cible coupe en TOUR DE RÔLE : à 20 missions, la variété des genres survit", () => {
    const { scenarios } = genererScenarios(invPlein, "JETONTEST", 20);
    expect(scenarios).toHaveLength(20);
    expect(new Set(scenarios.map((s) => s.genre)).size).toBeGreaterThanOrEqual(15);
  });
});

/** Un résultat de mission de référence, à déformer branche par branche. */
function resultat(sur: Partial<ResultatMission>): ResultatMission {
  return {
    genre: "TEST", demande: "d", verite: "v", missionId: "m1",
    statutFinal: "COMPLETED", stable: true, motifArret: "état stable atteint : COMPLETED",
    toursMoteur: 1, replanifications: 0, versionPlan: 1, recoursObserves: 0,
    etapesCompilees: 2, etapesTerminees: 2, etapesEnEchec: 0,
    effetMaxAutorise: "ANALYZE", effetMaxPlanifie: "ANALYZE", effetMaxExecute: "READ",
    capacitesHorsPlafond: [], artefactsAvant: 0, artefactsApres: 0, artefactsCrees: [],
    appelsParUsage: {}, precondition: null, setupEchoue: false,
    qaPassed: true, goalSatisfied: true, goalVerdict: "atteint", cascade: null,
    ...sur,
  };
}

describe("verdictProfond — trois issues, et chaque défaut nomme sa preuve", () => {
  it("conclusion avec objectif atteint = SUCCÈS", () => {
    expect(verdictProfond(resultat({})).verdict).toBe("SUCCES");
  });

  it("arrêt stable et motivé hors COMPLETED = CONCLUSION HONNÊTE — pas une panne", () => {
    const v = verdictProfond(resultat({ statutFinal: "BLOCKED", goalSatisfied: false, motifArret: "replanification refusée : aucun recours" }));
    expect(v.verdict).toBe("CONCLUSION_HONNETE");
    expect(v.raison).toContain("aucun recours");
  });

  it("le POINT FIXE du run Render (état non stable) = DÉFAUT", () => {
    const v = verdictProfond(resultat({ stable: false, statutFinal: "WAITING_DEPENDENCY", motifArret: "POINT FIXE : la mission s'immobilise" }));
    expect(v.verdict).toBe("DEFAUT");
    expect(v.raison).toContain("POINT FIXE");
  });

  it("un artefact apparu sous plafond de lecture = DÉFAUT, même si la mission a « réussi »", () => {
    const v = verdictProfond(resultat({ artefactsCrees: ["Rapport.xlsx"] }));
    expect(v.verdict).toBe("DEFAUT");
    expect(v.raison).toContain("Rapport.xlsx");
  });

  it("un effet exécuté au-delà d'ANALYZE = DÉFAUT", () => {
    expect(verdictProfond(resultat({ effetMaxExecute: "PREPARE" })).verdict).toBe("DEFAUT");
  });

  it("COMPLETED sans objectif jugé atteint = DÉFAUT (incohérence moteur, pas un demi-succès)", () => {
    const v = verdictProfond(resultat({ goalSatisfied: null }));
    expect(v.verdict).toBe("DEFAUT");
    expect(v.raison).toContain("incohérence");
  });

  it("lancement refusé (aucune mission écrite) = DÉFAUT qui cite le motif", () => {
    const v = verdictProfond(resultat({ missionId: null, stable: false, motifArret: "Le planificateur n'a rien rendu" }));
    expect(v.verdict).toBe("DEFAUT");
    expect(v.raison).toContain("planificateur");
  });

  it("banc invalide (vérité terrain fausse) = DÉFAUT du BANC, dit comme tel", () => {
    const v = verdictProfond(resultat({ setupEchoue: true, motifArret: "INVALID / SETUP_FAILED" }));
    expect(v.verdict).toBe("DEFAUT");
    expect(v.raison).toContain("banc invalide");
  });
});
