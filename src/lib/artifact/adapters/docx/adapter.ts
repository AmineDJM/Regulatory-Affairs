/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR WORD (§12) — « Centre le titre, réduis-le à 16, mets-le en Aptos. »
 *
 * ── CE QU'IL FAIT, ET CE QU'IL NE FAIT SURTOUT PAS ──────────────────────────────────────
 *
 * Il ouvre le ZIP, analyse `word/document.xml` en gardant chaque tranche de source
 * (`object-model/xml.ts`), construit un MODÈLE d'objets numérotés à l'humaine, applique des
 * commandes typées, et ré-écrit le ZIP en ne reconstruisant QUE les nœuds touchés.
 *
 * Il ne re-génère JAMAIS le document. C'est la différence entre « Adam modifie ton contrat » et
 * « Adam te rend un contrat qui ressemble au tien » : la seconde version perd les images, les
 * en-têtes, la numérotation automatique et les styles de la maison, et personne ne s'en aperçoit
 * avant que le client ne reçoive le fichier.
 *
 * ── LA NUMÉROTATION, QUI EST LE VRAI PIÈGE (§17) ────────────────────────────────────────
 *
 * « Supprime le troisième paragraphe » : le troisième que la PERSONNE voit. Un `.docx` compte
 * aussi les paragraphes des cellules de tableau, ceux des en-têtes, et les paragraphes vides
 * que Word insère après chaque tableau. Le modèle ne numérote QUE les paragraphes de corps —
 * `inTable` les distingue et ils sont exclus du rang — et `numbering.test.ts` le tient.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import PizZip from "pizzip";
import type {
  Alignment, DocxModel, ImageNode, ParagraphNode, RunNode, TableNode, TextStyle,
} from "@/lib/artifact/object-model/model";
import {
  STYLE_NEUTRE, cmEnEmu, cmEnTwip, demiPtEnPt, emuEnCm, ptEnDemiPt, twipEnCm,
} from "@/lib/artifact/object-model/model";
import { abreger, normaliserTexte } from "@/lib/artifact/object-model/text";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import { resoudre } from "@/lib/artifact/commands/resolve";
import type { AdaptateurArtefact, DocumentOuvert, EffetCommande, Validation } from "@/lib/artifact/adapters/contract";
import { effetEchec, effetOk } from "@/lib/artifact/adapters/contract";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, child, children, cloneNode, descendants, element, ensureChild, firstDescendant,
  insertAfter, insertBefore, markDirty, parseXml, removeChild, serializeXml, setAttr, textNode, textOf,
} from "@/lib/artifact/object-model/xml";

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALIGN_OOXML: Record<Alignment, string> = { left: "left", center: "center", right: "right", justify: "both" };
const ALIGN_MODELE: Record<string, Alignment> = { left: "left", start: "left", center: "center", right: "right", end: "right", both: "justify", distribute: "justify" };

/** Ordre imposé par le schéma pour les enfants de `w:pPr`. Le violer rend le fichier illisible. */
const ORDRE_PPR = ["w:pStyle", "w:numPr", "w:pBdr", "w:shd", "w:tabs", "w:spacing", "w:ind", "w:jc"];
/** Idem pour `w:rPr` : `w:rFonts` ouvre, `w:color` et `w:sz` suivent. */
const ORDRE_RPR = ["w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:strike", "w:color", "w:sz", "w:szCs", "w:u"];

// ─────────────────────────── Lecture du modèle ───────────────────────────

/** Le `w:rPr` d'un fragment, traduit en unités humaines. */
function lireStyleRun(run: XmlNode): TextStyle {
  const rPr = child(run, "w:rPr");
  if (!rPr) return { ...STYLE_NEUTRE };
  const onOff = (nom: string): boolean => {
    const el = child(rPr, nom);
    if (!el) return false;
    const v = attr(el, "w:val");
    // OOXML : la balise SEULE vaut « vrai » ; `w:val="0"` et `"false"` valent faux.
    return v === null || !["0", "false", "off"].includes(v);
  };
  const sz = child(rPr, "w:sz");
  const szVal = sz ? Number(attr(sz, "w:val")) : NaN;
  const fonts = child(rPr, "w:rFonts");
  const color = child(rPr, "w:color");
  const colorVal = color ? attr(color, "w:val") : null;
  return {
    bold: onOff("w:b"),
    italic: onOff("w:i"),
    underline: Boolean(child(rPr, "w:u")),
    sizePt: Number.isFinite(szVal) && szVal > 0 ? demiPtEnPt(szVal) : null,
    font: fonts ? attr(fonts, "w:ascii") ?? attr(fonts, "w:hAnsi") ?? attr(fonts, "w:cs") : null,
    color: colorVal && colorVal !== "auto" ? colorVal.toUpperCase() : null,
  };
}

function lireImages(p: XmlNode, depart: number): { images: ImageNode[]; noeuds: XmlNode[] } {
  const images: ImageNode[] = [];
  const noeuds: XmlNode[] = [];
  // `wp:inline` (dans le fil du texte) et `wp:anchor` (flottante) portent tous deux `wp:extent`.
  for (const balise of ["wp:inline", "wp:anchor"]) {
    for (const el of descendants(p, balise)) {
      const extent = child(el, "wp:extent");
      const docPr = child(el, "wp:docPr");
      const cx = extent ? Number(attr(extent, "cx")) : NaN;
      const cy = extent ? Number(attr(extent, "cy")) : NaN;
      images.push({
        id: `img${depart + images.length + 1}`,
        index: depart + images.length + 1,
        widthCm: Number.isFinite(cx) ? emuEnCm(cx) : 0,
        heightCm: Number.isFinite(cy) ? emuEnCm(cy) : 0,
        description: docPr ? attr(docPr, "descr") ?? attr(docPr, "name") : null,
      });
      noeuds.push(el);
    }
  }
  return { images, noeuds };
}

interface EtatDocx {
  zip: PizZip;
  racine: XmlNode;
  body: XmlNode;
  /** Paragraphes de CORPS, dans l'ordre, avec leur nœud XML. Reconstruit après chaque commande. */
  paragraphes: { noeud: XmlNode; modele: ParagraphNode }[];
  tables: { noeud: XmlNode; modele: TableNode }[];
  images: { noeud: XmlNode; modele: ImageNode }[];
  modele: DocxModel;
}

/** Un `w:p` est-il DANS un tableau ? On remonte : un `w:tc` au-dessus tranche la question. */
function dansTableau(p: XmlNode): boolean {
  let n = p.parent;
  while (n) {
    if (n.name === "w:tc") return true;
    n = n.parent;
  }
  return false;
}

function lireParagraphe(p: XmlNode, index: number, imgDepart: number): { modele: ParagraphNode; imgNoeuds: XmlNode[] } {
  const pPr = child(p, "w:pPr");
  const jc = pPr ? child(pPr, "w:jc") : null;
  const jcVal = jc ? attr(jc, "w:val") : null;
  const pStyle = pPr ? child(pPr, "w:pStyle") : null;
  const spacing = pPr ? child(pPr, "w:spacing") : null;
  const ind = pPr ? child(pPr, "w:ind") : null;

  const runs: RunNode[] = [];
  let r = 0;
  for (const run of children(p, "w:r")) {
    r += 1;
    // Uniquement les `w:t` : `textOf(run)` ramasserait aussi les codes de champ (`w:instrText`),
    // qui ne sont pas du texte lisible et fausseraient « le paragraphe qui contient … ».
    const contenu = children(run, "w:t").map(textOf).join("");
    runs.push({ id: `p${index}.r${r}`, index: r, text: contenu, style: lireStyleRun(run) });
  }
  const { images, noeuds } = lireImages(p, imgDepart);
  const nombreTwip = (el: XmlNode | null, a: string): number | null => {
    if (!el) return null;
    const v = Number(attr(el, a));
    return Number.isFinite(v) ? twipEnCm(v) : null;
  };
  const nombrePt = (el: XmlNode | null, a: string): number | null => {
    if (!el) return null;
    const v = Number(attr(el, a));
    // `w:spacing` s'exprime en vingtièmes de point.
    return Number.isFinite(v) ? Math.round((v / 20) * 10) / 10 : null;
  };
  const dominant = runs.find((x) => x.text.trim())?.style ?? runs[0]?.style ?? { ...STYLE_NEUTRE };

  return {
    modele: {
      id: `p${index}`,
      index,
      text: runs.map((x) => x.text).join(""),
      alignment: jcVal ? ALIGN_MODELE[jcVal] ?? null : null,
      styleName: pStyle ? attr(pStyle, "w:val") : null,
      style: dominant,
      runs,
      indentLeftCm: nombreTwip(ind, "w:left") ?? nombreTwip(ind, "w:start"),
      indentRightCm: nombreTwip(ind, "w:right") ?? nombreTwip(ind, "w:end"),
      spacingBeforePt: nombrePt(spacing, "w:before"),
      spacingAfterPt: nombrePt(spacing, "w:after"),
      inTable: dansTableau(p),
      images,
    },
    imgNoeuds: noeuds,
  };
}

function lireTable(t: XmlNode, index: number): TableNode {
  const lignes = children(t, "w:tr");
  const cells: TableNode["cells"] = [];
  let cols = 0;
  lignes.forEach((tr, i) => {
    const tcs = children(tr, "w:tc");
    cols = Math.max(cols, tcs.length);
    tcs.forEach((tc, j) => {
      cells.push({ id: `t${index}.r${i + 1}.c${j + 1}`, row: i + 1, col: j + 1, text: textOf(tc).trim() });
    });
  });
  return {
    id: `t${index}`, index, rows: lignes.length, cols, cells,
    header: cells.filter((c) => c.row === 1).sort((a, b) => a.col - b.col).map((c) => c.text),
  };
}

function construireEtat(zip: PizZip, racine: XmlNode): EtatDocx {
  const body = firstDescendant(racine, "w:body") ?? racine;

  const paragraphes: EtatDocx["paragraphes"] = [];
  const images: EtatDocx["images"] = [];
  let rang = 0;
  for (const p of descendants(body, "w:p")) {
    const enTable = dansTableau(p);
    const provisoire = lireParagraphe(p, 0, images.length);
    provisoire.modele.images.forEach((m, k) => images.push({ noeud: provisoire.imgNoeuds[k], modele: m }));
    if (enTable) continue;

    /**
     * NE REÇOIVENT UN RANG QUE LES PARAGRAPHES VISIBLES.
     *
     * Word insère un `<w:p/>` vide après chaque tableau — c'est obligatoire dans le format, et
     * ce paragraphe n'apparaît nulle part à l'écran. Le compter ferait que « supprime le
     * troisième paragraphe » désignerait, dans un document à tableaux, un paragraphe de plus
     * que celui que la personne montre du doigt. Le décalage serait invisible au test et
     * catastrophique à l'usage.
     *
     * Ces paragraphes restent DANS le document — on ne les supprime jamais, leur retrait
     * casserait la mise en page — ils sont seulement hors du comptage humain.
     */
    const visible = provisoire.modele.text.trim().length > 0 || provisoire.modele.images.length > 0;
    if (!visible) continue;
    rang += 1;
    const { modele } = lireParagraphe(p, rang, images.length - provisoire.modele.images.length);
    paragraphes.push({ noeud: p, modele });
  }

  const tables: EtatDocx["tables"] = [];
  // Uniquement les tableaux de PREMIER niveau : un tableau imbriqué n'est pas « le 2ᵉ tableau ».
  children(body, "w:tbl").forEach((t, i) => tables.push({ noeud: t, modele: lireTable(t, i + 1) }));

  const sectPr = firstDescendant(body, "w:sectPr");
  const pgSz = sectPr ? child(sectPr, "w:pgSz") : null;
  const pgMar = sectPr ? child(sectPr, "w:pgMar") : null;
  const twip = (el: XmlNode | null, a: string, defaut: number): number => {
    if (!el) return defaut;
    const v = Number(attr(el, a));
    return Number.isFinite(v) ? twipEnCm(v) : defaut;
  };

  const modele: DocxModel = {
    kind: "DOCX",
    paragraphs: paragraphes.map((x) => x.modele),
    tables: tables.map((x) => x.modele),
    images: images.map((x) => x.modele),
    pageWidthCm: twip(pgSz, "w:w", 21),
    pageHeightCm: twip(pgSz, "w:h", 29.7),
    marginTopCm: twip(pgMar, "w:top", 2.5),
    marginBottomCm: twip(pgMar, "w:bottom", 2.5),
    marginLeftCm: twip(pgMar, "w:left", 2.5),
    marginRightCm: twip(pgMar, "w:right", 2.5),
    hasHeader: Object.keys(zip.files).some((f) => /^word\/header\d*\.xml$/.test(f)),
    hasFooter: Object.keys(zip.files).some((f) => /^word\/footer\d*\.xml$/.test(f)),
  };
  return { zip, racine, body, paragraphes, tables, images, modele };
}

// ─────────────────────────── Écriture ───────────────────────────

function pPr(p: XmlNode): XmlNode {
  // `w:pPr` doit être le PREMIER enfant de `w:p` — sinon Word refuse le document.
  const existant = child(p, "w:pPr");
  if (existant) return existant;
  const el = element("w:pPr");
  el.parent = p;
  p.children.unshift(el);
  markDirty(p);
  return el;
}

function rPr(run: XmlNode): XmlNode {
  const existant = child(run, "w:rPr");
  if (existant) return existant;
  const el = element("w:rPr");
  el.parent = run;
  run.children.unshift(el);
  markDirty(run);
  return el;
}

/** Pose (ou retire) une balise « oui/non » du style OOXML : `<w:b/>` présent = gras. */
function poserOnOff(parent: XmlNode, nom: string, actif: boolean, ordre: string[]): void {
  const existant = child(parent, nom);
  if (actif) {
    if (existant) { existant.attrs.delete("w:val"); markDirty(existant); }
    else ensureChild(parent, nom, ordre.slice(0, ordre.indexOf(nom)));
  } else if (existant) {
    removeChild(parent, existant);
  }
}

/** Applique la mise en forme demandée sur un `w:rPr` DÉJÀ rattaché à l'arbre. */
function appliquerStyleProps(props: XmlNode, c: CommandeArtefact): void {
  if (c.gras !== null) poserOnOff(props, "w:b", c.gras, ORDRE_RPR);
  if (c.italique !== null) poserOnOff(props, "w:i", c.italique, ORDRE_RPR);
  if (c.souligne !== null) {
    const u = child(props, "w:u");
    if (c.souligne) setAttr(u ?? ensureChild(props, "w:u", ORDRE_RPR.slice(0, ORDRE_RPR.indexOf("w:u"))), "w:val", "single");
    else if (u) removeChild(props, u);
  }
  if (c.taillePt !== null) {
    const demi = String(ptEnDemiPt(c.taillePt));
    setAttr(ensureChild(props, "w:sz", ORDRE_RPR.slice(0, ORDRE_RPR.indexOf("w:sz"))), "w:val", demi);
    // `w:szCs` gouverne les écritures complexes (arabe) : sans lui, un titre réduit à 16 pt reste
    // à 24 pt dans les passages arabes du document, ce qui est incompréhensible pour la personne.
    setAttr(ensureChild(props, "w:szCs", ORDRE_RPR.slice(0, ORDRE_RPR.indexOf("w:szCs"))), "w:val", demi);
  }
  if (c.police !== null) {
    const f = ensureChild(props, "w:rFonts", []);
    for (const a of ["w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"]) setAttr(f, a, c.police);
  }
  if (c.couleur !== null) {
    setAttr(ensureChild(props, "w:color", ORDRE_RPR.slice(0, ORDRE_RPR.indexOf("w:color"))), "w:val", c.couleur.toUpperCase());
  }
}

/** Fabrique un `w:r` portant ce texte, en copiant le style d'un fragment de référence. */
function nouveauRun(texte: string, modele: XmlNode | null): XmlNode {
  const run = element("w:r");
  if (modele) {
    const src = child(modele, "w:rPr");
    if (src) {
      const copie = cloneNode(src, run);
      copie.raw = null;
      run.children.push(copie);
    }
  }
  const t = element("w:t", { "xml:space": "preserve" }, [textNode(texte)]);
  t.parent = run;
  run.children.push(t);
  run.selfClosing = false;
  return run;
}

/** Remplace tout le texte d'un paragraphe par un seul fragment, en gardant sa mise en forme. */
function remplacerTexteParagraphe(p: XmlNode, texte: string): void {
  const runs = children(p, "w:r");
  const reference = runs[0] ?? null;
  for (const r of runs) removeChild(p, r);
  // Les `w:hyperlink` contiennent aussi du texte : les retirer évite un doublon invisible.
  for (const h of children(p, "w:hyperlink")) removeChild(p, h);
  if (texte) insertAfter(p, child(p, "w:pPr"), nouveauRun(texte, reference));
  markDirty(p);
}

const libelleParagraphe = (p: ParagraphNode): string => `¶${p.index} ${abreger(p.text || "(vide)", 40)}`;

// ─────────────────────────── Le document ouvert ───────────────────────────

class DocxOuvert implements DocumentOuvert {
  format = "DOCX" as const;
  private etat: EtatDocx;

  constructor(zip: PizZip, racine: XmlNode) {
    this.etat = construireEtat(zip, racine);
  }

  modele(): DocxModel { return this.etat.modele; }

  /** Reconstruit le modèle : les rangs bougent dès qu'un paragraphe est inséré ou supprimé. */
  private rafraichir(): void {
    this.etat = construireEtat(this.etat.zip, this.etat.racine);
  }

  private designables() {
    return this.etat.paragraphes.map((x) => ({ id: x.modele.id, index: x.modele.index, texte: x.modele.text, noeud: x.noeud, modele: x.modele }));
  }

  private designablesTables() {
    return this.etat.tables.map((x) => ({ id: x.modele.id, index: x.modele.index, texte: x.modele.header.join(" "), noeud: x.noeud, modele: x.modele }));
  }

  private designablesImages() {
    return this.etat.images.map((x) => ({ id: x.modele.id, index: x.modele.index, texte: x.modele.description ?? "", noeud: x.noeud, modele: x.modele }));
  }

  appliquer(c: CommandeArtefact): EffetCommande {
    const effet = this.executer(c);
    if (effet.ok) this.rafraichir();
    return effet;
  }

  private executer(c: CommandeArtefact): EffetCommande {
    switch (c.op) {
      case "docx.align": return this.align(c);
      case "docx.format_texte": return this.formatTexte(c);
      case "docx.espacement": return this.espacement(c);
      case "docx.retrait": return this.retrait(c);
      case "docx.texte": return this.texte(c);
      case "docx.inserer_paragraphe": return this.insererParagraphe(c);
      case "docx.supprimer_paragraphe": return this.supprimerParagraphe(c);
      case "docx.deplacer": return this.deplacer(c);
      case "docx.remplacer_texte": return this.remplacerTexte(c);
      case "docx.cellule": return this.cellule(c);
      case "docx.inserer_ligne": return this.insererLigne(c);
      case "docx.supprimer_ligne": return this.supprimerLigne(c);
      case "docx.image_taille": return this.imageTaille(c);
      case "docx.supprimer_image": return this.supprimerImage(c);
      default: return effetEchec(`opération « ${c.op} » non gérée par l'adaptateur Word`);
    }
  }

  /** Résout un paragraphe, ou rend l'échec tout fait (avec les candidats à départager). */
  private ciblerParagraphe(c: CommandeArtefact) {
    const r = resoudre(c.cible, this.designables(), {
      libelle: "paragraphe",
      estTitre: (p) => /^(Heading|Titre|Title)/i.test(p.modele.styleName ?? ""),
    });
    if (r.etat === "TROUVE") return { ok: true as const, p: r.objet };
    const candidats = r.etat === "AMBIGU" ? r.candidats.map((x) => ({ id: x.id, libelle: libelleParagraphe(x.modele) })) : [];
    return { ok: false as const, echec: effetEchec(r.motif, candidats) };
  }

  private align(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const val = ALIGN_OOXML[c.alignement as Alignment];
    setAttr(ensureChild(pPr(t.p.noeud), "w:jc", ORDRE_PPR.slice(0, ORDRE_PPR.indexOf("w:jc"))), "w:val", val);
    const mot = { left: "à gauche", center: "centré", right: "à droite", justify: "justifié" }[c.alignement as Alignment];
    return effetOk(`${libelleParagraphe(t.p.modele)} → ${mot}.`, [t.p.id]);
  }

  private formatTexte(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const runs = children(t.p.noeud, "w:r");
    if (runs.length === 0) {
      // Paragraphe vide : le style se pose sur `w:pPr/w:rPr`, qui gouverne ce qu'on y tapera.
      appliquerStyleProps(ensureChild(pPr(t.p.noeud), "w:rPr", ORDRE_PPR), c);
    }
    for (const r of runs) appliquerStyleProps(rPr(r), c);
    if (c.alignement !== null) {
      setAttr(ensureChild(pPr(t.p.noeud), "w:jc", ORDRE_PPR.slice(0, ORDRE_PPR.indexOf("w:jc"))), "w:val", ALIGN_OOXML[c.alignement as Alignment]);
    }
    const dits = [
      c.taillePt !== null ? `${c.taillePt} pt` : "",
      c.police !== null ? c.police : "",
      c.gras === true ? "gras" : c.gras === false ? "sans gras" : "",
      c.italique === true ? "italique" : "",
      c.souligne === true ? "souligné" : "",
      c.couleur !== null ? `#${c.couleur}` : "",
    ].filter(Boolean).join(", ");
    return effetOk(`${libelleParagraphe(t.p.modele)} → ${dits}.`, [t.p.id]);
  }

  private espacement(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const sp = ensureChild(pPr(t.p.noeud), "w:spacing", ORDRE_PPR.slice(0, ORDRE_PPR.indexOf("w:spacing")));
    // `w:spacing` compte en vingtièmes de point ; « remonte un peu » vaut un espacement AVANT réduit.
    if (c.avantPt !== null) setAttr(sp, "w:before", String(Math.max(0, Math.round(c.avantPt * 20))));
    if (c.apresPt !== null) setAttr(sp, "w:after", String(Math.max(0, Math.round(c.apresPt * 20))));
    return effetOk(`${libelleParagraphe(t.p.modele)} → espacement ajusté.`, [t.p.id]);
  }

  private retrait(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const ind = ensureChild(pPr(t.p.noeud), "w:ind", ORDRE_PPR.slice(0, ORDRE_PPR.indexOf("w:ind")));
    // Word REFUSE un retrait négatif au-delà de la marge : on borne à 0 plutôt que d'écrire un
    // document que Word « répare » silencieusement en perdant tout le paragraphe.
    if (c.gaucheCm !== null) setAttr(ind, "w:left", String(Math.max(0, cmEnTwip(c.gaucheCm))));
    if (c.droiteCm !== null) setAttr(ind, "w:right", String(Math.max(0, cmEnTwip(c.droiteCm))));
    return effetOk(`${libelleParagraphe(t.p.modele)} → retrait ajusté.`, [t.p.id]);
  }

  private texte(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    remplacerTexteParagraphe(t.p.noeud, c.texte ?? "");
    return effetOk(`${libelleParagraphe(t.p.modele)} → texte remplacé.`, [t.p.id]);
  }

  private insererParagraphe(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const parent = t.p.noeud.parent;
    if (!parent) return effetEchec("paragraphe détaché du document");
    // On CLONE le paragraphe de référence puis on remplace son texte : le nouveau paragraphe
    // hérite ainsi de la police, de l'alignement et des retraits de son voisin — c'est ce qu'un
    // humain attend quand il dit « ajoute un paragraphe après celui-ci ».
    const copie = cloneNode(t.p.noeud, parent);
    copie.raw = null;
    remplacerTexteParagraphe(copie, c.texte ?? "");
    if (c.position === "avant") insertBefore(parent, t.p.noeud, copie);
    else insertAfter(parent, t.p.noeud, copie);
    return effetOk(`Paragraphe inséré ${c.position === "avant" ? "avant" : "après"} ${libelleParagraphe(t.p.modele)}.`, [t.p.id]);
  }

  private supprimerParagraphe(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const parent = t.p.noeud.parent;
    if (!parent) return effetEchec("paragraphe détaché du document");
    const libelle = libelleParagraphe(t.p.modele);
    removeChild(parent, t.p.noeud);
    return effetOk(`${libelle} supprimé.`, []);
  }

  private deplacer(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerParagraphe(c);
    if (!t.ok) return t.echec;
    const parent = t.p.noeud.parent;
    if (!parent) return effetEchec("paragraphe détaché du document");
    const pas = c.pas ?? 1;
    const freres = parent.children.filter((x) => x.type === "element" && (x.name === "w:p" || x.name === "w:tbl"));
    const i = freres.indexOf(t.p.noeud);
    const j = Math.max(0, Math.min(freres.length - 1, i + (c.direction === "haut" ? -pas : pas)));
    if (i === j) return effetEchec(`impossible de descendre plus ${c.direction === "haut" ? "haut" : "bas"}`);
    removeChild(parent, t.p.noeud);
    if (c.direction === "haut") insertBefore(parent, freres[j], t.p.noeud);
    else insertAfter(parent, freres[j], t.p.noeud);
    return effetOk(`${libelleParagraphe(t.p.modele)} déplacé vers le ${c.direction}.`, [t.p.id]);
  }

  private remplacerTexte(c: CommandeArtefact): EffetCommande {
    const cible = normaliserTexte(c.chercher ?? "");
    let n = 0;
    for (const { noeud, modele } of this.etat.paragraphes) {
      if (!normaliserTexte(modele.text).includes(cible)) continue;
      // On réécrit au niveau du PARAGRAPHE parce qu'un mot cherché est presque toujours coupé
      // en plusieurs `w:r` par Word (correcteur orthographique, révisions) — chercher fragment
      // par fragment raterait « rémunération » écrit en trois morceaux.
      remplacerTexteParagraphe(noeud, modele.text.replace(new RegExp(echapperRegex(c.chercher ?? ""), "gi"), c.remplacer ?? ""));
      n += 1;
      if (c.tout !== true) break;
    }
    if (n === 0) return effetEchec(`« ${c.chercher} » ne figure pas dans ce document`);
    return effetOk(`${n} paragraphe${n > 1 ? "s" : ""} modifié${n > 1 ? "s" : ""}.`, []);
  }

  private ciblerTable(c: CommandeArtefact) {
    const r = resoudre(c.cible, this.designablesTables(), { libelle: "tableau" });
    if (r.etat === "TROUVE") return { ok: true as const, t: r.objet };
    const candidats = r.etat === "AMBIGU" ? r.candidats.map((x) => ({ id: x.id, libelle: `tableau ${x.index} — ${abreger(x.texte, 40)}` })) : [];
    return { ok: false as const, echec: effetEchec(r.motif, candidats) };
  }

  private cellule(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerTable(c);
    if (!t.ok) return t.echec;
    const lignes = children(t.t.noeud, "w:tr");
    const tr = lignes[(c.ligne ?? 1) - 1];
    if (!tr) return effetEchec(`ce tableau n'a pas de ligne ${c.ligne} (il en a ${lignes.length})`);
    const tcs = children(tr, "w:tc");
    const tc = tcs[(c.colonne ?? 1) - 1];
    if (!tc) return effetEchec(`cette ligne n'a pas de colonne ${c.colonne} (elle en a ${tcs.length})`);
    const p = child(tc, "w:p");
    if (!p) return effetEchec("cellule sans paragraphe — document inattendu");
    remplacerTexteParagraphe(p, c.texte ?? "");
    return effetOk(`Tableau ${t.t.index}, ligne ${c.ligne}, colonne ${c.colonne} → « ${abreger(c.texte ?? "", 30)} ».`, [`${t.t.id}.r${c.ligne}.c${c.colonne}`]);
  }

  private insererLigne(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerTable(c);
    if (!t.ok) return t.echec;
    const lignes = children(t.t.noeud, "w:tr");
    if (lignes.length === 0) return effetEchec("ce tableau n'a aucune ligne à copier");
    // La DERNIÈRE ligne sert de gabarit plutôt que la première : la première porte souvent la mise
    // en forme d'en-tête (fond gris, gras), qu'on ne veut pas répliquer sur une ligne de données.
    const ref = lignes[Math.min((c.ligne ?? lignes.length) - 1, lignes.length - 1)] ?? lignes[lignes.length - 1];
    const copie = cloneNode(ref, t.t.noeud);
    copie.raw = null;
    for (const tc of children(copie, "w:tc")) {
      const p = child(tc, "w:p");
      if (p) remplacerTexteParagraphe(p, "");
    }
    insertAfter(t.t.noeud, ref, copie);
    return effetOk(`Ligne ajoutée au tableau ${t.t.index}.`, [t.t.id]);
  }

  private supprimerLigne(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerTable(c);
    if (!t.ok) return t.echec;
    const lignes = children(t.t.noeud, "w:tr");
    const tr = lignes[(c.ligne ?? 0) - 1];
    if (!tr) return effetEchec(`ce tableau n'a pas de ligne ${c.ligne} (il en a ${lignes.length})`);
    removeChild(t.t.noeud, tr);
    return effetOk(`Ligne ${c.ligne} du tableau ${t.t.index} supprimée.`, [t.t.id]);
  }

  private ciblerImage(c: CommandeArtefact) {
    const r = resoudre(c.cible, this.designablesImages(), { libelle: "image" });
    if (r.etat === "TROUVE") return { ok: true as const, i: r.objet };
    const candidats = r.etat === "AMBIGU" ? r.candidats.map((x) => ({ id: x.id, libelle: `image ${x.index}` })) : [];
    return { ok: false as const, echec: effetEchec(r.motif, candidats) };
  }

  private imageTaille(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerImage(c);
    if (!t.ok) return t.echec;
    const extent = child(t.i.noeud, "wp:extent");
    if (!extent) return effetEchec("cette image n'a pas de dimensions déclarées");
    // On conserve le RAPPORT quand une seule dimension est donnée : une photo étirée est un défaut
    // que le contrôle qualité visuel (§26) signalerait de toute façon, autant ne pas le produire.
    const l = c.largeurCm ?? (c.hauteurCm !== null && t.i.modele.heightCm ? (t.i.modele.widthCm * c.hauteurCm) / t.i.modele.heightCm : t.i.modele.widthCm);
    const h = c.hauteurCm ?? (c.largeurCm !== null && t.i.modele.widthCm ? (t.i.modele.heightCm * c.largeurCm) / t.i.modele.widthCm : t.i.modele.heightCm);
    setAttr(extent, "cx", String(cmEnEmu(l)));
    setAttr(extent, "cy", String(cmEnEmu(h)));
    // `a:ext` porte la MÊME taille dans la géométrie du dessin : ne changer que `wp:extent`
    // laisse Word afficher l'ancienne taille — le genre de défaut invisible au test unitaire.
    const ext = firstDescendant(t.i.noeud, "a:ext");
    if (ext) { setAttr(ext, "cx", String(cmEnEmu(l))); setAttr(ext, "cy", String(cmEnEmu(h))); }
    return effetOk(`Image ${t.i.index} → ${l.toFixed(1)} × ${h.toFixed(1)} cm.`, [t.i.id]);
  }

  private supprimerImage(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerImage(c);
    if (!t.ok) return t.echec;
    // On remonte au `w:drawing` : supprimer le seul `wp:inline` laisserait un `w:drawing` vide
    // que Word signale comme document endommagé.
    let n: XmlNode | null = t.i.noeud;
    while (n && n.name !== "w:drawing") n = n.parent;
    const cible = n ?? t.i.noeud;
    if (!cible.parent) return effetEchec("image détachée du document");
    removeChild(cible.parent, cible);
    return effetOk(`Image ${t.i.index} supprimée.`, []);
  }

  async serialiser(): Promise<Buffer> {
    this.etat.zip.file("word/document.xml", serializeXml(this.etat.racine));
    return this.etat.zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  async valider(): Promise<Validation> {
    const problemes: string[] = [];
    try {
      const octets = await this.serialiser();
      const relu = new PizZip(octets);
      const doc = relu.file("word/document.xml");
      if (!doc) problemes.push("word/document.xml absent du fichier produit");
      else {
        const xml = doc.asText();
        if (!xml.includes("<w:body")) problemes.push("corps de document introuvable");
        const ouvrantes = (xml.match(/<w:p[ >]/g) ?? []).length;
        const fermantes = (xml.match(/<\/w:p>/g) ?? []).length;
        if (ouvrantes !== fermantes) problemes.push(`balises de paragraphe déséquilibrées (${ouvrantes}/${fermantes})`);
      }
      // Les pièces qu'on ne touche jamais doivent survivre — c'est la garantie §44, vérifiée.
      for (const requis of ["[Content_Types].xml", "_rels/.rels"]) {
        if (!relu.file(requis)) problemes.push(`pièce obligatoire perdue : ${requis}`);
      }
    } catch (e) {
      problemes.push(`le fichier produit ne se relit pas : ${(e as Error).message}`);
    }
    return { ok: problemes.length === 0, problemes };
  }
}

const echapperRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const adaptateurDocx: AdaptateurArtefact = {
  format: "DOCX",
  mimes: [MIME_DOCX],
  extensions: [".docx"],
  async ouvrir(octets: Buffer): Promise<DocumentOuvert> {
    const zip = new PizZip(octets);
    const doc = zip.file("word/document.xml");
    if (!doc) throw new Error("Ce fichier .docx ne contient pas word/document.xml — il est probablement endommagé.");
    return new DocxOuvert(zip, parseXml(doc.asText()));
  },
};
