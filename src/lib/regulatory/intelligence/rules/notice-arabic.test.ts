import { describe, it, expect } from "vitest";
import { arabicStats, missesArabic, isArabicRequiredSection, MIN_LETTERS } from "./notice-arabic";

/**
 * Le contrôle « notice en arabe » ne doit se tromper DANS AUCUN SENS : rater une notice
 * français-seul coûte une réserve ANPP certaine ; accuser à tort une notice bilingue ruine
 * la confiance dans l'outil.
 */
const FRENCH_ONLY = "Notice : information de l'utilisateur. Lisez attentivement cette notice avant de prendre ce médicament. ".repeat(10);
const BILINGUAL = (FRENCH_ONLY + "النشرة الداخلية : معلومات للمستخدم. اقرأ هذه النشرة بعناية قبل تناول هذا الدواء. ".repeat(10));

describe("arabicStats", () => {
  it("mesure la part réelle d'arabe", () => {
    expect(arabicStats(FRENCH_ONLY).ratio).toBe(0);
    const bi = arabicStats(BILINGUAL);
    expect(bi.ratio).toBeGreaterThan(0.2);
    expect(bi.letters).toBeGreaterThan(MIN_LETTERS);
  });

  it("compte aussi les formes de présentation arabes (PDF exportés)", () => {
    // Les PDF encodent souvent l'arabe en « presentation forms » (U+FB50–U+FEFF).
    expect(arabicStats("ﻣﺮﺣﺒﺎ").ratio).toBe(1);
  });

  it("survit à un texte vide", () => {
    expect(arabicStats("").ratio).toBe(0);
  });
});

describe("missesArabic — prudence dans les deux sens", () => {
  it("signale une notice français-seul assez longue pour être jugée", () => {
    expect(missesArabic(FRENCH_ONLY)).toBe(true);
  });

  it("ne signale JAMAIS une notice bilingue", () => {
    expect(missesArabic(BILINGUAL)).toBe(false);
  });

  it("ne juge pas un texte trop court — l'absence de preuve n'est pas une preuve d'absence", () => {
    expect(missesArabic("Notice courte.")).toBe(false);
  });
});

describe("isArabicRequiredSection", () => {
  it("vise notice, étiquetage et maquettes (1.3.x) mais PAS le RCP (1.3.1)", () => {
    expect(isArabicRequiredSection("1.3.2")).toBe(true);
    expect(isArabicRequiredSection("1.3.3")).toBe(true);
    expect(isArabicRequiredSection("1.3.1")).toBe(false);
    expect(isArabicRequiredSection("3.2.P.8")).toBe(false);
    expect(isArabicRequiredSection(null)).toBe(false);
  });
});
