import { describe, expect, it } from "vitest";
import { CLASSES, PLANCHERS, SANS_DESESCALADE, plancherDe } from "@/lib/cout/plancher";
import {
  choisir, escalader, northStar, porteDeRegression,
  FRAICHEUR_MAX_JOURS, type Candidate, type Mesure,
} from "@/lib/cout/choix";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'OPTIMISEUR QUALITÉ-D'ABORD (mandat 6 §50).
 *
 * Un optimiseur de coût converge toujours vers le moins cher : c'est sa définition. Tout ce
 * fichier vérifie ce qui l'en empêche — et notamment la règle qui fait tout le travail :
 * **une paire non mesurée n'est pas une option bon marché, c'est une inconnue.**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const cher: Candidate = { modele: "gpt-5.6-sol", effort: "high", coutUsd: 0.0400, msAttendu: 9_000 };
const moyen: Candidate = { modele: "gpt-5.6-terra", effort: "medium", coutUsd: 0.0120, msAttendu: 5_000 };
const pasCher: Candidate = { modele: "gpt-5.6-luna", effort: "low", coutUsd: 0.0012, msAttendu: 1_800 };

const mesure = (o: Partial<Mesure> = {}): Mesure => ({
  classe: "RECHERCHE", modele: "gpt-5.6-luna", effort: "low",
  exactitude: 0.97, erreursArithmetiques: 0, observations: 200, quand: new Date(), ...o,
});

describe("les planchers — la hiérarchie qualité > coût > latence est écrite, pas espérée", () => {
  it("chaque classe a un plancher, une raison, et zéro erreur d'arithmétique tolérée", () => {
    for (const c of CLASSES) {
      const p = plancherDe(c);
      expect(p.exactitude, c).toBeGreaterThan(0.5);
      expect(p.exactitude, c).toBeLessThanOrEqual(1);
      expect(p.pourquoi.length, c).toBeGreaterThan(30);
      // AUCUNE classe ne tolère une erreur d'arithmétique. Pas même TRIVIAL.
      expect(p.erreursArithmetiquesTolerees, c).toBe(0);
      // Plus la classe engage, plus il faut d'observations avant de croire une mesure.
      expect(p.observationsMin, c).toBeGreaterThanOrEqual(10);
    }
  });

  it("les classes engageantes refusent la désescalade PAR CONSTRUCTION", () => {
    for (const c of ["FINANCE", "REGULATORY", "LEGAL", "DECISION", "DOCUMENT_EXECUTIF"] as const) {
      expect(PLANCHERS[c].desescaladeAutorisee, c).toBe(false);
    }
    // Et ce n'est pas une exception marginale : c'est la moitié du travail sérieux.
    expect(SANS_DESESCALADE.length).toBeGreaterThanOrEqual(4);
    // Le trivial, lui, est le SEUL endroit où l'on économise agressivement.
    expect(PLANCHERS.TRIVIAL.desescaladeAutorisee).toBe(true);
    expect(PLANCHERS.TRIVIAL.pourquoi).toMatch(/nulle part ailleurs/i);
  });
});

describe("le choix — la qualité tranche AVANT le prix", () => {
  it("LA RÈGLE CENTRALE : une paire non mesurée est écartée, pas préférée pour son prix", () => {
    const ch = choisir("RECHERCHE", moyen, [moyen, pasCher], []); // aucune mesure
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    expect(ch.desescalade).toBe(false);
    const e = ch.ecartes.find((x) => x.candidate.modele === "gpt-5.6-luna")!;
    expect(e.motif).toBe("NON_MESURE");
    expect(e.explication).toMatch(/n'est pas une option bon marché, c'est une inconnue/i);
    // Et la limite dit ce qu'il faut faire pour économiser : MESURER.
    expect(ch.limites.join(" ")).toMatch(/les mesurer est la façon d'économiser/i);
  });

  it("avec une mesure SOLIDE au-dessus du plancher, la désescalade se fait et s'explique", () => {
    const ch = choisir("RECHERCHE", moyen, [moyen, pasCher], [mesure()]);
    expect(ch.retenu.modele).toBe("gpt-5.6-luna");
    expect(ch.desescalade).toBe(true);
    expect(ch.economieUsd).toBeCloseTo(0.0108, 6);
    expect(ch.justification).toMatch(/qualité MESURÉE au-dessus du plancher/i);
  });

  it("« 100 % sur trois essais » n'est pas une mesure : la désescalade est refusée", () => {
    const ch = choisir("RECHERCHE", moyen, [moyen, pasCher], [mesure({ exactitude: 1, observations: 3 })]);
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    const e = ch.ecartes[0]!;
    expect(e.motif).toBe("MESURE_MAIGRE");
    expect(e.explication).toMatch(/est une anecdote, pas une mesure/i);
  });

  it("une mesure SOUS le plancher est refusée, avec les deux nombres", () => {
    const ch = choisir("EXTRACTION", moyen, [moyen, pasCher], [mesure({ classe: "EXTRACTION", exactitude: 0.93, observations: 300 })]);
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    expect(ch.ecartes[0]!.motif).toBe("SOUS_LE_PLANCHER");
    expect(ch.ecartes[0]!.explication).toContain("93 %");
    expect(ch.ecartes[0]!.explication).toContain("97 %");
  });

  it("UNE SEULE erreur d'arithmétique suffit à refuser, même avec une exactitude parfaite", () => {
    const ch = choisir("ANALYSE", moyen, [moyen, pasCher],
      [mesure({ classe: "ANALYSE", exactitude: 1, observations: 500, erreursArithmetiques: 1 })]);
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    expect(ch.ecartes[0]!.explication).toMatch(/1 erreur\(s\) d'arithmétique/);
  });

  it("FINANCE ne descend JAMAIS, même avec une mesure parfaite sur mille essais", () => {
    const ch = choisir("FINANCE", moyen, [moyen, pasCher],
      [mesure({ classe: "FINANCE", exactitude: 1, observations: 1000 })]);
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    expect(ch.ecartes[0]!.motif).toBe("CLASSE_SANS_DESESCALADE");
    expect(ch.ecartes[0]!.explication).toMatch(/rapprochement bancaire/i);
    expect(ch.limites.join(" ")).toMatch(/aucune économie n'est cherchée ici, et c'est délibéré/i);
  });

  it("une mesure PÉRIMÉE ne vaut plus : les modèles bougent sous le même nom", () => {
    const vieux = new Date(Date.now() - (FRAICHEUR_MAX_JOURS + 10) * 86_400_000);
    const ch = choisir("RECHERCHE", moyen, [moyen, pasCher], [mesure({ quand: vieux })]);
    expect(ch.retenu.modele).toBe("gpt-5.6-terra");
    expect(ch.ecartes[0]!.motif).toBe("MESURE_PERIMEE");
  });

  it("la référence passe toujours : sans aucune mesure, un choix existe quand même", () => {
    const ch = choisir("LEGAL", cher, [cher], []);
    expect(ch.retenu).toEqual(cher);
    expect(ch.ecartes).toHaveLength(0);
  });

  it("à qualité recevable ÉGALE, le prix tranche — et la latence seulement en troisième", () => {
    const lent: Candidate = { modele: "gpt-5.6-luna", effort: "low", coutUsd: 0.0012, msAttendu: 9_000 };
    const rapide: Candidate = { modele: "gpt-5.6-luna", effort: "none", coutUsd: 0.0012, msAttendu: 900 };
    const ch = choisir("TRIVIAL", moyen, [moyen, lent, rapide], [
      mesure({ classe: "TRIVIAL", effort: "low", observations: 60 }),
      mesure({ classe: "TRIVIAL", effort: "none", observations: 60 }),
    ]);
    // Même coût → le plus rapide gagne.
    expect(ch.retenu.msAttendu).toBe(900);
  });
});

describe("l'escalade — elle exige un CONSTAT, jamais une impression", () => {
  it("une escalade sans raison écrite est refusée", () => {
    const r = escalader(pasCher, [moyen, cher], "   ");
    expect("refus" in r).toBe(true);
    expect((r as { refus: string }).refus).toMatch(/exige un CONSTAT écrit/i);
  });

  it("avec un constat, on monte d'UN cran — pas directement au plus cher", () => {
    const r = escalader(pasCher, [moyen, cher], "le recalcul a donné 41 300 000 au lieu de 43 100 000");
    expect("retenu" in r).toBe(true);
    const ok = r as { retenu: Candidate; justification: string };
    expect(ok.retenu.modele).toBe("gpt-5.6-terra");
    expect(ok.justification).toContain("41 300 000");
  });

  it("au sommet, l'escalade s'ARRÊTE et le dit — au lieu de réessayer le même", () => {
    const r = escalader(cher, [moyen, pasCher], "contrôle qualité raté");
    expect((r as { refus: string }).refus).toMatch(/l'escalade s'arrête ici, et il faut le DIRE/i);
  });
});

describe("le North Star et la porte de régression", () => {
  it("le coût par réussite n'existe pas quand rien n'a réussi — et on refuse de le dire nul", () => {
    const n = northStar({ missions: 12, reussies: 0, coutTotalUsd: 0.9, coutDesEchecsUsd: 0.9 });
    expect(n.coutParReussiteUsd).toBeNull();
    expect(n.phrase).toMatch(/le présenter comme nul serait un mensonge/i);
  });

  it("LE SEUIL EST UN RAPPORT, et « coût par mission » le cache", () => {
    // La règle exacte, celle qu'il faut avoir en tête avant de descendre d'un modèle :
    //
    //     un modèle K fois moins cher est un gain SI ET SEULEMENT SI il réussit plus
    //     de 1/K fois ce que réussit le modèle de référence.
    //
    // Deux fois moins cher tolère donc de perdre jusqu'à la MOITIÉ des réussites — c'est
    // beaucoup plus permissif que l'intuition ne le suggère, et c'est exactement pour cela
    // qu'il faut le calculer au lieu de le sentir. Ce qui interdit la descente dans la
    // pratique, ce n'est pas ce ratio : c'est le PLANCHER de qualité, qui n'est pas un
    // arbitrage économique.
    const soigne = northStar({ missions: 100, reussies: 95, coutTotalUsd: 4.0, coutDesEchecsUsd: 0.2 });

    // 66 réussites à moitié prix : le rapport est encore favorable, et le dire est honnête.
    const acceptable = northStar({ missions: 100, reussies: 66, coutTotalUsd: 2.0, coutDesEchecsUsd: 0.68 });
    expect(acceptable.coutParReussiteUsd!).toBeLessThan(soigne.coutParReussiteUsd!);

    // 40 réussites à moitié prix : le rapport bascule. « Moins cher » devient plus cher.
    const mauvais = northStar({ missions: 100, reussies: 40, coutTotalUsd: 2.0, coutDesEchecsUsd: 1.2 });
    expect(mauvais.coutParMissionUsd!).toBeLessThan(soigne.coutParMissionUsd!); // trompeur
    expect(mauvais.coutParReussiteUsd!).toBeGreaterThan(soigne.coutParReussiteUsd!); // la vérité
    expect(mauvais.partGachee).toBeGreaterThan(soigne.partGachee);

    // Et le ratio dit ce qu'il ne compte pas — les deux coûts les plus lourds d'un échec.
    expect(n0(mauvais.limites)).toMatch(/le temps de la personne qui découvre une erreur/i);
    expect(n0(mauvais.limites)).toMatch(/corpus comparable/i);
  });

  it("la porte refuse une économie payée en qualité, quel que soit le montant", () => {
    const p = porteDeRegression({ exactitude: 0.97, coutUsd: 0.04 }, { exactitude: 0.91, coutUsd: 0.001 });
    expect(p.accepte).toBe(false);
    expect(p.pourquoi).toMatch(/ne rachète pas un point de qualité/i);
    expect(p.pourquoi).toMatch(/les deux ne s'additionnent pas/i);
  });

  it("elle refuse aussi de payer plus cher pour rien", () => {
    expect(porteDeRegression({ exactitude: 0.97, coutUsd: 0.01 }, { exactitude: 0.97, coutUsd: 0.04 }).accepte).toBe(false);
  });

  it("elle accepte une économie à qualité tenue, et une dépense qui achète de la qualité", () => {
    expect(porteDeRegression({ exactitude: 0.97, coutUsd: 0.04 }, { exactitude: 0.97, coutUsd: 0.01 }).accepte).toBe(true);
    expect(porteDeRegression({ exactitude: 0.90, coutUsd: 0.01 }, { exactitude: 0.97, coutUsd: 0.04 }).accepte).toBe(true);
  });
});

const n0 = (xs: readonly string[]): string => xs.join(" ");
