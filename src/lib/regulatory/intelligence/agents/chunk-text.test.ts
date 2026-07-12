import { describe, it, expect, afterEach } from "vitest";
import { splitTextIntoChunks, aiChunkChars } from "./chunk-text";

/**
 * Découpage du texte en parts d'analyse (~10 pages). Vérifie : texte court = 1 part, texte long
 * = N parts sous le plafond sans couper les mots, reconstruction intégrale, texte vide = [].
 */

afterEach(() => {
  delete process.env.REG_AI_CHUNK_PAGES;
  delete process.env.REG_AI_CHARS_PER_PAGE;
});

describe("splitTextIntoChunks", () => {
  it("texte court → une seule part", () => {
    expect(splitTextIntoChunks("Rapport de stabilité.", 1000)).toEqual(["Rapport de stabilité."]);
  });

  it("texte vide ou blanc → aucune part", () => {
    expect(splitTextIntoChunks("", 1000)).toEqual([]);
    expect(splitTextIntoChunks("   \n  ", 1000)).toEqual([]);
  });

  it("texte long → plusieurs parts sous le plafond, sans couper les mots, contenu intégral", () => {
    const words = Array.from({ length: 500 }, (_, i) => `mot${i}`).join(" ");
    const parts = splitTextIntoChunks(words, 200);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(200);
      expect(p.startsWith("mot")).toBe(true); // coupé sur une frontière de mot (pas au milieu)
    }
    // Reconstruction : tous les mots présents, dans l'ordre.
    expect(parts.join(" ").split(/\s+/)).toEqual(words.split(" "));
  });

  it("aiChunkChars = pages × caractères/page (configurable)", () => {
    expect(aiChunkChars()).toBe(10 * 2400); // défauts
    process.env.REG_AI_CHUNK_PAGES = "5";
    process.env.REG_AI_CHARS_PER_PAGE = "2000";
    expect(aiChunkChars()).toBe(10_000);
  });
});
