/**
 * LE CONTRÔLE QUALITÉ VISUEL (§26-27) — ce qu'il voit, ce qu'il TAIT, et pourquoi.
 *
 * La moitié des cas ici vérifient le SILENCE. Un contrôle qui signale un défaut sur un document
 * normal est pire qu'inutile : au bout de trois faux positifs, personne ne lit plus les alertes,
 * et la vraie passe inaperçue. Chaque « aucune alerte » est donc un test à part entière.
 */

import { describe, it, expect } from "vitest";
import { controlerVisuel, proportionsInitiales } from "@/lib/artifact/qa/checks";
import type { DocxModel, PdfModel, PptxModel, XlsxModel } from "@/lib/artifact/object-model/model";
import { STYLE_NEUTRE } from "@/lib/artifact/object-model/model";

const docx = (p: Partial<DocxModel>): DocxModel => ({
  kind: "DOCX", paragraphs: [], tables: [], images: [],
  pageWidthCm: 21, pageHeightCm: 29.7,
  marginTopCm: 2.5, marginBottomCm: 2.5, marginLeftCm: 2.5, marginRightCm: 2.5,
  hasHeader: false, hasFooter: false, pages: 1, paginationSource: "estimee", plan: [], ...p,
});

const para = (index: number, text: string, style: Partial<typeof STYLE_NEUTRE> = {}, styleName: string | null = null) => ({
  id: `p${index}`, index, text, alignment: null, styleName,
  style: { ...STYLE_NEUTRE, ...style }, runs: [],
  indentLeftCm: null, indentRightCm: null, spacingBeforePt: null, spacingAfterPt: null,
  inTable: false, images: [], page: null, headingLevel: null,
});

const forme = (i: number, o: Partial<PptxModel["slides"][0]["shapes"][0]>) => ({
  id: `s1.sh${i}`, index: i, name: `Forme ${i}`, xCm: 1, yCm: 1, widthCm: 5, heightCm: 2,
  text: "", style: { ...STYLE_NEUTRE }, alignment: null, role: "text" as const, ...o,
});

const pptx = (formes: ReturnType<typeof forme>[]): PptxModel => ({
  kind: "PPTX", slideWidthCm: 25.4, slideHeightCm: 14.3,
  slides: [{ id: "s1", index: 1, title: "", shapes: formes }],
});

describe("Word", () => {
  it("un document normal ne déclenche AUCUNE alerte", () => {
    const m = docx({
      paragraphs: [para(1, "Contrat", { sizePt: 20 }, "Heading1"), para(2, "Le présent contrat…", { sizePt: 11 })],
      tables: [{ id: "t1", index: 1, rows: 2, cols: 2, header: ["A", "B"], cells: [
        { id: "t1.r1.c1", row: 1, col: 1, text: "A" }, { id: "t1.r1.c2", row: 1, col: 2, text: "B" },
        { id: "t1.r2.c1", row: 2, col: 1, text: "C" }, { id: "t1.r2.c2", row: 2, col: 2, text: "D" },
      ] }],
    });
    expect(controlerVisuel(m)).toEqual([]);
  });

  it("un TITRE trop long à sa taille est signalé", () => {
    const long = "Contrat de prestation de services de conseil réglementaire pour l'ensemble du portefeuille";
    const m = docx({ paragraphs: [para(1, long, { sizePt: 28 }, "Heading1")] });
    expect(controlerVisuel(m).join(" ")).toMatch(/ne tient probablement pas sur une ligne/);
  });

  it("un PARAGRAPHE de corps long n'est PAS signalé — il passe simplement à la ligne", () => {
    const long = "Le présent contrat a pour objet la prestation de conseil réglementaire assurée par le consultant, dans les conditions décrites en annexe et pour la durée convenue entre les parties.";
    expect(controlerVisuel(docx({ paragraphs: [para(1, "Titre", { sizePt: 20 }, "Heading1"), para(2, long, { sizePt: 11 })] }))).toEqual([]);
  });

  it("un document vidé de tout contenu est signalé AVANT la sauvegarde", () => {
    expect(controlerVisuel(docx({})).join(" ")).toMatch(/ne contient plus aucun contenu/);
  });

  it("un tableau aux lignes inégales — signe d'une insertion ratée — est signalé", () => {
    const m = docx({
      paragraphs: [para(1, "Titre")],
      tables: [{ id: "t1", index: 1, rows: 2, cols: 2, header: ["A", "B"], cells: [
        { id: "t1.r1.c1", row: 1, col: 1, text: "A" }, { id: "t1.r1.c2", row: 1, col: 2, text: "B" },
        { id: "t1.r2.c1", row: 2, col: 1, text: "C" },
      ] }],
    });
    expect(controlerVisuel(m).join(" ")).toMatch(/lignes de largeurs différentes/);
  });

  it("une image DÉFORMÉE par rapport à ses proportions d'origine est signalée", () => {
    const avant = docx({ paragraphs: [para(1, "T")], images: [{ id: "img1", index: 1, widthCm: 8, heightCm: 6, description: null }] });
    const ref = proportionsInitiales(avant);
    expect(ref.img1).toBeCloseTo(8 / 6, 3);

    // Étirée en largeur sans toucher la hauteur : le rapport passe de 1,33 à 2,0.
    const apres = docx({ paragraphs: [para(1, "T")], images: [{ id: "img1", index: 1, widthCm: 12, heightCm: 6, description: null }] });
    expect(controlerVisuel(apres, ref).join(" ")).toMatch(/déformée/);

    // Redimensionnée EN GARDANT le rapport : rien à signaler.
    const propre = docx({ paragraphs: [para(1, "T")], images: [{ id: "img1", index: 1, widthCm: 4, heightCm: 3, description: null }] });
    expect(controlerVisuel(propre, ref)).toEqual([]);
  });
});

describe("PowerPoint", () => {
  it("une forme qui DÉPASSE du cadre est signalée — sinon elle disparaît à la projection", () => {
    const m = pptx([forme(1, { xCm: 22, widthCm: 8 })]);
    expect(controlerVisuel(m).join(" ")).toMatch(/dépasse du cadre/);
  });

  it("une forme poussée hors cadre par la gauche est signalée aussi", () => {
    expect(controlerVisuel(pptx([forme(1, { xCm: -2 })])).join(" ")).toMatch(/sort du cadre/);
  });

  it("deux formes qui se RECOUVRENT largement sont signalées", () => {
    const m = pptx([forme(1, { xCm: 2, yCm: 2, widthCm: 6, heightCm: 4 }), forme(2, { xCm: 2.3, yCm: 2.2, widthCm: 6, heightCm: 4 })]);
    expect(controlerVisuel(m).join(" ")).toMatch(/se recouvrent/);
  });

  it("deux formes côte à côte ne sont PAS signalées", () => {
    const m = pptx([forme(1, { xCm: 1, yCm: 1, widthCm: 5, heightCm: 3 }), forme(2, { xCm: 8, yCm: 1, widthCm: 5, heightCm: 3 })]);
    expect(controlerVisuel(m)).toEqual([]);
  });

  it("un texte trop long pour sa zone est signalé", () => {
    const m = pptx([forme(1, { widthCm: 4, heightCm: 1, style: { ...STYLE_NEUTRE, sizePt: 28 }, text: "Un titre bien trop long pour tenir dans une zone de quatre centimètres sur un" })]);
    expect(controlerVisuel(m).join(" ")).toMatch(/déborde de sa zone/);
  });
});

describe("PDF", () => {
  const pdf = (apercus: string[]): PdfModel => ({
    kind: "PDF", encrypted: false,
    pages: apercus.map((preview, i) => ({ id: `page${i + 1}`, index: i + 1, widthPt: 595, heightPt: 842, rotation: 0, preview })),
  });

  it("une page sans texte au milieu de pages pleines est signalée", () => {
    expect(controlerVisuel(pdf(["Page 1", "", "Page 3"])).join(" ")).toMatch(/sans texte : 2/);
  });

  it("un PDF ENTIÈREMENT scanné n'est PAS signalé — c'est sa nature, pas un défaut", () => {
    expect(controlerVisuel(pdf(["", "", ""]))).toEqual([]);
  });

  it("un PDF vidé de ses pages est signalé", () => {
    expect(controlerVisuel(pdf([])).join(" ")).toMatch(/aucune page/);
  });
});

describe("Excel", () => {
  const xlsx = (cellules: { ref: string; value: string; formula?: string | null }[]): XlsxModel => ({
    kind: "XLSX",
    sheets: [{
      id: "s1", index: 1, name: "Ventes", rows: 5, cols: 3, columnWidths: [],
      frozenRows: 0, frozenCols: 0, merges: [],
      cells: cellules.map((c) => ({
        id: `s1.${c.ref}`, ref: c.ref, row: 1, col: 1, value: c.value,
        formula: c.formula ?? null, numFmt: null, style: { ...STYLE_NEUTRE }, fill: null, align: null,
      })),
    }],
  });

  it("une cellule en erreur est remontée avec sa référence", () => {
    expect(controlerVisuel(xlsx([{ ref: "C6", value: "#REF!" }])).join(" ")).toMatch(/C6=#REF!/);
  });

  it("une référence circulaire est remontée", () => {
    expect(controlerVisuel(xlsx([{ ref: "C6", value: "0", formula: "=C6+1" }])).join(" ")).toMatch(/circulaire en C6/);
  });

  it("un classeur sain ne dit rien", () => {
    expect(controlerVisuel(xlsx([{ ref: "C6", value: "505000", formula: "=SUM(C2:C5)" }]))).toEqual([]);
  });
});
