import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { composerDocx, papierEnTeteDeDemonstration, paragraphe, tableau, vide } from "@/lib/artifact/factory/word";
import type { DocxModel } from "@/lib/artifact/object-model/model";

async function relire(octets: Buffer): Promise<DocxModel> {
  const doc = await adaptateurDocx.ouvrir(octets);
  return doc.modele() as DocxModel;
}

describe("le compositeur Word", () => {
  it("produit un paquet neuf que l'adaptateur rouvre : paragraphes, styles, tableau à colonnes fixes", async () => {
    const { octets, surPapierEnTete } = composerDocx({
      titre: "Essai", auteur: "Adam",
      blocs: [
        paragraphe("FACTURE N° FA-2026-0001", { style: "Titre" }),
        paragraphe([{ texte: "Client : " }, { texte: "Pharmacie Centrale", gras: true }], { alignement: "right" }),
        paragraphe("Ligne 1\nLigne 2"),
        tableau([["N°", "Désignation", "Total HT"], ["1", "Amoxicilline & Cie <1 g>", "25 000,00"]], {
          colonnes: [{ largeurCm: 1 }, { largeurCm: 10 }, { largeurCm: 3, alignement: "right" }], entete: true,
        }),
        vide(),
        tableau([[{ contenu: "TOTAL TTC", fusion: 2, gras: true }, "66 112,82"]], { colonnes: [{ largeurCm: 2 }, { largeurCm: 3 }, { largeurCm: 3, alignement: "right" }], position: "right" }),
      ],
    });
    expect(surPapierEnTete).toBe(false);
    const m = await relire(octets);
    expect(m.paragraphs[0].text).toBe("FACTURE N° FA-2026-0001");
    expect(m.paragraphs[0].styleName).toMatch(/Title/i);
    expect(m.paragraphs[1].text).toBe("Client : Pharmacie Centrale");
    expect(m.paragraphs[1].alignment).toBe("right");
    expect(m.tables).toHaveLength(2);
    expect(m.tables[0].header).toEqual(["N°", "Désignation", "Total HT"]);
    expect(m.tables[0].cells.find((c) => c.row === 2 && c.col === 2)?.text).toBe("Amoxicilline & Cie <1 g>");
    expect(m.tables[1].cells.map((c) => c.text)).toEqual(["TOTAL TTC", "66 112,82"]);
    expect(m.hasHeader).toBe(false);
    // Le XML est bien formé : PizZip le relit et les largeurs de grille sont fixes.
    const xml = new PizZip(octets).file("word/document.xml")!.asText();
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(xml).toContain('<w:gridCol w:w="5670"/>');
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
  });

  it("pose le contenu SUR le papier en-tête et conserve toutes les autres pièces à l'octet près", async () => {
    const base = papierEnTeteDeDemonstration("Adventum Pharma");
    const avant = new PizZip(base);
    const { octets, surPapierEnTete, piecesConservees } = composerDocx({
      base,
      blocs: [paragraphe("BON DE COMMANDE N° BC-2026-0003", { style: "Titre" }), paragraphe("Corps de la pièce.")],
    });
    expect(surPapierEnTete).toBe(true);
    const apres = new PizZip(octets);
    expect(piecesConservees).toEqual(expect.arrayContaining(["word/header1.xml", "word/footer1.xml", "word/media/image1.png", "word/styles.xml", "word/_rels/document.xml.rels"]));
    for (const nom of piecesConservees) {
      expect(Buffer.compare(avant.file(nom)!.asNodeBuffer(), apres.file(nom)!.asNodeBuffer()), `${nom} a changé`).toBe(0);
    }
    // Le corps est remplacé, le sectPr (qui référence l'en-tête et le pied) est intact.
    const xml = apres.file("word/document.xml")!.asText();
    expect(xml).not.toContain("Texte du modèle");
    expect(xml).toContain('<w:headerReference w:type="default" r:id="rId2"/>');
    expect(xml).toContain('<w:pgMar w:top="2268"');
    const m = await relire(octets);
    expect(m.hasHeader).toBe(true);
    expect(m.hasFooter).toBe(true);
    // Le paragraphe vide de fin (celui que Word exige après un tableau) ne compte pas : l'adaptateur
    // numérote à l'humaine, et personne ne « voit » ce paragraphe-là.
    expect(m.paragraphs.map((p) => p.text)).toEqual(["BON DE COMMANDE N° BC-2026-0003", "Corps de la pièce."]);
    expect(m.marginTopCm).toBeCloseTo(4, 1);
  });

  it("refuse un papier en-tête qui n'est pas un document Word", () => {
    const zip = new PizZip();
    zip.file("xl/workbook.xml", "<workbook/>");
    const faux = zip.generate({ type: "nodebuffer" }) as Buffer;
    expect(() => composerDocx({ base: faux, blocs: [paragraphe("x")] })).toThrow(/word\/document\.xml absent/);
  });
});
