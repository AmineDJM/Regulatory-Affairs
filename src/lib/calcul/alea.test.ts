import { describe, expect, it } from "vitest";
import { type Loi, betaIncompleteReguliere, cholesky, esperance, generateur, normaleStandard, phi, phiInverse, quantile, validerLoi } from "./alea";
import { ecartType, moyenne } from "./rigueur";

describe("alea — le hasard reproductible", () => {
  it("la même graine rend la même suite ; deux graines diffèrent", () => {
    const a = generateur("budget"), b = generateur("budget"), c = generateur("autre");
    const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const x of sa) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it("la loi uniforme du générateur : moyenne ≈ 0,5 et écart-type ≈ 0,289 sur 50 000 tirages", () => {
    const u = generateur(7);
    const xs = Array.from({ length: 50_000 }, u);
    expect(Math.abs(moyenne(xs) - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(ecartType(xs) - Math.sqrt(1 / 12))).toBeLessThan(0.01);
  });

  it("Box-Muller rend une normale centrée réduite", () => {
    const z = normaleStandard(generateur(3));
    const xs = Array.from({ length: 50_000 }, z);
    expect(Math.abs(moyenne(xs))).toBeLessThan(0.02);
    expect(Math.abs(ecartType(xs) - 1)).toBeLessThan(0.02);
    const dansUnSigma = xs.filter((x) => Math.abs(x) < 1).length / xs.length;
    expect(Math.abs(dansUnSigma - 0.6827)).toBeLessThan(0.01);
  });

  it("Φ et Φ⁻¹ sont inverses l'une de l'autre et connaissent les valeurs de table", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1.6449)).toBeCloseTo(0.05, 3);
    expect(phiInverse(0.975)).toBeCloseTo(1.96, 2);
    expect(phiInverse(0.5)).toBeCloseTo(0, 6);
    for (const p of [0.001, 0.05, 0.3, 0.7, 0.999]) expect(phi(phiInverse(p))).toBeCloseTo(p, 4);
  });

  it("les quantiles ont les espérances annoncées (moyenne des quantiles aux u équirépartis)", () => {
    const lois: Loi[] = [
      { loi: "normale", moyenne: 100, ecartType: 15 },
      { loi: "lognormale", moyenne: 50, ecartType: 20 },
      { loi: "uniforme", min: 10, max: 30 },
      { loi: "triangulaire", min: 0, mode: 10, max: 50 },
      { loi: "pert", min: 0, mode: 10, max: 50 },
      { loi: "discrete", valeurs: [{ valeur: 1, p: 0.2 }, { valeur: 5, p: 0.8 }] },
      { loi: "bernoulli", p: 0.3, siVrai: 10, siFaux: 2 },
      { loi: "poisson", lambda: 4 },
    ];
    const n = 20_000;
    for (const l of lois) {
      const xs: number[] = [];
      for (let i = 0; i < n; i += 1) xs.push(quantile(l, (i + 0.5) / n));
      const e = esperance(l)!;
      expect(Math.abs(moyenne(xs) - e) / Math.max(1, Math.abs(e))).toBeLessThan(0.02);
    }
    // La log-normale garde son écart-type déclaré (paramétrage par la variable, pas par le log).
    const ln: number[] = [];
    for (let i = 0; i < n; i += 1) ln.push(quantile({ loi: "lognormale", moyenne: 50, ecartType: 20 }, (i + 0.5) / n));
    expect(Math.abs(ecartType(ln) - 20)).toBeLessThan(1);
    expect(Math.min(...ln)).toBeGreaterThan(0);
  });

  it("la triangulaire et la PERT respectent leurs bornes et leur médiane", () => {
    const t = { loi: "triangulaire", min: 0, mode: 10, max: 50 } as const;
    expect(quantile(t, 0)).toBeCloseTo(0, 3);
    expect(quantile(t, 1)).toBeCloseTo(50, 3);
    // F(mode) = (mode-min)/(max-min) = 0,2 → le quantile 0,2 est le mode.
    expect(quantile(t, 0.2)).toBeCloseTo(10, 6);
    const p = { loi: "pert", min: 0, mode: 10, max: 50 } as const;
    expect(quantile(p, 0.001)).toBeGreaterThanOrEqual(0);
    expect(quantile(p, 0.999)).toBeLessThanOrEqual(50);
    expect(quantile(p, 0.5)).toBeGreaterThan(10);
    expect(quantile(p, 0.5)).toBeLessThan(20);
  });

  it("la bêta incomplète régularisée connaît ses cas exacts", () => {
    expect(betaIncompleteReguliere(0.5, 1, 1)).toBeCloseTo(0.5, 8);
    expect(betaIncompleteReguliere(0.3, 2, 1)).toBeCloseTo(0.09, 8);
    expect(betaIncompleteReguliere(0.5, 2, 2)).toBeCloseTo(0.5, 8);
    expect(betaIncompleteReguliere(0.25, 2, 3)).toBeCloseTo(0.2617, 3);
  });

  it("valide une loi : écart-type négatif, bornes inversées, probabilités qui ne somment pas à 1", () => {
    expect(validerLoi({ loi: "normale", moyenne: 0, ecartType: -1 })).toMatch(/écart-type/i);
    expect(validerLoi({ loi: "uniforme", min: 5, max: 1 })).toBeTruthy();
    expect(validerLoi({ loi: "triangulaire", min: 0, mode: 60, max: 50 })).toBeTruthy();
    expect(validerLoi({ loi: "discrete", valeurs: [{ valeur: 1, p: 0.5 }, { valeur: 2, p: 0.2 }] })).toBeTruthy();
    expect(validerLoi({ loi: "lognormale", moyenne: -3, ecartType: 1 })).toBeTruthy();
    expect(validerLoi({ loi: "normale", moyenne: 0, ecartType: 1 })).toBeNull();
  });

  it("Cholesky : L·Lᵀ redonne la matrice ; une matrice non définie positive rend null", () => {
    const m = [[1, 0.5, 0.2], [0.5, 1, 0.3], [0.2, 0.3, 1]];
    const L = cholesky(m)!;
    expect(L).not.toBeNull();
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
      let s = 0;
      for (let k = 0; k < 3; k += 1) s += L[i]![k]! * L[j]![k]!;
      expect(s).toBeCloseTo(m[i]![j]!, 10);
    }
    expect(cholesky([[1, 0.9, -0.9], [0.9, 1, 0.9], [-0.9, 0.9, 1]])).toBeNull();
  });
});
