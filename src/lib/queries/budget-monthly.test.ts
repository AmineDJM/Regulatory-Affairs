import { describe, expect, it } from "vitest";
import { buildMonthlySeries } from "./budget";

/**
 * La COURBE du budget. Elle ne sert qu'à répondre à une question : *dépense-t-on trop vite ?*
 * Elle ment si le cumul se réinitialise, si un mois vide disparaît, ou si le rythme théorique
 * n'atterrit pas exactement sur le budget en fin de période. D'où ces tests.
 */

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("Budget — série mensuelle & rythme théorique", () => {
  it("couvre TOUS les mois de la période, même ceux sans dépense", () => {
    const pts = buildMonthlySeries(d("2026-01-15"), d("2026-04-10"), 400, [{ date: d("2026-03-02"), amount: 100 }]);
    expect(pts.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(pts.map((p) => p.consumed)).toEqual([0, 0, 100, 0]);
  });

  it("le cumul ne redescend jamais", () => {
    const pts = buildMonthlySeries(d("2026-01-01"), d("2026-04-30"), 400, [
      { date: d("2026-01-10"), amount: 50 },
      { date: d("2026-03-05"), amount: 30 },
      { date: d("2026-03-25"), amount: 20 },
    ]);
    expect(pts.map((p) => p.cumulative)).toEqual([50, 50, 100, 100]);
  });

  it("le rythme théorique atterrit EXACTEMENT sur le budget au dernier mois", () => {
    const pts = buildMonthlySeries(d("2026-01-01"), d("2026-12-31"), 1_200_000, []);
    expect(pts).toHaveLength(12);
    expect(pts[0].expected).toBe(100_000);
    expect(pts[11].expected).toBe(1_200_000);
  });

  it("additionne plusieurs dépenses du même mois", () => {
    const pts = buildMonthlySeries(d("2026-05-01"), d("2026-05-31"), 100, [
      { date: d("2026-05-02"), amount: 10 },
      { date: d("2026-05-20"), amount: 15 },
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].consumed).toBe(25);
    expect(pts[0].expected).toBe(100);
  });

  it("une période à cheval sur deux années reste ordonnée", () => {
    const pts = buildMonthlySeries(d("2026-11-01"), d("2027-02-28"), 400, []);
    expect(pts.map((p) => p.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(pts.map((p) => p.label)).toEqual(["nov.", "déc.", "janv.", "févr."]);
  });

  it("une période aberrante ne fabrique pas des milliers de points", () => {
    const pts = buildMonthlySeries(d("1990-01-01"), d("2090-01-01"), 100, []);
    expect(pts.length).toBeLessThanOrEqual(60);
  });

  it("une période inversée ne produit rien plutôt que n'importe quoi", () => {
    expect(buildMonthlySeries(d("2026-06-01"), d("2026-01-01"), 100, [])).toEqual([]);
  });
});
