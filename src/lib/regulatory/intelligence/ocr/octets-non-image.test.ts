import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { estUneImage } from "./ocr-engine";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SIX OCTETS QUI ARRÊTAIENT LE SERVEUR.
 *
 * ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────────────────────────
 *
 * Une archive contenant « photo.bmp » = `BM????` (six octets). `sharp` refuse : il ne reconnaît
 * pas l'en-tête. Le code disait alors « pré-traitement best-effort : on OCR l'image brute si
 * sharp échoue » et passait ces octets à Tesseract. Or Tesseract ne se contente pas de rejeter
 * sa promesse — son worker Node ÉMET un événement `error`, et un `error` sans écouteur est une
 * exception non rattrapée : le processus s'arrête. Vitest l'a vu (« Errors 1 error ») sur un
 * test dont les quatre assertions passaient : le crash arrivait APRÈS.
 *
 * En production, cela se déclenche par le geste le plus banal du produit : quelqu'un dépose une
 * archive, ou — depuis que les images sont acceptées à l'import du corpus — un fichier
 * légèrement corrompu.
 *
 * ── CE QUI FERAIT TOMBER CE TEST ────────────────────────────────────────────────────────
 *
 * Retirer la garde et redonner les octets bruts au moteur. Le premier test tombe sur le fond ;
 * le second tombe sur le POINT D'APPEL, parce qu'une garde écrite mais débranchée est du code
 * mort couvert par ses tests (§118.49).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("des octets qui ne sont pas une image ne vont JAMAIS au moteur", () => {
  it("reconnaît un vrai PNG et refuse ce qui n'en est pas un", async () => {
    const sharp = (await import("sharp")).default;
    const vrai = await sharp({
      create: { width: 12, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    expect(await estUneImage(vrai)).toBe(true);
    expect(await estUneImage(Buffer.from("BM????")), "six octets « BM » passent pour un bitmap").toBe(false);
    expect(await estUneImage(Buffer.from("%PDF-1.4 ceci est un PDF"))).toBe(false);
    expect(await estUneImage(Buffer.alloc(0))).toBe(false);
  });

  it("la garde est BRANCHÉE dans la boucle de reconnaissance", async () => {
    const code = await readFile("src/lib/regulatory/intelligence/ocr/ocr-engine.ts", "utf8");
    const boucle = code.slice(code.indexOf("const recognizeOne"), code.indexOf("await worker.recognize"));
    expect(boucle, "le pré-traitement retombe sur les octets bruts sans vérifier que c'en est une image")
      .toContain("estUneImage(raw)");
  });
});
