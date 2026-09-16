import PDFDocument from "pdfkit";
import { readDocxBlocks, type DocxBlock, type DocxContent, type PageBand, type ParagraphBlock, type TableBlock, type TableCell } from "./docx-blocks";
import { columnWidths, effectiveSizePt, fontName, needsNewPage, BASE_SIZE_PT } from "./layout";

/**
 * CONVERTIR UN DOCUMENT WORD EN PDF — sur le serveur, sans LibreOffice.
 *
 * ── CE QUE CETTE CONVERSION EST, ET CE QU'ELLE N'EST PAS ────────────────────────────────────
 *
 * Ce n'est PAS la conversion fidèle d'un traitement de texte. LibreOffice est absent de la cible
 * de déploiement (Render, `runtime: node`) — §104 l'avait mesuré — et `mupdf` n'expose pas
 * l'API de mise en page qui permettrait un rendu HTML. Il n'existe donc, ici, aucun chemin vers
 * une restitution au pixel près : quand l'éditeur Office du serveur est configuré, c'est LUI qui
 * imprime (`office-convert.ts`), et ce module est le REPLI.
 *
 * Ce qu'on fait : relire la STRUCTURE du document — paragraphes, fragments (graisse, taille,
 * couleur), alignements, espacements, tableaux avec leur grille de colonnes, leurs trames et
 * leurs filets — et la REDESSINER proprement, avec l'EN-TÊTE et le PIED DE PAGE du papier
 * (textes et images, en ligne ou ancrées) sur chaque page. Sur une facture posée sur le papier
 * en-tête de la société, le PDF porte donc le logo, la bande de couleur, les colonnes alignées
 * comme dans le Word et le pied officiel — ce qui manquait quand ce rendu ne connaissait que le
 * texte à plat.
 *
 * Ce qui se perd encore, et se DIT à l'appelant plutôt que d'être tu : les polices autres que la
 * famille standard (tout est rendu en Helvetica), les formes dessinées et zones de texte
 * flottantes, les images ni PNG ni JPEG.
 *
 * ── POURQUOI L'ORIGINAL EST CONSERVÉ ────────────────────────────────────────────────────────
 *
 * Parce que la phrase précédente est une promesse que seul l'œil d'un humain peut vérifier. Le
 * `.docx` de départ reste donc attaché à la paie, invisible du salarié, ou rangé à côté de la
 * facture : si le PDF trahit le document, la source est là sans avoir à la redemander. Une
 * conversion qui détruit son entrée est une conversion qu'on ne peut plus contredire.
 */

/** Résultat d'une conversion — jamais une exception jusqu'à l'appelant. */
export type PdfConversion =
  | { ok: true; pdf: Buffer; pages: number }
  | { ok: false; error: string };

const MARGE_MIN_PT = 28;
const INTERLIGNE = 1.25;
const PADDING_CELLULE = 4;
/** L'air entre une bande (en-tête, pied) et le corps de la page. */
const ESPACE_BANDE_PT = 6;
const NOIR = "#000000";
const GRIS_FILET = "#BFBFBF";

type Doc = PDFKit.PDFDocument;

const couleur = (hex: string | null | undefined, defaut = NOIR): string => (hex ? `#${hex.replace(/^#/, "").slice(0, 6)}` : defaut);

function appliquerRun(doc: Doc, run: ParagraphBlock["runs"][number], heading: boolean): void {
  doc.font(fontName(run, heading)).fontSize(effectiveSizePt(run, heading)).fillColor(couleur(run.color));
}

type Run = ParagraphBlock["runs"][number];

/**
 * LES LIGNES VISUELLES D'UN PARAGRAPHE : ses fragments, coupés sur leurs retours à la ligne.
 *
 * Un `w:br` arrive comme un fragment « \n » (ou un « \n » au milieu d'un texte). Confié tel quel
 * à pdfkit en mode `continued`, ce saut était PERDU : « Sarl. BIOGALENIC » et « Zone Industrielle »
 * sortaient collés sur la même ligne dans le bloc client d'une facture (mesuré sur le rendu).
 * On découpe donc AVANT de dessiner, et la mesure de hauteur lit les mêmes lignes que le tracé.
 */
export function lignesDuParagraphe(runs: readonly Run[]): Run[][] {
  const lignes: Run[][] = [[]];
  for (const run of runs) {
    run.text.split("\n").forEach((segment, i) => {
      if (i > 0) lignes.push([]);
      if (segment) lignes[lignes.length - 1]!.push({ ...run, text: segment });
    });
  }
  return lignes;
}

/** La hauteur du TEXTE d'un paragraphe, ligne par ligne, mesurée sur la police du premier fragment de chaque ligne. */
function hauteurTexte(doc: Doc, p: ParagraphBlock, largeur: number): number {
  if (p.runs.length === 0) return 0;
  const w = Math.max(1, largeur);
  let h = 0;
  for (const ligne of lignesDuParagraphe(p.runs)) {
    const r0 = ligne[0] ?? p.runs[0]!;
    doc.font(fontName(r0, p.heading)).fontSize(effectiveSizePt(r0, p.heading));
    h += ligne.length === 0 ? doc.currentLineHeight(true) : doc.heightOfString(ligne.map((r) => r.text).join(""), { width: w });
  }
  return h;
}

/**
 * ÉCRIT UNE LIGNE VISUELLE à (x, y) et rend l'ordonnée sous elle.
 *
 * Deux cas, parce que pdfkit ne sait pas faire le second : à gauche, les fragments s'enchaînent
 * par `continued` (« Salaire de base : » puis « 187 450,00 DZD » en gras, sur la même ligne) ;
 * CENTRÉ ou À DROITE avec plusieurs fragments, `continued` + `align` centre CHAQUE fragment
 * séparément et les superpose — mesuré : « PAIEMENT PAR VIREMENT BANCAIRE » imprimé par-dessus
 * lui-même sur une facture. On mesure alors chaque fragment et on les pose soi-même, bout à bout,
 * à partir du point que l'alignement impose. Trop long pour tenir sur une ligne, le texte repasse
 * par pdfkit en une seule chaîne, dans le style du premier fragment : mieux vaut perdre une
 * graisse qu'un mot.
 */
function ecrireLigne(doc: Doc, ligne: Run[], p: ParagraphBlock, x: number, y: number, largeur: number): number {
  const w = Math.max(1, largeur);
  if (ligne.length === 0) {
    appliquerRun(doc, p.runs[0]!, p.heading);
    return y + doc.currentLineHeight(true);
  }
  if ((p.align === "center" || p.align === "right") && ligne.length > 1) {
    const largeurs = ligne.map((r) => { appliquerRun(doc, r, p.heading); return doc.widthOfString(r.text); });
    const total = largeurs.reduce((a, b) => a + b, 0);
    if (total <= w) {
      let cx = p.align === "center" ? x + (w - total) / 2 : x + w - total;
      let hauteur = 0;
      ligne.forEach((r, i) => {
        appliquerRun(doc, r, p.heading);
        hauteur = Math.max(hauteur, doc.currentLineHeight(true));
        doc.text(r.text, cx, y, { lineBreak: false, continued: false });
        cx += largeurs[i]!;
      });
      doc.x = x;
      doc.y = y + hauteur;
      return doc.y;
    }
    appliquerRun(doc, ligne[0]!, p.heading);
    doc.text(ligne.map((r) => r.text).join(""), x, y, { width: w, align: p.align });
    return doc.y;
  }
  ligne.forEach((r, i) => {
    appliquerRun(doc, r, p.heading);
    const dernier = i === ligne.length - 1;
    if (i === 0) doc.text(r.text, x, y, { width: w, align: p.align, continued: !dernier });
    else doc.text(r.text, { width: w, align: p.align, continued: !dernier });
  });
  return doc.y;
}

function hauteurParagraphe(doc: Doc, p: ParagraphBlock, largeur: number): number {
  const images = p.images.filter((i) => !i.anchored).reduce((s, i) => s + i.heightPt + 2, 0);
  const texte = hauteurTexte(doc, p, largeur);
  // Un paragraphe VIDE est un espace voulu : une demi-ligne.
  const vide = p.runs.length === 0 && images === 0 ? BASE_SIZE_PT * 0.6 : 0;
  return p.spaceBeforePt + images + texte + vide + p.spaceAfterPt;
}

/**
 * DESSINE un paragraphe à une position DONNÉE (une cellule, une bande) et rend la hauteur
 * consommée. Les fragments s'enchaînent sur la même ligne (`continued`) : sans lui,
 * « Salaire de base : » et « 187 450,00 DZD » — deux fragments parce que le second est en gras
 * — tomberaient sur deux lignes.
 */
function dessinerParagrapheA(doc: Doc, p: ParagraphBlock, x: number, y: number, largeur: number): number {
  let curseur = y + p.spaceBeforePt;
  for (const im of p.images) {
    if (im.anchored) continue;
    const ix = p.align === "center" ? x + (largeur - im.widthPt) / 2 : p.align === "right" ? x + largeur - im.widthPt : x;
    try { doc.image(im.bytes, ix, curseur, { width: im.widthPt, height: im.heightPt }); } catch { /* une image que pdfkit ne lit pas : on continue sans elle */ }
    curseur += im.heightPt + 2;
  }
  if (p.runs.length > 0) {
    for (const ligne of lignesDuParagraphe(p.runs)) curseur = ecrireLigne(doc, ligne, p, x, curseur, largeur);
  } else if (p.images.length === 0) {
    curseur += BASE_SIZE_PT * 0.6;
  }
  return curseur + p.spaceAfterPt - y;
}

// ─────────────────────────── Les tableaux ───────────────────────────

/** Les largeurs : la GRILLE du document quand elle existe (réduite si elle déborde), sinon le contenu. */
function largeursColonnes(t: TableBlock, largeur: number): { largeurs: number[]; decalage: number } {
  if (t.gridPt && t.gridPt.length > 0) {
    const total = t.gridPt.reduce((a, b) => a + b, 0);
    if (total > largeur + 0.5) {
      const k = largeur / total;
      return { largeurs: t.gridPt.map((w) => w * k), decalage: 0 };
    }
    const decalage = t.align === "right" ? largeur - total : t.align === "center" ? (largeur - total) / 2 : 0;
    return { largeurs: [...t.gridPt], decalage };
  }
  return { largeurs: columnWidths(t.rows, largeur), decalage: 0 };
}

/** Les cellules d'un tableau — construites depuis le texte à plat quand le lecteur n'en a pas fourni. */
function cellulesDe(t: TableBlock): TableCell[][] {
  if (t.cells.length > 0) return t.cells;
  return t.rows.map((ligne, r) => ligne.map((texte) => ({
    paragraphs: [{ kind: "paragraph" as const, runs: texte ? [{ text: texte, bold: r === 0, italic: false, sizePt: null, color: null }] : [], align: "left" as const, heading: false, spaceBeforePt: 0, spaceAfterPt: 0, images: [] }],
    text: texte, shading: r === 0 ? "F1F5F9" : null, span: 1,
  })));
}

const largeurCellule = (largeurs: number[], col: number, span: number): number => largeurs.slice(col, col + span).reduce((a, b) => a + b, 0);

function hauteurLigne(doc: Doc, cellules: TableCell[], largeurs: number[]): number {
  let h = 0;
  let col = 0;
  for (const c of cellules) {
    const w = largeurCellule(largeurs, col, c.span) - PADDING_CELLULE * 2;
    col += c.span;
    if (w <= 0) continue;
    const hc = c.paragraphs.reduce((s, p) => s + hauteurParagraphe(doc, p, w), 0);
    h = Math.max(h, hc || BASE_SIZE_PT);
  }
  return h + PADDING_CELLULE * 2;
}

function dessinerLigne(doc: Doc, t: TableBlock, cellules: TableCell[], largeurs: number[], x0: number, y: number, h: number): void {
  let x = x0;
  let col = 0;
  const filet = couleur(t.borders.color, GRIS_FILET);
  for (const c of cellules) {
    const w = largeurCellule(largeurs, col, c.span);
    col += c.span;
    if (c.shading) doc.save().rect(x, y, w, h).fill(couleur(c.shading)).restore();
    if (t.borders.inner) doc.save().rect(x, y, w, h).lineWidth(0.5).strokeColor(filet).stroke().restore();
    let cy = y + PADDING_CELLULE;
    for (const p of c.paragraphs) cy += dessinerParagrapheA(doc, p, x + PADDING_CELLULE, cy, Math.max(1, w - PADDING_CELLULE * 2));
    x += w;
  }
  doc.fillColor(NOIR);
}

/** Les filets que la ligne doit porter quand le tableau n'a pas de quadrillage intérieur. */
function filetsExterieurs(doc: Doc, t: TableBlock, x0: number, y: number, largeurTable: number, h: number, premiere: boolean, derniere: boolean): void {
  if (t.borders.inner) return;
  const filet = couleur(t.borders.color, GRIS_FILET);
  doc.save().lineWidth(t.borders.outer ? 0.5 : 0.8).strokeColor(filet);
  if (t.borders.outer) {
    doc.moveTo(x0, y).lineTo(x0, y + h).stroke();
    doc.moveTo(x0 + largeurTable, y).lineTo(x0 + largeurTable, y + h).stroke();
    if (premiere) doc.moveTo(x0, y).lineTo(x0 + largeurTable, y).stroke();
    if (derniere) doc.moveTo(x0, y + h).lineTo(x0 + largeurTable, y + h).stroke();
  } else if (t.borders.bottom && derniere) {
    doc.moveTo(x0, y + h).lineTo(x0 + largeurTable, y + h).stroke();
  }
  doc.restore();
}

/** Un tableau dans le FLUX du corps : il change de page quand une ligne ne tient pas, et répète ses en-têtes. */
function dessinerTableau(doc: Doc, t: TableBlock, gauche: number, largeur: number): void {
  const lignes = cellulesDe(t);
  if (lignes.length === 0) return;
  const { largeurs, decalage } = largeursColonnes(t, largeur);
  const x0 = gauche + decalage;
  const largeurTable = largeurs.reduce((a, b) => a + b, 0);
  const basPage = () => doc.page.height - doc.page.margins.bottom;
  const entetes = lignes.slice(0, t.headerRows);
  const redessinerEntetes = () => {
    entetes.forEach((e, i) => {
      const h = hauteurLigne(doc, e, largeurs);
      dessinerLigne(doc, t, e, largeurs, x0, doc.y, h);
      filetsExterieurs(doc, t, x0, doc.y, largeurTable, h, i === 0, false);
      doc.y += h;
    });
  };
  lignes.forEach((ligne, r) => {
    const h = hauteurLigne(doc, ligne, largeurs);
    if (needsNewPage(doc.y, h, basPage(), BASE_SIZE_PT * INTERLIGNE)) {
      doc.addPage();
      if (r >= t.headerRows) redessinerEntetes();
    }
    const y = doc.y;
    dessinerLigne(doc, t, ligne, largeurs, x0, y, h);
    filetsExterieurs(doc, t, x0, y, largeurTable, h, r === 0, r === lignes.length - 1);
    // pdfkit place le curseur là où le DERNIER texte s'est arrêté : on le ramène sous la ligne
    // entière, sinon la ligne suivante se dessinerait par-dessus la plus haute cellule.
    doc.y = y + h;
    doc.x = gauche;
  });
  doc.moveDown(0.4);
}

// ─────────────────────────── Le corps ───────────────────────────

function dessinerParagrapheFlux(doc: Doc, p: ParagraphBlock, gauche: number, largeur: number): void {
  doc.x = gauche;
  const basPage = doc.page.height - doc.page.margins.bottom;
  if (p.spaceBeforePt) doc.y += p.spaceBeforePt;
  for (const im of p.images) {
    if (im.anchored) continue;
    if (doc.y + im.heightPt > basPage) doc.addPage();
    const ix = p.align === "center" ? gauche + (largeur - im.widthPt) / 2 : p.align === "right" ? gauche + largeur - im.widthPt : gauche;
    try { doc.image(im.bytes, ix, doc.y, { width: im.widthPt, height: im.heightPt }); } catch { /* image illisible : on passe */ }
    doc.y += im.heightPt + 2;
    doc.x = gauche;
  }
  if (p.runs.length > 0) {
    for (const ligne of lignesDuParagraphe(p.runs)) {
      // Une ligne posée à la main (centrée, plusieurs fragments) ne déclenche pas la pagination de
      // pdfkit : on la déclenche ici, avant de l'écrire, sinon elle sortirait sous la marge basse.
      appliquerRun(doc, ligne[0] ?? p.runs[0]!, p.heading);
      if (doc.y + doc.currentLineHeight(true) > basPage) { doc.addPage(); doc.x = gauche; }
      doc.y = ecrireLigne(doc, ligne, p, gauche, doc.y, largeur);
      doc.x = gauche;
    }
    doc.fillColor(NOIR);
  } else if (p.images.length === 0) {
    doc.moveDown(0.5);
  }
  if (p.spaceAfterPt) doc.y += p.spaceAfterPt; else doc.moveDown(0.15);
}

function dessiner(doc: Doc, blocks: DocxBlock[], gauche: number, largeur: number): void {
  for (const b of blocks) {
    doc.x = gauche;
    if (b.kind === "paragraph") dessinerParagrapheFlux(doc, b, gauche, largeur);
    else dessinerTableau(doc, b, gauche, largeur);
  }
}

// ─────────────────────────── Les bandes : en-tête et pied ───────────────────────────

function hauteurBande(doc: Doc, bande: PageBand, largeur: number): number {
  let h = 0;
  for (const b of bande.blocks) {
    if (b.kind === "paragraph") h += hauteurParagraphe(doc, b, largeur);
    else {
      const { largeurs } = largeursColonnes(b, largeur);
      for (const ligne of cellulesDe(b)) h += hauteurLigne(doc, ligne, largeurs);
    }
  }
  return h;
}

/**
 * DESSINE une bande à une position ABSOLUE, sur la page courante — sans jamais déclencher de
 * nouvelle page : le pied se dessine SOUS la marge basse, et pdfkit ajouterait une page si on
 * la lui laissait ; on l'abaisse à zéro le temps du tracé, puis on rend tout comme on l'a trouvé.
 */
function dessinerBande(doc: Doc, bande: PageBand, x: number, y: number, largeur: number, hautMarge: number): void {
  const sauve = { x: doc.x, y: doc.y, bas: doc.page.margins.bottom };
  doc.page.margins.bottom = 0;
  let curseur = y;
  for (const b of bande.blocks) {
    if (b.kind === "paragraph") {
      for (const im of b.images) {
        if (!im.anchored) continue;
        const ix = im.relativeH === "page"
          ? (im.xPt ?? 0)
          : x + (im.xPt ?? (im.alignH === "center" ? (largeur - im.widthPt) / 2 : im.alignH === "right" ? largeur - im.widthPt : 0));
        const iy = im.relativeV === "page" ? (im.yPt ?? curseur) : im.relativeV === "margin" ? hautMarge + (im.yPt ?? 0) : curseur + (im.yPt ?? 0);
        try { doc.image(im.bytes, ix, iy, { width: im.widthPt, height: im.heightPt }); } catch { /* image illisible : on passe */ }
      }
      curseur += dessinerParagrapheA(doc, b, x, curseur, largeur);
    } else {
      const { largeurs, decalage } = largeursColonnes(b, largeur);
      const largeurTable = largeurs.reduce((a, s) => a + s, 0);
      const lignes = cellulesDe(b);
      lignes.forEach((ligne, r) => {
        const h = hauteurLigne(doc, ligne, largeurs);
        dessinerLigne(doc, b, ligne, largeurs, x + decalage, curseur, h);
        filetsExterieurs(doc, b, x + decalage, curseur, largeurTable, h, r === 0, r === lignes.length - 1);
        curseur += h;
      });
    }
  }
  doc.page.margins.bottom = sauve.bas;
  doc.fillColor(NOIR);
  doc.x = sauve.x;
  doc.y = sauve.y;
}

/** Ce que le rendu ne sait PAS restituer de ce document — pour le dire, jamais pour le taire. */
export function limitesDuRendu(contenu: DocxContent): string[] {
  const out: string[] = [];
  const nb = (blocs: DocxBlock[]) => blocs.reduce((s, b) => s + (b.kind === "paragraph" ? b.images.length : 0), 0);
  const images = nb(contenu.blocks) + nb(contenu.header?.blocks ?? []) + nb(contenu.footer?.blocks ?? []);
  out.push(`polices rendues en Helvetica${images ? "" : " ; aucune image lue"}`);
  return out;
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

    const largeurPage = contenu.pageWidthPt;
    const hauteurPage = contenu.pageHeightPt;
    const gauche = Math.max(MARGE_MIN_PT, contenu.margins.leftPt);
    const droite = Math.max(MARGE_MIN_PT, contenu.margins.rightPt);
    const largeur = largeurPage - gauche - droite;

    // LES BANDES SE MESURENT AVANT LA PREMIÈRE PAGE : la marge haute du corps est la plus grande
    // de la marge déclarée et de la place que prend l'en-tête — c'est ce que Word fait aussi quand
    // un en-tête est plus haut que la marge. `heightOfString` exige une page : on mesure sur un
    // document jetable.
    const mesure = new PDFDocument({ size: [largeurPage, hauteurPage], margin: 0, autoFirstPage: true });
    const hEntete = contenu.header ? hauteurBande(mesure, contenu.header, largeur) : 0;
    const hPied = contenu.footer ? hauteurBande(mesure, contenu.footer, largeur) : 0;
    const haut = Math.max(MARGE_MIN_PT, contenu.margins.topPt, contenu.header ? contenu.header.distancePt + hEntete + ESPACE_BANDE_PT : 0);
    const bas = Math.max(MARGE_MIN_PT, contenu.margins.bottomPt, contenu.footer ? contenu.footer.distancePt + hPied + ESPACE_BANDE_PT : 0);

    // `bufferPages` : sans lui, `bufferedPageRange()` répond toujours « une page », et l'on
    // annoncerait un bulletin d'une page là où il y en a quatre.
    const doc = new PDFDocument({ size: [largeurPage, hauteurPage], margins: { top: haut, bottom: bas, left: gauche, right: droite }, autoFirstPage: false, bufferPages: true });
    const morceaux: Buffer[] = [];
    doc.on("data", (c: Buffer) => morceaux.push(c));
    const fini = new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });
    // CHAQUE PAGE reçoit l'en-tête et le pied — la première comme celles qu'un long tableau ajoute.
    doc.on("pageAdded", () => {
      if (contenu.header) dessinerBande(doc, contenu.header, gauche, contenu.header.distancePt, largeur, haut);
      if (contenu.footer) dessinerBande(doc, contenu.footer, gauche, hauteurPage - contenu.footer.distancePt - hPied, largeur, haut);
      doc.x = gauche;
      doc.y = haut;
    });
    doc.addPage();

    dessiner(doc, contenu.blocks, gauche, largeur);
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
