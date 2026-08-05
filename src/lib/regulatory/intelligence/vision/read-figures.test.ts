import { describe, expect, it } from "vitest";
import { parseFigures, buildFigureCall, FIGURE_SCHEMA } from "./read-figures";
import { CATALOG, FIRST_WAVE, INGESTIBLE, BINDING, sourcesForModule, findSource, ANPP_WATCH_PAGES } from "../corpus/catalog";

/**
 * LECTURE DES FIGURES — une observation qu'on ne peut pas retrouver dans le document ne vaut
 * rien. D'où la règle testée ici : pas de page, pas d'observation.
 */
describe("Figures CTD — assainissement des observations", () => {
  it("garde une observation complète", () => {
    const o = parseFigures({
      observations: [{
        page: 3, kind: "COURBE_STABILITE", caption: "Figure 2 — Teneur en fonction du temps",
        description: "La teneur décroît de 99,8 % à 96,1 % sur 12 mois à 40 °C.",
        readings: ["t=0 : 99,8 %", "t=12 mois : 96,1 %"],
        concerns: ["Tendance descendante proche de la limite de 95 %."],
        confidence: 0.82,
      }],
    });
    expect(o).toHaveLength(1);
    expect(o[0].page).toBe(3);
    expect(o[0].readings).toHaveLength(2);
  });

  it("ÉCARTE une observation sans page — elle ne serait pas vérifiable", () => {
    const o = parseFigures({ observations: [{ description: "Une courbe descend.", kind: "AUTRE" }] });
    expect(o).toEqual([]);
  });

  it("écarte une observation sans description", () => {
    expect(parseFigures({ observations: [{ page: 2, description: "  " }] })).toEqual([]);
  });

  it("retombe sur « AUTRE » pour un type inconnu plutôt que de le propager", () => {
    const o = parseFigures({ observations: [{ page: 1, description: "x", kind: "HOLOGRAMME" }] });
    expect(o[0].kind).toBe("AUTRE");
  });

  it("borne la confiance et nettoie les listes de valeurs", () => {
    const o = parseFigures({
      observations: [{ page: 1, description: "x", confidence: 9, readings: ["ok", "", 42, null], concerns: "pas un tableau" }],
    });
    expect(o[0].confidence).toBe(1);
    expect(o[0].readings).toEqual(["ok"]);
    expect(o[0].concerns).toEqual([]);
  });

  it("une réponse vide ne produit rien plutôt que de planter", () => {
    expect(parseFigures(null)).toEqual([]);
    expect(parseFigures({})).toEqual([]);
    expect(parseFigures({ observations: "non" })).toEqual([]);
  });

  it("la consigne embarque les pages et impose le schéma", () => {
    const c = buildFigureCall([{ buffer: Buffer.from("a") }, { buffer: Buffer.from("b") }], "3.2.P.8.pdf", "3.2.P.8.3");
    expect(c.images).toHaveLength(2);
    expect(c.jsonSchema?.schema).toBe(FIGURE_SCHEMA);
    expect(c.user).toContain("3.2.P.8.3");
    expect(c.temperature).toBe(0);
  });
});

/**
 * CATALOGUE DES SOURCES — deux erreurs seraient graves : ingérer un texte sous licence, et
 * traiter un brouillon comme une règle opposable. Les tests les rendent impossibles.
 */
describe("Corpus — catalogue des sources réglementaires", () => {
  it("les textes SOUS LICENCE ne sont jamais ingérables", () => {
    const pheur = findSource("EDQM-PHEUR");
    const book = findSource("CRC-IPPR-2E");
    expect(pheur?.ingestible).toBe(false);
    expect(book?.ingestible).toBe(false);
    expect(INGESTIBLE.map((s) => s.code)).not.toContain("EDQM-PHEUR");
    expect(INGESTIBLE.map((s) => s.code)).not.toContain("CRC-IPPR-2E");
  });

  it("le brouillon ICH M4Q(R2) n'est PAS opposable", () => {
    const draft = findSource("ICH-M4Q-R2-DRAFT");
    expect(draft?.binding).toBe(false);
    expect(BINDING.map((s) => s.code)).not.toContain("ICH-M4Q-R2-DRAFT");
  });

  it("la première vague contient bien les fondamentaux algériens et ICH", () => {
    const codes = FIRST_WAVE.map((s) => s.code);
    expect(codes).toContain("ANPP-LD-CTD-2026");
    expect(codes).toContain("ICH-M4-R4");
    expect(codes).toContain("ICH-M4Q-R1");
    expect(codes).toContain("WHO-TRS986-A6");
    expect(FIRST_WAVE.length).toBeGreaterThanOrEqual(8);
    expect(FIRST_WAVE.every((s) => s.ingestible)).toBe(true);
  });

  it("chaque source a un code unique et une URL", () => {
    const codes = CATALOG.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of CATALOG) expect(s.url).toMatch(/^https:\/\//);
  });

  it("le ciblage par module ne ramène que du pertinent", () => {
    const m3 = sourcesForModule("M3").map((s) => s.code);
    expect(m3).toContain("ICH-M4Q-R1");
    expect(m3).toContain("WHO-TRS986-A6");
    expect(m3).toContain("ICH-Q6A");
    // Une source explicitement rattachée au seul Module 5 n'a rien à faire ici.
    expect(m3).not.toContain("ICH-M13A");
  });

  it("les pages ANPP à surveiller sont déclarées — une ligne directrice change sans préavis", () => {
    expect(ANPP_WATCH_PAGES.map((p) => p.url)).toContain("https://anpp.dz/fr/guidelines/");
    expect(ANPP_WATCH_PAGES.map((p) => p.url)).toContain("https://anpp.dz/fr/notes/");
  });
});
