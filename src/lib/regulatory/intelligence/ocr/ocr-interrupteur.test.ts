import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'OCR SOUS L'INTERRUPTEUR GÉNÉRAL DE L'IA (audit 360°, rapport 19, F3).
 *
 * Interrupteur coupé, l'écran « Contrôle de l'IA » promet « Toute l'IA est coupée ». Le moteur OCR
 * envoyait pourtant chaque scan à Mistral (un service cloud) et chaque page douteuse au modèle
 * vision. Coupé : le scan est lu ICI, par Tesseract, sur ce serveur — et le banc le prouve avec un
 * VRAI OCR local sur une image générée, pas avec un résultat simulé. Mistral et le secours vision,
 * eux, sont remplacés : aucun appel réseau ne part de ce banc, dans aucun des deux sens.
 *
 * Le lecteur de l'interrupteur est INJECTÉ : la ligne `AiSetting` est globale et partagée par la
 * suite parallèle, la couper ici couperait l'IA des bancs voisins (§118.132).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const mistral = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  eligible: vi.fn(() => true),
  document: vi.fn(),
}));
vi.mock("./mistral-ocr", () => ({
  mistralOcrConfigured: mistral.configured,
  mistralOcrEligible: mistral.eligible,
  mistralOcrDocument: mistral.document,
}));

const secours = vi.hoisted(() => ({ applyAiRescue: vi.fn() }));
vi.mock("./vision-ocr", () => ({ applyAiRescue: secours.applyAiRescue }));

import { ocrDocument, type OcrResult } from "./ocr-engine";
import { remplacerLecteurInterrupteurIaPourTests } from "@/lib/ai-settings";

const LU_PAR_MISTRAL: OcrResult = {
  engine: "mistral/mistral-ocr-latest", langs: "fra+eng", method: "ocr",
  pages: [{ page: 1, text: "TEXTE LU PAR MISTRAL", confidence: 95, chars: 20, lowConfidence: false }],
  text: "TEXTE LU PAR MISTRAL", meanConfidence: 95, pageCount: 1, lowConfidencePages: 0,
  needsReview: false, truncated: false, pageOffsets: [0],
};

async function imageAvecTexte(label: string): Promise<Buffer> {
  const svg = `<svg width="760" height="130" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="20" y="82" font-family="DejaVu Sans, sans-serif" font-size="46" fill="black">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const SECOURS = { label: "scan-du-banc.png" };
let moteurAvant: string | undefined;

beforeEach(() => {
  moteurAvant = process.env.REG_OCR_ENGINE;
  delete process.env.REG_OCR_ENGINE;
  mistral.configured.mockReset().mockReturnValue(true);
  mistral.eligible.mockReset().mockReturnValue(true);
  mistral.document.mockReset().mockResolvedValue(LU_PAR_MISTRAL);
  secours.applyAiRescue.mockReset().mockImplementation(async (_doc: unknown, base: OcrResult) => base);
});

afterEach(() => {
  remplacerLecteurInterrupteurIaPourTests(null);
  if (moteurAvant === undefined) delete process.env.REG_OCR_ENGINE;
  else process.env.REG_OCR_ENGINE = moteurAvant;
});

describe("ocrDocument sous l'interrupteur général de l'IA", () => {
  it("coupé : aucun octet ne part chez Mistral — Tesseract lit le scan sur ce serveur, et le dit par son moteur", async () => {
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    const r = await ocrDocument({ ext: "png", buffer: await imageAvecTexte("AMOXICILLINE 500 MG"), langs: ["eng"] });
    expect(mistral.document).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
    expect(r.text.toUpperCase()).toContain("AMOXICILLINE");
  }, 60_000);

  it("coupé, même un moteur FORCÉ (REG_OCR_ENGINE=mistral) cède à l'écran : repli local, aucun appel cloud", async () => {
    process.env.REG_OCR_ENGINE = "mistral";
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    const r = await ocrDocument({ ext: "png", buffer: await imageAvecTexte("PARACETAMOL 1000 MG"), langs: ["eng"] });
    expect(mistral.document).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
  }, 60_000);

  it("coupé : le secours vision ne part pas non plus — les pages douteuses restent à la revue humaine", async () => {
    mistral.configured.mockReturnValue(false); // seul le secours peut encore appeler un modèle ici
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    const r = await ocrDocument({ ext: "png", buffer: await imageAvecTexte("NIVOLEX 40 MG"), langs: ["eng"], aiRescue: SECOURS });
    expect(secours.applyAiRescue).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
  }, 60_000);

  it("rallumé : Mistral lit le scan et le secours vision s'applique, comme avant — l'interrupteur a bien été LU", async () => {
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await imageAvecTexte("AMOXICILLINE 500 MG"), aiRescue: SECOURS });
    expect(mistral.document).toHaveBeenCalledTimes(1);
    expect(secours.applyAiRescue).toHaveBeenCalledTimes(1);
    expect(secours.applyAiRescue.mock.calls[0][1]).toBe(LU_PAR_MISTRAL);
    expect(r).toBe(LU_PAR_MISTRAL);
    expect(lecteur).toHaveBeenCalledTimes(1);
  });

  it("un OCR purement local (ni cloud configuré, ni secours demandé) ne lit même pas l'interrupteur", async () => {
    mistral.configured.mockReturnValue(false);
    const lecteur = vi.fn(async () => true);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    const r = await ocrDocument({ ext: "png", buffer: await imageAvecTexte("AMOXICILLINE 500 MG"), langs: ["eng"] });
    expect(lecteur).not.toHaveBeenCalled();
    expect(r.engine).toMatch(/^tesseract/);
  }, 60_000);
});
