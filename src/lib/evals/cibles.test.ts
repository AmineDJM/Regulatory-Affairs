import { describe, expect, it } from "vitest";
import { CIBLES, cibleDe, formaterValeur, mesurer, rendreTableau, verdictSuite } from "./cibles";

/**
 * LES CIBLES — ce que le mandat §33 exige, tenu par le code : chaque chiffre du mandat a une cible,
 * une cible non mesurée n'est jamais réussie, un invariant ne s'approche pas, un dénominateur nul
 * ne vaut pas 100 %.
 */
describe("le registre des cibles", () => {
  it("porte chaque chiffre du mandat §33, et rien en double", () => {
    const ids = CIBLES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const attendu of ["permissions", "faux_succes", "action_sans_preuve", "workflows_deterministes", "entites_ambigues", "anomalies_critiques", "conduite_attention", "provenance_faits_critiques", "regles_versionnees", "watches_restaures"]) {
      expect(ids, attendu).toContain(attendu);
    }
    expect(cibleDe("faux_succes").invariant).toBe(true);
    expect(cibleDe("action_sans_preuve").invariant).toBe(true);
    expect(() => cibleDe("cible_inventee")).toThrow(/inconnue/);
    for (const c of CIBLES) expect(c.mesure.length, c.id).toBeGreaterThan(5);
  });

  it("mesurer : un taux se juge contre son seuil, un dénominateur nul n'est pas 100 %, un invariant casse au premier cas", () => {
    expect(mesurer("entites_ambigues", { n: 60, ok: 58 })).toMatchObject({ valeur: 58 / 60, atteint: true });
    expect(mesurer("entites_ambigues", { n: 60, ok: 56 }).atteint).toBe(false);
    expect(mesurer("permissions", { n: 40, ok: 40 }).atteint).toBe(true);
    expect(mesurer("permissions", { n: 40, ok: 39 }).atteint).toBe(false);
    expect(mesurer("permissions", { n: 0, ok: 0 }).atteint).toBe(false);
    expect(mesurer("faux_succes", { valeur: 0 }).atteint).toBe(true);
    expect(mesurer("faux_succes", { valeur: 1 })).toMatchObject({ atteint: false, invariant: true });
    // Un invariant compté sur n/ok : la valeur est le nombre de cas contraires.
    expect(mesurer("action_sans_preuve", { n: 12, ok: 12 })).toMatchObject({ valeur: 0, atteint: true });
    expect(mesurer("action_sans_preuve", { n: 12, ok: 11 })).toMatchObject({ valeur: 1, atteint: false });
    expect(mesurer("entite_simple_p95", { valeur: 120 }).atteint).toBe(true);
    expect(mesurer("entite_simple_p95", { valeur: 301 }).atteint).toBe(false);
  });

  it("le verdict de la suite : toutes mesurées ET atteintes, sinon il nomme les manquées et les non mesurées", () => {
    const partiel = verdictSuite([mesurer("permissions", { n: 10, ok: 10 }), mesurer("faux_succes", { valeur: 2 })]);
    expect(partiel.ok).toBe(false);
    expect(partiel.atteintes.map((m) => m.id)).toEqual(["permissions"]);
    expect(partiel.manquees.map((m) => m.id)).toEqual(["faux_succes"]);
    expect(partiel.nonMesurees.length).toBe(CIBLES.length - 2);
    expect(partiel.phrase).toMatch(/manquée\(s\) : faux_succes/);
    expect(partiel.phrase).toMatch(/non mesurée\(s\)/);
    const complet = verdictSuite(CIBLES.map((c) => mesurer(c.id, c.unite === "taux" ? { n: 20, ok: 20 } : c.sens === "max" ? { valeur: 0 } : { valeur: c.cible })));
    expect(complet.ok).toBe(true);
    expect(complet.nonMesurees).toEqual([]);
  });

  it("le tableau dit les non mesurées et les invariants cassés en toutes lettres", () => {
    const t = rendreTableau([mesurer("faux_succes", { valeur: 1 }), mesurer("permissions", { n: 8, ok: 8 })]);
    expect(t).toMatch(/\| faux succès[^|]*\| ≤ 0 \| 1 \| INVARIANT CASSÉ \|/);
    expect(t).toMatch(/sécurité des permissions \| ≥ 100 % \| 100 % \(8\/8\) \| atteinte/);
    expect(t).toMatch(/résolution d'entités[^\n]*\| — \| NON MESURÉE \|/);
    expect(formaterValeur("taux", 0.9667)).toBe("96.7 %");
    expect(formaterValeur("ms", 312.4)).toBe("312 ms");
  });
});
