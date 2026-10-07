import { describe, expect, it } from "vitest";
import { bcEnRetard, couvertureBasse, deriveCoutIa, partCDExcessive, planNonValide, recrutementNonDiffuse, risqueStockAo } from "./risks-plus";

const NOW = new Date("2026-10-07T09:00:00Z");
const ilYa = (j: number) => new Date(NOW.getTime() - j * 86_400_000);

describe("stock vs AO attribués", () => {
  it("rien à livrer, ou stock suffisant : pas de risque", () => {
    expect(risqueStockAo({ resteALivrer: 0, stock: 0, commandeEnCours: false })).toBeNull();
    expect(risqueStockAo({ resteALivrer: 800, stock: 800, commandeEnCours: false })).toBeNull();
  });
  it("le niveau suit la couverture et la commande fournisseur en cours", () => {
    expect(risqueStockAo({ resteALivrer: 8000, stock: null, commandeEnCours: false })).toBe("critical");
    expect(risqueStockAo({ resteALivrer: 8000, stock: 0, commandeEnCours: true })).toBe("high");
    expect(risqueStockAo({ resteALivrer: 8000, stock: 1000, commandeEnCours: false })).toBe("critical");
    expect(risqueStockAo({ resteALivrer: 8000, stock: 6000, commandeEnCours: false })).toBe("high");
    expect(risqueStockAo({ resteALivrer: 8000, stock: 1000, commandeEnCours: true })).toBe("medium");
    expect(risqueStockAo({ resteALivrer: 8000, stock: 6000, commandeEnCours: true })).toBeNull();
  });
});

describe("recrutement validé non diffusé", () => {
  it("compte les jours depuis la validation quand aucun canal n'est publié", () => {
    expect(recrutementNonDiffuse({ valideLe: ilYa(5), canauxPublies: 0, now: NOW, seuilJours: 3 })).toBe(5);
    expect(recrutementNonDiffuse({ valideLe: ilYa(2), canauxPublies: 0, now: NOW, seuilJours: 3 })).toBeNull();
    expect(recrutementNonDiffuse({ valideLe: ilYa(9), canauxPublies: 1, now: NOW, seuilJours: 3 })).toBeNull();
    expect(recrutementNonDiffuse({ valideLe: null, canauxPublies: 0, now: NOW, seuilJours: 3 })).toBeNull();
  });
});

describe("couverture terrain et Ad & Pro sur C/D", () => {
  it("couverture : seulement à mi-cycle, avec assez de cibles, sous le seuil", () => {
    expect(couvertureBasse({ taux: 0.31, cibles: 40, seuilPct: 50, partCycle: 0.6 })).toBe("medium");
    expect(couvertureBasse({ taux: 0.2, cibles: 40, seuilPct: 50, partCycle: 0.6 })).toBe("high");
    expect(couvertureBasse({ taux: 0.31, cibles: 40, seuilPct: 50, partCycle: 0.3 })).toBeNull();
    expect(couvertureBasse({ taux: 0.31, cibles: 3, seuilPct: 50, partCycle: 0.8 })).toBeNull();
    expect(couvertureBasse({ taux: 0.7, cibles: 40, seuilPct: 50, partCycle: 0.8 })).toBeNull();
    expect(couvertureBasse({ taux: null, cibles: 0, seuilPct: 50, partCycle: 0.8 })).toBeNull();
  });
  it("part C/D : au-delà du maximum, élevé au double", () => {
    expect(partCDExcessive(null, 25)).toBeNull();
    expect(partCDExcessive(0.2, 25)).toBeNull();
    expect(partCDExcessive(0.3, 25)).toBe("medium");
    expect(partCDExcessive(0.55, 25)).toBe("high");
  });
});

describe("BC non signé, plan de tournée, coût IA", () => {
  it("BC : entré dans le circuit depuis plus du seuil, ni signé ni renvoyé", () => {
    expect(bcEnRetard({ entreLe: ilYa(6), signe: false, renvoye: false, now: NOW, seuilJours: 5 })).toBe(6);
    expect(bcEnRetard({ entreLe: ilYa(4), signe: false, renvoye: false, now: NOW, seuilJours: 5 })).toBeNull();
    expect(bcEnRetard({ entreLe: ilYa(9), signe: true, renvoye: false, now: NOW, seuilJours: 5 })).toBeNull();
    expect(bcEnRetard({ entreLe: ilYa(9), signe: false, renvoye: true, now: NOW, seuilJours: 5 })).toBeNull();
  });
  it("plan de tournée : non validé à l'approche (ou après) le début, jamais une fois la période finie", () => {
    const debut = new Date(NOW.getTime() + 2 * 86_400_000);
    const fin = new Date(NOW.getTime() + 30 * 86_400_000);
    expect(planNonValide({ statut: "DRAFT", debut, fin, now: NOW, avanceJours: 3 })).toBe(2);
    expect(planNonValide({ statut: "APPROVED", debut, fin, now: NOW, avanceJours: 3 })).toBeNull();
    expect(planNonValide({ statut: "SUBMITTED", debut, fin, now: NOW, avanceJours: 1 })).toBeNull();
    expect(planNonValide({ statut: "SUBMITTED", debut: ilYa(4), fin, now: NOW, avanceJours: 1 })).toBe(-4);
    expect(planNonValide({ statut: "DRAFT", debut: ilYa(40), fin: ilYa(10), now: NOW, avanceJours: 3 })).toBeNull();
  });
  it("coût IA : au-delà de la moyenne + seuil, au-dessus d'un plancher", () => {
    expect(deriveCoutIa({ jour: 6, moyenne7: 2, seuilPct: 50 })).toBe(3);
    expect(deriveCoutIa({ jour: 2.5, moyenne7: 2, seuilPct: 50 })).toBeNull();
    expect(deriveCoutIa({ jour: 0.3, moyenne7: 0.05, seuilPct: 50 })).toBeNull();
    expect(deriveCoutIa({ jour: 4, moyenne7: 0, seuilPct: 50 })).toBeNull();
  });
});
