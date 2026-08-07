import { describe, expect, it } from "vitest";
import {
  parseFigures, buildFigureCall, FIGURE_SCHEMA, parseDefects,
  FORM_DEFECT_KINDS, FORM_DEFECT_LABEL, FORM_DEFECT_SEVERITY,
} from "./read-figures";
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

describe("parseDefects — contrôle de forme", () => {
  it("retient un défaut décrit et le rattache à sa page", () => {
    const out = parseDefects({
      defauts: [{ page: 3, type: "CAPTURE_ECRAN", constat: "barre d'adresse de navigateur visible en haut de page", confiance: 0.9 }],
    });
    expect(out).toEqual([{ page: 3, kind: "CAPTURE_ECRAN", evidence: "barre d'adresse de navigateur visible en haut de page", confidence: 0.9 }]);
  });

  it("écarte un défaut SANS constat visuel — il ne s'oppose à personne", () => {
    // « c'est une capture d'écran » sans dire à quoi on le voit ferait recaler une pièce
    // valable sur une intuition.
    expect(parseDefects({ defauts: [{ page: 1, type: "CAPTURE_ECRAN", constat: "  ", confiance: 0.9 }] })).toEqual([]);
  });

  it("écarte un défaut sans page — un constat non localisable n'est pas vérifiable", () => {
    expect(parseDefects({ defauts: [{ type: "SCAN_ILLISIBLE", constat: "flou", confiance: 0.8 }] })).toEqual([]);
    expect(parseDefects({ defauts: [{ page: 0, type: "SCAN_ILLISIBLE", constat: "flou", confiance: 0.8 }] })).toEqual([]);
  });

  it("ramène un type inconnu sur AUTRE plutôt que de perdre le constat", () => {
    const out = parseDefects({ defauts: [{ page: 2, type: "INVENTÉ", constat: "quelque chose d'anormal", confiance: 0.5 }] });
    expect(out[0].kind).toBe("AUTRE");
  });

  it("borne la confiance dans [0,1]", () => {
    const out = parseDefects({ defauts: [
      { page: 1, type: "PAGE_DE_TRAVERS", constat: "page inclinée", confiance: 7 },
      { page: 2, type: "PAGE_DE_TRAVERS", constat: "page inclinée", confiance: -3 },
    ] });
    expect(out.map((d) => d.confidence)).toEqual([1, 0]);
  });

  it("rend une liste vide sur une réponse vide ou malformée", () => {
    expect(parseDefects(null)).toEqual([]);
    expect(parseDefects({})).toEqual([]);
    expect(parseDefects({ defauts: "pas un tableau" })).toEqual([]);
  });
});

describe("gravité des défauts de forme", () => {
  it("rend IRRECEVABLE ce qui ne se corrige pas par une explication", () => {
    // Une capture d'écran, une photo d'écran ou un filigrane « brouillon » exigent la pièce
    // authentique — aucune justification ne les rattrape.
    expect(FORM_DEFECT_SEVERITY.CAPTURE_ECRAN).toBe("CRITICAL");
    expect(FORM_DEFECT_SEVERITY.PHOTO_ECRAN).toBe("CRITICAL");
    expect(FORM_DEFECT_SEVERITY.FILIGRANE_BROUILLON).toBe("CRITICAL");
    // Une page de travers se rescanne : c'est ennuyeux, pas rédhibitoire.
    expect(FORM_DEFECT_SEVERITY.PAGE_DE_TRAVERS).toBe("MINOR");
  });

  it("chaque type de défaut a un libellé et une gravité", () => {
    for (const k of FORM_DEFECT_KINDS) {
      expect(FORM_DEFECT_LABEL[k]?.length).toBeGreaterThan(0);
      expect(["CRITICAL", "MAJOR", "MINOR"]).toContain(FORM_DEFECT_SEVERITY[k]);
    }
  });

  it("le schéma envoyé au modèle expose bien les défauts", () => {
    expect(Object.keys(FIGURE_SCHEMA.properties)).toContain("defauts");
  });
});
