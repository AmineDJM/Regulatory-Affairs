/**
 * LIRE UN `.docx` DANS L'ORDRE OÙ IL SE LIT — paragraphes et tableaux mélangés.
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
 * ── CE QU'ON GARDE, ET CE QU'ON LAISSE ──────────────────────────────────────────────────────
 *
 * On garde ce qui porte le SENS d'un bulletin : le texte, ses fragments et leur graisse, la
 * taille, l'alignement, et les tableaux avec leurs cellules. On laisse les images, les en-têtes,
 * les pieds de page et les bordures fines — un moteur de rendu écrit ici ne les restituerait pas
 * fidèlement, et la conversion se veut LISIBLE et JUSTE, pas trompeusement ressemblante.
 *
 * Module PUR : il ne connaît ni base, ni session, ni PDF. Il prend des octets, il rend des blocs.
 */

import PizZip from "pizzip";
import { attr, child, children, parseXml, textOf, type XmlNode } from "@/lib/artifact/object-model/xml";

/** Un fragment homogène : un morceau de texte et sa graisse. */
export interface BlockRun {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Taille en POINTS (Word stocke des demi-points). `null` = taille du document. */
  sizePt: number | null;
}

export interface ParagraphBlock {
  kind: "paragraph";
  runs: BlockRun[];
  align: "left" | "center" | "right" | "justify";
  /** Un titre Word (`Heading…`, `Titre…`) : on le rend plus gros et gras. */
  heading: boolean;
}

export interface TableBlock {
  kind: "table";
  /** Lignes, puis cellules — le texte de chaque cellule, déjà aplati. */
  rows: string[][];
}

export type DocxBlock = ParagraphBlock | TableBlock;

export interface DocxContent {
  blocks: DocxBlock[];
  /** Largeur utile en points typographiques (page moins marges), pour dimensionner le rendu. */
  pageWidthPt: number;
  marginPt: number;
}

const TWIP_PAR_POINT = 20; // 1 pt = 20 twips
const A4_LARGEUR_TWIP = 11906;
const MARGE_DEFAUT_TWIP = 1440; // 2,54 cm

const nombre = (v: string | null): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** `attr` sur un nœud qui peut manquer — la moitié des balises OOXML sont optionnelles. */
const attrOpt = (n: XmlNode | null, nom: string): string | null => (n ? attr(n, nom) : null);

/** Un `w:r` : son texte, sa graisse, sa taille. */
function lireRun(r: XmlNode): BlockRun | null {
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
  const drapeau = (nom: string): boolean => {
    const e = rPr ? child(rPr, nom) : null;
    if (!e) return false;
    const v = attr(e, "w:val");
    return v !== "0" && v !== "false";
  };
  const demiPt = nombre(attrOpt(rPr ? child(rPr, "w:sz") : null, "w:val"));
  return {
    text: texte,
    bold: drapeau("w:b"),
    italic: drapeau("w:i"),
    sizePt: demiPt != null ? demiPt / 2 : null,
  };
}

function lireParagraphe(p: XmlNode): ParagraphBlock {
  const runs: BlockRun[] = [];
  for (const r of children(p, "w:r")) {
    const run = lireRun(r);
    if (run) runs.push(run);
  }
  const pPr = child(p, "w:pPr");
  const jc = attrOpt(pPr ? child(pPr, "w:jc") : null, "w:val");
  const style = attrOpt(pPr ? child(pPr, "w:pStyle") : null, "w:val");
  const align =
    jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" ? "justify" : "left";
  return {
    kind: "paragraph",
    runs,
    align,
    heading: Boolean(style && /^(heading|titre)/i.test(style)),
  };
}

/** Le texte d'une cellule : ses paragraphes, joints par un retour. */
function texteCellule(tc: XmlNode): string {
  return children(tc, "w:p")
    .map((p) => children(p, "w:r").map((r) => lireRun(r)?.text ?? "").join(""))
    .join("\n")
    .trim();
}

function lireTableau(tbl: XmlNode): TableBlock {
  const rows: string[][] = [];
  for (const tr of children(tbl, "w:tr")) {
    rows.push(children(tr, "w:tc").map(texteCellule));
  }
  return { kind: "table", rows };
}

/**
 * LES BLOCS D'UN `.docx`, DANS L'ORDRE DU DOCUMENT.
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

  const blocks: DocxBlock[] = [];
  for (const n of body.children) {
    if (n.name === "w:p") {
      const p = lireParagraphe(n);
      // Un paragraphe vide reste un ESPACE VOULU par l'auteur : le supprimer ferait remonter le
      // tableau sous le titre. On ne jette que les vides consécutifs au-delà du premier.
      const precedent = blocks[blocks.length - 1];
      const vide = p.runs.length === 0;
      if (vide && (!precedent || (precedent.kind === "paragraph" && precedent.runs.length === 0))) continue;
      blocks.push(p);
    } else if (n.name === "w:tbl") {
      blocks.push(lireTableau(n));
    }
  }

  // `w:sectPr` porte les dimensions ; à défaut, A4 portrait avec des marges de 2,54 cm.
  const sectPr = child(body, "w:sectPr");
  const pgSz = sectPr ? child(sectPr, "w:pgSz") : null;
  const pgMar = sectPr ? child(sectPr, "w:pgMar") : null;
  const largeurTwip = nombre(attrOpt(pgSz, "w:w")) ?? A4_LARGEUR_TWIP;
  const margeTwip = nombre(attrOpt(pgMar, "w:left")) ?? MARGE_DEFAUT_TWIP;

  return {
    blocks,
    pageWidthPt: largeurTwip / TWIP_PAR_POINT,
    // Une marge aberrante (nulle, ou plus large que la demi-page) rendrait le document illisible :
    // on retombe alors sur la marge par défaut plutôt que d'obéir à une valeur absurde.
    marginPt:
      margeTwip > 0 && margeTwip < largeurTwip / 2 ? margeTwip / TWIP_PAR_POINT : MARGE_DEFAUT_TWIP / TWIP_PAR_POINT,
  };
}
