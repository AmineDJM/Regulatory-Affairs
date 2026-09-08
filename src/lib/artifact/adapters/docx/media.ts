/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PLOMBERIE D'UNE IMAGE DANS UN `.docx` — quatre endroits, et il faut les quatre.
 *
 * Poser une image dans un document Word ne consiste pas à écrire une balise. Il faut :
 *
 *   1. les OCTETS, dans `word/media/…` ;
 *   2. le TYPE de la partie, dans `[Content_Types].xml` — sans lui, Word ouvre le fichier et
 *      annonce un document endommagé, sans dire lequel des quatre manque ;
 *   3. la RELATION, dans `word/_rels/document.xml.rels`, qui donne l'identifiant `rId` ;
 *   4. le DESSIN, dans `document.xml`, qui pointe vers cet `rId`.
 *
 * Ce fichier existe pour que ces quatre gestes soient écrits UNE fois, ensemble, avec la raison
 * de chacun. Éparpillés dans l'adaptateur, on en oublie un — et le défaut ne se voit pas au
 * test unitaire : le zip est valide, le XML est valide, et c'est Word qui refuse.
 *
 * ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────────────────────
 *
 * Il ne lit pas le Drive, ne connaît pas les droits, ne décide pas de la taille. On lui donne
 * des octets déjà autorisés et une taille déjà calculée ; il pose.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type PizZip from "pizzip";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, children, element, insertAfter, parseXml, serializeXml, setAttr,
} from "@/lib/artifact/object-model/xml";
import { cmEnEmu } from "@/lib/artifact/object-model/model";
import type { ImageLue } from "@/lib/artifact/object-model/image";

const RELS = "word/_rels/document.xml.rels";
const TYPES = "[Content_Types].xml";
const TYPE_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

/** Les espaces de noms qu'un dessin exige. `wp` et `r` vivent sur la racine ; `a` et `pic`, sur
 *  leurs propres éléments — c'est ce que Word lui-même écrit, et cela évite de toucher la
 *  racine d'un document dont on ne connaît pas les déclarations. */
const NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

/**
 * DÉCLARE `wp` ET `r` SUR LA RACINE s'ils manquent.
 *
 * Un document produit par Word les porte toujours ; un document produit par une bibliothèque
 * tierce, pas forcément. Ajouter une déclaration qui existe déjà, avec la même valeur, est sans
 * effet — on ne compare donc pas, on pose.
 */
export function assurerNamespacesDessin(racine: XmlNode): void {
  if (!attr(racine, "xmlns:wp")) setAttr(racine, "xmlns:wp", NS_WP);
  if (!attr(racine, "xmlns:r")) setAttr(racine, "xmlns:r", NS_R);
}

function partiesRels(zip: PizZip): XmlNode {
  const f = zip.file(RELS);
  if (f) return parseXml(f.asText());
  // Un `.docx` sans relations de document est théoriquement possible (aucun lien, aucune
  // image). On en crée un plutôt que d'échouer : le refus n'apprendrait rien à personne.
  return parseXml(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
  );
}

function racineDe(doc: XmlNode, nom: string): XmlNode | null {
  if (doc.name === nom) return doc;
  for (const k of doc.children) if (k.type === "element" && k.name === nom) return k;
  return null;
}

/** Un identifiant de relation LIBRE — jamais réutilisé, même si une relation a disparu. */
function prochainRId(rels: XmlNode): string {
  let max = 0;
  for (const r of children(rels, "Relationship")) {
    const m = /^rId(\d+)$/.exec(attr(r, "Id") ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `rId${max + 1}`;
}

/** Un nom de partie LIBRE dans `word/media/`. On garde le préfixe `image` pour qu'un humain
 *  qui ouvre le zip retrouve ses petits. */
function prochainMedia(zip: PizZip, extension: string): string {
  let n = 1;
  while (zip.file(`word/media/image${n}.${extension}`)) n += 1;
  return `image${n}.${extension}`;
}

/**
 * DÉCLARE LE TYPE DE LA PARTIE dans `[Content_Types].xml`.
 *
 * On pose un `Default` par EXTENSION, comme Word : c'est ce qui rend une seconde image du même
 * type gratuite. Un `Override` par partie marcherait aussi mais alourdirait le fichier d'une
 * ligne par image, pour rien.
 */
function assurerTypeContenu(zip: PizZip, extension: string, mime: string): void {
  const f = zip.file(TYPES);
  if (!f) return;
  const doc = parseXml(f.asText());
  const racine = racineDe(doc, "Types");
  if (!racine) return;
  const deja = children(racine, "Default").some(
    (d) => (attr(d, "Extension") ?? "").toLowerCase() === extension.toLowerCase(),
  );
  if (deja) return;
  insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
    element("Default", { Extension: extension, ContentType: mime }));
  zip.file(TYPES, serializeXml(doc));
}

export interface MediaPose {
  rId: string;
  /** Le chemin de la partie, relatif à `word/` — ce que porte la relation. */
  cible: string;
}

/**
 * POSE LES OCTETS ET LEUR RELATION. Rend l'`rId` à mettre dans le dessin.
 *
 * Une NOUVELLE partie à chaque fois, même pour deux insertions de la même image : partager la
 * partie économiserait quelques kilo-octets et ferait qu'un remplacement ultérieur changerait
 * les DEUX images. Le coût de la duplication est du disque ; le coût du partage est une
 * modification qu'on n'a pas demandée.
 */
export function poserMedia(zip: PizZip, octets: Buffer, img: ImageLue): MediaPose {
  const nom = prochainMedia(zip, img.extension);
  zip.file(`word/media/${nom}`, octets);
  assurerTypeContenu(zip, img.extension, img.mime);

  const doc = partiesRels(zip);
  const racine = racineDe(doc, "Relationships");
  if (!racine) throw new Error("word/_rels/document.xml.rels illisible");
  const rId = prochainRId(racine);
  insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
    element("Relationship", { Id: rId, Type: TYPE_IMAGE, Target: `media/${nom}` }));
  zip.file(RELS, serializeXml(doc));
  return { rId, cible: `media/${nom}` };
}

/**
 * LE PARAGRAPHE QUI PORTE L'IMAGE.
 *
 * `wp:inline` et non `wp:anchor` : une image ANCRÉE flotte, et son placement dépend d'un
 * habillage que personne n'a demandé. En ligne, elle se comporte comme un caractère — elle
 * suit le texte, elle se centre avec le paragraphe, et elle ne recouvre rien.
 *
 * `docPr/@id` doit être unique dans le document : Word tolère un doublon à l'ouverture mais le
 * signale à la première modification. On le fait porter par l'appelant, qui compte les images.
 */
export function paragrapheImage(opts: {
  rId: string;
  largeurCm: number;
  hauteurCm: number;
  alt: string | null;
  docPrId: number;
  nom: string;
  alignement?: "center" | null;
}): XmlNode {
  const cx = String(cmEnEmu(opts.largeurCm));
  const cy = String(cmEnEmu(opts.hauteurCm));
  const descr = opts.alt ?? "";

  const blip = element("a:blip", { "r:embed": opts.rId });
  const stretch = element("a:stretch", {}, [element("a:fillRect")]);
  const blipFill = element("pic:blipFill", {}, [blip, stretch]);

  const nvPicPr = element("pic:nvPicPr", {}, [
    element("pic:cNvPr", { id: String(opts.docPrId), name: opts.nom, descr }),
    element("pic:cNvPicPr"),
  ]);

  const spPr = element("pic:spPr", {}, [
    element("a:xfrm", {}, [
      element("a:off", { x: "0", y: "0" }),
      element("a:ext", { cx, cy }),
    ]),
    element("a:prstGeom", { prst: "rect" }, [element("a:avLst")]),
  ]);

  const pic = element("pic:pic", { "xmlns:pic": NS_PIC }, [nvPicPr, blipFill, spPr]);
  const graphicData = element("a:graphicData", {
    uri: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  }, [pic]);
  const graphic = element("a:graphic", { "xmlns:a": NS_A }, [graphicData]);

  const inline = element("wp:inline", { distT: "0", distB: "0", distL: "0", distR: "0" }, [
    element("wp:extent", { cx, cy }),
    element("wp:effectExtent", { l: "0", t: "0", r: "0", b: "0" }),
    element("wp:docPr", { id: String(opts.docPrId), name: opts.nom, descr }),
    element("wp:cNvGraphicFramePr", {}, [
      element("a:graphicFrameLocks", { "xmlns:a": NS_A, noChangeAspect: "1" }),
    ]),
    graphic,
  ]);

  const run = element("w:r", {}, [element("w:drawing", {}, [inline])]);
  const enfants: XmlNode[] = [];
  if (opts.alignement === "center") {
    enfants.push(element("w:pPr", {}, [element("w:jc", { "w:val": "center" })]));
  }
  enfants.push(run);
  // Un paragraphe d'image ne porte PAS de texte : le texte de remplacement vit dans `descr`,
  // là où un lecteur d'écran le cherche, et non dans le corps où il s'imprimerait.
  return element("w:p", {}, enfants);
}

/**
 * REPOINTE une image existante vers de NOUVEAUX octets.
 *
 * On ne réécrit PAS la partie d'origine : elle peut être partagée par plusieurs images (Word le
 * fait quand on copie-colle), et l'écraser changerait toutes les occurrences alors qu'on n'en a
 * désigné qu'une. On pose une nouvelle partie et l'on déplace le seul `r:embed` visé — la
 * modification a exactement l'empreinte demandée.
 *
 * Rend `false` quand le nœud ne porte pas de `a:blip` : une forme dessinée, un graphique
 * incorporé. Le dire vaut mieux que remplacer autre chose que ce qu'on croit.
 */
export function repointerImage(noeud: XmlNode, rId: string): boolean {
  const blips: XmlNode[] = [];
  const pile = [noeud];
  while (pile.length > 0) {
    const n = pile.pop()!;
    if (n.type === "element" && n.name === "a:blip") blips.push(n);
    for (const k of n.children) if (k.type === "element") pile.push(k);
  }
  if (blips.length === 0) return false;
  for (const b of blips) setAttr(b, "r:embed", rId);
  return true;
}
