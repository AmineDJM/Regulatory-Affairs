import { describe, expect, it } from "vitest";
import { chercherDansPdf, extrairePages, lireTextePdf, plagePages, planPdf } from "@/lib/artifact/pdf/read";
import { pdfNumerote } from "@/lib/artifact/adapters/fixtures";
import { chargerMupdf } from "@/lib/artifact/adapters/pdf/adapter";

describe("lire un PDF page par page", () => {
  it("interprète une plage humaine et la borne", () => {
    expect(plagePages("12-15", 500, 40)).toEqual({ pages: [12, 13, 14, 15], tronque: false });
    expect(plagePages("3, 5 ; 9", 500, 40)).toEqual({ pages: [3, 5, 9], tronque: false });
    expect(plagePages([2, 1, 999], 10, 40)).toEqual({ pages: [1, 2], tronque: false });
    expect(plagePages(null, 500, 40).pages).toHaveLength(40);
    expect(plagePages(null, 500, 40).tronque).toBe(true);
    expect(plagePages("1-3", 2, 40)).toEqual({ pages: [1, 2], tronque: false });
  });

  it("extrait le texte natif des pages demandées d'un PDF de 500 pages, vite", async () => {
    const octets = await pdfNumerote(500);
    const t = performance.now();
    const l = await lireTextePdf(octets, { pages: "498-500" });
    expect(l.total).toBe(500);
    expect(l.pages.map((p) => [p.n, p.texte, p.methode])).toEqual([[498, "Page 498", "natif"], [499, "Page 499", "natif"], [500, "Page 500", "natif"]]);
    expect(l.sansTexte).toEqual([]);
    const tout = await lireTextePdf(octets, { pages: null, max: 500 });
    expect(tout.pages).toHaveLength(500);
    expect(tout.pages[123].texte).toBe("Page 124");
    expect(performance.now() - t).toBeLessThan(15_000);
  });

  it("cherche dans tout le document, accents repliés, avec la page et un extrait", async () => {
    const octets = await pdfNumerote(300);
    const r = await chercherDansPdf(octets, "PAGE 217");
    expect(r.pagesTouchees).toEqual([217]);
    expect(r.occurrences).toEqual([{ page: 217, extrait: "Page 217" }]);
    expect(r.total).toBe(300);
    const large = await chercherDansPdf(octets, "page 2", { max: 5 });
    expect(large.occurrences).toHaveLength(5);
    expect(large.tronque).toBe(true);
    expect(large.pagesTouchees[0]).toBe(2); // « Page 2 », puis « Page 20 »…
    expect((await chercherDansPdf(octets, "introuvable")).occurrences).toEqual([]);
  });

  it("nomme les pages SANS texte au lieu de les inventer, et sait les extraire seules", async () => {
    // Une page blanche (aucun texte) au milieu de pages pleines.
    const mupdf = await chargerMupdf();
    const doc = new mupdf.PDFDocument();
    const police = doc.addSimpleFont(new mupdf.Font("Helvetica"));
    for (let i = 1; i <= 4; i++) {
      const page = doc.addPage([0, 0, 595, 842], 0, { Font: { F1: police } }, i === 3 ? "" : `BT /F1 24 Tf 60 700 Td (Texte ${i}) Tj ET`);
      doc.insertPage(-1, page);
    }
    const octets = Buffer.from(doc.saveToBuffer("compress").asUint8Array());
    const l = await lireTextePdf(octets);
    expect(l.sansTexte).toEqual([3]);
    expect(l.pages[2]).toMatchObject({ n: 3, texte: "", methode: "vide" });
    const sous = await extrairePages(octets, [3, 1]);
    const relu = await lireTextePdf(sous);
    expect(relu.total).toBe(2);
    expect(relu.pages.map((p) => p.texte)).toEqual(["", "Texte 1"]);
    expect((await planPdf(octets)).entrees).toEqual([]);
  });
});
