import { describe, it, expect } from "vitest";
import {
  boxCount, unitsFromBoxes, unitFromBoxPrice, boxFromUnitPrice, lineEconomics, awardResult,
} from "./box-economics";

describe("le marché compte en unités, nous vendons en boîtes", () => {
  it("LE NOMBRE DE BOÎTES S'ARRONDIT AU SUPÉRIEUR — on ne livre pas une demi-boîte", () => {
    expect(boxCount(8000, 30)).toBe(267);
    expect(boxCount(9000, 30)).toBe(300);
    expect(boxCount(0, 30)).toBe(0);
  });

  it("SANS CONDITIONNEMENT, ON NE DEVINE PAS — ni 0, ni la quantité en unités", () => {
    // Rendre 0 laisserait croire qu'il n'en faut aucune ; rendre 8 000 ferait passer des
    // comprimés pour des boîtes.
    expect(boxCount(8000, null)).toBeNull();
    expect(boxCount(8000, 0)).toBeNull();
  });

  it("et l'inverse, quand la saisie se fait en boîtes", () => {
    expect(unitsFromBoxes(267, 30)).toBe(8010);
    expect(unitsFromBoxes(10, null)).toBeNull();
  });
});

describe("le prix : la boîte est la source, l'unité sa projection", () => {
  it("LE PRIX UNITAIRE SE DÉDUIT DU PRIX DE BOÎTE", () => {
    expect(unitFromBoxPrice(1200, 30)).toBe(40);
    expect(unitFromBoxPrice(1000, 30)).toBe(33.33);
    expect(unitFromBoxPrice(null, 30)).toBeNull();
    expect(unitFromBoxPrice(1200, 0)).toBeNull();
  });

  it("l'aller-retour PERD un centime — c'est pourquoi on stocke la boîte, pas l'unité", () => {
    // 1 000 → 33,33 → 999,90. Un centime perdu à chaque passage sur le seul chiffre que
    // l'équipe reconnaît : celui qu'elle a négocié.
    expect(boxFromUnitPrice(unitFromBoxPrice(1000, 30), 30)).toBe(999.9);
  });

  it("le prix de boîte se RECONSTRUIT pour lire une ligne ancienne", () => {
    expect(boxFromUnitPrice(40, 30)).toBe(1200);
    expect(boxFromUnitPrice(null, 30)).toBeNull();
  });
});

describe("l'économie d'une ligne", () => {
  it("LE PRIX DE BOÎTE SAISI FAIT FOI, et le montant se calcule sur les UNITÉS", () => {
    // Facturer 267 boîtes pleines ferait payer au client dix comprimés qu'il n'a pas commandés.
    const e = lineEconomics({ quantityUnits: 8000, unitsPerBox: 30, boxPriceDzd: 1200 });
    expect(e.boxes).toBe(267);
    expect(e.boxPrice).toBe(1200);
    expect(e.unitPrice).toBe(40);
    expect(e.amount).toBe(320000);
  });

  it("UNE LIGNE ANCIENNE, CHIFFRÉE À L'UNITÉ, N'EST PAS RÉÉCRITE", () => {
    const e = lineEconomics({ quantityUnits: 8000, unitsPerBox: 30, unitPriceDzd: 40 });
    expect(e.unitPrice).toBe(40);
    // Le prix de boîte est RECONSTRUIT pour la lecture — jamais réenregistré.
    expect(e.boxPrice).toBe(1200);
    expect(e.amount).toBe(320000);
  });

  it("LA MARGE À LA BOÎTE SE VOIT AVANT LE DÉPÔT, pas après", () => {
    const e = lineEconomics({ quantityUnits: 8000, unitsPerBox: 30, boxPriceDzd: 1200, boxCostDzd: 900 });
    expect(e.marginPerBox).toBe(300);
    expect(e.marginPct).toBe(25);
    expect(e.atLoss).toBe(false);
  });

  it("SOUMISSIONNER À PERTE EST UN FAIT AFFICHÉ, pas un interdit", () => {
    // Entrer sur un marché à perte est une décision qui se prend — encore faut-il la voir.
    const e = lineEconomics({ quantityUnits: 100, unitsPerBox: 10, boxPriceDzd: 800, boxCostDzd: 950 });
    expect(e.marginPerBox).toBe(-150);
    expect(e.atLoss).toBe(true);
    expect(e.marginPct).toBe(-18.8);
  });

  it("tant que le coût n'est pas connu, aucune marge n'est inventée", () => {
    const e = lineEconomics({ quantityUnits: 100, unitsPerBox: 10, boxPriceDzd: 800 });
    expect(e.marginPerBox).toBeNull();
    expect(e.marginPct).toBeNull();
    expect(e.atLoss).toBe(false);
  });

  it("sans conditionnement, la ligne vit quand même — à l'unité", () => {
    const e = lineEconomics({ quantityUnits: 500, unitsPerBox: null, unitPriceDzd: 12 });
    expect(e.boxes).toBeNull();
    expect(e.boxPrice).toBeNull();
    expect(e.unitPrice).toBe(12);
    expect(e.amount).toBe(6000);
  });
});

describe("l'attribution, lot par lot", () => {
  it("LE POURCENTAGE SE MESURE SUR CE QU'ON A DÉPOSÉ, pas sur ce que le marché demandait", () => {
    // « 100 % de notre offre » et « 50 % du marché » sont deux phrases vraies ; celle qui juge
    // notre performance est la première.
    const r = awardResult({ quantityUnits: 10000, submittedQuantityUnits: 5000, awardedQuantityUnits: 5000, status: "WON" });
    expect(r.won).toBe(true);
    expect(r.pct).toBe(100);
    expect(r.partial).toBe(false);
    expect(r.label).toBe("Gagné en totalité");
  });

  it("une attribution PARTIELLE se dit en pourcentage", () => {
    const r = awardResult({ quantityUnits: 8000, awardedQuantityUnits: 4000, status: "WON" });
    expect(r.pct).toBe(50);
    expect(r.partial).toBe(true);
    expect(r.label).toBe("Gagné à 50 %");
  });

  it("GAGNÉ SANS QUANTITÉ SAISIE N'EST PAS 100 % — on ne l'invente pas", () => {
    const r = awardResult({ quantityUnits: 8000, awardedQuantityUnits: null, status: "WON" });
    expect(r.won).toBe(true);
    expect(r.pct).toBeNull();
    expect(r.label).toMatch(/à renseigner/);
  });

  it("INFRUCTUEUX N'EST PAS PERDU — personne n'a gagné, et cela se dit", () => {
    expect(awardResult({ quantityUnits: 1, status: "UNSUCCESSFUL" }).label).toMatch(/personne n'a gagné/);
    expect(awardResult({ quantityUnits: 1, status: "LOST" }).label).toBe("Perdu");
    expect(awardResult({ quantityUnits: 1, status: "CANCELLED" }).label).toBe("Lot annulé");
    expect(awardResult({ quantityUnits: 1, status: "SUBMITTED" }).label).toMatch(/en attente de décision/);
  });

  it("un lot non gagné ne porte aucun pourcentage", () => {
    const r = awardResult({ quantityUnits: 8000, awardedQuantityUnits: 4000, status: "LOST" });
    expect(r.pct).toBeNull();
    expect(r.won).toBe(false);
  });
});
