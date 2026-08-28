/**
 * LA FIDÉLITÉ (§44) — « une petite modification ne doit pas détruire styles, images, tableaux,
 * en-têtes, formules, graphiques, masques ».
 *
 * Ce fichier est le garde-fou de la décision d'architecture centrale : l'arbre XML qui garde sa
 * tranche de source. Il vérifie deux choses différentes, et les deux comptent :
 *
 *   1. CE QU'ON NE TOUCHE PAS EST RECOPIÉ À L'IDENTIQUE. Pas « ressemble à », pas « toujours
 *      ouvrable » : IDENTIQUE, octet pour octet, au niveau de la pièce XML.
 *   2. CE QU'ON TOUCHE CHANGE, ET SEULEMENT CELA.
 *
 * Sans (1), la régression est indétectable : le fichier s'ouvre, il a juste perdu son en-tête.
 */

import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { adaptateurXlsx } from "@/lib/artifact/adapters/xlsx/adapter";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { commande, cibleIndex, cibleRole } from "@/lib/artifact/commands/ir";
import type { DocxModel, PptxModel, XlsxModel } from "@/lib/artifact/object-model/model";
import { docxDeParagraphes, pptxDiapos, xlsxVentes } from "@/lib/artifact/adapters/fixtures";

/** Les pièces d'un ZIP OOXML, texte par texte — la granularité à laquelle la fidélité se juge. */
function pieces(octets: Buffer): Map<string, string> {
  const zip = new PizZip(octets);
  const out = new Map<string, string>();
  for (const nom of Object.keys(zip.files)) {
    const f = zip.files[nom];
    if (f.dir) continue;
    out.set(nom, f.asText());
  }
  return out;
}

describe("fidélité Word", () => {
  it("changer l'alignement du titre ne touche QUE document.xml", async () => {
    const avant = await docxDeParagraphes(["Contrat", "Article 1", "Article 2"], {
      premierEstTitre: true, tableau: [["Poste", "Montant"], ["Conseil", "120 000"]],
    });
    const doc = await adaptateurDocx.ouvrir(avant);
    expect(doc.appliquer(commande("docx.align", { cible: cibleRole("titre"), alignement: "center" })).ok).toBe(true);
    const apres = await doc.serialiser();

    const a = pieces(avant);
    const b = pieces(apres);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [nom, contenu] of a) {
      if (nom === "word/document.xml") continue;
      // styles.xml, les relations, [Content_Types].xml : intacts, caractère pour caractère.
      expect(b.get(nom), `${nom} a été modifié alors qu'on n'y a pas touché`).toBe(contenu);
    }
    expect(b.get("word/document.xml")).not.toBe(a.get("word/document.xml"));
  });

  it("le tableau, le sectPr et les autres paragraphes survivent mot pour mot", async () => {
    const avant = await docxDeParagraphes(["Titre", "Alpha", "Bravo"], { tableau: [["A", "B"], ["C", "D"]] });
    const doc = await adaptateurDocx.ouvrir(avant);
    doc.appliquer(commande("docx.format_texte", { cible: cibleIndex(1), taillePt: 16, police: "Aptos" }));
    const apres = await doc.serialiser();

    const xml = pieces(apres).get("word/document.xml")!;
    // Le tableau est recopié tel quel : sa signature d'origine se retrouve dans la sortie.
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>');
    for (const cellule of ["A", "B", "C", "D"]) {
      expect(xml).toContain(`<w:t xml:space="preserve">${cellule}</w:t>`);
    }
    const relu = await adaptateurDocx.ouvrir(apres);
    const m = relu.modele() as DocxModel;
    expect(m.tables).toHaveLength(1);
    expect(m.tables[0].header).toEqual(["A", "B"]);
    expect(m.paragraphs.map((p) => p.text)).toEqual(["Titre", "Alpha", "Bravo"]);
    expect(m.paragraphs[0].style.sizePt).toBe(16);
    expect(m.paragraphs[0].style.font).toBe("Aptos");
    // Les AUTRES paragraphes n'ont pas hérité de la mise en forme du titre.
    expect(m.paragraphs[1].style.sizePt).toBeNull();
  });

  it("la mise en page (format de page, marges) traverse la modification", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(["A", "B"]));
    const avant = doc.modele() as DocxModel;
    doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) }));
    const relu = await adaptateurDocx.ouvrir(await doc.serialiser());
    const apres = relu.modele() as DocxModel;
    expect(apres.pageWidthCm).toBeCloseTo(avant.pageWidthCm, 2);
    expect(apres.marginLeftCm).toBeCloseTo(avant.marginLeftCm, 2);
  });
});

describe("fidélité Excel", () => {
  it("écrire une cellule ne touche QUE la feuille concernée", async () => {
    const avant = await xlsxVentes();
    const doc = await adaptateurXlsx.ouvrir(avant);
    expect(doc.appliquer(commande("xlsx.valeur", { feuille: "Ventes", plage: "B3", texte: "Tlemcen" })).ok).toBe(true);
    const apres = await doc.serialiser();

    const a = pieces(avant);
    const b = pieces(apres);
    // La feuille « Notes » n'a pas été effleurée. C'est exactement ce qu'ExcelJS ne garantit pas :
    // il ré-imprime tout le classeur.
    const feuilleNotes = [...a.keys()].find((k) => /worksheets\/sheet2/.test(k));
    if (feuilleNotes) expect(b.get(feuilleNotes)).toBe(a.get(feuilleNotes));
    expect(b.get("xl/sharedStrings.xml")).toBe(a.get("xl/sharedStrings.xml"));
  });

  it("la formule de total et les autres cellules survivent", async () => {
    const doc = await adaptateurXlsx.ouvrir(await xlsxVentes());
    doc.appliquer(commande("xlsx.format", { feuille: "Ventes", plage: "A1:C1", gras: true, remplissage: "1B7F79" }));
    const relu = await adaptateurXlsx.ouvrir(await doc.serialiser());
    const m = relu.modele() as XlsxModel;
    const cel = (r: string) => m.sheets[0].cells.find((c) => c.ref === r);
    expect(cel("C6")?.formula).toBe("=SUM(C2:C5)");
    expect(cel("A2")?.value).toBe("Amoxival");
    expect(m.sheets.map((s) => s.name)).toEqual(["Ventes", "Notes"]);
    expect(m.sheets[1].cells.find((c) => c.ref === "A1")?.value).toBe("Rien à signaler");
  });

  it("mettre UNE cellule en gras ne met pas en gras celles qui partageaient son style", async () => {
    const doc = await adaptateurXlsx.ouvrir(await xlsxVentes());
    doc.appliquer(commande("xlsx.format", { feuille: "Ventes", plage: "A2", gras: true }));
    const relu = await adaptateurXlsx.ouvrir(await doc.serialiser());
    const m = relu.modele() as XlsxModel;
    const cel = (r: string) => m.sheets[0].cells.find((c) => c.ref === r);
    expect(cel("A2")?.style.bold).toBe(true);
    // A3 partageait l'index de style d'A2 : sans dérivation de `xf`, elle serait devenue grasse.
    expect(cel("A3")?.style.bold).toBe(false);
  });
});

describe("fidélité PowerPoint", () => {
  it("changer un texte ne touche QUE sa diapositive — le masque et le thème sont intacts", async () => {
    const avant = await pptxDiapos(3);
    const doc = await adaptateurPptx.ouvrir(avant);
    expect(doc.appliquer(commande("pptx.texte", { diapo: 2, cible: cibleRole("premier"), texte: "Résultats 2026" })).ok).toBe(true);
    const apres = await doc.serialiser();

    const a = pieces(avant);
    const b = pieces(apres);
    for (const [nom, contenu] of a) {
      if (/^ppt\/slides\/slide2\.xml$/.test(nom)) continue;
      expect(b.get(nom), `${nom} a été modifié alors qu'on n'y a pas touché`).toBe(contenu);
    }
    expect([...b.keys()].some((k) => /^ppt\/slideMasters\//.test(k))).toBe(true);
  });

  it("déplacer une forme laisse les autres diapositives et les autres formes en place", async () => {
    const doc = await adaptateurPptx.ouvrir(await pptxDiapos(3));
    const avant = doc.modele() as PptxModel;
    const corpsAvant = avant.slides[0].shapes[1];
    doc.appliquer(commande("pptx.deplacer", { diapo: 1, cible: cibleIndex(1), dxCm: -1.5 }));

    const relu = await adaptateurPptx.ouvrir(await doc.serialiser());
    const apres = relu.modele() as PptxModel;
    expect(apres.slides).toHaveLength(3);
    expect(apres.slides[0].shapes[0].xCm).toBeCloseTo(avant.slides[0].shapes[0].xCm - 1.5, 2);
    expect(apres.slides[0].shapes[1].xCm).toBeCloseTo(corpsAvant.xCm, 3);
    expect(apres.slides[1].shapes[0].text).toBe(avant.slides[1].shapes[0].text);
    expect(await relu.valider()).toEqual({ ok: true, problemes: [] });
  });
});
