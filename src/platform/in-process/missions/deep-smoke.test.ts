import { describe, expect, it } from "vitest";
import {
  genererScenarios, verdictProfond, poursuivreEscalade, carteDeScore, GENRES_TRIVIAUX,
  type Echantillons, type PalierMesure, type MissionProfonde, type ResultatDeep,
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

/** Un palier de référence, à déformer signal par signal. */
function palier(sur: Partial<PalierMesure>): PalierMesure {
  return {
    concurrence: 3, missions: 10, succes: 6, honnetes: 4, defauts: 0,
    p50Ms: 8000, p95Ms: 30000, dureeMs: 120000, missionsParMinute: 5,
    ...sur,
  };
}

describe("poursuivreEscalade — on ne monte jamais sur un palier qui dégrade (§29)", () => {
  it("palier sain (défauts stables, P95 contenu) : on monte", () => {
    const e = poursuivreEscalade(palier({}), palier({ concurrence: 5, p95Ms: 45000 }));
    expect(e.poursuivre).toBe(true);
  });

  it("des DÉFAUTS en hausse arrêtent l'escalade, raison dite", () => {
    const e = poursuivreEscalade(palier({}), palier({ concurrence: 10, defauts: 2 }));
    expect(e.poursuivre).toBe(false);
    expect(e.raison).toContain("défauts en hausse");
  });

  it("un P95 plus que DOUBLÉ arrête l'escalade — le système sature", () => {
    const e = poursuivreEscalade(palier({}), palier({ concurrence: 10, p95Ms: 70000 }));
    expect(e.poursuivre).toBe(false);
    expect(e.raison).toContain("P95");
  });

  it("un P95 NON MESURÉ n'est pas un signal d'arrêt — l'absence de mesure n'est pas une mesure (§78)", () => {
    const e = poursuivreEscalade(palier({ p95Ms: null }), palier({ concurrence: 10, p95Ms: null }));
    expect(e.poursuivre).toBe(true);
  });
});

describe("carteDeScore (§71) — les taux qui décident, agrégés par le code", () => {
  const mission = (
    genre: string,
    verdict: MissionProfonde["verdict"],
    sur: Partial<ResultatMission> = {},
  ): MissionProfonde => ({
    genre, titre: genre, attendu: "OBSERVE", verdict, raisonVerdict: "—",
    resultat: resultat({
      genre,
      statutFinal: verdict === "SUCCES" ? "COMPLETED" : "BLOCKED",
      goalSatisfied: verdict === "SUCCES",
      ...sur,
    }),
  });

  const runDe = (missions: MissionProfonde[], sur: Partial<ResultatDeep> = {}): ResultatDeep => ({
    horodatage: "2026-08-29T00:00:00.000Z", jeton: "T", modele: "gpt-x", cible: missions.length,
    concurrence: 3, missions, ecartes: [], jetonsEntree: 1000, jetonsSortie: 500,
    appelsModele: 0, latenceTotaleMs: 120000, nettoyage: { supprimees: 0, gardees: false },
    paliers: null, arretEscalade: null, concurrenceRetenue: null,
    ...sur,
  });

  const cascade = (voiePlan: "DIRECTE" | "MODELE", totalMs: number) =>
    ({ voiePlan, totalMs } as unknown as ResultatMission["cascade"]);

  it("chaque taux vient de SES missions : E2E, création, routes, non-trivial, gaspillage", () => {
    const r = runDe([
      mission("PREUVE_ABSENCE", "SUCCES", { cascade: cascade("DIRECTE", 3000), appelsParUsage: { juge: 1 } }),
      mission("TACHES", "SUCCES", { cascade: cascade("DIRECTE", 8000), appelsParUsage: { worker: 2 } }),
      mission("LEGAL", "CONCLUSION_HONNETE", { cascade: cascade("MODELE", 30000), appelsParUsage: { planner: 3, juge: 3 } }),
      mission("FINANCES", "DEFAUT", { missionId: null, appelsParUsage: {} }),
    ]);
    const c = carteDeScore(r);
    expect(c.e2e).toEqual({ num: 2, den: 4, taux: 50 });
    expect(c.creation).toEqual({ num: 3, den: 4, taux: 75 });
    const directe = c.parVoie.find((v) => v.voie === "DIRECTE")!;
    expect(directe.succes).toEqual({ num: 2, den: 2, taux: 100 });
    expect(directe.p50Ms).toBe(3000);
    // Non trivial : PREUVE_ABSENCE exclue → 1 succès (TACHES) sur 3.
    expect(c.nonTriviales.den).toBe(3);
    expect(c.nonTriviales.num).toBe(1);
    // 9 appels au total, 3 sur des succès → 6 gaspillés (66,7 %).
    expect(c.appels).toEqual({ total: 9, surSucces: 3, surNonSucces: 6, tauxGaspillePct: 66.7 });
    expect(c.jetons.parSucces).toBe(750);
  });

  it("§78 — zéro mission, zéro succès : les taux sont NULS, jamais 0 % ni 100 %", () => {
    const c = carteDeScore(runDe([]));
    expect(c.e2e.taux).toBeNull();
    expect(c.nonTriviales.taux).toBeNull();
    expect(c.appels.tauxGaspillePct).toBeNull();
    expect(c.jetons.parSucces).toBeNull();
    expect(c.latence.p50Ms).toBeNull();
  });

  it("SABOTAGE anti-triche — réussir SEULEMENT les genres triviaux laisse NON-TRIVIALES à 0 %", () => {
    const r = runDe([
      mission("PREUVE_ABSENCE", "SUCCES"),
      mission("RECHERCHE_PRODUIT", "SUCCES"),
      mission("LEGAL", "CONCLUSION_HONNETE"),
    ]);
    const c = carteDeScore(r);
    expect(c.e2e.taux).toBeCloseTo(66.7, 1);
    expect(c.nonTriviales).toEqual({ num: 0, den: 1, taux: 0 });
    expect(GENRES_TRIVIAUX).toContain("PREUVE_ABSENCE");
  });
});
