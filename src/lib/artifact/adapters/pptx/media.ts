/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE IMAGE DANS UNE DIAPOSITIVE — mêmes quatre endroits que dans Word, un de plus à savoir.
 *
 * Word n'a qu'un seul document, donc un seul fichier de relations. PowerPoint en a UN PAR
 * DIAPOSITIVE : `ppt/slides/_rels/slide7.xml.rels`. Écrire la relation dans le mauvais fichier
 * produit une diapositive dont l'image ne s'affiche pas — et PowerPoint ne le dit pas : il
 * montre un cadre vide, ce qui se découvre en présentant devant quelqu'un.
 *
 * ── LE PLACEMENT, ET POURQUOI IL EST DIT ────────────────────────────────────────────────
 *
 * Une image de diapositive est POSITIONNÉE : x, y, largeur, hauteur, en centimètres. Sans
 * position demandée, on centre sur la diapositive et l'on borne à ce qui tient dedans. Une
 * image qui déborde de la diapositive n'est pas « presque bien » : à la projection, elle est
 * coupée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type PizZip from "pizzip";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, children, descendants, element, insertAfter, parseXml, serializeXml, setAttr,
} from "@/lib/artifact/object-model/xml";
import { cmEnEmu } from "@/lib/artifact/object-model/model";
import type { ImageLue } from "@/lib/artifact/object-model/image";

const TYPES = "[Content_Types].xml";
const TYPE_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function racineDe(doc: XmlNode, nom: string): XmlNode | null {
  if (doc.name === nom) return doc;
  for (const k of doc.children) if (k.type === "element" && k.name === nom) return k;
  return null;
}

/** `ppt/slides/slide3.xml` → `ppt/slides/_rels/slide3.xml.rels`. */
export function cheminRels(cheminDiapo: string): string {
  const i = cheminDiapo.lastIndexOf("/");
  return `${cheminDiapo.slice(0, i)}/_rels/${cheminDiapo.slice(i + 1)}.rels`;
}

function assurerTypeContenu(zip: PizZip, extension: string, mime: string): void {
  const f = zip.file(TYPES);
  if (!f) return;
  const doc = parseXml(f.asText());
  const racine = racineDe(doc, "Types");
  if (!racine) return;
  if (children(racine, "Default").some((d) => (attr(d, "Extension") ?? "").toLowerCase() === extension.toLowerCase())) return;
  insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
    element("Default", { Extension: extension, ContentType: mime }));
  zip.file(TYPES, serializeXml(doc));
}

function prochainMedia(zip: PizZip, extension: string): string {
  let n = 1;
  while (zip.file(`ppt/media/image${n}.${extension}`)) n += 1;
  return `image${n}.${extension}`;
}

/**
 * POSE LES OCTETS et la relation DE CETTE DIAPOSITIVE. Rend l'`rId` à mettre dans le `p:pic`.
 *
 * `..\/media\/…` : le chemin est relatif au fichier de relations, qui vit dans `_rels/`. Un
 * `media/…` sans remontée pointerait vers `ppt/slides/media/…`, qui n'existe pas — et
 * PowerPoint afficherait un cadre vide sans rien dire.
 */
export function poserMediaDiapo(
  zip: PizZip, cheminDiapo: string, octets: Buffer, img: ImageLue,
): { rId: string } {
  const nom = prochainMedia(zip, img.extension);
  zip.file(`ppt/media/${nom}`, octets);
  assurerTypeContenu(zip, img.extension, img.mime);

  const chemin = cheminRels(cheminDiapo);
  const f = zip.file(chemin);
  const doc = f
    ? parseXml(f.asText())
    : parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  const racine = racineDe(doc, "Relationships");
  if (!racine) throw new Error(`${chemin} illisible`);

  let max = 0;
  for (const r of children(racine, "Relationship")) {
    const m = /^rId(\d+)$/.exec(attr(r, "Id") ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  const rId = `rId${max + 1}`;
  insertAfter(racine, racine.children[racine.children.length - 1] ?? null,
    element("Relationship", { Id: rId, Type: TYPE_IMAGE, Target: `../media/${nom}` }));
  zip.file(chemin, serializeXml(doc));
  return { rId };
}

/**
 * LA FORME IMAGE. `p:pic` est la forme native de PowerPoint pour une image — pas un cadre
 * graphique, qui sert aux tableaux et aux graphiques et que l'on ne saurait ni déplacer ni
 * redimensionner avec les mêmes commandes.
 */
export function formeImage(opts: {
  rId: string;
  xCm: number; yCm: number; largeurCm: number; hauteurCm: number;
  nom: string; alt: string | null; id: number;
}): XmlNode {
  const descr = opts.alt ?? "";
  const nvPicPr = element("p:nvPicPr", {}, [
    element("p:cNvPr", { id: String(opts.id), name: opts.nom, descr }),
    element("p:cNvPicPr", {}, [element("a:picLocks", { noChangeAspect: "1" })]),
    element("p:nvPr"),
  ]);
  const blipFill = element("p:blipFill", {}, [
    element("a:blip", { "r:embed": opts.rId }),
    element("a:stretch", {}, [element("a:fillRect")]),
  ]);
  const spPr = element("p:spPr", {}, [
    element("a:xfrm", {}, [
      element("a:off", { x: String(cmEnEmu(opts.xCm)), y: String(cmEnEmu(opts.yCm)) }),
      element("a:ext", { cx: String(cmEnEmu(opts.largeurCm)), cy: String(cmEnEmu(opts.hauteurCm)) }),
    ]),
    element("a:prstGeom", { prst: "rect" }, [element("a:avLst")]),
  ]);
  return element("p:pic", {}, [nvPicPr, blipFill, spPr]);
}

/** Le prochain identifiant de forme LIBRE dans l'arbre — un doublon fait râler PowerPoint. */
export function prochainIdForme(spTree: XmlNode): number {
  let max = 1;
  for (const nv of descendants(spTree, "p:cNvPr")) {
    const v = Number(attr(nv, "id"));
    if (Number.isFinite(v)) max = Math.max(max, v);
  }
  return max + 1;
}

/** Déclare `a`, `p` et `r` sur la racine d'une diapositive si elles manquent. */
export function assurerNamespacesDiapo(racine: XmlNode): void {
  if (!attr(racine, "xmlns:a")) setAttr(racine, "xmlns:a", NS_A);
  if (!attr(racine, "xmlns:p")) setAttr(racine, "xmlns:p", NS_P);
  if (!attr(racine, "xmlns:r")) setAttr(racine, "xmlns:r", NS_R);
}

/** Repointe une forme image vers de NOUVEAUX octets. Faux si ce n'est pas une image. */
export function repointerImageDiapo(sp: XmlNode, rId: string): boolean {
  const blips = descendants(sp, "a:blip");
  if (blips.length === 0) return false;
  for (const b of blips) setAttr(b, "r:embed", rId);
  return true;
}

/**
 * LES OCTETS D'UNE IMAGE D'UNE DIAPOSITIVE — même chaîne que Word, mais les relations de CETTE
 * diapositive. Chercher dans un autre fichier de relations rendrait l'image d'une autre page,
 * et rien ne le signalerait : le rId `rId2` existe sur presque toutes les diapositives.
 */
export function octetsDeLImageDiapo(
  zip: PizZip, cheminDiapo: string, sp: XmlNode,
): { octets: Buffer; nom: string } | null {
  const blip = descendants(sp, "a:blip")[0] ?? null;
  const rId = blip ? attr(blip, "r:embed") ?? attr(blip, "r:link") : null;
  if (!rId) return null;
  const f = zip.file(cheminRels(cheminDiapo));
  if (!f) return null;
  const racine = racineDe(parseXml(f.asText()), "Relationships");
  if (!racine) return null;
  for (const r of children(racine, "Relationship")) {
    if (attr(r, "Id") !== rId) continue;
    const cible = (attr(r, "Target") ?? "").replace(/^\//, "");
    const chemin = cible.startsWith("ppt/") ? cible : `ppt/${cible.replace(/^\.\.\//, "")}`;
    const p = zip.file(chemin);
    if (!p) return null;
    return { octets: Buffer.from(p.asUint8Array()), nom: chemin.slice(chemin.lastIndexOf("/") + 1) };
  }
  return null;
}
