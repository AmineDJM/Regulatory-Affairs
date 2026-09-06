import { describe, expect, it } from "vitest";
import { TIRAGES_MAX, resumerSimulation, simuler } from "./montecarlo";

describe("montecarlo — la simulation hors modèle", () => {
  it("une somme de normales indépendantes a la moyenne et la variance attendues, et ses percentiles", () => {
    const r = simuler(
      { entrees: { a: { loi: "normale", moyenne: 100, ecartType: 10 }, b: { loi: "normale", moyenne: 50, ecartType: 5 } }, formules: { total: "a + b" } },
      { tirages: 50_000, graine: 1 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.sorties.total!;
    expect(Math.abs(t.moyenne - 150)).toBeLessThan(0.3);
    expect(Math.abs(t.ecartType - Math.sqrt(125))).toBeLessThan(0.3);
    expect(Math.abs(t.percentiles.P50! - 150)).toBeLessThan(0.4);
    expect(Math.abs(t.percentiles.P90! - (150 + 1.2816 * Math.sqrt(125)))).toBeLessThan(0.5);
    expect(Math.abs(t.percentiles.P5! - (150 - 1.6449 * Math.sqrt(125)))).toBeLessThan(0.6);
    expect(t.histogramme.reduce((s, h) => s + h.n, 0)).toBe(50_000);
    expect(t.valeurDeterministe).toBe(150);
    expect(r.convergence.intervalle95P90[0]).toBeLessThanOrEqual(t.percentiles.P90!);
    expect(r.convergence.intervalle95P90[1]).toBeGreaterThanOrEqual(t.percentiles.P90!);
    expect(r.rigueur.hypotheses.some((h) => /INDÉPENDANTES/.test(h))).toBe(true);
  });

  it("même graine → mêmes chiffres ; autre graine → chiffres proches mais différents", () => {
    const m = { entrees: { x: { loi: "uniforme", min: 0, max: 1 } as const }, formules: { y: "x * 100" } };
    const a = simuler(m, { tirages: 5_000, graine: "s1" }), b = simuler(m, { tirages: 5_000, graine: "s1" }), c = simuler(m, { tirages: 5_000, graine: "s2" });
    if (!a.ok || !b.ok || !c.ok) throw new Error("ko");
    expect(a.sorties.y!.moyenne).toBe(b.sorties.y!.moyenne);
    expect(a.sorties.y!.percentiles).toEqual(b.sorties.y!.percentiles);
    expect(a.sorties.y!.moyenne).not.toBe(c.sorties.y!.moyenne);
  });

  it("probabilité de perte, seuils et piège des moyennes sur une marge non linéaire", () => {
    const r = simuler(
      {
        entrees: {
          volume: { loi: "triangulaire", min: 500, mode: 1000, max: 2000 },
          prix: { loi: "normale", moyenne: 12, ecartType: 1.5 },
          cv: { loi: "pert", min: 6, mode: 8, max: 12 },
        },
        constantes: { fixes: 3500 },
        formules: { ca: "prix * volume", marge: "ca - fixes - cv * volume - si(volume > 1500, (volume - 1500) * 3, 0)" },
        sortie: "marge",
        seuils: [{ sens: "inferieur", valeur: 0, libelle: "perte" }, { sens: "superieur", valeur: 5000 }],
      },
      { tirages: 40_000, graine: 11 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const perte = r.probabilites.find((p) => p.libelle === "perte")!;
    expect(perte.p).toBeGreaterThan(0.2);
    expect(perte.p).toBeLessThan(0.6);
    expect(Math.abs(perte.p - r.sorties.marge!.pNegatif)).toBeLessThan(1e-9);
    expect(r.probabilites[1]!.libelle).toBe("marge > 5000");
    // Sensibilité : le prix domine (σ 1,5 × ~1 170 unités), l'ordre est par amplitude bas/haut décile.
    expect(r.sensibilite.length).toBe(3);
    expect(r.sensibilite[0]!.entree).toBe("prix");
    expect(r.sensibilite.map((s) => s.entree).sort()).toEqual(["cv", "prix", "volume"]);
    const somme = r.sensibilite.reduce((s, x) => s + x.contributionVariancePourcent, 0);
    expect(Math.abs(somme - 100)).toBeLessThan(1e-6);
    for (const s of r.sensibilite) { expect(Math.abs(s.spearman)).toBeLessThanOrEqual(1); expect(s.amplitude).toBeGreaterThanOrEqual(0); }
    expect(r.sensibilite.find((s) => s.entree === "cv")!.spearman).toBeLessThan(0);
    expect(r.sensibilite.find((s) => s.entree === "prix")!.spearman).toBeGreaterThan(0.3);
    // Le déterministe existe et la sortie « ca » aussi.
    expect(r.sorties.ca!.valeurDeterministe).toBeCloseTo(12 * (500 + 1000 + 2000) / 3, 6);
    const lignes = resumerSimulation(r);
    expect(lignes[0]).toMatch(/^marge : moyenne/);
    expect(lignes.some((l) => /P\(perte\)/.test(l))).toBe(true);
    expect(lignes.some((l) => /Leviers/.test(l))).toBe(true);
  });

  it("les corrélations (copule gaussienne) se retrouvent dans les tirages et changent le risque de la somme", () => {
    const base = { entrees: { a: { loi: "normale", moyenne: 0, ecartType: 1 } as const, b: { loi: "normale", moyenne: 0, ecartType: 1 } as const }, formules: { s: "a + b" } };
    const indep = simuler(base, { tirages: 40_000, graine: 5 });
    const corr = simuler({ ...base, correlations: [{ a: "a", b: "b", rho: 0.8 }] }, { tirages: 40_000, graine: 5 });
    if (!indep.ok || !corr.ok) throw new Error("ko");
    expect(Math.abs(indep.sorties.s!.ecartType - Math.SQRT2)).toBeLessThan(0.03);
    expect(Math.abs(corr.sorties.s!.ecartType - Math.sqrt(2 + 2 * 0.8))).toBeLessThan(0.03);
    expect(corr.rigueur.hypotheses.some((h) => /copule/.test(h))).toBe(true);
    // Une corrélation impossible est réduite ou ignorée, et c'est DIT.
    const impossible = simuler(
      { entrees: { a: { loi: "normale", moyenne: 0, ecartType: 1 }, b: { loi: "normale", moyenne: 0, ecartType: 1 }, c: { loi: "normale", moyenne: 0, ecartType: 1 } }, formules: { s: "a + b + c" }, correlations: [{ a: "a", b: "b", rho: 0.95 }, { a: "b", b: "c", rho: 0.95 }, { a: "a", b: "c", rho: -0.95 }] },
      { tirages: 2_000, graine: 1 },
    );
    if (!impossible.ok) throw new Error("ko");
    expect(impossible.rigueur.avertissements.some((a) => /incompatibles/.test(a))).toBe(true);
  });

  it("le piège des moyennes est nommé quand la formule n'est pas linéaire", () => {
    const r = simuler({ entrees: { d: { loi: "uniforme", min: 1, max: 9 } }, formules: { y: "1000 / d" } }, { tirages: 20_000, graine: 2 });
    if (!r.ok) throw new Error("ko");
    expect(r.sorties.y!.valeurDeterministe).toBe(200);
    expect(r.sorties.y!.moyenne).toBeGreaterThan(250);
    expect(r.rigueur.avertissements.some((a) => /Piège des moyennes/.test(a))).toBe(true);
  });

  it("refuse un modèle mal posé, une formule inconnue, une loi invalide — et dit pourquoi", () => {
    expect(simuler({ entrees: {}, formules: { y: "1" } })).toMatchObject({ ok: false });
    const inconnue = simuler({ entrees: { x: { loi: "uniforme", min: 0, max: 1 } }, formules: { y: "x + z" } });
    expect(inconnue.ok).toBe(false);
    if (!inconnue.ok) expect(inconnue.erreur).toMatch(/z/);
    const loi = simuler({ entrees: { x: { loi: "normale", moyenne: 0, ecartType: -1 } }, formules: { y: "x" } });
    expect(loi.ok).toBe(false);
    const corr = simuler({ entrees: { x: { loi: "uniforme", min: 0, max: 1 } }, formules: { y: "x" }, correlations: [{ a: "x", b: "w", rho: 0.5 }] });
    expect(corr.ok).toBe(false);
    const divisions = simuler({ entrees: { x: { loi: "constante", valeur: 0 } }, formules: { y: "1 / x" } });
    expect(divisions.ok).toBe(false);
    if (!divisions.ok) expect(divisions.erreur).toMatch(/non finie/);
  });

  it("borne les tirages au plafond opérationnel et le dit ; 200 000 tirages × 3 formules en moins de 3 s", () => {
    const t0 = Date.now();
    const r = simuler(
      { entrees: { a: { loi: "lognormale", moyenne: 100, ecartType: 30 }, b: { loi: "pert", min: 1, mode: 2, max: 5 }, c: { loi: "poisson", lambda: 3 } }, formules: { p: "a * b", q: "p - c * 10", r: "max(0, q)" } },
      { tirages: 500_000, graine: 9 },
    );
    if (!r.ok) throw new Error(r.erreur);
    expect(r.tirages).toBe(TIRAGES_MAX);
    expect(r.rigueur.limites.some((l) => /plafond/.test(l))).toBe(true);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
