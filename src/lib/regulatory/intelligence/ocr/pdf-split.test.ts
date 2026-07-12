import { describe, it, expect } from "vitest";
import { openPdf } from "./pdf-split";

/**
 * Test du découpage PDF par plages de pages (mupdf). Vérifie le comptage des pages, l'extraction
 * d'une sous-plage AUTONOME (ré-ouvrable, bon nombre de pages) et le bornage en fin de document.
 */

// PDF minimal à N pages blanches (xref absent → mupdf répare à l'ouverture).
function makePdf(pageCount: number): Buffer {
  const kids = Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(" ");
  const objs = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj`,
    ...Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >> endobj`),
  ];
  return Buffer.from(`%PDF-1.4\n${objs.join("\n")}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, "latin1");
}

async function pageCountOf(buffer: Buffer): Promise<number> {
  const src = await openPdf(buffer);
  try {
    return src.pageCount;
  } finally {
    src.close();
  }
}

describe("openPdf — découpage par plages de pages", () => {
  it("compte les pages, extrait une sous-plage autonome, borne en fin de document", async () => {
    const src = await openPdf(makePdf(5));
    try {
      expect(src.pageCount).toBe(5);
      // Plage [1,3) = 2 pages → sous-PDF ré-ouvrable de 2 pages.
      expect(await pageCountOf(src.extractRange(1, 2))).toBe(2);
      // Plage débordante [4, 4+10) → bornée à la dernière page (1 page restante).
      expect(await pageCountOf(src.extractRange(4, 10))).toBe(1);
      // Plage complète.
      expect(await pageCountOf(src.extractRange(0, 5))).toBe(5);
    } finally {
      src.close();
    }
  });
});
