import { describe, it, expect } from "vitest";
import { anneeDuBesoin, lireBesoinsDuRapport, lireQuantite, peutEcrireBesoin, previsionsDesServices, totalExprime, type BesoinLigne } from "./regles";

const fd = (paires: [string, string][]) => {
  const m = new FormData();
  for (const [k, v] of paires) m.append(k, v);
  return m;
};

describe("les besoins annuels des services — la saisie", () => {
  it("l'année annoncée est l'année qui vient", () => {
    expect(anneeDuBesoin(new Date("2026-10-09T10:00:00Z"))).toBe(2027);
  });

  it("lit les boîtes comme un humain les écrit ; rejette le reste", () => {
    expect(lireQuantite("6 000")).toEqual({ ok: true, valeur: 6000 });
    expect(lireQuantite("4.200 boîtes")).toEqual({ ok: true, valeur: 4200 });
    expect(lireQuantite("0")).toEqual({ ok: true, valeur: 0 });
    expect(lireQuantite("")).toEqual({ ok: true, valeur: null });
    expect(lireQuantite("-3").ok).toBe(false);
    expect(lireQuantite("12,5").ok).toBe(false);
  });

  it("les paires du rapport de visite : une case vide n'écrit rien, un produit répété garde la dernière", () => {
    const r = lireBesoinsDuRapport(fd([
      ["besoinProduitId", "p1"], ["besoinQuantite", "6 000"],
      ["besoinProduitId", "p2"], ["besoinQuantite", ""],
      ["besoinProduitId", "p1"], ["besoinQuantite", "6500"],
    ]));
    expect(r).toEqual({ ok: true, besoins: [{ productId: "p1", quantite: 6500 }] });
    expect(lireBesoinsDuRapport(fd([["besoinProduitId", "p1"], ["besoinQuantite", "beaucoup"]])).ok).toBe(false);
    expect(lireBesoinsDuRapport(fd([]))).toEqual({ ok: true, besoins: [] });
  });

  it("qui écrit : la Direction Marketing, le chef de produit et la Direction pour tous ; le KAM pour son panel", () => {
    const rien = { superAdmin: false, vueGlobale: false, cockpitModifier: false, chefDeProduit: false, saisitDesVisites: false, decideurOuvert: false };
    expect(peutEcrireBesoin(rien)).toBe(false);
    expect(peutEcrireBesoin({ ...rien, cockpitModifier: true })).toBe(true);
    expect(peutEcrireBesoin({ ...rien, chefDeProduit: true })).toBe(true);
    expect(peutEcrireBesoin({ ...rien, vueGlobale: true })).toBe(true);
    expect(peutEcrireBesoin({ ...rien, saisitDesVisites: true })).toBe(false);
    expect(peutEcrireBesoin({ ...rien, saisitDesVisites: true, decideurOuvert: true })).toBe(true);
  });
});

describe("les prévisions des services — la lecture", () => {
  const l: BesoinLigne[] = [
    { productId: "p1", institutionId: "kettar", serviceId: "inf", annee: 2027, quantite: 6000 },
    { productId: "p1", institutionId: "kettar", serviceId: "inf", annee: 2026, quantite: 5000 },
    { productId: "p1", institutionId: "oran", serviceId: null, annee: 2027, quantite: 4200 },
    { productId: "p1", institutionId: "oran", serviceId: null, annee: 2026, quantite: 4200 },
    { productId: "p2", institutionId: "oran", serviceId: null, annee: 2027, quantite: 800 },
    { productId: "p1", institutionId: "cne", serviceId: "inf", annee: 2026, quantite: 2000 },
    { productId: "p1", institutionId: "vieux", serviceId: null, annee: 2024, quantite: 99 },
  ];

  it("par service : l'année, l'année d'avant, l'évolution — les produits du périmètre s'additionnent", () => {
    const p = previsionsDesServices(l, 2027);
    expect(p.map((x) => [x.cle, x.actuel, x.precedent])).toEqual([
      ["kettar|inf", 6000, 5000], ["oran|-", 5000, 4200], ["cne|inf", null, 2000],
    ]);
    expect(p[0].evolution).toBeCloseTo(0.2);
    expect(p[2].evolution).toBeNull();
  });

  it("le total exprimé de l'année — null quand rien n'est saisi, jamais 0", () => {
    expect(totalExprime(l, 2027)).toEqual({ total: 11000, services: 2 });
    expect(totalExprime(l, 2030)).toBeNull();
  });
});
