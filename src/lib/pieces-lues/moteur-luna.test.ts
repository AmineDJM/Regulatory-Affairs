import { describe, expect, it } from "vitest";
import { moteurLuna } from "@/lib/pieces-lues/moteur-luna";
import type { MoteurOcr } from "@/lib/regulatory/intelligence/extract/texte-ou-ocr";

const local: MoteurOcr = async () => ({ text: "LOCAL", meanConfidence: 80, needsReview: false, pageCount: 1, moteur: "local" });
const repondre = (data: unknown, ok = true) => (async () => ({ ok, data, usage: {} })) as never;

describe("Luna lit les scans, le moteur local ne fait que le relais (§118.200)", () => {
  it("une image se lit par Luna — l'image part, le texte revient, la méthode le dit", async () => {
    let images = 0;
    const m = moteurLuna(local, { configure: () => true, appeler: (async (i: { images?: unknown[] }) => { images = i.images?.length ?? 0; return { ok: true, data: { texte: "Fiche | 10 | 500", lisibilite: "bonne" }, usage: {} }; }) as never });
    const r = await m({ ext: "png", buffer: Buffer.from("x") });
    expect(images).toBe(1);
    expect(r.text).toBe("Fiche | 10 | 500");
    expect(r.moteur).toMatch(/^luna:/);
  });
  it("un PDF scanné part page par page", async () => {
    let images = 0;
    const m = moteurLuna(local, { configure: () => true, pages: (async () => ({ pages: [Buffer.from("a"), Buffer.from("b")], total: 3, failedPages: 0 })) as never,
      appeler: (async (i: { images?: unknown[] }) => { images = i.images?.length ?? 0; return { ok: true, data: { texte: "t", lisibilite: "partielle" }, usage: {} }; }) as never });
    const r = await m({ ext: "pdf", buffer: Buffer.from("x"), maxPages: 2 });
    expect(images).toBe(2);
    expect([r.pagesLues, r.pageCount, r.needsReview]).toEqual([2, 3, true]);
  });
  it("Luna absente, en panne ou muette : le moteur local prend le relais", async () => {
    expect((await moteurLuna(local, { configure: () => false, appeler: repondre({ texte: "L", lisibilite: "bonne" }) })({ ext: "png", buffer: Buffer.from("x") })).text).toBe("LOCAL");
    expect((await moteurLuna(local, { configure: () => true, appeler: repondre(null, false) })({ ext: "png", buffer: Buffer.from("x") })).text).toBe("LOCAL");
    expect((await moteurLuna(local, { configure: () => true, appeler: (async () => { throw new Error("x"); }) as never })({ ext: "jpg", buffer: Buffer.from("x") })).text).toBe("LOCAL");
  });
});

import { readFileSync } from "node:fs";
describe("le service confie un scan à Luna, et jamais une pièce confidentielle (point d'appel, §118.49)", () => {
  const src = readFileSync("src/lib/pieces-lues/service.ts", "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  it("Luna seulement si la pièce peut sortir ET que la lecture par l'IA est ouverte", () => {
    expect(src).toMatch(/const parLuna = contexte\.sortieCloudPermise && \(await disponibiliteLecturePieces\(\)\)\.disponible;/);
    expect(src).toMatch(/parLuna \? \{ ocr: moteurLuna\(moteurParDefaut\) \} : \{\}/);
  });
});
