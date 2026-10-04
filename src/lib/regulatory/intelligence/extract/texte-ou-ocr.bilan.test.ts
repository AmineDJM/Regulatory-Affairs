import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSimplePdf, parsePdfBody } from "@/lib/pdf/simple-pdf";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LECTEUR COMMUN DIT CE QU'IL A FAIT DE L'OCR (lot D2-A).
 *
 * Avant : un moteur OCR qui levait rendait le texte natif « comme si de rien n'était » — un scan
 * dont l'OCR était tombé ressortait lu, presque vide, indiscernable d'une page blanche ; et la
 * lecture des appels d'offres PCH reconstruisait dans une fermeture à elle ce que le lecteur aurait
 * dû dire. Ici on vérifie le BILAN : tenté, échoué et pourquoi, pages lues sur pages totales, coupe,
 * moteur — et que `cloud` / `maxPages` parviennent au moteur, y compris au moteur de PRODUCTION.
 *
 * Aucun vrai OCR : le geste est INJECTÉ (`MoteurOcr`), et le moteur de production (`ocrDocument`)
 * est remplacé par un espion — seul `canOcr` reste le vrai.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const production = vi.hoisted(() => ({ ocrDocument: vi.fn() }));
vi.mock("@/lib/regulatory/intelligence/ocr/ocr-engine", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/regulatory/intelligence/ocr/ocr-engine")>();
  return { ...reel, ocrDocument: production.ocrDocument };
});

import { lireTexteOuOcr, type MoteurOcr } from "./texte-ou-ocr";

const TEXTE_LONG = "FACTURE N° FA-2026-0142 du 12 septembre 2026. Fournisseur : Imprimerie du Banc SARL. "
  + "Désignation : fiche posologique quadri recto verso, quantité 2 000, prix unitaire 42,50 DA. "
  + "Désignation : kakémono 80 x 200 cm, quantité 4, prix unitaire 18 000,00 DA. Total HT 157 000,00. "
  + "TVA 19 % 29 830,00. Total TTC 186 830,00. Arrêtée la présente facture à la somme de cent "
  + "quatre-vingt-six mille huit cent trente dinars. Conditions de paiement : virement à trente jours.";

/** Un PDF sans couche de texte : c'est ce que rend un scan. */
const scan = (): Buffer => buildSimplePdf("", [], {});

const lu = (over: Partial<Awaited<ReturnType<MoteurOcr>>> = {}): MoteurOcr =>
  async () => ({ text: TEXTE_LONG, meanConfidence: 71.4, needsReview: true, pageCount: 3, ...over });

beforeEach(() => {
  production.ocrDocument.mockReset();
});

describe("le lecteur commun dit ce qu'il a fait de l'OCR (lot D2-A)", () => {
  it("un PDF natif se lit tel quel : OCR ni tenté ni échoué, aucun moteur, rien de coupé", async () => {
    let appels = 0;
    const r = await lireTexteOuOcr("pdf", buildSimplePdf("Facture", parsePdfBody(TEXTE_LONG), {}), {
      ocr: async (a) => { appels += 1; return lu()(a); },
    });
    expect(appels, "on paie un OCR sur un texte déjà lisible").toBe(0);
    expect(r.methode).toBe("texte");
    expect(r.texte).toContain("FA-2026-0142");
    expect(r).toMatchObject({
      ocrTente: false, ocrEchoue: false, raisonOcr: null,
      pagesLues: null, pagesTotal: null, tronque: false, moteur: null,
    });
  });

  it("un scan océrisé dit ses pages lues, ses pages totales et le moteur qui a VRAIMENT lu", async () => {
    const r = await lireTexteOuOcr("pdf", scan(), { ocr: lu({ pagesLues: 3, moteur: "tesseract.js/7" }) });
    expect(r.methode).toBe("ocr");
    expect(r).toMatchObject({
      ocrTente: true, ocrEchoue: false, raisonOcr: null,
      pagesLues: 3, pagesTotal: 3, tronque: false, moteur: "tesseract.js/7",
      // Les champs d'avant ne bougent pas : un appelant existant lit la même chose qu'hier.
      confiance: 71, aRelire: true, pages: 3,
    });
  });

  it("un moteur qui ne dit pas ses pages lues ni son nom : inconnu (null), jamais deviné", async () => {
    const r = await lireTexteOuOcr("pdf", scan(), { ocr: lu({ pageCount: 5 }) });
    expect(r.methode).toBe("ocr");
    expect(r.pagesTotal).toBe(5);
    expect(r.pagesLues, "on a prêté au moteur une lecture complète qu'il n'a pas déclarée").toBeNull();
    expect(r.moteur).toBeNull();
    expect(r.tronque).toBe(false);
  });

  it("un OCR qui laisse des pages de côté rend un texte COUPÉ — et le dit", async () => {
    const r = await lireTexteOuOcr("pdf", scan(), { ocr: lu({ pageCount: 5, pagesLues: 2, moteur: "tesseract.js/7" }) });
    expect(r.methode).toBe("ocr");
    expect(r.pagesLues).toBe(2);
    expect(r.pagesTotal).toBe(5);
    expect(r.tronque, "deux pages sur cinq se lisent comme le document entier").toBe(true);
  });

  it("un moteur qui lève : texte natif, OCR tenté ET échoué, et la raison voyage avec", async () => {
    const r = await lireTexteOuOcr("pdf", scan(), {
      ocr: async () => { throw new Error("tesseract absent du conteneur"); },
    });
    expect(r.methode).toBe("texte");
    expect(r.texte.length).toBeLessThan(300);
    expect(r.ocrTente).toBe(true);
    expect(r.ocrEchoue, "un OCR tombé se lit comme une page blanche").toBe(true);
    expect(r.raisonOcr ?? "").toContain("tesseract absent du conteneur");
    expect(r).toMatchObject({ pagesLues: null, pagesTotal: null, moteur: null, confiance: null, pages: null });
  });

  it("un OCR qui rend moins que le texte natif a été tenté, n'a pas échoué, et ne l'emporte pas", async () => {
    const r = await lireTexteOuOcr("pdf", buildSimplePdf("Facture", parsePdfBody(TEXTE_LONG), {}), {
      seuilOcr: 100_000, // on force le passage par l'OCR
      ocr: lu({ text: "trois mots seulement", pagesLues: 1, pageCount: 1, moteur: "tesseract.js/7" }),
    });
    expect(r.methode).toBe("texte");
    expect(r).toMatchObject({ ocrTente: true, ocrEchoue: false, raisonOcr: null, moteur: null, pagesLues: null });
  });

  it("une extraction native plafonnée est dite coupée ; un texte court ne l'est pas", async () => {
    // L'extraction native plafonne à 2 000 000 de caractères (`extract-text.ts`) : au-delà, elle coupe.
    const enorme = await lireTexteOuOcr("txt", Buffer.from("a".repeat(2_000_100), "utf8"));
    expect(enorme.methode).toBe("texte");
    expect(enorme.tronque, "une extraction coupée à 2 000 000 de caractères se lit comme le texte entier").toBe(true);
    const court = await lireTexteOuOcr("txt", Buffer.from(TEXTE_LONG, "utf8"));
    expect(court.tronque).toBe(false);
  });

  it("une image qu'aucun moteur ne lit n'est pas « lue, rien dedans » : la raison le dit", async () => {
    let appels = 0;
    const r = await lireTexteOuOcr("heic", Buffer.from("octets-heic-du-banc"), {
      ocr: async (a) => { appels += 1; return lu()(a); },
    });
    expect(appels).toBe(0);
    expect(r).toMatchObject({ methode: "texte", texte: "", ocrTente: false, ocrEchoue: false });
    expect(r.raisonOcr ?? "").toMatch(/heic/);
    // Un texte COURT mais lisible n'est pas une image à océriser : aucune raison inventée.
    const note = await lireTexteOuOcr("txt", Buffer.from("Note brève.", "utf8"));
    expect(note.raisonOcr).toBeNull();
    expect(note.ocrTente).toBe(false);
  });

  it("les options `cloud` et `maxPages` parviennent au moteur ; `cloud` vaut vrai par défaut", async () => {
    const recu: Array<{ cloud?: boolean; maxPages?: number }> = [];
    const espion: MoteurOcr = async (a) => { recu.push({ cloud: a.cloud, maxPages: a.maxPages }); return lu()(a); };
    await lireTexteOuOcr("pdf", scan(), { ocr: espion, cloud: false, maxPages: 40 });
    await lireTexteOuOcr("pdf", scan(), { ocr: espion });
    expect(recu[0]).toEqual({ cloud: false, maxPages: 40 });
    expect(recu[1], "le comportement d'avant (cloud permis) doit rester le défaut").toEqual({ cloud: true, maxPages: undefined });
  });

  it("le moteur de PRODUCTION reçoit `cloud:false` et rend pages lues et moteur réel — sans rien injecter", async () => {
    production.ocrDocument.mockResolvedValue({
      engine: "tesseract.js/7", langs: "fra+eng", method: "ocr",
      pages: [
        { page: 1, text: TEXTE_LONG, confidence: 80, chars: TEXTE_LONG.length, lowConfidence: false },
        { page: 2, text: "", confidence: 0, chars: 0, lowConfidence: true },
      ],
      text: TEXTE_LONG, meanConfidence: 80, pageCount: 4, lowConfidencePages: 1,
      needsReview: true, truncated: true, pageOffsets: [0, TEXTE_LONG.length],
    });
    const r = await lireTexteOuOcr("pdf", scan(), { cloud: false, maxPages: 2 });
    expect(production.ocrDocument).toHaveBeenCalledTimes(1);
    expect(production.ocrDocument.mock.calls[0][0], "la lecture locale demandée n'atteint pas le moteur").toMatchObject({ ext: "pdf", cloud: false, maxPages: 2 });
    expect(r).toMatchObject({
      methode: "ocr", ocrTente: true, ocrEchoue: false,
      pagesLues: 2, pagesTotal: 4, tronque: true, moteur: "tesseract.js/7",
    });
  });

  it("le moteur de production qui lève est un échec DIT — et, sans option, l'appel garde le cloud permis comme avant", async () => {
    production.ocrDocument.mockRejectedValue(new Error("Mistral OCR : HTTP 503"));
    const r = await lireTexteOuOcr("pdf", scan());
    expect(production.ocrDocument.mock.calls[0][0]).toMatchObject({ cloud: true });
    expect(r).toMatchObject({ methode: "texte", ocrTente: true, ocrEchoue: true });
    expect(r.raisonOcr ?? "").toContain("HTTP 503");
  });
});
