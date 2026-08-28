/**
 * LES DOCUMENTS D'ESSAI — de VRAIS fichiers, fabriqués par les mêmes bibliothèques que la
 * production, jamais des octets bidons.
 *
 * Un test qui part d'un `.docx` fabriqué à la main avec trois balises ne prouve rien : il ne
 * contient ni styles, ni sectPr, ni relations, donc il ne peut pas révéler les défauts qui
 * cassent les vrais fichiers. Ceux-ci sont produits par PizZip, ExcelJS, pptxgenjs et MuPDF —
 * les mêmes que celles qui écrivent les livrables de l'ERP — et s'ouvrent réellement dans Word,
 * Excel et PowerPoint.
 *
 * Ce module n'est PAS un module de test (`.test.ts`) : il est importé par plusieurs suites et
 * par le banc de performance.
 */

import PizZip from "pizzip";
import ExcelJS from "exceljs";
import { chargerMupdf } from "@/lib/artifact/adapters/pdf/adapter";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface OptionsDocx {
  /** Un tableau, ajouté après les paragraphes. */
  tableau?: string[][];
  /** Taille de police du premier paragraphe, en points. */
  taillePremierPt?: number;
  /** Le premier paragraphe reçoit le style `Heading1` — c'est ainsi qu'on désigne « le titre ». */
  premierEstTitre?: boolean;
}

/** Un `.docx` réel : styles, sectPr, relations, et le contenu demandé. */
export async function docxDeParagraphes(textes: string[], opts: OptionsDocx = {}): Promise<Buffer> {
  const p = (t: string, i: number) => {
    const props: string[] = [];
    if (i === 0 && opts.premierEstTitre) props.push(`<w:pStyle w:val="Heading1"/>`);
    const rPr = i === 0 && opts.taillePremierPt
      ? `<w:rPr><w:sz w:val="${Math.round(opts.taillePremierPt * 2)}"/></w:rPr>`
      : "";
    return `<w:p>${props.length ? `<w:pPr>${props.join("")}</w:pPr>` : ""}<w:r>${rPr}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  };
  const tbl = opts.tableau
    ? `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${opts.tableau
        .map((ligne) => `<w:tr>${ligne.map((c) => `<w:tc><w:tcPr/><w:p><w:r><w:t xml:space="preserve">${esc(c)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`)
        .join("")}</w:tbl><w:p/>`
    : "";

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${textes.map(p).join("")}${tbl}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr></w:body></w:document>`;

  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.folder("_rels")!.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const word = zip.folder("word")!;
  word.file("document.xml", document);
  word.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style></w:styles>`);
  word.folder("_rels")!.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** Un PDF de `n` pages, chacune portant « Page k » — c'est ce qui rend les rangs VÉRIFIABLES. */
export async function pdfNumerote(n: number): Promise<Buffer> {
  const mupdf = await chargerMupdf();
  const doc = new mupdf.PDFDocument();
  const police = doc.addSimpleFont(new mupdf.Font("Helvetica"));
  for (let i = 1; i <= n; i += 1) {
    const page = doc.addPage([0, 0, 595, 842], 0, { Font: { F1: police } }, `BT /F1 42 Tf 60 700 Td (Page ${i}) Tj ET`);
    doc.insertPage(-1, page);
  }
  return Buffer.from(doc.saveToBuffer("compress").asUint8Array());
}

/** Un classeur réel : en-tête en gras, quatre lignes de données, un total en formule. */
export async function xlsxVentes(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ventes");
  ws.columns = [{ header: "Produit", width: 20 }, { header: "Wilaya", width: 14 }, { header: "Montant", width: 14 }];
  ws.getRow(1).font = { bold: true };
  for (const r of [["Amoxival", "Alger", 120000], ["Betacor", "Oran", 90000], ["Cardiplus", "Constantine", 250000], ["Dolexan", "Annaba", 45000]]) {
    ws.addRow(r);
  }
  ws.getCell("C6").value = { formula: "SUM(C2:C5)", result: 505000 };
  const notes = wb.addWorksheet("Notes");
  notes.getCell("A1").value = "Rien à signaler";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Une présentation réelle, avec masque, titre et corps sur chaque diapositive. */
export async function pptxDiapos(n = 4): Promise<Buffer> {
  const { default: pptxgen } = await import("pptxgenjs");
  const p = new pptxgen();
  p.defineSlideMaster({ title: "AMD", background: { color: "FFFFFF" } });
  for (let i = 1; i <= n; i += 1) {
    const s = p.addSlide({ masterName: "AMD" });
    s.addText(`Diapositive ${i}`, { x: 1, y: 0.6, w: 8, h: 1, fontSize: 32, bold: true, color: "0B2545" });
    s.addText(`Contenu de la diapositive ${i}`, { x: 1, y: 2, w: 8, h: 1.2, fontSize: 18 });
  }
  return (await p.write({ outputType: "nodebuffer" })) as Buffer;
}
