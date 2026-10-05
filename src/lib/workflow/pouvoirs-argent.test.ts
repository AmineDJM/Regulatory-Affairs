import { describe, expect, it } from "vitest";
import { argentEffectif, porteUnPouvoirDArgent, type ConfigArgent } from "./pouvoirs-argent";
import { defaultDefinition } from "./defaults";
import { etapesNonAtteintes, parcoursAdPro } from "./parcours";
import { WORKFLOW_CATEGORIES, type StepInput } from "./types";

/**
 * Les pouvoirs d'argent de l'étape qui CONCLUT une route coupée — la règle seule, sans base.
 * Le comportement de bout en bout (création, écran, moteur, pièce financière) est éprouvé par
 * `argent-route-coupee-flow.test.ts`.
 */

const etape = (powers: string[], requireAmount = false, requireCategory = false): ConfigArgent => ({ powers, requireAmount, requireCategory });
const DECISION = etape(["APPROVE", "REJECT", "SET_AMOUNT", "SET_CATEGORY", "COMMENT"], true, true);
const VALIDATION = etape(["APPROVE", "REJECT", "COMMENT"]);
const TENUE = etape(["APPROVE", "REJECT", "COMMENT"]);

describe("argentEffectif — ce que l'étape qui conclut décide de l'argent", () => {
  it("l'étape qui CONCLUT une route coupée hérite le montant, la catégorie ET leurs exigences", () => {
    const e = argentEffectif(VALIDATION, true, [DECISION]);
    expect(e.powers).toEqual(expect.arrayContaining(["SET_AMOUNT", "SET_CATEGORY"]));
    expect([e.requireAmount, e.requireCategory]).toEqual([true, true]);
    expect(e.powers, "ses propres pouvoirs restent").toEqual(expect.arrayContaining(["APPROVE", "REJECT", "COMMENT"]));
  });

  it("une étape qui NE conclut PAS n'hérite rien — elle propose, elle ne décide pas l'argent", () => {
    expect(argentEffectif(VALIDATION, false, [DECISION])).toBe(VALIDATION);
  });

  it("une étape configurée À LA MAIN garde sa configuration — rien n'y est fusionné", () => {
    // Le Super Admin lui a donné « fixer un montant » sans l'exiger : l'exigence de l'étape coupée ne
    // s'y ajoute pas. Une seule de ses quatre clés suffit à dire « configurée ».
    for (const propre of [etape(["APPROVE", "SET_AMOUNT"]), etape(["APPROVE", "SET_CATEGORY"]), etape(["APPROVE"], true), etape(["APPROVE"], false, true)]) {
      expect(argentEffectif(propre, true, [DECISION]), JSON.stringify(propre)).toBe(propre);
    }
  });

  it("RIEN À HÉRITER quand l'étape coupée ne fixe aucun argent — le sponsoring par défaut (§118.151)", () => {
    expect(argentEffectif(VALIDATION, true, [TENUE])).toBe(VALIDATION);
    expect(argentEffectif(VALIDATION, true, [])).toBe(VALIDATION);
  });

  it("l'exigence suit sa source : un pouvoir hérité sans exigence reste facultatif", () => {
    const e = argentEffectif(VALIDATION, true, [etape(["APPROVE", "SET_AMOUNT"])]);
    expect(e.powers).toContain("SET_AMOUNT");
    expect(e.powers).not.toContain("SET_CATEGORY");
    expect([e.requireAmount, e.requireCategory]).toEqual([false, false]);
  });

  it("porteUnPouvoirDArgent lit les quatre faits, et eux seuls", () => {
    expect(porteUnPouvoirDArgent(VALIDATION)).toBe(false);
    expect(porteUnPouvoirDArgent(etape(["ASSIGN", "COMMENT"]))).toBe(false);
    expect(porteUnPouvoirDArgent(etape(["SET_CATEGORY"]))).toBe(true);
    expect(porteUnPouvoirDArgent(etape([], true))).toBe(true);
  });
});

describe("Sur le circuit PAR DÉFAUT, seule la route du rang 2 hérite — et jamais pour le sponsoring", () => {
  const config = (s: StepInput): ConfigArgent => ({ powers: s.powers, requireAmount: s.requireAmount ?? false, requireCategory: s.requireCategory ?? false });

  it("chaque catégorie × chaque demandeur : l'étape qui conclut ne change que pour le rang 2, hors sponsoring", () => {
    // Le garde-fou STRUCTUREL du lot : un défaut de la règle qui ferait hériter une autre route — un
    // KAM, un National Sales, la Direction — ajouterait une exigence à une étape qui tranche déjà
    // avec ses propres pouvoirs, ou à une étape qui n'a rien à trancher.
    const demandeurs = [
      { nom: "KAM", rang: 0, kam: true }, { nom: "ordinaire", rang: 0, kam: false },
      { nom: "National Sales", rang: 1, kam: false }, { nom: "Direction Marketing", rang: 2, kam: false },
      { nom: "Direction", rang: 3, kam: false },
    ];
    for (const categorie of WORKFLOW_CATEGORIES) {
      const steps = defaultDefinition(categorie).steps;
      const slugs = steps.map((s) => s.slug);
      for (const d of demandeurs) {
        const p = parcoursAdPro({ rang: d.rang, kam: d.kam, categorie });
        const hors = etapesNonAtteintes(slugs, p.decision, p.ignorees);
        const route = slugs.filter((s) => !hors.includes(s));
        const conclut = steps.find((s) => s.slug === route[route.length - 1])!;
        const avant = config(conclut);
        const apres = argentEffectif(avant, true, hors.map((slug) => config(steps.find((s) => s.slug === slug)!)));
        const herite = apres !== avant;
        expect(herite, `${categorie} · ${d.nom} (conclut sur « ${conclut.slug} »)`).toBe(d.rang === 2 && categorie !== "SPONSORING");
        if (herite) {
          expect(conclut.slug).toBe("final");
          expect([apres.requireAmount, apres.requireCategory], `${categorie} · ${d.nom}`).toEqual([true, true]);
        }
      }
    }
  });
});
