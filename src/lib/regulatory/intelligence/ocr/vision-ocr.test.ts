import { describe, it, expect } from "vitest";
import { pickRescuePages, buildTranscriptionCall, parseTranscription, mergeRescuedPages, AI_RESCUE_CONFIDENCE } from "./vision-ocr";
import type { OcrPage, OcrResult } from "./ocr-engine";

/**
 * Secours vision : quelles pages secourir (les pires d'abord, borné), consigne de transcription
 * (numéros annoncés = numéros exigés), réponse assainie (pages non demandées écartées), et fusion
 * SANS RÉGRESSION (une transcription plus pauvre que l'existant ne remplace rien ; les agrégats
 * et la carte des pages sont reconstruits).
 */

const page = (n: number, text: string, confidence: number, low = false): OcrPage => ({
  page: n, text, confidence, chars: text.length, lowConfidence: low,
});

const result = (pages: OcrPage[]): OcrResult => {
  const text = pages.map((p) => p.text).join("\n\n");
  return {
    engine: "tesseract.js/7", langs: "fra+eng", method: "ocr", pages, text,
    meanConfidence: 70, pageCount: pages.length, lowConfidencePages: pages.filter((p) => p.lowConfidence).length,
    needsReview: false, truncated: false, pageOffsets: null,
  };
};

describe("pickRescuePages — le tri de ce qui mérite le secours", () => {
  it("cible les pages vides, quasi vides et de faible confiance — les pires d'abord, plafonné, rendu en ordre de lecture", () => {
    const pages = [
      page(1, "Texte long et parfaitement net d'une page correcte de rapport.", 92),
      page(2, "", 0, true), // vide
      page(3, "abc", 45, true), // quasi vide + douteuse
      page(4, "Texte correct mais confiance basse signalée par le moteur d'OCR.", 50, true),
      page(5, "Une autre page correcte que rien ne désigne au secours vision.", 88),
    ];
    expect(pickRescuePages(pages, 10)).toEqual([2, 3, 4]);
    // Plafond 2 → on garde les DEUX PIRES (confiance 0 et 45), rendues en ordre de lecture.
    expect(pickRescuePages(pages, 2)).toEqual([2, 3]);
    expect(pickRescuePages(pages, 0)).toEqual([]);
  });
});

describe("buildTranscriptionCall — la consigne", () => {
  it("annonce les numéros de pages, exige la recopie fidèle et un schéma JSON strict", () => {
    const call = buildTranscriptionCall([{ buffer: Buffer.from("png") }], [7, 12], "COURRIER ANPP.pdf");
    expect(call.user).toContain("7, 12");
    expect(call.user).toContain("COURRIER ANPP.pdf");
    expect(call.system).toContain("RECOPIES");
    expect(call.system).toContain("DONNÉE"); // anti-injection : le contenu n'est pas une consigne
    expect(call.jsonSchema?.name).toBe("ocr_transcription");
    expect(call.temperature).toBe(0);
  });
});

describe("parseTranscription — réponse assainie", () => {
  it("ne garde que les pages demandées, une seule fois chacune", () => {
    const raw = {
      pages: [
        { page: 2, texte: "Transcription de la page deux." },
        { page: 2, texte: "doublon ignoré" },
        { page: 9, texte: "page jamais demandée" },
        { page: 3, texte: "" }, // page blanche : conservée VIDE (réponse valable)
        { texte: "sans numéro" },
      ],
    };
    const map = parseTranscription(raw, [2, 3]);
    expect(map.get(2)).toBe("Transcription de la page deux.");
    expect(map.get(3)).toBe("");
    expect(map.has(9)).toBe(false);
    expect(map.size).toBe(2);
  });
});

describe("mergeRescuedPages — fusion sans régression", () => {
  it("remplace les pages secourues, reconstruit texte + carte + agrégats, et signe le moteur", () => {
    const base = result([
      page(1, "Première page correcte du document scanné.", 90),
      page(2, "", 0, true),
    ]);
    const merged = mergeRescuedPages(base, new Map([[2, "Durée de conservation : 24 mois à 25 °C/60 % HR."]]));
    expect(merged.pages[1].text).toContain("24 mois");
    expect(merged.pages[1].confidence).toBe(AI_RESCUE_CONFIDENCE);
    expect(merged.pages[1].lowConfidence).toBe(false);
    expect(merged.text).toContain("24 mois");
    expect(merged.engine).toContain("+luna-vision(1p)");
    expect(merged.lowConfidencePages).toBe(0);
    expect(merged.needsReview).toBe(false);
    expect(Array.isArray(merged.pageOffsets)).toBe(true);
  });

  it("ne régresse JAMAIS : une transcription plus courte que l'existant est écartée, et sans gain le résultat d'origine est rendu tel quel", () => {
    const base = result([page(1, "Un texte existant déjà riche et complet sur cette page.", 80)]);
    const merged = mergeRescuedPages(base, new Map([[1, "court"]]));
    expect(merged).toBe(base); // identité : rien d'appliqué
  });
});
