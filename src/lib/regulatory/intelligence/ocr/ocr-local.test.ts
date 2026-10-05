import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE LECTURE LOCALE, PAR APPEL : `ocrDocument({ cloud: false })` (lot D2-A).
 *
 * Avant : dès que la clé Mistral existait, une lecture censée être gratuite partait chez Mistral —
 * facturée au PDF entier, le document sorti du serveur — et la seule façon de l'empêcher était de
 * couper TOUTE l'IA. Une pièce commerciale déposée se lit d'abord ICI : `cloud: false` donne zéro
 * appel au moteur cloud, aucun secours vision, et l'interrupteur n'est même pas lu (rien ne sort).
 *
 * Calqué sur `ocr-interrupteur.test.ts`, avec une différence : AUCUN vrai OCR. La clé Mistral est
 * VRAIMENT posée et `mistralOcrConfigured` reste le vrai (sans quoi « zéro appel » pourrait venir
 * d'une clé non reconnue, §118.17) ; seul l'appel réseau `mistralOcrDocument` est un espion.
 * Tesseract (`tesseract.js`) et ses données de langue sont remplacés par un faux moteur ; le
 * pré-traitement `sharp` est le vrai. Le lecteur de l'interrupteur est INJECTÉ (§118.132).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const mistral = vi.hoisted(() => ({ document: vi.fn() }));
vi.mock("./mistral-ocr", async (importOriginal) => {
  const reel = await importOriginal<typeof import("./mistral-ocr")>();
  return { ...reel, mistralOcrDocument: mistral.document };
});

const secours = vi.hoisted(() => ({ applyAiRescue: vi.fn() }));
vi.mock("./vision-ocr", () => ({ applyAiRescue: secours.applyAiRescue }));

const tess = vi.hoisted(() => ({ createWorker: vi.fn(), recognize: vi.fn() }));
vi.mock("tesseract.js", () => ({ createWorker: tess.createWorker, default: { createWorker: tess.createWorker } }));
vi.mock("./lang-data", () => ({
  ensureLangData: vi.fn(async () => "/inexistant/langues-du-banc"),
  ocrCacheDir: () => "/inexistant/cache-du-banc",
  defaultOcrLangs: () => ["fra", "eng"],
}));

import { ocrDocument, type OcrResult } from "./ocr-engine";
import { mistralOcrConfigured } from "./mistral-ocr";
import { remplacerLecteurInterrupteurIaPourTests } from "@/lib/ai-settings";

const LU_PAR_MISTRAL: OcrResult = {
  engine: "mistral/mistral-ocr-latest", langs: "fra+eng", method: "ocr",
  pages: [{ page: 1, text: "TEXTE LU PAR MISTRAL", confidence: 95, chars: 20, lowConfidence: false }],
  text: "TEXTE LU PAR MISTRAL", meanConfidence: 95, pageCount: 1, lowConfidencePages: 0,
  needsReview: false, truncated: false, pageOffsets: [0],
};

const scanPng = (): Promise<Buffer> =>
  sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();

const ENV = ["MISTRAL_API_KEY", "REG_OCR_ENGINE"] as const;
let avant: Record<string, string | undefined> = {};

beforeEach(() => {
  avant = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.MISTRAL_API_KEY = "cle-mistral-du-banc";
  process.env.REG_OCR_ENGINE = "auto";
  mistral.document.mockReset().mockResolvedValue(LU_PAR_MISTRAL);
  secours.applyAiRescue.mockReset().mockImplementation(async (_doc: unknown, base: OcrResult) => base);
  tess.recognize.mockReset().mockResolvedValue({ data: { text: "LU SUR CE SERVEUR", confidence: 88 } });
  tess.createWorker.mockReset().mockImplementation(async () => ({ recognize: tess.recognize, terminate: async () => undefined }));
});

afterEach(() => {
  remplacerLecteurInterrupteurIaPourTests(null);
  for (const k of ENV) {
    if (avant[k] === undefined) delete process.env[k];
    else process.env[k] = avant[k];
  }
});

describe("ocrDocument({ cloud:false }) — une lecture locale par appel (lot D2-A)", () => {
  it("témoin : clé Mistral posée, mode auto, SANS `cloud:false` — le scan part chez Mistral et l'interrupteur est LU", async () => {
    expect(mistralOcrConfigured(), "la clé posée n'est pas reconnue : « zéro appel » ne prouverait rien").toBe(true);
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await scanPng() });
    expect(mistral.document).toHaveBeenCalledTimes(1);
    expect(lecteur).toHaveBeenCalledTimes(1);
    expect(tess.createWorker).not.toHaveBeenCalled();
    expect(r).toBe(LU_PAR_MISTRAL);
  });

  it("clé Mistral posée, mode auto, `cloud:false` : zéro appel à Mistral, l'interrupteur n'est pas consulté, le moteur local lit ici", async () => {
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await scanPng(), cloud: false });
    expect(mistral.document, "une lecture locale demandée est partie chez Mistral").not.toHaveBeenCalled();
    expect(lecteur, "une lecture qui ne sort pas n'a pas à lire l'interrupteur").not.toHaveBeenCalled();
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(r.engine).toMatch(/^tesseract/);
    expect(r.text).toContain("LU SUR CE SERVEUR");
  });

  it("`cloud:false` avec un secours vision demandé : le secours ne part pas, et l'interrupteur n'est pas consulté", async () => {
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await scanPng(), cloud: false, aiRescue: { label: "scan-du-banc.png" } });
    expect(secours.applyAiRescue, "les pages douteuses sont parties EN IMAGE chez un modèle").not.toHaveBeenCalled();
    expect(mistral.document).not.toHaveBeenCalled();
    expect(lecteur).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
  });

  it("`cloud:false` l'emporte même sur un moteur FORCÉ (REG_OCR_ENGINE=mistral) : aucun appel cloud", async () => {
    process.env.REG_OCR_ENGINE = "mistral";
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await scanPng(), cloud: false });
    expect(mistral.document).not.toHaveBeenCalled();
    expect(lecteur).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
  });
});
