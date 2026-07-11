import { describe, it, expect } from "vitest";
import { validatePartSize, expectedPartsFor } from "./session";

/** Tests unitaires (purs) de la logique de découpage/validation des parties d'upload (G14). */

describe("expectedPartsFor", () => {
  it("calcule le nombre de parties", () => {
    expect(expectedPartsFor(100, 40)).toBe(3); // 40 + 40 + 20
    expect(expectedPartsFor(80, 40)).toBe(2);
    expect(expectedPartsFor(1, 40)).toBe(1);
    expect(expectedPartsFor(0, 40)).toBe(1); // au moins une partie
  });
});

describe("validatePartSize — contrôle de taille côté stockage", () => {
  const partSize = 40;
  const totalBytes = 100; // 3 parties : 40, 40, 20

  it("accepte des parties valides", () => {
    expect(validatePartSize({ index: 0, size: 40, partSize, totalBytes })).toBeNull();
    expect(validatePartSize({ index: 1, size: 40, partSize, totalBytes })).toBeNull();
    expect(validatePartSize({ index: 2, size: 20, partSize, totalBytes })).toBeNull(); // dernière plus petite
  });

  it("rejette un index hors bornes", () => {
    expect(validatePartSize({ index: 3, size: 10, partSize, totalBytes })).toContain("hors bornes");
    expect(validatePartSize({ index: -1, size: 10, partSize, totalBytes })).toContain("hors bornes");
  });

  it("rejette une partie vide ou trop grande", () => {
    expect(validatePartSize({ index: 0, size: 0, partSize, totalBytes })).toContain("vide");
    expect(validatePartSize({ index: 0, size: 41, partSize, totalBytes })).toContain("trop grande");
  });

  it("rejette une partie non-dernière plus petite que partSize", () => {
    expect(validatePartSize({ index: 0, size: 30, partSize, totalBytes })).toContain("dernière partie");
  });

  it("rejette une dernière partie trop grande", () => {
    expect(validatePartSize({ index: 2, size: 25, partSize, totalBytes })).toContain("trop grande");
  });
});
