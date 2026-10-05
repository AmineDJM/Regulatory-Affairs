import { describe, expect, it } from "vitest";
import {
  RAISONS_SANS_LIGNES, methodeCourte, noteDeMethode, phraseSansLignes, refusFormatDePiece, refusTailleDePiece,
} from "@/lib/pieces-lues/phrases";

describe("la note de méthode — une lecture de machine voyage avec sa réserve (§104.15)", () => {
  it("le badge d'une ligne lue : « OCR 71 % », « OCR », « texte natif »", () => {
    expect(methodeCourte({ methode: "ocr", confiance: 71.4 })).toBe("OCR 71 %");
    expect(methodeCourte({ methode: "ocr", confiance: null })).toBe("OCR");
    expect(methodeCourte({ methode: "texte", confiance: null })).toBe("texte natif");
  });

  it("une lecture par OCR dit son moteur, sa confiance, les pages non lues, la coupe et qui a proposé les lignes", () => {
    const n = noteDeMethode({ methode: "ocr", confiance: 71, moteur: "tesseract", aRelire: true, pagesLues: 10, pagesTotal: 40, tronque: true }, { parModele: true });
    expect(n).toContain("Lue par OCR (Tesseract, confiance 71 %) — une lecture de machine, à vérifier sur le papier.");
    expect(n).toContain("L'OCR signale des pages à relire.");
    expect(n).toContain("10 page(s) lue(s) sur 40");
    expect(n).toContain("Texte coupé");
    expect(n).toContain("Lignes proposées par l'IA — à confirmer une à une.");
  });

  it("un OCR tenté qui n'a pas abouti se DIT — ce n'est pas une lecture vide", () => {
    const n = noteDeMethode({ methode: "texte", caracteres: 1240, ocrTente: true, ocrEchoue: true, raisonOcr: "données de langue absentes." });
    expect(n).toBe("Texte natif du fichier (1\u202f240 caractères), lu sans OCR. L'OCR a été tenté et n'a pas abouti (données de langue absentes) : seul le texte natif a été lu.");
  });

  it("chaque raison de lignes non lues a sa phrase, et dit quoi faire ; une cause canonique passée prend la tête", () => {
    for (const r of RAISONS_SANS_LIGNES) {
      const p = phraseSansLignes(r);
      expect(p, r).toMatch(/saisissez/);
      expect(p.endsWith("."), r).toBe(true);
    }
    expect(phraseSansLignes("DESACTIVEE")).toContain("désactivée (Administration › Contrôle de l'IA)");
    const coupee = phraseSansLignes("IA_COUPEE", "L'IA est coupée par l'interrupteur général (Administration › Contrôle de l'IA) : aucun appel n'est parti.");
    expect(coupee).toBe("L'IA est coupée par l'interrupteur général (Administration › Contrôle de l'IA) : aucun appel n'est parti — en-tête et totaux repérés : saisissez les lignes depuis le papier.");
    expect(noteDeMethode({ methode: "texte" }, { parModele: false, raisonSansLignes: "CONFIDENTIELLE" })).toMatch(/rien n'est envoyé hors de l'ERP/);
  });

  it("les refus de lecture nomment le format admis et la limite", () => {
    expect(refusFormatDePiece(".heic", ["pdf", "png", "jpg"])).toBe("Format « HEIC » non lu : seuls PDF, PNG, JPG se lisent — saisissez la pièce depuis le papier.");
    expect(refusTailleDePiece(25 * 1024 * 1024, 20 * 1024 * 1024)).toMatch(/^Fichier de 25 Mo : au-delà de 20 Mo/);
  });
});
