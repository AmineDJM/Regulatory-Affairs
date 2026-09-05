/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE COMPOSITEUR WORD DE LA FABRIQUE — des paragraphes, des tableaux, et le papier en-tête de
 * la société recopié à l'octet près.
 *
 * ── POURQUOI ÉCRIRE L'OOXML SOI-MÊME ────────────────────────────────────────────────────
 *
 * Le produit sait déjà écrire trois `.docx` minimaux (livrables d'Adam, artefacts de mission,
 * rapports réglementaires) : trente lignes chacun, sans tableau digne de ce nom. Une pièce
 * commerciale exige davantage — un tableau de lignes à colonnes fixes, des montants alignés à
 * droite, une ligne de total ombrée, un pied de page de mentions légales — et surtout de
 * pouvoir se poser SUR le papier en-tête de la société.
 *
 * ── LE PAPIER EN-TÊTE N'EST PAS UNE IMAGE COLLÉE : C'EST LE FICHIER LUI-MÊME ────────────
 *
 * L'ERP tient les en-têtes comme de vrais `.docx` (`OfficeLetterhead`) : marges, en-tête,
 * pied de page, logo à la bonne taille. Le compositeur OUVRE ce fichier, REMPLACE le corps du
 * document par le contenu de la pièce, et laisse TOUT LE RESTE intact : `header1.xml`,
 * `footer1.xml`, les images, les styles, les relations et le `w:sectPr` qui les référence.
 * Le résultat s'ouvre exactement comme le modèle — c'est ce que `word.test.ts` vérifie, pièce
 * du ZIP par pièce du ZIP. Une fusion de documents ou une image injectée produirait des
 * décalages qu'on ne découvre qu'à l'impression, chez le client.
 *
 * Module PUR : il prend des blocs et des octets, il rend des octets.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import PizZip from "pizzip";
import { escapeXml } from "@/lib/artifact/object-model/xml";

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type Alignement = "left" | "center" | "right" | "both";

export interface Fragment {
  texte: string;
  gras?: boolean;
  italique?: boolean;
  taillePt?: number;
  /** Couleur hexadécimale, avec ou sans dièse. */
  couleur?: string;
}

export interface OptionsParagraphe extends Omit<Fragment, "texte"> {
  alignement?: Alignement;
  avantPt?: number;
  apresPt?: number;
  /** Style Word déclaré dans le paquet : `Titre` (Title) ou `Titre1`… ; sans style = Normal. */
  style?: "Titre" | "Titre1" | "Titre2" | null;
  garderAvecSuivant?: boolean;
}

export type Cellule =
  | string
  | Fragment[]
  | { contenu: string | Fragment[]; alignement?: Alignement; gras?: boolean; fusion?: number; fond?: string; couleur?: string };

export interface ColonneTableau {
  largeurCm: number;
  alignement?: Alignement;
}

export interface OptionsTableau {
  colonnes: ColonneTableau[];
  /** La première ligne est un en-tête : en gras, ombrée, répétée en haut de chaque page. */
  entete?: boolean;
  couleurEntete?: string;
  couleurTexteEntete?: string;
  /** Bordures fines (défaut) ou aucune (blocs d'adresse, signatures). */
  bordures?: boolean;
  taillePt?: number;
  /** Indices (0 = première ligne) des lignes à mettre en gras. */
  lignesEnGras?: number[];
  /** Fond d'une ligne donnée, par indice. */
  fondLignes?: Record<number, string>;
  /** Position du tableau dans la page : à droite pour un bloc de totaux. */
  position?: "left" | "center" | "right";
}

const TWIPS_PAR_CM = 567;
const hex = (c: string | undefined, defaut: string): string => (c ?? defaut).replace(/^#/, "").toUpperCase().slice(0, 6) || defaut;
const twips = (cm: number): number => Math.round(cm * TWIPS_PAR_CM);

function rPr(f: Omit<Fragment, "texte">, defauts: Omit<Fragment, "texte"> = {}): string {
  const gras = f.gras ?? defauts.gras;
  const italique = f.italique ?? defauts.italique;
  const taille = f.taillePt ?? defauts.taillePt;
  const couleur = f.couleur ?? defauts.couleur;
  const parts = [
    gras ? "<w:b/><w:bCs/>" : "",
    italique ? "<w:i/><w:iCs/>" : "",
    couleur ? `<w:color w:val="${hex(couleur, "000000")}"/>` : "",
    taille ? `<w:sz w:val="${Math.round(taille * 2)}"/><w:szCs w:val="${Math.round(taille * 2)}"/>` : "",
  ].join("");
  return parts ? `<w:rPr>${parts}</w:rPr>` : "";
}

/** Un fragment → un ou plusieurs `w:r` ; un retour à la ligne dans le texte devient `w:br`. */
function runs(f: Fragment, defauts: Omit<Fragment, "texte"> = {}): string {
  const props = rPr(f, defauts);
  return String(f.texte ?? "")
    .split("\n")
    .map((seg) => `<w:r>${props}<w:t xml:space="preserve">${escapeXml(seg)}</w:t></w:r>`)
    .join(`<w:r>${props}<w:br/></w:r>`);
}

const STYLE_ID: Record<NonNullable<OptionsParagraphe["style"]>, string> = { Titre: "Title", Titre1: "Heading1", Titre2: "Heading2" };

function pPr(o: OptionsParagraphe): string {
  const parts = [
    o.style ? `<w:pStyle w:val="${STYLE_ID[o.style]}"/>` : "",
    o.garderAvecSuivant ? "<w:keepNext/>" : "",
    o.avantPt !== undefined || o.apresPt !== undefined
      ? `<w:spacing${o.avantPt !== undefined ? ` w:before="${Math.round(o.avantPt * 20)}"` : ""}${o.apresPt !== undefined ? ` w:after="${Math.round(o.apresPt * 20)}"` : ""}/>`
      : "",
    o.alignement ? `<w:jc w:val="${o.alignement}"/>` : "",
  ].join("");
  return parts ? `<w:pPr>${parts}</w:pPr>` : "";
}

/** UN PARAGRAPHE. `texte` est une chaîne ou une suite de fragments de styles différents. */
export function paragraphe(texte: string | Fragment[], o: OptionsParagraphe = {}): string {
  const frags: Fragment[] = typeof texte === "string" ? [{ texte }] : texte;
  const defauts: Omit<Fragment, "texte"> = { gras: o.gras, italique: o.italique, taillePt: o.taillePt, couleur: o.couleur };
  return `<w:p>${pPr(o)}${frags.map((f) => runs(f, defauts)).join("")}</w:p>`;
}

/** Un paragraphe vide — l'espace entre deux blocs, et le paragraphe que Word exige après un tableau. */
export const vide = (apresPt = 0): string => `<w:p>${apresPt ? `<w:pPr><w:spacing w:after="${Math.round(apresPt * 20)}"/></w:pPr>` : ""}</w:p>`;

export const sautDePage = (): string => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

function normaliserCellule(c: Cellule): { contenu: Fragment[]; alignement?: Alignement; gras?: boolean; fusion?: number; fond?: string; couleur?: string } {
  if (typeof c === "string") return { contenu: [{ texte: c }] };
  if (Array.isArray(c)) return { contenu: c };
  return { ...c, contenu: typeof c.contenu === "string" ? [{ texte: c.contenu }] : c.contenu };
}

const BORDURE = (val: "single" | "nil") => `w:val="${val}" w:sz="4" w:space="0" w:color="BFBFBF"`;

/**
 * UN TABLEAU à colonnes FIXES (largeurs en centimètres), qui ne dépend donc pas de la police du
 * lecteur pour être aligné. Les cellules fusionnées horizontalement (`fusion`) servent aux
 * lignes de total ; l'en-tête se répète en haut de chaque page.
 */
export function tableau(lignes: Cellule[][], o: OptionsTableau): string {
  const largeurs = o.colonnes.map((c) => twips(c.largeurCm));
  const total = largeurs.reduce((s, w) => s + w, 0);
  const bordures = o.bordures !== false;
  const b = BORDURE(bordures ? "single" : "nil");
  const tblPr = `<w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${o.position ? `<w:jc w:val="${o.position}"/>` : ""}<w:tblLayout w:type="fixed"/>`
    + `<w:tblBorders><w:top ${b}/><w:left ${b}/><w:bottom ${b}/><w:right ${b}/><w:insideH ${b}/><w:insideV ${b}/></w:tblBorders>`
    + `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  const grid = `<w:tblGrid>${largeurs.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const taille = o.taillePt ?? 10;
  const rows = lignes.map((ligne, i) => {
    const estEntete = !!o.entete && i === 0;
    const grasLigne = estEntete || (o.lignesEnGras ?? []).includes(i);
    const fondLigne = estEntete ? hex(o.couleurEntete, "0B2545") : o.fondLignes?.[i] ? hex(o.fondLignes[i], "F2F2F2") : null;
    let col = 0;
    const cells = ligne.map((brut) => {
      const c = normaliserCellule(brut);
      const span = Math.max(1, c.fusion ?? 1);
      const w = largeurs.slice(col, col + span).reduce((s, x) => s + x, 0);
      const alignement = c.alignement ?? o.colonnes[col]?.alignement;
      col += span;
      const fond = c.fond ? hex(c.fond, "F2F2F2") : fondLigne;
      const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${fond ? `<w:shd w:val="clear" w:color="auto" w:fill="${fond}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>`;
      const couleur = c.couleur ?? (estEntete ? hex(o.couleurTexteEntete, "FFFFFF") : undefined);
      const p = paragraphe(c.contenu, { alignement, gras: grasLigne || c.gras, taillePt: taille, couleur, apresPt: 0 });
      return `<w:tc>${tcPr}${p}</w:tc>`;
    });
    const trPr = estEntete ? "<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>";
    return `<w:tr>${trPr}${cells.join("")}</w:tr>`;
  });
  return `<w:tbl>${tblPr}${grid}${rows.join("")}</w:tbl>`;
}

// ─────────────────────────── Le paquet ───────────────────────────

const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

function styles(police: string, taillePt: number, couleur: string): string {
  const demi = Math.round(taillePt * 2);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS_W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${escapeXml(police)}" w:hAnsi="${escapeXml(police)}" w:cs="${escapeXml(police)}" w:eastAsia="${escapeXml(police)}"/><w:sz w:val="${demi}"/><w:szCs w:val="${demi}"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
    + `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="${couleur}"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>`
    + `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${couleur}"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>`
    + `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="${couleur}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>`
    + `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`
    + `</w:styles>`;
}

function core(titre: string, auteur: string, maintenant: Date): string {
  const iso = maintenant.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(titre)}</dc:title><dc:creator>${escapeXml(auteur)}</dc:creator><cp:lastModifiedBy>${escapeXml(auteur)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
}

export interface OptionsComposition {
  /** Les blocs (`paragraphe`, `tableau`, `vide`…), dans l'ordre. */
  blocs: string[];
  /** Le papier en-tête : un `.docx` complet dont on garde tout, sauf le corps. */
  base?: Buffer | null;
  titre?: string;
  auteur?: string;
  /** Sans papier en-tête : la police, la taille et la couleur des titres du paquet neuf. */
  police?: string;
  taillePt?: number;
  couleurTitres?: string;
  /** Marges en centimètres (sans papier en-tête). */
  margesCm?: { haut: number; bas: number; gauche: number; droite: number };
  maintenant?: Date;
}

export interface ResultatComposition {
  octets: Buffer;
  /** Vrai quand le contenu a été posé sur un papier en-tête. */
  surPapierEnTete: boolean;
  /** Les pièces du paquet d'origine conservées telles quelles (hors `word/document.xml`). */
  piecesConservees: string[];
}

/** Le corps d'un `.docx` : ce qu'il y a entre `<w:body>` et le `w:sectPr` final. */
function bornesDuCorps(xml: string): { debut: number; fin: number } {
  const ouverture = /<w:body(?:\s[^>]*)?>/.exec(xml);
  if (!ouverture) throw new Error("papier en-tête : pas de <w:body> dans word/document.xml");
  const debut = ouverture.index + ouverture[0].length;
  const fermeture = xml.lastIndexOf("</w:body>");
  if (fermeture < debut) throw new Error("papier en-tête : <w:body> jamais refermé");
  // Le sectPr de section finale est le DERNIER `<w:sectPr` du corps. Un sectPr de paragraphe
  // (multi-sections) est plus tôt et disparaît avec le corps qu'on remplace.
  const sect = xml.lastIndexOf("<w:sectPr", fermeture);
  const fin = sect > debut ? sect : fermeture;
  return { debut, fin };
}

/**
 * COMPOSE le document. Avec `base`, le corps du papier en-tête est remplacé et tout le reste
 * est conservé à l'octet près ; sans, un paquet neuf et complet est produit.
 */
export function composerDocx(o: OptionsComposition): ResultatComposition {
  const corps = [...o.blocs, vide()].join("");
  if (o.base && o.base.length > 0) {
    const zip = new PizZip(o.base);
    const fichier = zip.file("word/document.xml");
    if (!fichier) throw new Error("papier en-tête : ce fichier n'est pas un document Word (word/document.xml absent)");
    const xml = fichier.asText();
    const { debut, fin } = bornesDuCorps(xml);
    zip.file("word/document.xml", `${xml.slice(0, debut)}${corps}${xml.slice(fin)}`);
    const piecesConservees = Object.keys(zip.files).filter((n) => !zip.files[n].dir && n !== "word/document.xml").sort();
    return { octets: zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer, surPapierEnTete: true, piecesConservees };
  }
  const m = o.margesCm ?? { haut: 2, bas: 2, gauche: 2, droite: 2 };
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS_W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${corps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(m.haut)}" w:right="${twips(m.droite)}" w:bottom="${twips(m.bas)}" w:left="${twips(m.gauche)}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/></w:sectPr></w:body></w:document>`;
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", RELS);
  zip.folder("docProps")!.file("core.xml", core(o.titre ?? "Document", o.auteur ?? "Adam", o.maintenant ?? new Date()));
  const word = zip.folder("word")!;
  word.file("document.xml", document);
  word.file("styles.xml", styles(o.police ?? "Calibri", o.taillePt ?? 10.5, hex(o.couleurTitres, "0B2545")));
  word.folder("_rels")!.file("document.xml.rels", DOC_RELS);
  return { octets: zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer, surPapierEnTete: false, piecesConservees: [] };
}

/**
 * UN PAPIER EN-TÊTE DE DÉMONSTRATION — un vrai `.docx` avec en-tête, pied de page, image et
 * styles, tel qu'une assistante de direction en dépose un. Sert aux tests et au banc ; jamais
 * en production, où l'en-tête vient de la bibliothèque de la société.
 */
export function papierEnTeteDeDemonstration(societe = "Adventum Pharma"): Buffer {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
  zip.folder("_rels")!.file(".rels", RELS.replace(/<Relationship Id="rId2"[^>]*\/>/, ""));
  const word = zip.folder("word")!;
  word.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS_W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Texte du modèle — à remplacer</w:t></w:r></w:p><w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2268" w:right="1418" w:bottom="1701" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/><w:cols w:space="708"/></w:sectPr></w:body></w:document>`);
  word.file("styles.xml", styles("Arial", 10, "1B7F79"));
  word.file("header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${NS_W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:r><w:rPr><w:b/><w:color w:val="1B7F79"/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(societe)}</w:t></w:r></w:p><w:p><w:r><w:t>Laboratoire pharmaceutique — Alger</w:t></w:r></w:p></w:hdr>`);
  word.file("footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${NS_W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>${escapeXml(societe)} — SARL au capital de 10 000 000 DZD — RC 16/00-1234567B21 — NIF 001916012345678</w:t></w:r></w:p></w:ftr>`);
  // Une image PNG d'un pixel : ce qui compte est qu'elle SURVIVE, octet pour octet.
  word.folder("media")!.file("image1.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
  word.folder("_rels")!.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
