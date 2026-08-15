import { describe, it, expect } from "vitest";
import {
  stockOf, parseQuantity, deltaFor, signOf, canWithdraw, validateMovement, stockLevel,
} from "./stock";

describe("Le stock est une conséquence des mouvements, jamais une saisie", () => {
  it("additionne les entrées et les sorties", () => {
    expect(stockOf([{ kind: "RECEIPT", delta: 5000 }, { kind: "DISTRIBUTION", delta: -1200 }])).toBe(3800);
  });

  it("vaut zéro sans mouvement, pas NaN", () => {
    expect(stockOf([])).toBe(0);
  });

  it("ignore une valeur aberrante plutôt que de contaminer tout le stock", () => {
    expect(stockOf([{ kind: "RECEIPT", delta: 100 }, { kind: "RECEIPT", delta: Number.NaN }])).toBe(100);
  });
});

describe("C'est la NATURE du mouvement qui donne le sens, pas la personne qui saisit", () => {
  it("une entrée ajoute, une distribution retire — quel que soit le signe saisi", () => {
    expect(deltaFor("RECEIPT", 600)).toBe(600);
    expect(deltaFor("DISTRIBUTION", 600)).toBe(-600);
    expect(deltaFor("DISTRIBUTION", -600)).toBe(-600); // un signe saisi par erreur ne renverse rien
    expect(deltaFor("LOSS", 12)).toBe(-12);
  });

  it("seule la correction d'inventaire accepte les deux sens", () => {
    expect(signOf("CORRECTION")).toBeNull();
    expect(deltaFor("CORRECTION", -40)).toBe(-40);
    expect(deltaFor("CORRECTION", 40)).toBe(40);
  });

  it("lit une quantité tapée à la main, et refuse ce qui n'est pas un nombre", () => {
    expect(parseQuantity("1 200")).toBe(1200);
    expect(parseQuantity("12,5")).toBe(12.5);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("beaucoup")).toBeNull();
  });
});

describe("On ne sort pas ce qu'on n'a pas", () => {
  it("refuse une sortie supérieure au stock, et DIT ce qui reste", () => {
    const r = canWithdraw(300, 500);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("300");
  });

  it("sur un stock vide, oriente vers l'entrée manquante plutôt que vers un chiffre", () => {
    // Un stock négatif ne veut rien dire physiquement : il masque une entrée non saisie.
    const r = canWithdraw(0, 10);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/entrée|inventaire/i);
  });

  it("accepte de vider exactement le stock", () => {
    expect(canWithdraw(300, 300).ok).toBe(true);
  });

  it("refuse une quantité nulle", () => {
    expect(canWithdraw(300, 0).ok).toBe(false);
  });
});

describe("La garde vaut pour toutes les natures", () => {
  it("laisse toujours passer une entrée", () => {
    expect(validateMovement("RECEIPT", 0, 5000).ok).toBe(true);
  });

  it("applique la garde de stock à une perte comme à une distribution", () => {
    expect(validateMovement("LOSS", 5, 10).ok).toBe(false);
    expect(validateMovement("DISTRIBUTION", 5, 10).ok).toBe(false);
  });

  it("une correction NÉGATIVE ne peut pas creuser le stock sous zéro", () => {
    expect(validateMovement("CORRECTION", 100, -150).ok).toBe(false);
    expect(validateMovement("CORRECTION", 100, -50).ok).toBe(true);
  });

  it("une correction POSITIVE passe toujours : c'est le cas du carton retrouvé", () => {
    expect(validateMovement("CORRECTION", 0, 80).ok).toBe(true);
  });

  it("refuse une quantité vide", () => {
    expect(validateMovement("RECEIPT", 0, 0).ok).toBe(false);
  });
});

describe("Signaler AVANT la rupture", () => {
  it("distingue rupture, stock bas et disponible", () => {
    expect(stockLevel(0, 50)).toBe("OUT");
    expect(stockLevel(40, 50)).toBe("LOW");
    expect(stockLevel(400, 50)).toBe("OK");
  });

  it("sans seuil réglé, ne crie au loup que sur la rupture", () => {
    expect(stockLevel(3, null)).toBe("OK");
    expect(stockLevel(0, null)).toBe("OUT");
  });

  it("un stock négatif (donnée héritée) se lit comme une rupture, pas comme un stock", () => {
    expect(stockLevel(-5, 10)).toBe("OUT");
  });
});
