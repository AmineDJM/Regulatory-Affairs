import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { ocrDocument, canOcr } from "./ocr-engine";

/**
 * Test OCR RÉEL (G13) — génère une image et un PDF contenant du texte, puis vérifie que le
 * moteur (tesseract.js + mupdf + sharp, données de langue locales) en extrait réellement le
 * contenu avec une confiance mesurée. Aucune donnée simulée, aucun service tiers.
 */

async function textPng(label: string): Promise<Buffer> {
  const svg = `<svg width="760" height="130" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="20" y="82" font-family="DejaVu Sans, sans-serif" font-size="46" fill="black">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// PDF minimal valide (auto-réparé par mupdf) contenant du texte.
function textPdf(label: string): Buffer {
  const content = `BT /F1 24 Tf 20 60 Td (${label}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 120]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${content.length}>>stream
${content}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Size 6/Root 1 0 R>>
%%EOF`;
  return Buffer.from(pdf, "latin1");
}

describe("ocrDocument — OCR réel", () => {
  it("canOcr : images et PDF oui ; docx non", () => {
    expect(canOcr("png")).toBe(true);
    expect(canOcr("PDF")).toBe(true);
    expect(canOcr("tiff")).toBe(true);
    expect(canOcr("docx")).toBe(false);
  });

  it("extrait réellement le texte d'une image (confiance mesurée, une page)", async () => {
    const buf = await textPng("AMOXICILLINE 500 MG");
    const r = await ocrDocument({ ext: "png", buffer: buf, langs: ["eng"] });
    expect(r.method).toBe("ocr");
    expect(r.pages).toHaveLength(1);
    expect(r.text.toUpperCase()).toContain("AMOXICILLINE");
    expect(r.text).toContain("500");
    expect(r.meanConfidence).toBeGreaterThan(50);
  }, 60_000);

  it("rastérise puis océrise un PDF scanné (mupdf → tesseract)", async () => {
    const r = await ocrDocument({ ext: "pdf", buffer: textPdf("PARACETAMOL 1000 MG"), langs: ["eng"] });
    expect(r.pageCount).toBe(1);
    expect(r.text.toUpperCase()).toContain("PARACETAMOL");
    expect(r.pages[0].confidence).toBeGreaterThan(0);
  }, 60_000);

  it("signale la revue humaine quand aucun texte n'est lisible", async () => {
    // Image blanche : aucun texte → needsReview.
    const blank = await sharp({ create: { width: 200, height: 80, channels: 3, background: "white" } }).png().toBuffer();
    const r = await ocrDocument({ ext: "png", buffer: blank, langs: ["eng"] });
    expect(r.text.length).toBe(0);
    expect(r.needsReview).toBe(true);
  }, 60_000);
});
