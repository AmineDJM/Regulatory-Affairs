import { describe, expect, it } from "vitest";
import {
  ajouterMois, avantApres, choisirComparables, coutParPassage, differenceDesDifferences, intervalleBootstrap, lettreA, lettreDeFige,
  lireFenetre, mesurerEffet, mouvementLettre, passeEnA, sommeEntre, variationPct, MIN_COMPARABLES, type Profil,
} from "./mesure";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("ROI Ad & Pro — différence des différences", () => {
  it("effet = variation moyenne des touchés − variation moyenne des comparables", () => {
    expect(differenceDesDifferences([4, 6, 5], [1, 1, 1, 1])).toBeCloseTo(4);
    expect(differenceDesDifferences([], [1])).toBeNull();
  });

  it("sous les seuils (moins de 3 touchés ou de 10 comparables) : pas assez de données, aucun chiffre", () => {
    const peu = mesurerEffet([5, 6], Array(20).fill(1));
    expect(peu.statut).toBe("PEU_DE_DONNEES");
    expect(peu.effet).toBeNull();
    expect(mesurerEffet([5, 6, 7], Array(MIN_COMPARABLES - 1).fill(1)).statut).toBe("PEU_DE_DONNEES");
    const ok = mesurerEffet([5, 6, 7], Array(12).fill(1), { graine: 42 });
    expect(ok.statut).toBe("MESURE");
    expect(ok.effet).toBeCloseTo(5);
    expect(ok.bas!).toBeLessThanOrEqual(ok.effet!);
    expect(ok.haut!).toBeGreaterThanOrEqual(ok.effet!);
  });

  it("la fourchette bootstrap est déterministe (même graine, même résultat) et s'élargit avec la dispersion", () => {
    const a = intervalleBootstrap([1, 9, 3, 7], [0, 2, 1, 3, 0, 2], { graine: 7 });
    const b = intervalleBootstrap([1, 9, 3, 7], [0, 2, 1, 3, 0, 2], { graine: 7 });
    expect(a).toEqual(b);
    const serre = intervalleBootstrap([5, 5, 5, 5], [1, 1, 1, 1, 1, 1], { graine: 7 })!;
    expect(serre.bas).toBeCloseTo(4);
    expect(serre.haut).toBeCloseTo(4);
    expect(a!.haut - a!.bas).toBeGreaterThan(0);
    expect(intervalleBootstrap([], [1])).toBeNull();
  });
});

describe("appariement des comparables", () => {
  const p = (specialite: string | null, zone: string | null, lettre: string | null, statut: string | null): Profil => ({ specialite, zone, lettre, statut });
  const touches = [p("infectio", "Oran", "B", "PRESCRIPTEUR")];

  it("strict d'abord ; les touchés sont exclus ; desserré quand il en manque, et le niveau est dit", () => {
    const candidats = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, profil: p("infectio", "Oran", "B", "PRESCRIPTEUR") })),
      { id: "touche", profil: p("infectio", "Oran", "B", "PRESCRIPTEUR") },
      { id: "autre", profil: p("cardio", "Oran", "B", "PRESCRIPTEUR") },
    ];
    const r = choisirComparables(touches, candidats, new Set(["touche"]));
    expect(r.niveau).toBe("STRICT");
    expect(r.ids).toHaveLength(10);
    expect(r.ids).not.toContain("touche");

    const peu = [
      { id: "a", profil: p("infectio", "Alger", "B", "REFERENT") },
      { id: "b", profil: p("infectio", "Oran", "C", null) },
    ];
    const r2 = choisirComparables(touches, peu, new Set(), 2);
    expect(r2.niveau).toBe("SPECIALITE");
    expect(r2.ids).toEqual(["a", "b"]);
    expect(choisirComparables([p(null, null, null, null)], peu, new Set()).niveau).toBe("AUCUN");
  });
});

describe("séries, lettres, coûts", () => {
  it("avant / après : la valeur la plus récente avant l'action (12 mois), la plus récente dans la fenêtre", () => {
    const pts = [
      { date: d("2025-01-10"), valeur: 1 }, { date: d("2026-01-05"), valeur: 2 }, { date: d("2026-03-01"), valeur: 3 },
      { date: d("2026-05-01"), valeur: 6 }, { date: d("2026-12-01"), valeur: 9 },
    ];
    expect(avantApres(pts, d("2026-03-01"), 6)).toEqual({ avant: 3, apres: 6 });
    expect(avantApres(pts, d("2026-03-02"), 3)).toEqual({ avant: 3, apres: 6 });
    expect(avantApres(pts, d("2028-01-01"), 3)).toEqual({ avant: null, apres: null });
  });

  it("sommes et variation : pas de % depuis zéro", () => {
    const pts = [{ date: d("2026-01-01"), valeur: 10 }, { date: d("2026-02-01"), valeur: 5 }, { date: d("2026-04-01"), valeur: 30 }];
    expect(sommeEntre(pts, d("2026-01-01"), d("2026-03-01"))).toBe(15);
    expect(variationPct(15, 30)).toBeCloseTo(100);
    expect(variationPct(0, 30)).toBeNull();
  });

  it("mouvements de lettre : rang D < C < B < A < H ; NA / NC / absente ne bougent pas", () => {
    expect(mouvementLettre("B", "A")).toBe("HAUSSE");
    expect(mouvementLettre("A", "C")).toBe("BAISSE");
    expect(mouvementLettre("B", "B")).toBe("STABLE");
    expect(mouvementLettre("NA", "A")).toBeNull();
    expect(passeEnA("B", "A")).toBe(true);
    expect(passeEnA("D", "B")).toBe(false);
    expect(lettreDeFige({ h: true, affichage: "B" })).toBe("H");
    expect(lettreDeFige({ h: false, affichage: "A / C" })).toBe("A");
    expect(lettreDeFige({ h: false, affichage: "? / B" })).toBe("NA");
  });

  it("la lettre à une date, et la lettre APRÈS l'action (instantané ouvert après elle)", () => {
    const h = [{ debut: d("2026-01-01"), lettre: "B" }, { debut: d("2026-04-01"), lettre: "A" }];
    expect(lettreA(h, d("2026-03-01"))).toBe("B");
    expect(lettreA(h, d("2026-09-01"), d("2026-03-01"))).toBe("A");
    expect(lettreA(h, d("2026-03-15"), d("2026-03-01"))).toBeNull();
  });

  it("coût par passage en A : n/d sans passage", () => {
    expect(coutParPassage(960_000, 2)).toBe(480_000);
    expect(coutParPassage(960_000, 0)).toBeNull();
    expect(coutParPassage(null, 3)).toBeNull();
  });

  it("fenêtre lue : 3 / 6 / 12, sinon 6 ; mois calendaires bornés", () => {
    expect(lireFenetre("12")).toBe(12);
    expect(lireFenetre("7")).toBe(6);
    expect(ajouterMois(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(ajouterMois(d("2026-08-15"), -12).toISOString().slice(0, 10)).toBe("2025-08-15");
  });
});
