import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { docxToPdf, pdfFileName, isConvertibleWord } from "./to-pdf";
import { readDocxBlocks } from "./docx-blocks";

/**
 * On FABRIQUE un `.docx` minimal mais réel — un vrai ZIP, un vrai `word/document.xml` — plutôt
 * que de simuler la lecture. C'est la seule façon de vérifier que la chaîne complète tient :
 * ouverture du ZIP, analyse XML, ordre des blocs, rendu PDF.
 */
function docx(corps: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corps}</w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer" });
}

const para = (texte: string, opts: { bold?: boolean; align?: string; style?: string } = {}) =>
  `<w:p>${opts.align || opts.style ? `<w:pPr>${opts.style ? `<w:pStyle w:val="${opts.style}"/>` : ""}${opts.align ? `<w:jc w:val="${opts.align}"/>` : ""}</w:pPr>` : ""}<w:r>${opts.bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${texte}</w:t></w:r></w:p>`;

const cellule = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
const ligne = (...cs: string[]) => `<w:tr>${cs.map(cellule).join("")}</w:tr>`;
const tableau = (...ls: string[]) => `<w:tbl>${ls.join("")}</w:tbl>`;

describe("lire un .docx dans l'ordre du document", () => {
  it("l'ORDRE est conservé — un pied de page ne remonte pas au-dessus du tableau", () => {
    // C'est toute la raison d'être de ce lecteur : le modèle d'ÉDITION range les tableaux dans
    // une liste séparée, ce qui perd « qui vient avant quoi ».
    const c = readDocxBlocks(docx(
      para("Bulletin de paie — août 2026") +
      tableau(ligne("Libellé", "Montant"), ligne("Salaire de base", "187 450,00")) +
      para("Net à payer : 142 300,00 DZD"),
    ));
    expect(c.blocks.map((b) => b.kind)).toEqual(["paragraph", "table", "paragraph"]);
  });

  it("les fragments, leur graisse et l'alignement sont lus", () => {
    const c = readDocxBlocks(docx(para("Titre centré", { bold: true, align: "center", style: "Heading1" })));
    const p = c.blocks[0];
    expect(p.kind).toBe("paragraph");
    if (p.kind !== "paragraph") return;
    expect(p.runs[0].text).toBe("Titre centré");
    expect(p.runs[0].bold).toBe(true);
    expect(p.align).toBe("center");
    expect(p.heading).toBe(true);
  });

  it("les cellules d'un tableau arrivent ligne par ligne", () => {
    const c = readDocxBlocks(docx(tableau(ligne("A", "B", "C"), ligne("1", "2", "3"))));
    const t = c.blocks[0];
    expect(t.kind).toBe("table");
    if (t.kind !== "table") return;
    expect(t.rows).toEqual([["A", "B", "C"], ["1", "2", "3"]]);
  });

  it("les paragraphes vides CONSÉCUTIFS se réduisent, mais un espace voulu survit", () => {
    // Tout supprimer collerait le tableau sous le titre ; tout garder produirait des pages
    // blanches sur les documents générés par un traitement de texte.
    const c = readDocxBlocks(docx(para("A") + "<w:p/><w:p/><w:p/>" + para("B")));
    expect(c.blocks).toHaveLength(3);
  });

  it("un fichier qui n'est pas un .docx LÈVE — l'appelant garde alors l'original", () => {
    expect(() => readDocxBlocks(Buffer.from("ceci n'est pas un zip"))).toThrow();
  });
});

describe("convertir en PDF", () => {
  it("produit un PDF valide, avec ses pages", async () => {
    const r = await docxToPdf(docx(
      para("Bulletin de paie — août 2026", { bold: true, style: "Heading1" }) +
      para("Salarié : Amine Djouamaï") +
      tableau(
        ligne("Libellé", "Base", "Taux", "Montant"),
        ligne("Salaire de base", "173,33", "1 082,00", "187 450,00"),
        ligne("Cotisations", "", "9,00 %", "-16 870,50"),
      ) +
      para("Net à payer : 170 579,50 DZD", { bold: true }),
    ));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // L'entête d'un PDF, et un contenu qui n'est pas une page vide.
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.pdf.length).toBeGreaterThan(1000);
    expect(r.pages).toBeGreaterThanOrEqual(1);
  });

  it("les ACCENTS et les montants français survivent", async () => {
    const r = await docxToPdf(docx(para("Rémunération brute : 187 450,00 DZD — é è ê à ç ù")));
    expect(r.ok).toBe(true);
  });

  it("un document long produit PLUSIEURS pages sans boucler", async () => {
    const lignes = Array.from({ length: 120 }, (_, i) => ligne(`Ligne ${i + 1}`, `${i * 1000},00`));
    const r = await docxToPdf(docx(tableau(ligne("Libellé", "Montant"), ...lignes)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages).toBeGreaterThan(1);
  });

  it("NE LÈVE JAMAIS — payer un salarié passe avant le format de son bulletin", async () => {
    // Un fichier illisible rend un échec explicite ; l'appelant garde alors l'original et la
    // paie suit son cours.
    const r = await docxToPdf(Buffer.from("pas un docx du tout"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(10);
  });

  it("un document VIDE est un échec, pas un PDF blanc", async () => {
    const r = await docxToPdf(docx(""));
    expect(r.ok).toBe(false);
  });
});

describe("nommage et éligibilité", () => {
  it("le PDF garde le nom du Word", () => {
    expect(pdfFileName("Bulletin août 2026.docx")).toBe("Bulletin août 2026.pdf");
    expect(pdfFileName("sans-extension")).toBe("sans-extension.pdf");
  });

  it("seul le .docx est convertible — le vieux .doc binaire ne l'est pas", () => {
    const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(isConvertibleWord("b.docx", null)).toBe(true);
    expect(isConvertibleWord("b", MIME)).toBe(true);
    expect(isConvertibleWord("b.doc", "application/msword")).toBe(false);
    expect(isConvertibleWord("b.pdf", "application/pdf")).toBe(false);
  });
});
