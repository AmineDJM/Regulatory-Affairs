/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE IMAGE DANS UN CLASSEUR — le format qui en demande le plus.
 *
 * Word pose l'image DANS le document ; PowerPoint, DANS la diapositive. Excel, lui, ne met
 * jamais d'image dans une feuille : il met un DESSIN à côté, et la feuille se contente d'y
 * renvoyer. Il faut donc six choses, pas quatre :
 *
 *   1. les octets, dans `xl/media/…` ;
 *   2. le TYPE de la partie image, dans `[Content_Types].xml` ;
 *   3. une partie DESSIN, `xl/drawings/drawingN.xml`, et son propre type déclaré ;
 *   4. les relations du DESSIN vers l'image ;
 *   5. les relations de la FEUILLE vers le dessin ;
 *   6. la balise `<drawing r:id="…"/>` dans la feuille — et À LA BONNE PLACE.
 *
 * ── LA BONNE PLACE, ET POURQUOI C'EST UN PIÈGE ──────────────────────────────────────────
 *
 * Le schéma d'une feuille est une SÉQUENCE : les éléments doivent apparaître dans un ordre
 * précis. `<drawing>` vient tard, mais pas en dernier — `tableParts` et `extLst` le suivent.
 * L'ajouter à la fin d'une feuille qui contient un tableau structuré produit un classeur
 * qu'Excel « répare » en perdant le tableau. On insère donc AVANT le premier élément qui doit
 * rester après.
 *
 * ── UNE SEULE PARTIE DESSIN PAR FEUILLE ─────────────────────────────────────────────────
 *
 * Une feuille ne peut renvoyer qu'à UN dessin. Une seconde image ne crée donc pas une seconde
 * partie : elle ajoute un ancrage dans celle qui existe. En créer une seconde ferait disparaître
 * la première image — sans erreur, sans trace.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type PizZip from "pizzip";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, child, children, descendants, element, insertAfter, insertBefore, markDirty,
  parseXml, removeChild, serializeXml, setAttr, textNode, textOf,
} from "@/lib/artifact/object-model/xml";
import { cmEnEmu, emuEnCm, formerRef } from "@/lib/artifact/object-model/model";
import type { ImageLue } from "@/lib/artifact/object-model/image";

const TYPES = "[Content_Types].xml";
const TYPE_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const TYPE_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/**
 * CE QUI DOIT RESTER APRÈS `<drawing>` dans une feuille. La liste vient du schéma OOXML ; s'en
 * remettre à « on ajoute à la fin » casse les classeurs qui portent un tableau structuré.
 */
const APRES_DRAWING = [
  "legacyDrawing", "legacyDrawingHF", "drawingHF", "picture", "oleObjects", "controls",
  "webPublishItems", "tableParts", "extLst",
];

function racineDe(doc: XmlNode, nom: string): XmlNode | null {
  if (doc.name === nom) return doc;
  for (const k of doc.children) if (k.type === "element" && k.name === nom) return k;
  return null;
}

function relsDe(chemin: string): string {
  const i = chemin.lastIndexOf("/");
  return `${chemin.slice(0, i)}/_rels/${chemin.slice(i + 1)}.rels`;
}

function lireRels(zip: PizZip, chemin: string): { doc: XmlNode; racine: XmlNode } {
  const f = zip.file(chemin);
  const doc = f
    ? parseXml(f.asText())
    : parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  const racine = racineDe(doc, "Relationships");
  if (!racine) throw new Error(`${chemin} illisible`);
  return { doc, racine };
}

function ajouterRel(racine: XmlNode, type: string, cible: string): string {
  let max = 0;
  for (const r of children(racine, "Relationship")) {
    const m = /^rId(\d+)$/.exec(attr(r, "Id") ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  const rId = `rId${max + 1}`;
  insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
    element("Relationship", { Id: rId, Type: type, Target: cible }));
  return rId;
}

function assurerTypes(zip: PizZip, extension: string, mime: string, dessin: string | null): void {
  const f = zip.file(TYPES);
  if (!f) return;
  const doc = parseXml(f.asText());
  const racine = racineDe(doc, "Types");
  if (!racine) return;
  let change = false;

  if (!children(racine, "Default").some((d) => (attr(d, "Extension") ?? "").toLowerCase() === extension.toLowerCase())) {
    insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
      element("Default", { Extension: extension, ContentType: mime }));
    change = true;
  }
  if (dessin && !children(racine, "Override").some((o) => attr(o, "PartName") === `/${dessin}`)) {
    insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
      element("Override", { PartName: `/${dessin}`, ContentType: CT_DRAWING }));
    change = true;
  }
  if (change) zip.file(TYPES, serializeXml(doc));
}

function prochainMedia(zip: PizZip, extension: string): string {
  let n = 1;
  while (zip.file(`xl/media/image${n}.${extension}`)) n += 1;
  return `image${n}.${extension}`;
}

function prochainDessin(zip: PizZip): string {
  let n = 1;
  while (zip.file(`xl/drawings/drawing${n}.xml`)) n += 1;
  return `xl/drawings/drawing${n}.xml`;
}

/** Le dessin DÉJÀ rattaché à cette feuille, s'il y en a un — jamais un second (voir l'en-tête). */
function dessinDeLaFeuille(zip: PizZip, cheminFeuille: string, ws: XmlNode): string | null {
  const balise = child(ws, "drawing");
  if (!balise) return null;
  const rId = attr(balise, "r:id");
  if (!rId) return null;
  const { racine } = lireRels(zip, relsDe(cheminFeuille));
  for (const r of children(racine, "Relationship")) {
    if (attr(r, "Id") !== rId) continue;
    const cible = attr(r, "Target") ?? "";
    // `../drawings/drawing1.xml` depuis `xl/worksheets/_rels/` → `xl/drawings/drawing1.xml`.
    return cible.replace(/^\.\.\//, "xl/").replace(/^\//, "");
  }
  return null;
}

export interface ImagePosee {
  /** Le chemin de la partie dessin utilisée — la même pour toutes les images d'une feuille. */
  dessin: string;
  /** Combien d'images porte désormais ce dessin. */
  ancrages: number;
}

/**
 * POSE UNE IMAGE sur une feuille, ancrée à une cellule (0-indexée en interne, 1-indexée dehors).
 *
 * `oneCellAnchor` : l'image est accrochée à UNE cellule et garde sa taille. `twoCellAnchor`
 * l'étirerait entre deux cellules — donc elle se déformerait au moindre redimensionnement de
 * colonne, ce que personne ne demande en disant « mets le logo en B2 ».
 */
export function poserImageFeuille(
  zip: PizZip,
  cheminFeuille: string,
  ws: XmlNode,
  octets: Buffer,
  img: ImageLue,
  opts: { ligne: number; colonne: number; largeurCm: number; hauteurCm: number; nom: string; alt: string | null },
): ImagePosee {
  // 1. Les octets.
  const nomMedia = prochainMedia(zip, img.extension);
  zip.file(`xl/media/${nomMedia}`, octets);

  // 2-3. La partie dessin : celle de la feuille, ou une neuve.
  const existant = dessinDeLaFeuille(zip, cheminFeuille, ws);
  const cheminDessin = existant ?? prochainDessin(zip);
  const dessinDoc = existant && zip.file(cheminDessin)
    ? parseXml(zip.file(cheminDessin)!.asText())
    : parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}"/>`);
  const wsDr = racineDe(dessinDoc, "xdr:wsDr");
  if (!wsDr) throw new Error(`${cheminDessin} illisible`);

  // 4. La relation du DESSIN vers l'image.
  const relsDessin = lireRels(zip, relsDe(cheminDessin));
  const rIdImage = ajouterRel(relsDessin.racine, TYPE_IMAGE, `../media/${nomMedia}`);
  zip.file(relsDe(cheminDessin), serializeXml(relsDessin.doc));

  // L'ancrage lui-même.
  const cx = String(cmEnEmu(opts.largeurCm));
  const cy = String(cmEnEmu(opts.hauteurCm));
  const id = children(wsDr, "xdr:oneCellAnchor").length + children(wsDr, "xdr:twoCellAnchor").length + 1;
  const ancre = element("xdr:oneCellAnchor", {}, [
    element("xdr:from", {}, [
      element("xdr:col", {}, [textNode(String(opts.colonne - 1))]),
      element("xdr:colOff", {}, [textNode("0")]),
      element("xdr:row", {}, [textNode(String(opts.ligne - 1))]),
      element("xdr:rowOff", {}, [textNode("0")]),
    ]),
    element("xdr:ext", { cx, cy }),
    element("xdr:pic", {}, [
      element("xdr:nvPicPr", {}, [
        element("xdr:cNvPr", { id: String(id), name: opts.nom, descr: opts.alt ?? "" }),
        element("xdr:cNvPicPr", {}, [element("a:picLocks", { noChangeAspect: "1" })]),
      ]),
      element("xdr:blipFill", {}, [
        element("a:blip", { "xmlns:r": NS_R, "r:embed": rIdImage }),
        element("a:stretch", {}, [element("a:fillRect")]),
      ]),
      element("xdr:spPr", {}, [
        element("a:xfrm", {}, [
          element("a:off", { x: "0", y: "0" }),
          element("a:ext", { cx, cy }),
        ]),
        element("a:prstGeom", { prst: "rect" }, [element("a:avLst")]),
      ]),
    ]),
    element("xdr:clientData"),
  ]);
  insertAfter(wsDr, wsDr.children[wsDr.children.length - 1] ?? null, ancre);
  zip.file(cheminDessin, serializeXml(dessinDoc));

  // 5-6. La feuille renvoie au dessin — une seule fois, et à la bonne place.
  if (!existant) {
    const relsFeuille = lireRels(zip, relsDe(cheminFeuille));
    const cibleRelative = `../drawings/${cheminDessin.slice(cheminDessin.lastIndexOf("/") + 1)}`;
    const rIdDessin = ajouterRel(relsFeuille.racine, TYPE_DRAWING, cibleRelative);
    zip.file(relsDe(cheminFeuille), serializeXml(relsFeuille.doc));

    const balise = element("drawing", { "r:id": rIdDessin });
    const apres = ws.children.find((k) => k.type === "element" && APRES_DRAWING.includes(k.name));
    if (apres) insertBefore(ws, apres, balise);
    else insertAfter(ws, ws.children[ws.children.length - 1] ?? null, balise);
  }

  assurerTypes(zip, img.extension, img.mime, cheminDessin);
  return {
    dessin: cheminDessin,
    ancrages: children(wsDr, "xdr:oneCellAnchor").length + children(wsDr, "xdr:twoCellAnchor").length,
  };
}

// ─────────────────────── Lire, remplacer, retirer une image d'une feuille ───────────────────────

/**
 * UNE IMAGE TELLE QU'ON PEUT LA DÉSIGNER. `ancre` est la cellule où l'image commence, en
 * notation humaine (« B2 ») : c'est ce que la personne voit et ce par quoi elle en parle.
 */
export interface ImageFeuille {
  index: number;
  /** L'ancrage (`xdr:oneCellAnchor`…) — ce qu'on retire pour supprimer l'image. */
  ancrage: XmlNode;
  /** Le `xdr:pic` lui-même — ce qu'on repointe pour la remplacer. */
  pic: XmlNode;
  ancre: string | null;
  largeurCm: number;
  hauteurCm: number;
  nom: string;
  description: string | null;
}

export interface DessinFeuille {
  chemin: string;
  doc: XmlNode;
  wsDr: XmlNode;
  images: ImageFeuille[];
}

const ANCRAGES = ["xdr:oneCellAnchor", "xdr:twoCellAnchor", "xdr:absoluteAnchor"];

function entier(n: XmlNode | null): number | null {
  if (!n) return null;
  const v = Number(textOf(n).trim());
  return Number.isFinite(v) ? v : null;
}

/**
 * LE DESSIN DE CETTE FEUILLE, DÉJÀ LU — `null` si la feuille n'en a pas.
 *
 * On lit la TAILLE là où elle est vraiment : `xdr:ext` sur un `oneCellAnchor`, et l'`a:ext` du
 * `spPr` sinon. Un `twoCellAnchor` n'a pas de taille propre — elle dépend des colonnes — et
 * l'`a:ext` du `spPr` en donne la dernière valeur connue, ce qui est ce que la personne a vu.
 */
export function ouvrirDessinFeuille(zip: PizZip, cheminFeuille: string, ws: XmlNode): DessinFeuille | null {
  const chemin = dessinDeLaFeuille(zip, cheminFeuille, ws);
  if (!chemin) return null;
  const f = zip.file(chemin);
  if (!f) return null;
  const doc = parseXml(f.asText());
  const wsDr = racineDe(doc, "xdr:wsDr");
  if (!wsDr) return null;

  const images: ImageFeuille[] = [];
  for (const ancrage of wsDr.children) {
    if (ancrage.type !== "element" || !ANCRAGES.includes(ancrage.name)) continue;
    const pic = child(ancrage, "xdr:pic");
    if (!pic) continue;
    const from = child(ancrage, "xdr:from");
    const col = from ? entier(child(from, "xdr:col")) : null;
    const row = from ? entier(child(from, "xdr:row")) : null;
    const extAncrage = child(ancrage, "xdr:ext");
    const spPr = child(pic, "xdr:spPr");
    const xfrm = spPr ? child(spPr, "a:xfrm") : null;
    const extForme = xfrm ? child(xfrm, "a:ext") : null;
    const ext = extAncrage ?? extForme;
    const cNvPr = child(child(pic, "xdr:nvPicPr") ?? element("x"), "xdr:cNvPr");
    const descr = cNvPr ? attr(cNvPr, "descr") : null;
    images.push({
      index: images.length + 1,
      ancrage,
      pic,
      ancre: col !== null && row !== null ? formerRef(row + 1, col + 1) : null,
      largeurCm: ext ? emuEnCm(Number(attr(ext, "cx") ?? "0")) : 0,
      hauteurCm: ext ? emuEnCm(Number(attr(ext, "cy") ?? "0")) : 0,
      nom: (cNvPr ? attr(cNvPr, "name") : null) ?? `Image ${images.length + 1}`,
      description: descr && descr.trim() ? descr : null,
    });
  }
  return { chemin, doc, wsDr, images };
}

/** Écrit le dessin modifié. À appeler APRÈS toute mutation d'un `ImageFeuille`. */
export function enregistrerDessin(zip: PizZip, d: DessinFeuille): void {
  zip.file(d.chemin, serializeXml(d.doc));
}

/**
 * POSE LES OCTETS et la relation DU DESSIN — sans créer d'ancrage. C'est ce dont un
 * REMPLACEMENT a besoin : l'ancrage existe déjà, seuls les octets changent.
 */
export function poserMediaDessin(
  zip: PizZip, cheminDessin: string, octets: Buffer, img: ImageLue,
): { rId: string } {
  const nom = prochainMedia(zip, img.extension);
  zip.file(`xl/media/${nom}`, octets);
  const rels = lireRels(zip, relsDe(cheminDessin));
  const rId = ajouterRel(rels.racine, TYPE_IMAGE, `../media/${nom}`);
  zip.file(relsDe(cheminDessin), serializeXml(rels.doc));
  assurerTypes(zip, img.extension, img.mime, null);
  return { rId };
}

/** Repointe une image vers de NOUVEAUX octets. Faux si ce `xdr:pic` ne porte pas de `a:blip`. */
export function repointerImageFeuille(pic: XmlNode, rId: string): boolean {
  const blips = descendants(pic, "a:blip");
  if (blips.length === 0) return false;
  for (const b of blips) setAttr(b, "r:embed", rId);
  return true;
}

/** Redimensionne une image de feuille — les DEUX endroits, sinon Excel affiche l'ancienne taille. */
export function redimensionnerImageFeuille(i: ImageFeuille, largeurCm: number, hauteurCm: number): void {
  const cx = String(cmEnEmu(largeurCm));
  const cy = String(cmEnEmu(hauteurCm));
  const extAncrage = child(i.ancrage, "xdr:ext");
  if (extAncrage) { setAttr(extAncrage, "cx", cx); setAttr(extAncrage, "cy", cy); }
  const spPr = child(i.pic, "xdr:spPr");
  const xfrm = spPr ? child(spPr, "a:xfrm") : null;
  const ext = xfrm ? child(xfrm, "a:ext") : null;
  if (ext) { setAttr(ext, "cx", cx); setAttr(ext, "cy", cy); }
}

/**
 * RETIRE une image — l'ANCRAGE entier, jamais le seul `xdr:pic`.
 *
 * Un ancrage vide reste un objet pour Excel : il « répare » le classeur à l'ouverture, ce qui
 * se traduit par un avertissement rouge sur un fichier qu'on vient d'envoyer.
 */
export function retirerImageFeuille(d: DessinFeuille, i: ImageFeuille): boolean {
  return removeChild(d.wsDr, i.ancrage);
}

/**
 * LA FEUILLE NE RENVOIE PLUS AU DESSIN — quand on vient d'en retirer la dernière image.
 *
 * Laisser la balise `<drawing>` et la partie vide n'affiche rien de faux, mais un classeur
 * qu'on rouvre garde un objet dessin sans contenu ; Excel le signale sur certains fichiers. On
 * ne supprime PAS la partie elle-même : d'autres relations (`legacyDrawing`, un commentaire)
 * peuvent y renvoyer, et une partie orpheline est inerte là où une relation morte ne l'est pas.
 */
export function detacherDessinSiVide(zip: PizZip, cheminFeuille: string, ws: XmlNode, d: DessinFeuille): void {
  if (d.images.length > 0) return;
  const balise = child(ws, "drawing");
  if (!balise) return;
  removeChild(ws, balise);
  markDirty(ws);
}

/**
 * LES OCTETS D'UNE IMAGE D'UNE FEUILLE — la relation vit dans le DESSIN, pas dans la feuille.
 * Chercher dans les relations de la feuille ne trouverait que le dessin lui-même, et rendrait
 * un XML là où l'on attend une image.
 */
export function octetsDeLImageFeuille(
  zip: PizZip, cheminDessin: string, pic: XmlNode,
): { octets: Buffer; nom: string } | null {
  const blip = descendants(pic, "a:blip")[0] ?? null;
  const rId = blip ? attr(blip, "r:embed") ?? attr(blip, "r:link") : null;
  if (!rId) return null;
  const { racine } = lireRels(zip, relsDe(cheminDessin));
  for (const r of children(racine, "Relationship")) {
    if (attr(r, "Id") !== rId) continue;
    const cible = (attr(r, "Target") ?? "").replace(/^\//, "");
    const chemin = cible.startsWith("xl/") ? cible : `xl/${cible.replace(/^\.\.\//, "")}`;
    const f = zip.file(chemin);
    if (!f) return null;
    return { octets: Buffer.from(f.asUint8Array()), nom: chemin.slice(chemin.lastIndexOf("/") + 1) };
  }
  return null;
}
