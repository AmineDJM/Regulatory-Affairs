import { describe, expect, it } from "vitest";
import { BUDGET_MEMOIRE_DEFAUT, COUCHES, INCOMPRESSIBLES, composer, estimerJetons, type Morceau } from "./budget";
import {
  FIDELITES, compacter, critiquesPerdus, fideliteVisee, pertes, verifier,
  type Compacteur, type Episode,
} from "./compact";

const m = (couche: Morceau["couche"], texte: string, poids?: number): Morceau => ({ couche, texte, poids });
const bloc = (n: number) => "x".repeat(n * 4);

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §96-97 — CE QUI SE COUPE, ET CE QUI NE SE COUPE JAMAIS.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("composition du contexte sous budget", () => {
  it("sert les couches dans l'ordre où un humain compétent répondrait", () => {
    const a = composer([
      m("EPISODES", "vieux souvenir"),
      m("CONTRAINTE_COURANTE", "pas avant vendredi"),
      m("IDENTITE_ACTIVE", "on parle de Redouane"),
      m("APPROBATION_EN_ATTENTE", "un accord attend"),
    ], 10_000);
    expect(a.morceaux.map((x) => x.couche)).toEqual([
      "APPROBATION_EN_ATTENTE", "IDENTITE_ACTIVE", "CONTRAINTE_COURANTE", "EPISODES",
    ]);
  });

  it("départage deux morceaux d'une même couche par leur poids", () => {
    const a = composer([
      m("EPISODES", "moins pertinent", 1),
      m("EPISODES", "plus pertinent", 9),
    ], 10_000);
    expect(a.morceaux[0].texte).toBe("plus pertinent");
  });

  it("coupe ce qui dépasse — et DIT ce qu'il a coupé", () => {
    const a = composer([
      m("TOURS_RECENTS", bloc(100)),
      m("EPISODES", bloc(500)),
      m("OPERATIONNEL", bloc(500)),
    ], 200);
    expect(a.morceaux.map((x) => x.couche)).toEqual(["TOURS_RECENTS"]);
    expect(a.metriques.ecartes.map((e) => e.couche).sort()).toEqual(["EPISODES", "OPERATIONNEL"]);
    expect(a.metriques.ecartes[0].tokens).toBeGreaterThan(0);
  });

  it("§97 — NE COUPE JAMAIS une approbation en attente, même au-delà du budget", () => {
    const a = composer([
      m("APPROBATION_EN_ATTENTE", bloc(500)),
      m("EPISODES", bloc(100)),
    ], 50);
    expect(a.morceaux.map((x) => x.couche)).toEqual(["APPROBATION_EN_ATTENTE"]);
    // Le dépassement est SIGNALÉ plutôt que masqué : couper ici ferait redemander un accord
    // déjà donné, ou pire, agir comme s'il l'était.
    expect(a.metriques.budgetDepasse).toBe(true);
  });

  it("§97 — les trois incompressibles passent TOUS, quel que soit le budget", () => {
    const a = composer([
      m("APPROBATION_EN_ATTENTE", bloc(300)),
      m("IDENTITE_ACTIVE", bloc(300)),
      m("CONTRAINTE_COURANTE", bloc(300)),
      m("PREFERENCES", bloc(10)),
    ], 10);
    expect(a.morceaux.map((x) => x.couche)).toEqual([...INCOMPRESSIBLES]);
    expect(INCOMPRESSIBLES.size).toBe(3);
  });

  it("la liste des incompressibles ne contient QUE ces trois-là", () => {
    for (const c of COUCHES) {
      const attendu = ["APPROBATION_EN_ATTENTE", "IDENTITE_ACTIVE", "CONTRAINTE_COURANTE"].includes(c);
      expect(INCOMPRESSIBLES.has(c), `${c}`).toBe(attendu);
    }
  });

  it("§98 — l'instrumentation distingue mémoire VIVE et mémoire RETROUVÉE", () => {
    const a = composer([
      m("TOURS_RECENTS", bloc(100)),
      m("IDENTITE_ACTIVE", bloc(50)),
      m("EPISODES", bloc(80)),
      m("EPISODES", bloc(80)),
      m("PREFERENCES", bloc(40)),
    ], 10_000);
    expect(a.metriques.workingMemoryTokens).toBeGreaterThan(0);
    expect(a.metriques.retrievedMemoryTokens).toBeGreaterThan(0);
    expect(a.metriques.contextTokens)
      .toBe(a.metriques.workingMemoryTokens + a.metriques.retrievedMemoryTokens);
    expect(a.metriques.episodeCount).toBe(2);
    expect(a.metriques.contextBuildMs).toBeGreaterThanOrEqual(0);
    expect(a.metriques.memoryCacheHit).toBe(false);
  });

  it("un contexte vide coûte zéro et ne plante pas", () => {
    const a = composer([], BUDGET_MEMOIRE_DEFAUT);
    expect(a.texte).toBe("");
    expect(a.metriques.contextTokens).toBe(0);
    expect(a.metriques.budgetDepasse).toBe(false);
  });

  it("l'estimation est monotone et gère le vide", () => {
    expect(estimerJetons("")).toBe(0);
    expect(estimerJetons("abcd")).toBeGreaterThan(0);
    expect(estimerJetons(bloc(100))).toBeGreaterThan(estimerJetons(bloc(10)));
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §92-95 — COMPRESSER SANS PERDRE CE QUI COMPTE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("compression progressive", () => {
  it("la fidélité descend avec l'âge", () => {
    expect(fideliteVisee(1, "RICH")).toBe("RICH");
    expect(fideliteVisee(20, "RICH")).toBe("STRUCTURED");
    expect(fideliteVisee(200, "RICH")).toBe("FACTS");
  });

  it("LA FIDÉLITÉ NE REMONTE JAMAIS — on ne reconstruit pas un détail jeté", () => {
    expect(fideliteVisee(1, "FACTS")).toBe("FACTS");
    expect(fideliteVisee(1, "STRUCTURED")).toBe("STRUCTURED");
    expect(fideliteVisee(20, "FACTS")).toBe("FACTS");
    expect(FIDELITES).toEqual(["RICH", "STRUCTURED", "FACTS"]);
  });
});

describe("les invariants d'une compression (§94)", () => {
  const avant: Episode = {
    summary: "Discussion sur le marché PCH-2026-014 et la facture de 4 200 000 DZD.",
    entities: ["MARCHE:PCH-2026-014", "EMPLOYEE:e-42"],
    decisions: ["on soumet avant le 15/03/2026"],
    commitments: ["Redouane envoie son contrat"],
    openQuestions: ["quel est le taux de remise ?"],
    corrections: ["ce n'est pas Anna, c'est Alla"],
  };

  it("une compression fidèle passe", () => {
    const apres: Episode = { ...avant, summary: "Marché PCH-2026-014, facture 4 200 000 DZD, 15/03/2026." };
    const v = verifier(avant, apres, avant.summary);
    expect(v.acceptable).toBe(true);
    expect(v.pertes).toEqual([]);
  });

  it("PERDRE UN IDENTIFIANT REFUSE la compression", () => {
    const apres: Episode = { ...avant, entities: ["EMPLOYEE:e-42"] };
    const v = verifier(avant, apres, avant.summary);
    expect(v.acceptable).toBe(false);
    expect(v.pertes.map((p) => p.valeur)).toContain("MARCHE:PCH-2026-014");
  });

  it("perdre une CORRECTION refuse la compression — sinon on refait la même erreur", () => {
    const apres: Episode = { ...avant, corrections: [] };
    const v = verifier(avant, apres, avant.summary);
    expect(v.acceptable).toBe(false);
    expect(v.pertes[0].champ).toBe("corrections");
  });

  it("perdre une décision, un engagement ou une question ouverte refuse aussi", () => {
    for (const champ of ["decisions", "commitments", "openQuestions"] as const) {
      const apres: Episode = { ...avant, [champ]: [] };
      expect(verifier(avant, apres, avant.summary).acceptable, champ).toBe(false);
    }
  });

  it("un MONTANT absent du résumé est une valeur critique perdue", () => {
    const texte = "La facture s'élève à 4 200 000 DZD, à régler avant le 15/03/2026.";
    expect(critiquesPerdus(texte, "La facture est à régler avant le 15/03/2026.")
      .map((c) => c.nom)).toContain("montant");
    expect(critiquesPerdus(texte, "Facture 4 200 000 DZD avant le 15/03/2026.")).toEqual([]);
  });

  it("le montant est retrouvé même écrit sans ses espaces", () => {
    expect(critiquesPerdus("Montant : 4 200 000 DZD.", "Montant 4200000DZD.")).toEqual([]);
  });

  it("une référence et un pourcentage comptent aussi", () => {
    const texte = "Marché PCH-2026-014, remise de 12,5 %.";
    const perdus = critiquesPerdus(texte, "Un marché avec une remise.");
    expect(perdus.map((c) => c.nom).sort()).toEqual(["pourcentage", "référence"]);
  });

  it("la comparaison ignore la casse et les espaces de bord", () => {
    expect(pertes(
      { ...avant, entities: ["  MARCHE:PCH-2026-014  "] },
      { ...avant, entities: ["marche:pch-2026-014"] },
    )).toEqual([]);
  });
});

describe("le compacteur, avec son filet", () => {
  const avant: Episode = {
    summary: "Le marché PCH-2026-014 vaut 4 200 000 DZD.",
    entities: ["MARCHE:PCH-2026-014"],
    decisions: ["soumettre avant le 15/03/2026"],
    commitments: [], openQuestions: [], corrections: [],
  };

  it("applique une compression fidèle", async () => {
    const c: Compacteur = {
      compacter: async () => ({ ...avant, summary: "PCH-2026-014 : 4 200 000 DZD, soumission 15/03/2026." }),
    };
    const r = await compacter(c, avant, avant.summary, "STRUCTURED");
    expect(r.applique).toBe(true);
    expect(r.episode.summary).toMatch(/4 200 000 DZD/);
  });

  it("REFUSE une compression qui perd un identifiant, et garde l'épisode d'origine", async () => {
    const c: Compacteur = {
      compacter: async () => ({ ...avant, entities: [], summary: "On a parlé d'un marché." }),
    };
    const r = await compacter(c, avant, avant.summary, "FACTS");
    expect(r.applique).toBe(false);
    expect(r.episode).toEqual(avant);
    expect(r.verdict.raison).toMatch(/perdu/);
  });

  it("UN COMPACTEUR QUI TOMBE NE DÉTRUIT RIEN", async () => {
    const c: Compacteur = { compacter: async () => { throw new Error("modèle indisponible"); } };
    const r = await compacter(c, avant, avant.summary, "FACTS");
    expect(r.applique).toBe(false);
    expect(r.episode).toEqual(avant);
    expect(r.verdict.raison).toMatch(/modèle indisponible/);
  });
});
