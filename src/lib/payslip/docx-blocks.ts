/**
 * LIRE UN `.docx` DANS L'ORDRE OÙ IL SE LIT — paragraphes et tableaux mélangés, EN-TÊTE et PIED
 * DE PAGE compris, avec leurs images.
 *
 * ── POURQUOI CE MODULE, ALORS QUE `DocxModel` EXISTE ────────────────────────────────────────
 *
 * `adapters/docx` construit un modèle d'ÉDITION : il numérote les paragraphes à l'humaine pour
 * qu'on puisse dire « le troisième paragraphe », et range les tableaux dans une liste séparée.
 * C'est exactement ce qu'il faut pour retoucher un document — et exactement ce qu'il ne faut pas
 * pour le REDESSINER : deux listes parallèles ne disent pas ce qui vient avant quoi. Rendre
 * « tous les paragraphes puis tous les tableaux » mettrait le pied de page d'un bulletin de paie
 * au-dessus du tableau des montants.
 *
 * On relit donc `w:body` DANS L'ORDRE, et l'on rend une suite de blocs. Rien n'est dupliqué de
 * l'adaptateur : le ZIP, l'analyse XML et les conversions d'unités sont les siens.
 *
 * ── CE QU'ON LIT, ET POURQUOI C'EST PLUS QU'AVANT ───────────────────────────────────────────
 *
 * La première version ne gardait que le texte, sa graisse et les cellules à plat : suffisant pour
 * un bulletin de paie, insuffisant pour une FACTURE posée sur le papier en-tête de la société —
 * le PDF sortait sans logo, sans pied officiel, sans la bande de couleur ni les largeurs de
 * colonnes de la pièce de référence, et « le .docx fait foi » était la seule réponse. On lit
 * désormais aussi : la COULEUR des fragments, l'espacement des paragraphes, la GRILLE de
 * colonnes d'un tableau (`w:tblGrid`), la TRAME des cellules, les bordures déclarées côté par
 * côté, la position du tableau, les lignes d'en-tête répétées — et les parties `header` /
 * `footer` référencées par la section, avec leurs IMAGES (PNG / JPEG, en ligne ou ancrées).
 *
 * Ce qui n'est toujours pas lu se DIT dans le rendu, pas ici : formes dessinées, zones de texte
 * flottantes, polices autres que la famille standard.
 *
 * Module PUR : il ne connaît ni base, ni session, ni PDF. Il prend des octets, il rend des blocs.
 */

import PizZip from "pizzip";
import { attr, child, children, descendants, firstDescendant, parseXml, textOf, type XmlNode } from "@/lib/artifact/object-model/xml";

/** Un fragment homogène : un morceau de texte, sa graisse, sa taille, sa couleur. */
export interface BlockRun {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Taille en POINTS (Word stocke des demi-points). `null` = taille du document. */
  sizePt: number | null;
  /** Couleur hexadécimale (sans dièse). `null` = automatique (noir). */
  color: string | null;
}

/** Une image, avec sa taille et — si elle est ancrée — où elle se pose. */
export interface PlacedImage {
  bytes: Buffer;
  png: boolean;
  widthPt: number;
  heightPt: number;
  /** Ancrée (position absolue) ou en ligne (dans le flux du paragraphe). */
  anchored: boolean;
  xPt: number | null;
  yPt: number | null;
  alignH: "left" | "center" | "right" | null;
  relativeH: "page" | "margin";
  relativeV: "page" | "margin" | "paragraph";
}

export interface ParagraphBlock {
  kind: "paragraph";
  runs: BlockRun[];
  align: "left" | "center" | "right" | "justify";
  /** Un titre Word (`Heading…`, `Titre…`) : on le rend plus gros et gras. */
  heading: boolean;
  spaceBeforePt: number;
  spaceAfterPt: number;
  images: PlacedImage[];
}

export interface TableCell {
  paragraphs: ParagraphBlock[];
  /** Le texte de la cellule, aplati — ce que les anciens lecteurs consommaient. */
  text: string;
  /** Trame de fond (hexadécimal), ou `null`. */
  shading: string | null;
  /** Nombre de colonnes de la grille couvertes. */
  span: number;
}

export interface TableBorders {
  /** Un cadre extérieur est déclaré (au moins un côté). */
  outer: boolean;
  /** Des filets intérieurs sont déclarés. */
  inner: boolean;
  /** Le filet du BAS seul — la règle qui ferme les totaux d'un bon de commande. */
  bottom: boolean;
  color: string | null;
}

export interface TableBlock {
  kind: "table";
  /** Lignes, puis cellules — le texte de chaque cellule, déjà aplati (compatibilité). */
  rows: string[][];
  cells: TableCell[][];
  /** Les largeurs de la grille, en points, telles que le document les déclare. */
  gridPt: number[] | null;
  borders: TableBorders;
  align: "left" | "center" | "right";
  /** Le nombre de premières lignes déclarées « en-tête répété ». */
  headerRows: number;
}

export type DocxBlock = ParagraphBlock | TableBlock;

/** L'en-tête ou le pied de page : ses blocs, et sa distance au bord de la feuille. */
export interface PageBand {
  blocks: DocxBlock[];
  distancePt: number;
}

export interface DocxContent {
  blocks: DocxBlock[];
  /** Largeur utile en points typographiques (page moins marges), pour dimensionner le rendu. */
  pageWidthPt: number;
  pageHeightPt: number;
  /** La marge gauche, gardée sous son ancien nom pour les lecteurs qui ne connaissaient qu'elle. */
  marginPt: number;
  margins: { topPt: number; bottomPt: number; leftPt: number; rightPt: number };
  header: PageBand | null;
  footer: PageBand | null;
}

const TWIP_PAR_POINT = 20; // 1 pt = 20 twips
const EMU_PAR_POINT = 12_700;
const A4_LARGEUR_TWIP = 11906;
const A4_HAUTEUR_TWIP = 16838;
const MARGE_DEFAUT_TWIP = 1440; // 2,54 cm
const BANDE_DEFAUT_TWIP = 708; // 1,25 cm : la distance d'en-tête par défaut de Word

const nombre = (v: string | null): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** `attr` sur un nœud qui peut manquer — la moitié des balises OOXML sont optionnelles. */
const attrOpt = (n: XmlNode | null, nom: string): string | null => (n ? attr(n, nom) : null);
const hexOuNull = (v: string | null): string | null => (v && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : null);

/** Une partie du paquet (document, en-tête, pied) et ses relations — pour retrouver ses images. */
interface Partie {
  zip: PizZip;
  rels: Map<string, string>;
  /** Les styles du paquet : ce qu'un fragment hérite de son style de paragraphe. */
  styles: Map<string, StyleRun>;
  spacingAfterDefautPt: number;
}

interface StyleRun { sizePt: number | null; bold: boolean; color: string | null }

/** `word/document.xml` → `word/_rels/document.xml.rels`, et chaque cible ramenée à un chemin du ZIP. */
function lireRels(zip: PizZip, cheminPartie: string): Map<string, string> {
  const dossier = cheminPartie.slice(0, cheminPartie.lastIndexOf("/") + 1);
  const nom = cheminPartie.slice(dossier.length);
  const out = new Map<string, string>();
  const f = zip.file(`${dossier}_rels/${nom}.rels`);
  if (!f) return out;
  for (const r of descendants(parseXml(f.asText()), "Relationship")) {
    const id = attr(r, "Id");
    const cible = attr(r, "Target");
    if (!id || !cible || attr(r, "TargetMode") === "External") continue;
    out.set(id, cible.startsWith("/") ? cible.slice(1) : resoudre(dossier, cible));
  }
  return out;
}

function resoudre(dossier: string, relatif: string): string {
  const parts = `${dossier}${relatif}`.split("/");
  const pile: string[] = [];
  for (const p of parts) {
    if (p === "..") pile.pop();
    else if (p !== "." && p !== "") pile.push(p);
  }
  return pile.join("/");
}

/** Les styles du paquet : taille, graisse, couleur par identifiant — et l'espacement par défaut. */
function lireStyles(zip: PizZip): { styles: Map<string, StyleRun>; spacingAfterDefautPt: number } {
  const styles = new Map<string, StyleRun>();
  const f = zip.file("word/styles.xml");
  if (!f) return { styles, spacingAfterDefautPt: 0 };
  const racine = parseXml(f.asText());
  const defauts = firstDescendant(racine, "w:pPrDefault");
  const spacing = defauts ? firstDescendant(defauts, "w:spacing") : null;
  const spacingAfterDefautPt = (nombre(attrOpt(spacing, "w:after")) ?? 0) / TWIP_PAR_POINT;
  for (const st of descendants(racine, "w:style")) {
    const id = attr(st, "w:styleId");
    if (!id) continue;
    const rPr = child(st, "w:rPr");
    const sz = nombre(attrOpt(rPr ? child(rPr, "w:sz") : null, "w:val"));
    const b = rPr ? child(rPr, "w:b") : null;
    styles.set(id, {
      sizePt: sz != null ? sz / 2 : null,
      bold: !!b && attr(b, "w:val") !== "0" && attr(b, "w:val") !== "false",
      color: hexOuNull(attrOpt(rPr ? child(rPr, "w:color") : null, "w:val")),
    });
  }
  return { styles, spacingAfterDefautPt };
}

const estPng = (b: Buffer): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const estJpeg = (b: Buffer): boolean => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/** Les octets d'une image par sa relation — seulement PNG et JPEG, les deux formats que pdfkit dessine. */
function octetsImage(partie: Partie, rid: string | null): Buffer | null {
  if (!rid) return null;
  const chemin = partie.rels.get(rid);
  const f = chemin ? partie.zip.file(chemin) : null;
  if (!f) return null;
  const b = f.asNodeBuffer();
  return estPng(b) || estJpeg(b) ? b : null;
}

/** Les images d'un run : dessins DrawingML (en ligne ou ancrés) et, à défaut, VML ancien. */
function lireImagesDuRun(r: XmlNode, partie: Partie): PlacedImage[] {
  const out: PlacedImage[] = [];
  for (const d of descendants(r, "w:drawing")) {
    const inline = child(d, "wp:inline");
    const anchor = child(d, "wp:anchor");
    const conteneur = inline ?? anchor;
    if (!conteneur) continue;
    const extent = child(conteneur, "wp:extent");
    const cx = nombre(attrOpt(extent, "cx"));
    const cy = nombre(attrOpt(extent, "cy"));
    const blip = firstDescendant(conteneur, "a:blip");
    const octets = octetsImage(partie, blip ? attr(blip, "r:embed") : null);
    if (!octets || !cx || !cy) continue;
    let xPt: number | null = null, yPt: number | null = null, alignH: PlacedImage["alignH"] = null;
    let relativeH: PlacedImage["relativeH"] = "margin", relativeV: PlacedImage["relativeV"] = "paragraph";
    if (anchor) {
      const pH = child(anchor, "wp:positionH");
      const pV = child(anchor, "wp:positionV");
      if (pH) {
        relativeH = attr(pH, "relativeFrom") === "page" ? "page" : "margin";
        const off = child(pH, "wp:posOffset");
        const al = child(pH, "wp:align");
        if (off) xPt = (nombre(textOf(off).trim()) ?? 0) / EMU_PAR_POINT;
        else if (al) { const v = textOf(al).trim(); alignH = v === "center" ? "center" : v === "right" || v === "outside" ? "right" : "left"; }
      }
      if (pV) {
        const rel = attr(pV, "relativeFrom");
        relativeV = rel === "page" ? "page" : rel === "margin" || rel === "topMargin" ? "margin" : "paragraph";
        const off = child(pV, "wp:posOffset");
        if (off) yPt = (nombre(textOf(off).trim()) ?? 0) / EMU_PAR_POINT;
      }
    }
    out.push({ bytes: octets, png: estPng(octets), widthPt: cx / EMU_PAR_POINT, heightPt: cy / EMU_PAR_POINT, anchored: !!anchor, xPt, yPt, alignH, relativeH, relativeV });
  }
  if (out.length) return out;
  for (const im of descendants(r, "v:imagedata")) {
    const octets = octetsImage(partie, attr(im, "r:id") ?? attr(im, "o:relid"));
    const style = im.parent ? attr(im.parent, "style") ?? "" : "";
    const w = /width:\s*([\d.]+)pt/.exec(style);
    const h = /height:\s*([\d.]+)pt/.exec(style);
    if (!octets || !w || !h) continue;
    out.push({ bytes: octets, png: estPng(octets), widthPt: Number(w[1]), heightPt: Number(h[1]), anchored: false, xPt: null, yPt: null, alignH: null, relativeH: "margin", relativeV: "paragraph" });
  }
  return out;
}

/** Un `w:r` : son texte, sa graisse, sa taille, sa couleur — hérités du style du paragraphe à défaut. */
function lireRun(r: XmlNode, style: StyleRun | null): BlockRun | null {
  // `w:tab` et `w:br` ne portent pas de texte mais séparent : on les rend par un espace, sans
  // quoi deux colonnes tabulées se colleraient en un seul mot.
  let texte = "";
  for (const n of r.children) {
    if (n.name === "w:t") texte += textOf(n);
    else if (n.name === "w:tab") texte += "  ";
    else if (n.name === "w:br") texte += "\n";
  }
  if (!texte) return null;
  const rPr = child(r, "w:rPr");
  const drapeau = (nom: string): boolean | null => {
    const e = rPr ? child(rPr, nom) : null;
    if (!e) return null;
    const v = attr(e, "w:val");
    return v !== "0" && v !== "false";
  };
  const demiPt = nombre(attrOpt(rPr ? child(rPr, "w:sz") : null, "w:val"));
  const couleur = hexOuNull(attrOpt(rPr ? child(rPr, "w:color") : null, "w:val"));
  return {
    text: texte,
    bold: drapeau("w:b") ?? style?.bold ?? false,
    italic: drapeau("w:i") ?? false,
    sizePt: demiPt != null ? demiPt / 2 : style?.sizePt ?? null,
    color: couleur ?? style?.color ?? null,
  };
}

/**
 * LES RUNS D'UN PARAGRAPHE, dans l'ordre — en descendant dans les liens et les révisions, mais
 * JAMAIS dans `mc:Fallback` : le repli VML d'un dessin répète le même contenu, et le compter
 * deux fois doublerait un logo ou une zone de texte.
 */
function runsDe(p: XmlNode): XmlNode[] {
  const out: XmlNode[] = [];
  const marcher = (n: XmlNode) => {
    for (const c of n.children) {
      if (c.type !== "element" || c.name === "mc:Fallback") continue;
      if (c.name === "w:r") out.push(c);
      else marcher(c);
    }
  };
  marcher(p);
  return out;
}

function lireParagraphe(p: XmlNode, partie: Partie): ParagraphBlock {
  const pPr = child(p, "w:pPr");
  const styleId = attrOpt(pPr ? child(pPr, "w:pStyle") : null, "w:val");
  const style = styleId ? partie.styles.get(styleId) ?? null : null;
  const runs: BlockRun[] = [];
  const images: PlacedImage[] = [];
  for (const r of runsDe(p)) {
    const run = lireRun(r, style);
    if (run) runs.push(run);
    images.push(...lireImagesDuRun(r, partie));
  }
  const jc = attrOpt(pPr ? child(pPr, "w:jc") : null, "w:val");
  const spacing = pPr ? child(pPr, "w:spacing") : null;
  const avant = nombre(attrOpt(spacing, "w:before"));
  const apres = nombre(attrOpt(spacing, "w:after"));
  const align =
    jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" || jc === "distribute" ? "justify" : "left";
  return {
    kind: "paragraph",
    runs,
    align,
    heading: Boolean(styleId && /^(heading|titre|title)/i.test(styleId)),
    spaceBeforePt: (avant ?? 0) / TWIP_PAR_POINT,
    spaceAfterPt: (apres ?? (partie.spacingAfterDefautPt * TWIP_PAR_POINT)) / TWIP_PAR_POINT,
    images,
  };
}

function lireCellule(tc: XmlNode, partie: Partie): TableCell {
  const tcPr = child(tc, "w:tcPr");
  const span = nombre(attrOpt(tcPr ? child(tcPr, "w:gridSpan") : null, "w:val")) ?? 1;
  const fill = attrOpt(tcPr ? child(tcPr, "w:shd") : null, "w:fill");
  const paragraphs = children(tc, "w:p").map((p) => lireParagraphe(p, partie));
  return {
    paragraphs,
    text: paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n").trim(),
    shading: hexOuNull(fill),
    span: Math.max(1, span),
  };
}

const bordurePresente = (n: XmlNode | null): boolean => !!n && !["nil", "none"].includes(attr(n, "w:val") ?? "nil");

function lireTableau(tbl: XmlNode, partie: Partie): TableBlock {
  const tblPr = child(tbl, "w:tblPr");
  const jc = attrOpt(tblPr ? child(tblPr, "w:jc") : null, "w:val");
  const bords = tblPr ? child(tblPr, "w:tblBorders") : null;
  const cote = (nom: string) => (bords ? child(bords, nom) : null);
  const haut = bordurePresente(cote("w:top")), gauche = bordurePresente(cote("w:left")), bas = bordurePresente(cote("w:bottom")), droite = bordurePresente(cote("w:right"));
  const inner = bordurePresente(cote("w:insideH")) || bordurePresente(cote("w:insideV"));
  const couleur = hexOuNull(attrOpt(cote("w:bottom") ?? cote("w:top") ?? cote("w:insideH"), "w:color"));
  const grille = children(child(tbl, "w:tblGrid") ?? tbl, "w:gridCol").map((g) => (nombre(attr(g, "w:w")) ?? 0) / TWIP_PAR_POINT).filter((w) => w > 0);
  const cells: TableCell[][] = [];
  let headerRows = 0;
  let enTete = true;
  for (const tr of children(tbl, "w:tr")) {
    const trPr = child(tr, "w:trPr");
    const estEntete = !!trPr && !!child(trPr, "w:tblHeader");
    if (enTete && estEntete) headerRows += 1; else enTete = false;
    cells.push(children(tr, "w:tc").map((tc) => lireCellule(tc, partie)));
  }
  return {
    kind: "table",
    rows: cells.map((ligne) => ligne.map((c) => c.text)),
    cells,
    gridPt: grille.length ? grille : null,
    borders: { outer: haut || gauche || bas || droite, inner, bottom: bas && !haut && !inner, color: couleur },
    align: jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : "left",
    headerRows,
  };
}

/** Les blocs d'un conteneur (`w:body`, `w:hdr`, `w:ftr`), dans l'ordre. */
function lireBlocs(conteneur: XmlNode, partie: Partie): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  for (const n of conteneur.children) {
    if (n.name === "w:p") {
      const p = lireParagraphe(n, partie);
      // Un paragraphe vide reste un ESPACE VOULU par l'auteur : le supprimer ferait remonter le
      // tableau sous le titre. On ne jette que les vides consécutifs au-delà du premier.
      const precedent = blocks[blocks.length - 1];
      const vide = p.runs.length === 0 && p.images.length === 0;
      if (vide && (!precedent || (precedent.kind === "paragraph" && precedent.runs.length === 0 && precedent.images.length === 0))) continue;
      blocks.push(p);
    } else if (n.name === "w:tbl") {
      blocks.push(lireTableau(n, partie));
    } else if (n.name === "w:sdt") {
      // Un contrôle de contenu enveloppe des paragraphes ordinaires.
      const contenu = child(n, "w:sdtContent");
      if (contenu) blocks.push(...lireBlocs(contenu, partie));
    }
  }
  return blocks;
}

/** L'en-tête (ou le pied) que la section désigne — celui de type « default », sinon le premier. */
function lireBande(zip: PizZip, sectPr: XmlNode | null, relsDoc: Map<string, string>, base: Omit<Partie, "rels" | "zip">, genre: "header" | "footer", distanceTwip: number): PageBand | null {
  const refs = sectPr ? children(sectPr, `w:${genre}Reference`) : [];
  const choisie = refs.find((r) => attr(r, "w:type") === "default") ?? refs[0] ?? null;
  const rid = choisie ? attr(choisie, "r:id") : null;
  let chemin = rid ? relsDoc.get(rid) ?? null : null;
  if (!chemin) {
    // Sans référence lisible, le premier fichier `header1.xml` / `footer1.xml` du paquet.
    const candidat = Object.keys(zip.files).filter((f) => new RegExp(`^word/${genre}\\d*\\.xml$`).test(f)).sort()[0];
    chemin = candidat ?? null;
  }
  const f = chemin ? zip.file(chemin) : null;
  if (!f || !chemin) return null;
  const racine = parseXml(f.asText());
  // Les paragraphes vivent SOUS `w:hdr` / `w:ftr`, pas à la racine du document XML : lire la racine
  // rendait une bande vide, donc `null`, donc un PDF sans papier en-tête — en silence.
  const conteneur = child(racine, genre === "header" ? "w:hdr" : "w:ftr") ?? racine;
  const partie: Partie = { zip, rels: lireRels(zip, chemin), styles: base.styles, spacingAfterDefautPt: base.spacingAfterDefautPt };
  const blocks = lireBlocs(conteneur, partie);
  if (!blocks.some((b) => (b.kind === "paragraph" ? b.runs.length > 0 || b.images.length > 0 : b.rows.length > 0))) return null;
  return { blocks, distancePt: distanceTwip / TWIP_PAR_POINT };
}

/**
 * LES BLOCS D'UN `.docx`, DANS L'ORDRE DU DOCUMENT — et ses bandes d'en-tête et de pied.
 *
 * Lève si le fichier n'est pas un `.docx` lisible — l'appelant décide alors quoi faire, et il a
 * mieux à proposer qu'un PDF vide : garder le fichier d'origine.
 */
export function readDocxBlocks(bytes: Buffer | Uint8Array): DocxContent {
  const zip = new PizZip(bytes);
  const entree = zip.file("word/document.xml");
  if (!entree) throw new Error("Ce fichier ne contient pas de document Word (word/document.xml absent).");
  const racine = parseXml(entree.asText());

  // `w:document` → `w:body`. On tolère l'absence d'espace de noms préfixé.
  const document = racine.name === "w:document" ? racine : (child(racine, "w:document") ?? racine);
  const body = child(document, "w:body");
  if (!body) throw new Error("Document Word sans corps (w:body absent).");

  const { styles, spacingAfterDefautPt } = lireStyles(zip);
  const relsDoc = lireRels(zip, "word/document.xml");
  const partie: Partie = { zip, rels: relsDoc, styles, spacingAfterDefautPt };
  const blocks = lireBlocs(body, partie);

  // `w:sectPr` porte les dimensions ; à défaut, A4 portrait avec des marges de 2,54 cm.
  const sectPr = child(body, "w:sectPr");
  const pgSz = sectPr ? child(sectPr, "w:pgSz") : null;
  const pgMar = sectPr ? child(sectPr, "w:pgMar") : null;
  const largeurTwip = nombre(attrOpt(pgSz, "w:w")) ?? A4_LARGEUR_TWIP;
  const hauteurTwip = nombre(attrOpt(pgSz, "w:h")) ?? A4_HAUTEUR_TWIP;
  // Une marge aberrante (nulle, ou plus large que la demi-page) rendrait le document illisible :
  // on retombe alors sur la marge par défaut plutôt que d'obéir à une valeur absurde.
  const marge = (nom: string, borne: number): number => {
    const v = nombre(attrOpt(pgMar, nom));
    return v != null && v > 0 && v < borne / 2 ? v / TWIP_PAR_POINT : MARGE_DEFAUT_TWIP / TWIP_PAR_POINT;
  };
  const margins = { topPt: marge("w:top", hauteurTwip), bottomPt: marge("w:bottom", hauteurTwip), leftPt: marge("w:left", largeurTwip), rightPt: marge("w:right", largeurTwip) };
  const distance = (nom: string): number => { const v = nombre(attrOpt(pgMar, nom)); return v != null && v >= 0 && v < hauteurTwip / 2 ? v : BANDE_DEFAUT_TWIP; };

  return {
    blocks,
    pageWidthPt: largeurTwip / TWIP_PAR_POINT,
    pageHeightPt: hauteurTwip / TWIP_PAR_POINT,
    marginPt: margins.leftPt,
    margins,
    header: lireBande(zip, sectPr, relsDoc, { styles, spacingAfterDefautPt }, "header", distance("w:header")),
    footer: lireBande(zip, sectPr, relsDoc, { styles, spacingAfterDefautPt }, "footer", distance("w:footer")),
  };
}
