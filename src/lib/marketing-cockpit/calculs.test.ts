import { describe, expect, it } from "vitest";
import type { ResultatPraticien } from "@/lib/segmentation/moteur";
import {
  couvertureFrequence, dansFenetre, entonnoir, evolution, frequenceTenue, lettreFigee, lettrePourProduit, messagePeuPorte,
  moisGlissants, partImputee, partsMensuelles, passesEnA, pointsSparkline, prescripteursAvecAffinite, repartitionDepenses,
  retraitDuMessage, statsMessage, type PraticienCockpit,
} from "./calculs";

const resultat = (o: Partial<ResultatPraticien> & { produits: ResultatPraticien["produits"] }): ResultatPraticien => ({
  doctorId: "d", cible: true, h: false, affichage: "", priorite: null, pourquoiPriorite: "", visites: 2, pourquoiVisites: "",
  lettre: "A", lettreCalculee: "A", lettreForcee: null, ...o,
});
const produit = (productId: string, rang: number, etat: ResultatPraticien["produits"][number]["etat"], potentiel: number | null = 5, affinite: number | null = 0.5) =>
  ({ productId, rang, etat, calcule: etat, derogation: null, potentiel, affinite, pourquoi: [] });
const p = (o: Partial<PraticienCockpit>): PraticienCockpit => ({ doctorId: "x", lettre: "B", segment: "B", deuxReponses: true, requises: 2, faitesCycle: 0, ...o });

describe("la lettre d'un praticien pour un produit", () => {
  const r = resultat({ lettre: "B", produits: [produit("p1", 1, "B"), produit("p2", 2, "C")] });
  it("produit n° 1 : la lettre du moteur (forçage compris) ; autre produit : son segment", () => {
    expect(lettrePourProduit(r, "p1")).toBe("B");
    expect(lettrePourProduit(r, "p2")).toBe("C");
    expect(lettrePourProduit(r, null)).toBe("B");
  });
  it("H prime, « non ciblé » et « en attente » se disent ; un produit non classé garde la lettre de la BU", () => {
    expect(lettrePourProduit({ ...r, h: true }, "p2")).toBe("H");
    expect(lettrePourProduit({ ...r, cible: false }, "p2")).toBe("NC");
    expect(lettrePourProduit(resultat({ lettre: "A", produits: [produit("p1", 1, "A"), produit("p2", 2, "EN_ATTENTE")] }), "p2")).toBe("NA");
    expect(lettrePourProduit(r, "inconnu")).toBe("B");
    expect(lettrePourProduit(null, "p1")).toBe("NA");
  });
});

describe("l'entonnoir et la fréquence", () => {
  it("une cible sans fréquence publiée doit avoir été vue ; sinon les visites requises comptent", () => {
    expect(frequenceTenue(0, 0)).toBe(false);
    expect(frequenceTenue(1, 0)).toBe(true);
    expect(frequenceTenue(1, 2)).toBe(false);
    expect(frequenceTenue(2, 1.5)).toBe(true);
  });
  it("de l'annuaire à l'affinité : chaque marche après « Ciblés » est un sous-ensemble", () => {
    const panel = [
      p({ doctorId: "1", lettre: "H", segment: "A", faitesCycle: 3, requises: 3 }),
      p({ doctorId: "2", lettre: "A", segment: "A", faitesCycle: 2, requises: 2 }),
      p({ doctorId: "3", lettre: "B", segment: "B", faitesCycle: 1, requises: 2 }),
      p({ doctorId: "4", lettre: "C", segment: "C", faitesCycle: 4 }),
      p({ doctorId: "5", lettre: "NA", segment: "EN_ATTENTE", deuxReponses: false }),
    ];
    expect(entonnoir(40, panel)).toEqual({ annuaire: 40, segmentes: 4, cibles: 3, vus: 3, aFrequence: 2, affinite: 2 });
    expect(couvertureFrequence(panel)).toEqual({ cibles: 3, tenues: 2, taux: 2 / 3 });
    expect(couvertureFrequence([]).taux).toBeNull();
  });
  it("prescripteurs avec affinité = segments A et C", () => {
    expect(prescripteursAvecAffinite(["A", "B", "C", "D", null, "EN_ATTENTE", "A"])).toBe(3);
  });
});

describe("ce qui a bougé depuis le cycle figé", () => {
  it("relit la lettre du produit voulu dans l'instantané", () => {
    expect(lettreFigee({ h: false, cible: true, affichage: "A / C" }, 1)).toEqual({ lettre: "C", segment: "C" });
    expect(lettreFigee({ h: true, cible: true, affichage: "B" }, 0)).toEqual({ lettre: "H", segment: "B" });
    expect(lettreFigee({ h: false, cible: false, affichage: "NC" }, 0)).toEqual({ lettre: "NC", segment: "NON_CIBLE" });
    expect(lettreFigee({ h: false, cible: true, affichage: "?" }, 0)).toEqual({ lettre: "NA", segment: "EN_ATTENTE" });
  });
  it("compte ceux qui sont PASSÉS en A (pas les nouveaux venus, pas ceux qui y étaient)", () => {
    const avant = new Map([["a", "B"], ["b", "A"], ["c", "D"], ["d", "EN_ATTENTE"]] as const);
    const apres = new Map([["a", "A"], ["b", "A"], ["c", "A"], ["d", "A"], ["e", "A"]] as const);
    expect(passesEnA(avant, apres)).toBe(2);
  });
});

describe("l'efficacité d'un message", () => {
  const maintenant = new Date(Date.UTC(2026, 9, 15));
  const mois = moisGlissants(maintenant, 6);
  const cycle = mois[5];
  it("six mois glissants, du plus ancien au mois courant, fin incluse", () => {
    expect(mois.map((m) => m.debut.toISOString().slice(0, 7))).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(dansFenetre(new Date(Date.UTC(2026, 9, 31, 18)), cycle)).toBe(true);
    expect(dansFenetre(new Date(Date.UTC(2026, 10, 1)), cycle)).toBe(false);
  });
  it("portés ce cycle, sur quelles lettres, par combien de délégués, et la pente", () => {
    const lettres: Record<string, "H" | "A" | "C"> = { d1: "H", d2: "A", d3: "C" };
    const s = statsMessage([
      { date: new Date(Date.UTC(2026, 9, 2)), doctorId: "d1", delegateId: "k1" },
      { date: new Date(Date.UTC(2026, 9, 3)), doctorId: "d2", delegateId: "k1" },
      { date: new Date(Date.UTC(2026, 9, 4)), doctorId: "d2", delegateId: "k2" },
      { date: new Date(Date.UTC(2026, 9, 5)), doctorId: "hors-panel", delegateId: "k3" },
      { date: new Date(Date.UTC(2026, 8, 5)), doctorId: "d3", delegateId: "k1" },
    ], cycle, mois, (id) => lettres[id] ?? null);
    expect(s.portesCycle).toBe(4);
    expect(s.parLettre).toEqual({ H: 1, A: 2 });
    expect(s.delegues).toBe(3);
    expect(s.tendance).toEqual([0, 0, 0, 0, 1, 4]);
  });
  it("porté → archivé ; jamais porté → supprimé", () => {
    expect(retraitDuMessage(3)).toBe("ARCHIVER");
    expect(retraitDuMessage(0)).toBe("SUPPRIMER");
  });
  it("le message peu porté : actif, porté par moins de la moitié des délégués, le moins porté d'abord", () => {
    const st = (portesCycle: number, delegues: number) => ({ portesCycle, delegues, parLettre: {}, tendance: [] });
    const ms = [
      { id: "a", actif: true, stats: st(40, 9) },
      { id: "b", actif: true, stats: st(6, 3) },
      { id: "c", actif: false, stats: st(0, 0) },
      { id: "d", actif: true, stats: st(2, 4) },
    ];
    expect(messagePeuPorte(ms, 9)?.id).toBe("d");
    expect(messagePeuPorte(ms, 1)).toBeNull();
  });
  it("la courbe : une série plate reste au milieu, une série montante finit en haut", () => {
    expect(pointsSparkline([2, 2, 2], 70, 20)).toBe("0,10 35,10 70,10");
    const pts = pointsSparkline([0, 5, 10], 70, 20, 3).split(" ").map((x) => Number(x.split(",")[1]));
    expect(pts[0]).toBeGreaterThan(pts[2]);
  });
});

describe("où va l'argent", () => {
  it("part sur H · A · B et sur C · D au prorata des praticiens nommés ; le non nominatif n'entre pas dans la part", () => {
    const r = repartitionDepenses([
      { nature: "CONGRES", montant: 1000, lettres: ["H", "A", "C", "D"] },
      { nature: "CONGRES", montant: 500, lettres: ["B"] },
      { nature: "SPONSORING", montant: 300, lettres: [null] },
      { nature: "MATERIEL", montant: 200, lettres: [] },
    ], 10);
    const congres = r.lignes.find((l) => l.nature === "CONGRES")!;
    expect(congres.engage).toBe(1500);
    expect(congres.partCibles).toBeCloseTo((500 + 500) / 1500);
    expect(congres.partCD).toBeCloseTo(500 / 1500);
    expect(congres.parCible).toBe(150);
    const spo = r.lignes.find((l) => l.nature === "SPONSORING")!;
    expect(spo.partCibles, "nommé mais hors panel : compté, pas sur une cible").toBe(0);
    const mat = r.lignes.find((l) => l.nature === "MATERIEL")!;
    expect(mat.partCibles).toBeNull();
    expect(r.lignes.find((l) => l.nature === "EVENEMENTS")!.engage).toBe(0);
    expect(r.total).toBe(2000);
    expect(r.partCDCongresEvenements).toBeCloseTo(500 / 1500);
    expect(repartitionDepenses([], 0).partCDCongresEvenements).toBeNull();
  });
  it("la part d'un poste imputée au produit : montant saisi, sinon part en %, sinon rien", () => {
    expect(partImputee(1000, [{ productId: "p", pct: null, montant: 300 }], "p")).toBe(300);
    expect(partImputee(1000, [{ productId: "p", pct: 25, montant: null }], "p")).toBe(250);
    expect(partImputee(1000, [{ productId: "p", pct: null, montant: null }], "p")).toBeNull();
    expect(partImputee(1000, [{ productId: "q", pct: 50, montant: null }], "p")).toBeNull();
  });
});

describe("le marché mois par mois", () => {
  it("nos parts d'abord, puis les premiers concurrents ; un mois sans réception est un trou", () => {
    const series = partsMensuelles([
      { mois: "2025-01", cle: "NOUS", nom: "Nous SPA", valeur: 20 },
      { mois: "2025-01", cle: "X", nom: "X", valeur: 60 },
      { mois: "2025-01", cle: "Y", nom: "Y", valeur: 20 },
      { mois: "2025-02", cle: "X", nom: "X", valeur: 50 },
      { mois: "2025-02", cle: "NOUS", nom: "Nous", valeur: 50 },
      { mois: "2025-02", cle: "Z", nom: "Z", valeur: 0 },
    ], ["2025-01", "2025-02", "2025-03"], new Set(["NOUS"]), 1);
    expect(series.map((s) => s.cle)).toEqual(["NOUS", "X"]);
    expect(series[0]).toMatchObject({ nom: "Nous", nous: true, parts: [0.2, 0.5, null] });
    expect(series[1].parts).toEqual([0.6, 0.5, null]);
  });
  it("l'évolution d'une période à l'autre", () => {
    expect(evolution(100, 88)).toBeCloseTo(-0.12);
    expect(evolution(0, 10)).toBeNull();
  });
});
