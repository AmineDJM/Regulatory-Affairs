import PDFDocument from "pdfkit";
import { readDocxBlocks, type DocxBlock, type ParagraphBlock, type TableBlock } from "./docx-blocks";
import { columnWidths, effectiveSizePt, fontName, needsNewPage, BASE_SIZE_PT } from "./layout";

/**
 * CONVERTIR UN BULLETIN WORD EN PDF — sur le serveur, sans LibreOffice.
 *
 * ── CE QUE CETTE CONVERSION EST, ET CE QU'ELLE N'EST PAS ────────────────────────────────────
 *
 * Ce n'est PAS la conversion fidèle d'un traitement de texte. LibreOffice est absent de la cible
 * de déploiement (Render, `runtime: node`) — §104 l'avait mesuré — et `mupdf` n'expose pas
 * l'API de mise en page qui permettrait un rendu HTML. Il n'existe donc, ici, aucun chemin vers
 * une restitution au pixel près.
 *
 * Ce qu'on fait à la place : relire la STRUCTURE du document — ses paragraphes, leurs fragments
 * et leur graisse, leur alignement, et ses tableaux — et la REDESSINER proprement. Sur un
 * bulletin de paie, c'est ce qui compte : les libellés, les colonnes, les montants et les totaux
 * arrivent intacts et alignés. Ce qui se perd est décoratif : couleurs de trame, bordures fines,
 * logos, en-têtes et pieds de page.
 *
 * ── POURQUOI L'ORIGINAL EST CONSERVÉ ────────────────────────────────────────────────────────
 *
 * Parce que la phrase précédente est une promesse que seul l'œil d'un humain peut vérifier. Le
 * `.docx` de départ reste donc attaché à la paie, invisible du salarié : si le PDF trahit le
 * bulletin, les ressources humaines récupèrent la source sans avoir à la redemander. Une
 * conversion qui détruit son entrée est une conversion qu'on ne peut plus contredire.
 */

/** Résultat d'une conversion — jamais une exception jusqu'à l'appelant. */
export type PdfConversion =
  | { ok: true; pdf: Buffer; pages: number }
  | { ok: false; error: string };

const MARGE_MIN_PT = 28;
const INTERLIGNE = 1.25;
const PADDING_CELLULE = 4;

function dessinerParagraphe(doc: PDFKit.PDFDocument, p: ParagraphBlock, largeur: number): void {
  if (p.runs.length === 0) { doc.moveDown(0.5); return; }
  const taille = effectiveSizePt(p.runs[0], p.heading);
  doc.fontSize(taille);
  // LES FRAGMENTS S'ENCHAÎNENT SUR LA MÊME LIGNE. `continued` garde le curseur en place : sans
  // lui, « Salaire de base : » et « 187 450,00 DZD » — deux fragments parce que le second est en
  // gras — tomberaient sur deux lignes, et le bulletin deviendrait illisible.
  p.runs.forEach((run, i) => {
    const dernier = i === p.runs.length - 1;
    doc
      .font(fontName(run, p.heading))
      .fontSize(effectiveSizePt(run, p.heading))
      .text(run.text, { width: largeur, align: p.align, continued: !dernier });
  });
  doc.moveDown(0.3);
}

function hauteurLigne(doc: PDFKit.PDFDocument, cellules: string[], largeurs: number[]): number {
  let h = 0;
  cellules.forEach((texte, i) => {
    const w = (largeurs[i] ?? 0) - PADDING_CELLULE * 2;
    if (w <= 0) return;
    h = Math.max(h, doc.heightOfString(texte || " ", { width: w }));
  });
  return h + PADDING_CELLULE * 2;
}

function dessinerTableau(doc: PDFKit.PDFDocument, t: TableBlock, gauche: number, largeur: number): void {
  if (t.rows.length === 0) return;
  const largeurs = columnWidths(t.rows, largeur);
  doc.fontSize(BASE_SIZE_PT);
  const basPage = doc.page.height - doc.page.margins.bottom;

  t.rows.forEach((ligne, r) => {
    const entete = r === 0;
    doc.font(entete ? "Helvetica-Bold" : "Helvetica").fontSize(BASE_SIZE_PT);
    const h = hauteurLigne(doc, ligne, largeurs);
    if (needsNewPage(doc.y, h, basPage, BASE_SIZE_PT * INTERLIGNE)) doc.addPage();

    const y = doc.y;
    let x = gauche;
    // Une trame légère sur l'en-tête : c'est la seule décoration qu'on garde, parce qu'elle
    // sépare les titres des montants et qu'un tableau sans elle se lit de travers.
    if (entete) doc.rect(gauche, y, largeur, h).fill("#F1F5F9").fillColor("#000000");
    ligne.forEach((texte, i) => {
      const w = largeurs[i] ?? 0;
      doc.rect(x, y, w, h).strokeColor("#CBD5E1").lineWidth(0.5).stroke();
      doc
        .fillColor("#000000")
        .text(texte || "", x + PADDING_CELLULE, y + PADDING_CELLULE, {
          width: Math.max(1, w - PADDING_CELLULE * 2),
          height: h - PADDING_CELLULE * 2,
        });
      x += w;
    });
    // pdfkit place le curseur là où le DERNIER texte s'est arrêté : on le ramène sous la ligne
    // entière, sinon la ligne suivante se dessinerait par-dessus la plus haute cellule.
    doc.y = y + h;
    doc.x = gauche;
  });
  doc.moveDown(0.6);
}

function dessiner(doc: PDFKit.PDFDocument, blocks: DocxBlock[], gauche: number, largeur: number): void {
  for (const b of blocks) {
    doc.x = gauche;
    if (b.kind === "paragraph") dessinerParagraphe(doc, b, largeur);
    else dessinerTableau(doc, b, gauche, largeur);
  }
}

/**
 * LES OCTETS D'UN `.docx` → LES OCTETS D'UN PDF.
 *
 * Ne lève jamais : un bulletin illisible ne doit pas faire échouer la PAIE. L'appelant reçoit un
 * échec explicite et garde alors le fichier d'origine — payer un salarié passe avant le format
 * de son bulletin.
 */
export async function docxToPdf(bytes: Buffer | Uint8Array): Promise<PdfConversion> {
  try {
    const contenu = readDocxBlocks(bytes);
    if (contenu.blocks.length === 0) return { ok: false, error: "Le document Word est vide." };

    const marge = Math.max(MARGE_MIN_PT, contenu.marginPt);
    // `bufferPages` : sans lui, `bufferedPageRange()` répond toujours « une page », et l'on
    // annoncerait un bulletin d'une page là où il y en a quatre.
    const doc = new PDFDocument({ size: "A4", margin: marge, autoFirstPage: true, bufferPages: true });
    const morceaux: Buffer[] = [];
    doc.on("data", (c: Buffer) => morceaux.push(c));
    const fini = new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });

    const largeur = doc.page.width - marge * 2;
    dessiner(doc, contenu.blocks, marge, largeur);
    const pages = doc.bufferedPageRange().count;
    doc.end();
    await fini;

    return { ok: true, pdf: Buffer.concat(morceaux), pages };
  } catch (err) {
    console.error("[payslip] conversion docx → pdf impossible", err);
    return { ok: false, error: "Ce fichier Word n'a pas pu être converti en PDF." };
  }
}

/** Le nom du PDF produit : le même, avec la bonne extension. */
export function pdfFileName(original: string): string {
  return `${original.replace(/\.[^.]+$/, "")}.pdf`;
}

/** Est-ce un document Word que l'on sait convertir ? (Le `.doc` ancien format ne l'est pas.) */
export function isConvertibleWord(name: string, mime: string | null | undefined): boolean {
  if (/\.docx$/i.test(name)) return true;
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
