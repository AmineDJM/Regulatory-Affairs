import { describe, expect, it } from "vitest";
import { type Programme, optimiser, resumerOptimum } from "./simplexe";

describe("simplexe — l'optimisation sous contraintes", () => {
  it("le programme classique de Hillier : optimum 36 en (2, 6) et les prix marginaux de la table", () => {
    const p: Programme = {
      sens: "max",
      variables: [{ nom: "x", objectif: 3 }, { nom: "y", objectif: 5 }],
      contraintes: [
        { nom: "usine 1", coefficients: { x: 1 }, comparateur: "<=", valeur: 4 },
        { nom: "usine 2", coefficients: { y: 2 }, comparateur: "<=", valeur: 12 },
        { nom: "usine 3", coefficients: { x: 3, y: 2 }, comparateur: "<=", valeur: 18 },
      ],
    };
    const r = optimiser(p);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.objectif).toBeCloseTo(36, 6);
    expect(r.valeurs.x).toBeCloseTo(2, 6);
    expect(r.valeurs.y).toBeCloseTo(6, 6);
    expect(r.contraintes.find((c) => c.nom === "usine 1")!.prixMarginal).toBeCloseTo(0, 6);
    expect(r.contraintes.find((c) => c.nom === "usine 2")!.prixMarginal).toBeCloseTo(1.5, 6);
    expect(r.contraintes.find((c) => c.nom === "usine 3")!.prixMarginal).toBeCloseTo(1, 6);
    expect(r.contraintes.find((c) => c.nom === "usine 1")!.jeu).toBeCloseTo(2, 6);
    expect(r.contraintes.find((c) => c.nom === "usine 2")!.saturee).toBe(true);
    expect(r.goulots.map((g) => g.nom)).toEqual(["usine 2", "usine 3"]);
    expect(r.goulots[0]!.interpretation).toMatch(/améliore l'objectif de 1\.5/);
    const lignes = resumerOptimum(r);
    expect(lignes[0]).toMatch(/36/);
    expect(lignes.some((l) => /usine 2/.test(l))).toBe(true);
  });

  it("le programme de Vanderbei : optimum 13 en (2, 0, 1)", () => {
    const r = optimiser({
      sens: "max",
      variables: [{ nom: "a", objectif: 5 }, { nom: "b", objectif: 4 }, { nom: "c", objectif: 3 }],
      contraintes: [
        { coefficients: { a: 2, b: 3, c: 1 }, comparateur: "<=", valeur: 5 },
        { coefficients: { a: 4, b: 1, c: 2 }, comparateur: "<=", valeur: 11 },
        { coefficients: { a: 3, b: 4, c: 2 }, comparateur: "<=", valeur: 8 },
      ],
    });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.objectif).toBeCloseTo(13, 6);
    expect(r.valeurs.a).toBeCloseTo(2, 6);
    expect(r.valeurs.b).toBeCloseTo(0, 6);
    expect(r.valeurs.c).toBeCloseTo(1, 6);
  });

  it("une minimisation avec des contraintes ≥ (le mélange au moindre coût) passe par la phase 1", () => {
    // min 0,6 a + 1,0 b, a + b >= 100, a >= 20, b >= 30, 2a + 5b >= 300
    const r = optimiser({
      sens: "min",
      variables: [{ nom: "a", objectif: 0.6, min: 20 }, { nom: "b", objectif: 1, min: 30 }],
      contraintes: [
        { nom: "volume", coefficients: { a: 1, b: 1 }, comparateur: ">=", valeur: 100 },
        { nom: "titre", coefficients: { a: 2, b: 5 }, comparateur: ">=", valeur: 300 },
      ],
    });
    if (!r.ok) throw new Error(r.erreur);
    // a + b = 100 et 2a + 5b = 300 → b = 100/3, a = 200/3 → coût 0,6·66,67 + 33,33 = 73,33
    expect(r.valeurs.a).toBeCloseTo(200 / 3, 5);
    expect(r.valeurs.b).toBeCloseTo(100 / 3, 5);
    expect(r.objectif).toBeCloseTo(0.6 * (200 / 3) + 100 / 3, 5);
    expect(r.contraintes.every((c) => c.saturee)).toBe(true);
    expect(r.goulots.length).toBe(2);
  });

  it("une égalité et des bornes supérieures sont respectées", () => {
    const r = optimiser({
      sens: "max",
      variables: [{ nom: "x", objectif: 2, max: 6 }, { nom: "y", objectif: 3, max: 6 }],
      contraintes: [{ nom: "budget", coefficients: { x: 1, y: 1 }, comparateur: "=", valeur: 10 }],
    });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.valeurs.x).toBeCloseTo(4, 6);
    expect(r.valeurs.y).toBeCloseTo(6, 6);
    expect(r.objectif).toBeCloseTo(26, 6);
  });

  it("le sac à dos binaire : la relaxation dit 240, l'optimum entier est 220", () => {
    const items = [{ nom: "i1", v: 60, w: 10 }, { nom: "i2", v: 100, w: 20 }, { nom: "i3", v: 120, w: 30 }];
    const contrainte = { nom: "capacité", coefficients: Object.fromEntries(items.map((i) => [i.nom, i.w])), comparateur: "<=" as const, valeur: 50 };
    const continu = optimiser({ sens: "max", variables: items.map((i) => ({ nom: i.nom, objectif: i.v, max: 1 })), contraintes: [contrainte] });
    if (!continu.ok) throw new Error(continu.erreur);
    expect(continu.objectif).toBeCloseTo(240, 6);
    const entier = optimiser({ sens: "max", variables: items.map((i) => ({ nom: i.nom, objectif: i.v, type: "binaire" as const })), contraintes: [contrainte] });
    if (!entier.ok) throw new Error(entier.erreur);
    expect(entier.objectif).toBeCloseTo(220, 6);
    expect(entier.valeurs).toEqual({ i1: 0, i2: 1, i3: 1 });
    expect(entier.statut).toBe("OPTIMAL_ENTIER");
    expect(entier.ecartOptimalite).toBe(0);
    expect(entier.contraintes[0]!.prixMarginal).toBeNull();
    expect(entier.rigueur.limites.some((l) => /duales/.test(l))).toBe(true);
  });

  it("des lots indivisibles : l'arrondi de la relaxation se tromperait", () => {
    // max 4x + 3y, 3x + 4y <= 12, 5x + 2y <= 10, x,y entiers → 4 en (1,2) ; la relaxation donne 4,52 en (0,71 ; 2,21)
    const base = { contraintes: [{ nom: "c1", coefficients: { x: 3, y: 4 }, comparateur: "<=" as const, valeur: 12 }, { nom: "c2", coefficients: { x: 5, y: 2 }, comparateur: "<=" as const, valeur: 10 }] };
    const continu = optimiser({ sens: "max", variables: [{ nom: "x", objectif: 4 }, { nom: "y", objectif: 3 }], ...base });
    const entier = optimiser({ sens: "max", variables: [{ nom: "x", objectif: 4, type: "entiere" }, { nom: "y", objectif: 3, type: "entiere" }], ...base });
    if (!continu.ok || !entier.ok) throw new Error("ko");
    expect(continu.objectif).toBeGreaterThan(entier.objectif);
    expect(entier.objectif).toBeCloseTo(10, 6);
    expect(entier.valeurs.x).toBe(1);
    expect(entier.valeurs.y).toBe(2);
    expect(Number.isInteger(entier.valeurs.x)).toBe(true);
  });

  it("une affectation 4×4 (0/1) rend le coût minimal exact", () => {
    const couts = [[9, 2, 7, 8], [6, 4, 3, 7], [5, 8, 1, 8], [7, 6, 9, 4]];
    const variables = [];
    const contraintes = [];
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) variables.push({ nom: `x${i}${j}`, objectif: couts[i]![j]!, type: "binaire" as const });
    for (let i = 0; i < 4; i += 1) contraintes.push({ nom: `agent ${i}`, coefficients: Object.fromEntries([0, 1, 2, 3].map((j) => [`x${i}${j}`, 1])), comparateur: "=" as const, valeur: 1 });
    for (let j = 0; j < 4; j += 1) contraintes.push({ nom: `tâche ${j}`, coefficients: Object.fromEntries([0, 1, 2, 3].map((i) => [`x${i}${j}`, 1])), comparateur: "=" as const, valeur: 1 });
    const r = optimiser({ sens: "min", variables, contraintes });
    if (!r.ok) throw new Error(r.erreur);
    // Hongrois : 2 (0→1) + 6 (1→0) ... l'optimum vaut 13 : x01=2, x10=6... vérifié par énumération ci-dessous.
    let brut = Infinity;
    const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    for (const p of perms([0, 1, 2, 3])) brut = Math.min(brut, p.reduce((s, j, i) => s + couts[i]![j]!, 0));
    expect(r.objectif).toBeCloseTo(brut, 6);
    expect(Object.values(r.valeurs).filter((v) => v === 1).length).toBe(4);
  });

  it("INFAISABLE et NON BORNÉ sont des réponses, pas des pannes", () => {
    const infaisable = optimiser({ sens: "max", variables: [{ nom: "x", objectif: 1 }], contraintes: [{ nom: "mini", coefficients: { x: 1 }, comparateur: ">=", valeur: 5 }, { nom: "maxi", coefficients: { x: 1 }, comparateur: "<=", valeur: 3 }] });
    expect(infaisable.ok).toBe(false);
    if (!infaisable.ok) { expect(infaisable.statut).toBe("INFAISABLE"); expect(infaisable.erreur).toMatch(/contredisent/); }
    const nonBorne = optimiser({ sens: "max", variables: [{ nom: "x", objectif: 1 }], contraintes: [{ coefficients: { x: 0 }, comparateur: "<=", valeur: 1 }] });
    expect(nonBorne.ok).toBe(false);
    if (!nonBorne.ok) { expect(nonBorne.statut).toBe("NON_BORNE"); expect(nonBorne.erreur).toMatch(/sans limite/); }
    const entierInfaisable = optimiser({ sens: "max", variables: [{ nom: "x", objectif: 1, type: "entiere", min: 0, max: 10 }], contraintes: [{ coefficients: { x: 2 }, comparateur: "=", valeur: 5 }] });
    expect(entierInfaisable.ok).toBe(false);
    if (!entierInfaisable.ok) expect(entierInfaisable.erreur).toMatch(/ENTIÈRE/);
  });

  it("refuse un programme incohérent en le disant", () => {
    const cas: [Programme, RegExp][] = [
      [{ sens: "max", variables: [], contraintes: [] }, /variable/i],
      [{ sens: "max", variables: [{ nom: "x", objectif: 1 }], contraintes: [{ coefficients: { z: 1 }, comparateur: "<=", valeur: 1 }] }, /z/],
      [{ sens: "max", variables: [{ nom: "x" }], contraintes: [{ coefficients: { x: 1 }, comparateur: "<=", valeur: 1 }] }, /objectif nul/i],
      [{ sens: "max", variables: [{ nom: "x", objectif: 1, min: 5, max: 2 }], contraintes: [{ coefficients: { x: 1 }, comparateur: "<=", valeur: 1 }] }, /max/],
    ];
    for (const [p, motif] of cas) {
      const r = optimiser(p);
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.statut).toBe("INVALIDE"); expect(r.erreur).toMatch(motif); }
    }
  });

  it("tient l'échelle : 60 produits × 40 contraintes en moins d'une seconde", () => {
    const n = 60, m = 40;
    const variables = Array.from({ length: n }, (_, j) => ({ nom: `p${j}`, objectif: 10 + (j % 7) * 3, max: 100 }));
    const contraintes = Array.from({ length: m }, (_, i) => ({
      nom: `ressource ${i}`,
      coefficients: Object.fromEntries(Array.from({ length: n }, (_, j) => [`p${j}`, ((i * 7 + j * 3) % 5) + 1])),
      comparateur: "<=" as const,
      valeur: 500 + i * 10,
    }));
    const t0 = Date.now();
    const r = optimiser({ sens: "max", variables, contraintes });
    if (!r.ok) throw new Error(r.erreur);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r.objectif).toBeGreaterThan(0);
    // Aucune contrainte violée.
    for (const c of r.contraintes) expect(c.atteinte).toBeLessThanOrEqual(c.valeur + 1e-6);
  });
});
