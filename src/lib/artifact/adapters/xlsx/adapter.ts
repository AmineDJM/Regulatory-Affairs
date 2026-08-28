/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR EXCEL (§13) — cellules, formules, mise en forme, lignes, colonnes, tri.
 *
 * ── POURQUOI PAS EXCELJS, QUI EST POURTANT DÉJÀ LÀ ──────────────────────────────────────
 *
 * ExcelJS lit et écrit très bien, mais il RECONSTRUIT le classeur : ce qu'il ne modélise pas
 * disparaît à l'écriture — les graphiques, les tableaux croisés dynamiques, les mises en forme
 * conditionnelles, les validations de données, les segments. Sur un fichier de reporting, changer
 * une cellule effacerait les six graphiques de la synthèse, et personne ne le verrait avant la
 * réunion. §44 l'interdit explicitement.
 *
 * On travaille donc au niveau XML avec le même arbre à tranches de source que Word : ce qu'on ne
 * touche pas est recopié octet pour octet. ExcelJS reste utilisé ailleurs (`assistant/exports`,
 * `missions/artifacts`) pour CRÉER des classeurs — là, il n'y a rien à préserver.
 *
 * ── LES DEUX PIÈGES D'UN `.xlsx` ────────────────────────────────────────────────────────
 *
 *   1. LES CHAÎNES PARTAGÉES. Une cellule texte contient un NUMÉRO qui pointe dans
 *      `sharedStrings.xml`. Écrire « Total » à la place de « Sous-total » sans toucher la table
 *      renommerait la chaîne PARTOUT où elle sert. On écrit donc les nouvelles valeurs en
 *      `inlineStr` — valide, autonome, et sans effet de bord.
 *   2. LES STYLES. Une cellule porte un index `s` dans `cellXfs`. Mettre une cellule en gras en
 *      modifiant son `xf` mettrait en gras toutes les cellules qui partagent cet index. On DÉRIVE
 *      donc un nouvel `xf` à partir de l'ancien — c'est ce que fait Excel lui-même.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import PizZip from "pizzip";
import type { Alignment, SheetCellNode, SheetNode, TextStyle, XlsxModel } from "@/lib/artifact/object-model/model";
import {
  STYLE_NEUTRE, analyserPlage, cellulesDePlage, formerRef, analyserRef, nombreEnColonne,
} from "@/lib/artifact/object-model/model";
import { normaliserTexte } from "@/lib/artifact/object-model/text";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import type { AdaptateurArtefact, DocumentOuvert, EffetCommande, Validation } from "@/lib/artifact/adapters/contract";
import { effetEchec, effetOk } from "@/lib/artifact/adapters/contract";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, child, children, cloneNode, element, ensureChild, insertBefore, markDirty,
  parseXml, removeChild, serializeXml, setAttr, textNode, textOf,
} from "@/lib/artifact/object-model/xml";

export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ALIGN_XLSX: Record<Alignment, string> = { left: "left", center: "center", right: "right", justify: "justify" };
const ALIGN_MODELE: Record<string, Alignment> = { left: "left", center: "center", right: "right", justify: "justify", centerContinuous: "center" };

/** Combien de cellules on modélise par feuille — au-delà, l'aperçu se charge à la demande (§71). */
const CELLULES_MODELE_MAX = 20_000;

interface Feuille {
  nom: string;
  chemin: string;
  racine: XmlNode;
  sheetData: XmlNode;
}

// ─────────────────────────── Lecture ───────────────────────────

/** Les chaînes partagées, dans l'ordre — un index `t="s"` s'y résout. */
function lireChainesPartagees(zip: PizZip): string[] {
  const f = zip.file("xl/sharedStrings.xml");
  if (!f) return [];
  const racine = parseXml(f.asText());
  const sst = child(racine, "sst") ?? racine;
  // Un `<si>` peut être un `<t>` simple ou plusieurs `<r><t>` (texte enrichi) : on concatène.
  return children(sst, "si").map((si) => textOf(si));
}

function valeurCellule(c: XmlNode, chaines: string[]): string {
  const t = attr(c, "t");
  if (t === "inlineStr") {
    const is = child(c, "is");
    return is ? textOf(is) : "";
  }
  const v = child(c, "v");
  const brut = v ? textOf(v) : "";
  if (t === "s") {
    const i = Number(brut);
    return Number.isInteger(i) && i >= 0 && i < chaines.length ? chaines[i] : "";
  }
  if (t === "b") return brut === "1" ? "VRAI" : "FAUX";
  return brut;
}

interface StylesClasseur {
  racine: XmlNode;
  cellXfs: XmlNode;
  fonts: XmlNode;
  fills: XmlNode;
  numFmts: XmlNode | null;
}

function lireStyles(zip: PizZip): StylesClasseur | null {
  const f = zip.file("xl/styles.xml");
  if (!f) return null;
  const racine = parseXml(f.asText());
  const ss = child(racine, "styleSheet");
  if (!ss) return null;
  const cellXfs = child(ss, "cellXfs");
  const fonts = child(ss, "fonts");
  const fills = child(ss, "fills");
  if (!cellXfs || !fonts || !fills) return null;
  return { racine, cellXfs, fonts, fills, numFmts: child(ss, "numFmts") };
}

function styleDeXf(st: StylesClasseur | null, idx: number): { style: TextStyle; fill: string | null; align: Alignment | null; numFmt: string | null } {
  const neutre = { style: { ...STYLE_NEUTRE }, fill: null, align: null, numFmt: null };
  if (!st) return neutre;
  const xf = children(st.cellXfs, "xf")[idx];
  if (!xf) return neutre;

  const fontId = Number(attr(xf, "fontId") ?? "0");
  const font = children(st.fonts, "font")[fontId];
  const style: TextStyle = { ...STYLE_NEUTRE };
  if (font) {
    style.bold = Boolean(child(font, "b"));
    style.italic = Boolean(child(font, "i"));
    style.underline = Boolean(child(font, "u"));
    const sz = child(font, "sz");
    const szv = sz ? Number(attr(sz, "val")) : NaN;
    style.sizePt = Number.isFinite(szv) ? szv : null;
    const name = child(font, "name");
    style.font = name ? attr(name, "val") : null;
    const color = child(font, "color");
    const rgb = color ? attr(color, "rgb") : null;
    // Excel écrit AARRGGBB : on ne garde que RRGGBB, comme partout ailleurs dans le système.
    style.color = rgb && rgb.length === 8 ? rgb.slice(2).toUpperCase() : rgb ? rgb.toUpperCase() : null;
  }

  let fill: string | null = null;
  if (attr(xf, "applyFill") !== "0") {
    const fillId = Number(attr(xf, "fillId") ?? "0");
    const f = children(st.fills, "fill")[fillId];
    const pat = f ? child(f, "patternFill") : null;
    const fg = pat ? child(pat, "fgColor") : null;
    const rgb = fg ? attr(fg, "rgb") : null;
    if (rgb) fill = rgb.length === 8 ? rgb.slice(2).toUpperCase() : rgb.toUpperCase();
  }

  const al = child(xf, "alignment");
  const alv = al ? attr(al, "horizontal") : null;

  const numFmtId = attr(xf, "numFmtId");
  let numFmt: string | null = null;
  if (numFmtId && st.numFmts) {
    const trouve = children(st.numFmts, "numFmt").find((n) => attr(n, "numFmtId") === numFmtId);
    numFmt = trouve ? attr(trouve, "formatCode") : null;
  }

  return { style, fill, align: alv ? ALIGN_MODELE[alv] ?? null : null, numFmt };
}

// ─────────────────────────── Le document ouvert ───────────────────────────

class XlsxOuvert implements DocumentOuvert {
  format = "XLSX" as const;
  private modeleCache: XlsxModel | null = null;

  constructor(
    private zip: PizZip,
    private workbook: XmlNode,
    private feuilles: Feuille[],
    private chaines: string[],
    private styles: StylesClasseur | null,
  ) {}

  modele(): XlsxModel {
    if (this.modeleCache) return this.modeleCache;
    const sheets: SheetNode[] = this.feuilles.map((f, i) => this.lireFeuille(f, i + 1));
    this.modeleCache = { kind: "XLSX", sheets };
    return this.modeleCache;
  }

  private lireFeuille(f: Feuille, index: number): SheetNode {
    const cells: SheetCellNode[] = [];
    let maxRow = 0;
    let maxCol = 0;
    for (const row of children(f.sheetData, "row")) {
      for (const c of children(row, "c")) {
        const ref = attr(c, "r") ?? "";
        const pos = analyserRef(ref);
        if (!pos) continue;
        maxRow = Math.max(maxRow, pos.row);
        maxCol = Math.max(maxCol, pos.col);
        if (cells.length >= CELLULES_MODELE_MAX) continue;
        const fEl = child(c, "f");
        const s = Number(attr(c, "s") ?? "0");
        const deco = styleDeXf(this.styles, Number.isFinite(s) ? s : 0);
        const valeur = valeurCellule(c, this.chaines);
        if (!valeur && !fEl && !attr(c, "s")) continue; // cellule vide et sans style : rien à dire.
        cells.push({
          id: `s${index}.${ref}`, ref, row: pos.row, col: pos.col,
          value: valeur, formula: fEl ? `=${textOf(fEl)}` : null,
          numFmt: deco.numFmt, style: deco.style, fill: deco.fill, align: deco.align,
        });
      }
    }
    const cols = child(f.racine, "worksheet") ? child(child(f.racine, "worksheet")!, "cols") : null;
    const largeurs: (number | null)[] = [];
    if (cols) {
      for (const col of children(cols, "col")) {
        const min = Number(attr(col, "min") ?? "1");
        const max = Number(attr(col, "max") ?? String(min));
        const w = Number(attr(col, "width"));
        for (let k = min; k <= Math.min(max, 200); k += 1) largeurs[k - 1] = Number.isFinite(w) ? w : null;
      }
    }
    const ws = child(f.racine, "worksheet");
    const sheetViews = ws ? child(ws, "sheetViews") : null;
    const pane = sheetViews ? child(children(sheetViews, "sheetView")[0] ?? element("x"), "pane") : null;
    const merges = ws ? children(child(ws, "mergeCells") ?? element("x"), "mergeCell").map((m) => attr(m, "ref") ?? "").filter(Boolean) : [];

    return {
      id: `s${index}`, index, name: f.nom, rows: maxRow, cols: maxCol, cells,
      columnWidths: largeurs,
      frozenRows: pane ? Number(attr(pane, "ySplit") ?? "0") || 0 : 0,
      frozenCols: pane ? Number(attr(pane, "xSplit") ?? "0") || 0 : 0,
      merges,
    };
  }

  appliquer(c: CommandeArtefact): EffetCommande {
    const effet = this.executer(c);
    if (effet.ok) this.modeleCache = null;
    return effet;
  }

  /** La feuille visée : celle qui est nommée, sinon la première. */
  private feuille(nom: string | null): Feuille | null {
    if (!nom) return this.feuilles[0] ?? null;
    const cible = normaliserTexte(nom);
    return this.feuilles.find((f) => normaliserTexte(f.nom) === cible)
      ?? this.feuilles.find((f) => normaliserTexte(f.nom).includes(cible))
      ?? null;
  }

  private executer(c: CommandeArtefact): EffetCommande {
    const f = this.feuille(c.feuille);
    if (!f && c.op !== "xlsx.ajouter_feuille") {
      return effetEchec(c.feuille ? `ce classeur n'a pas de feuille « ${c.feuille} »` : "ce classeur n'a aucune feuille");
    }
    switch (c.op) {
      case "xlsx.valeur": return this.valeur(f!, c, false);
      case "xlsx.formule": return this.valeur(f!, c, true);
      case "xlsx.format": return this.mettreEnForme(f!, c);
      case "xlsx.largeur_colonne": return this.largeurColonne(f!, c);
      case "xlsx.inserer_ligne": return this.insererLigne(f!, c);
      case "xlsx.supprimer_ligne": return this.supprimerLigne(f!, c);
      case "xlsx.inserer_colonne": return this.insererColonne(f!, c);
      case "xlsx.supprimer_colonne": return this.supprimerColonne(f!, c);
      case "xlsx.figer": return this.figer(f!, c);
      case "xlsx.fusionner": return this.fusionner(f!, c);
      case "xlsx.trier": return this.trier(f!, c);
      case "xlsx.ajouter_feuille": return this.ajouterFeuille(c);
      case "xlsx.renommer_feuille": return this.renommerFeuille(f!, c);
      case "xlsx.supprimer_feuille": return this.supprimerFeuille(f!);
      default: return effetEchec(`opération « ${c.op} » non gérée par l'adaptateur Excel`);
    }
  }

  // ── Accès aux lignes et cellules ────────────────────────────────────────────────────
  /** La `<row>` de ce rang, créée à sa place si elle manque (les lignes sont triées). */
  private ligne(f: Feuille, r: number): XmlNode {
    const lignes = children(f.sheetData, "row");
    const existante = lignes.find((x) => Number(attr(x, "r")) === r);
    if (existante) return existante;
    const nouvelle = element("row", { r: String(r) });
    const suivante = lignes.find((x) => Number(attr(x, "r")) > r);
    if (suivante) insertBefore(f.sheetData, suivante, nouvelle);
    else { nouvelle.parent = f.sheetData; f.sheetData.children.push(nouvelle); markDirty(f.sheetData); }
    nouvelle.selfClosing = false;
    return nouvelle;
  }

  /** La `<c>` de cette référence, créée à sa place (les cellules sont triées par colonne). */
  private cellule(f: Feuille, row: number, col: number): XmlNode {
    const ref = formerRef(row, col);
    const l = this.ligne(f, row);
    const cs = children(l, "c");
    const existante = cs.find((x) => attr(x, "r") === ref);
    if (existante) return existante;
    const nouvelle = element("c", { r: ref });
    const suivante = cs.find((x) => (analyserRef(attr(x, "r") ?? "")?.col ?? 0) > col);
    if (suivante) insertBefore(l, suivante, nouvelle);
    else { nouvelle.parent = l; l.children.push(nouvelle); markDirty(l); }
    nouvelle.selfClosing = false;
    return nouvelle;
  }

  private valeur(f: Feuille, c: CommandeArtefact, estFormule: boolean): EffetCommande {
    const plage = analyserPlage(c.plage ?? "");
    if (!plage) return effetEchec(`plage « ${c.plage } » illisible`);
    const cases = cellulesDePlage(plage);
    for (const pos of cases) {
      const cell = this.cellule(f, pos.row, pos.col);
      // On vide d'abord : une cellule qui garderait son `<f>` recalculerait par-dessus la valeur
      // qu'on vient d'écrire, et l'utilisateur verrait sa saisie « revenir » à l'ouverture.
      for (const nom of ["v", "f", "is"]) {
        const el = child(cell, nom);
        if (el) removeChild(cell, el);
      }
      cell.attrs.delete("t");
      markDirty(cell);
      if (estFormule) {
        const formule = (c.formule ?? "").replace(/^=/, "");
        const fEl = element("f", {}, [textNode(formule)]);
        fEl.parent = cell;
        cell.children.push(fEl);
        // Pas de `<v>` : sans valeur mise en cache, Excel recalcule à l'ouverture — c'est
        // exactement ce qu'on veut, et cela évite d'afficher un résultat périmé.
      } else {
        const brut = c.texte ?? "";
        const nombre = brut.trim() !== "" && Number.isFinite(Number(brut.replace(",", ".")));
        if (nombre) {
          const v = element("v", {}, [textNode(String(Number(brut.replace(",", "."))))]);
          v.parent = cell;
          cell.children.push(v);
        } else if (brut !== "") {
          setAttr(cell, "t", "inlineStr");
          const t = element("t", { "xml:space": "preserve" }, [textNode(brut)]);
          const is = element("is", {}, [t]);
          is.parent = cell;
          cell.children.push(is);
        }
      }
      cell.selfClosing = cell.children.length === 0;
    }
    // Le cache de calcul devient faux dès qu'une valeur bouge : le retirer force le recalcul.
    this.invaliderCache();
    const quoi = estFormule ? c.formule : c.texte;
    return effetOk(`${f.nom}!${c.plage} → ${cases.length > 1 ? `${cases.length} cellules` : `« ${quoi} »`}.`, cases.map((p) => `${f.nom}!${formerRef(p.row, p.col)}`));
  }

  /** Supprime `calcChain.xml`, dont l'ordre devient faux dès qu'une formule change. */
  private invaliderCache(): void {
    if (this.zip.file("xl/calcChain.xml")) this.zip.remove("xl/calcChain.xml");
  }

  private mettreEnForme(f: Feuille, c: CommandeArtefact): EffetCommande {
    if (!this.styles) return effetEchec("ce classeur n'a pas de table de styles : impossible de le mettre en forme");
    const plage = analyserPlage(c.plage ?? "");
    if (!plage) return effetEchec(`plage « ${c.plage} » illisible`);
    const cases = cellulesDePlage(plage);
    for (const pos of cases) {
      const cell = this.cellule(f, pos.row, pos.col);
      const actuel = Number(attr(cell, "s") ?? "0");
      const nouveau = this.deriverStyle(Number.isFinite(actuel) ? actuel : 0, c);
      setAttr(cell, "s", String(nouveau));
    }
    return effetOk(`${f.nom}!${c.plage} mis en forme (${cases.length} cellule${cases.length > 1 ? "s" : ""}).`, cases.map((p) => `${f.nom}!${formerRef(p.row, p.col)}`));
  }

  /**
   * DÉRIVE un `xf` : on part de l'existant, on n'y change QUE ce qui est demandé, et on ajoute
   * le résultat s'il n'existe pas déjà. C'est ce qui empêche « mets B4 en gras » de mettre en
   * gras les deux cents cellules qui partageaient son style.
   */
  private deriverStyle(idx: number, c: CommandeArtefact): number {
    const st = this.styles!;
    const xfs = children(st.cellXfs, "xf");
    const source = xfs[idx] ?? xfs[0];
    const copie = source ? cloneNode(source, st.cellXfs) : element("xf", { numFmtId: "0", fontId: "0", fillId: "0", borderId: "0" });
    copie.raw = null;

    if (c.gras !== null || c.italique !== null || c.souligne !== null || c.taillePt !== null || c.police !== null || c.couleur !== null) {
      copie.attrs.set("fontId", String(this.deriverPolice(Number(attr(copie, "fontId") ?? "0"), c)));
      copie.attrs.set("applyFont", "1");
    }
    if (c.remplissage !== null) {
      copie.attrs.set("fillId", String(this.deriverRemplissage(c.remplissage)));
      copie.attrs.set("applyFill", "1");
    }
    if (c.formatNombre !== null) {
      copie.attrs.set("numFmtId", String(this.deriverFormatNombre(c.formatNombre)));
      copie.attrs.set("applyNumberFormat", "1");
    }
    if (c.alignement !== null) {
      const al = ensureChild(copie, "alignment", []);
      setAttr(al, "horizontal", ALIGN_XLSX[c.alignement as Alignment]);
      copie.attrs.set("applyAlignment", "1");
    }
    markDirty(copie);

    const signature = serializeXml(copie);
    const deja = xfs.findIndex((x) => serializeXml(x) === signature);
    if (deja >= 0) return deja;
    copie.parent = st.cellXfs;
    st.cellXfs.children.push(copie);
    st.cellXfs.selfClosing = false;
    setAttr(st.cellXfs, "count", String(children(st.cellXfs, "xf").length));
    markDirty(st.cellXfs);
    return children(st.cellXfs, "xf").length - 1;
  }

  private deriverPolice(idx: number, c: CommandeArtefact): number {
    const st = this.styles!;
    const polices = children(st.fonts, "font");
    const source = polices[idx] ?? polices[0];
    const copie = source ? cloneNode(source, st.fonts) : element("font");
    copie.raw = null;
    const poser = (nom: string, actif: boolean) => {
      const el = child(copie, nom);
      if (actif && !el) ensureChild(copie, nom, []);
      else if (!actif && el) removeChild(copie, el);
    };
    if (c.gras !== null) poser("b", c.gras);
    if (c.italique !== null) poser("i", c.italique);
    if (c.souligne !== null) poser("u", c.souligne);
    if (c.taillePt !== null) setAttr(ensureChild(copie, "sz", []), "val", String(c.taillePt));
    if (c.police !== null) setAttr(ensureChild(copie, "name", []), "val", c.police);
    if (c.couleur !== null) {
      const col = ensureChild(copie, "color", []);
      col.attrs.delete("theme");
      col.attrs.delete("indexed");
      setAttr(col, "rgb", `FF${c.couleur.toUpperCase()}`);
    }
    markDirty(copie);
    const signature = serializeXml(copie);
    const deja = polices.findIndex((x) => serializeXml(x) === signature);
    if (deja >= 0) return deja;
    copie.parent = st.fonts;
    st.fonts.children.push(copie);
    st.fonts.selfClosing = false;
    setAttr(st.fonts, "count", String(children(st.fonts, "font").length));
    markDirty(st.fonts);
    return children(st.fonts, "font").length - 1;
  }

  private deriverRemplissage(couleur: string): number {
    const st = this.styles!;
    const rgb = `FF${couleur.replace(/^#/, "").toUpperCase()}`;
    const fills = children(st.fills, "fill");
    const deja = fills.findIndex((f) => {
      const p = child(f, "patternFill");
      return p !== null && attr(p, "patternType") === "solid" && attr(child(p, "fgColor") ?? element("x"), "rgb") === rgb;
    });
    if (deja >= 0) return deja;
    const fg = element("fgColor", { rgb });
    const bg = element("bgColor", { indexed: "64" });
    const pat = element("patternFill", { patternType: "solid" }, [fg, bg]);
    const fill = element("fill", {}, [pat]);
    fill.parent = st.fills;
    st.fills.children.push(fill);
    st.fills.selfClosing = false;
    setAttr(st.fills, "count", String(children(st.fills, "fill").length));
    markDirty(st.fills);
    return children(st.fills, "fill").length - 1;
  }

  private deriverFormatNombre(code: string): number {
    const st = this.styles!;
    const ss = child(st.racine, "styleSheet")!;
    let numFmts = st.numFmts;
    if (!numFmts) {
      numFmts = element("numFmts", { count: "0" });
      numFmts.parent = ss;
      // `numFmts` doit ouvrir la feuille de styles : le schéma l'exige avant `fonts`.
      ss.children.unshift(numFmts);
      markDirty(ss);
      st.numFmts = numFmts;
    }
    const existants = children(numFmts, "numFmt");
    const deja = existants.find((n) => attr(n, "formatCode") === code);
    if (deja) return Number(attr(deja, "numFmtId"));
    // Les identifiants < 164 sont RÉSERVÉS aux formats intégrés d'Excel : on démarre après.
    const ids = existants.map((n) => Number(attr(n, "numFmtId"))).filter(Number.isFinite);
    const id = Math.max(163, ...ids) + 1;
    const el = element("numFmt", { numFmtId: String(id), formatCode: code });
    el.parent = numFmts;
    numFmts.children.push(el);
    numFmts.selfClosing = false;
    setAttr(numFmts, "count", String(children(numFmts, "numFmt").length));
    markDirty(numFmts);
    return id;
  }

  private largeurColonne(f: Feuille, c: CommandeArtefact): EffetCommande {
    const ws = child(f.racine, "worksheet");
    if (!ws) return effetEchec("feuille illisible");
    // `cols` doit venir AVANT `sheetData` : Excel refuse le fichier autrement.
    let cols = child(ws, "cols");
    if (!cols) {
      cols = element("cols");
      cols.parent = ws;
      const sd = child(ws, "sheetData");
      if (sd) insertBefore(ws, sd, cols);
      else { ws.children.push(cols); markDirty(ws); }
    }
    // Excel exprime la largeur en CARACTÈRES ; un centimètre vaut environ 4,7 caractères.
    const largeur = c.taillePt ?? (c.largeurCm !== null ? Math.round(c.largeurCm * 4.7 * 100) / 100 : 12);
    const n = String(c.colonne);
    const existant = children(cols, "col").find((x) => attr(x, "min") === n && attr(x, "max") === n);
    const col = existant ?? element("col", { min: n, max: n });
    setAttr(col, "width", String(largeur));
    setAttr(col, "customWidth", "1");
    if (!existant) { col.parent = cols; cols.children.push(col); cols.selfClosing = false; markDirty(cols); }
    return effetOk(`Colonne ${nombreEnColonne(c.colonne ?? 1)} de ${f.nom} → largeur ${largeur}.`, []);
  }

  /**
   * DÉCALE toutes les références d'une feuille après une insertion / suppression.
   *
   * Les attributs `r` des lignes et des cellules d'abord, PUIS les formules. Sans le second
   * temps, `=SOMME(B2:B10)` continuerait de pointer une plage qui a changé de sens — l'erreur
   * la plus coûteuse d'un tableur, parce qu'elle donne un nombre plausible et faux.
   *
   * Ce décaleur traite les références A1 de la MÊME feuille. Les références inter-feuilles
   * (`Feuil2!B4`) et `INDIRECT` ne sont pas réécrites — Excel non plus ne réécrit pas `INDIRECT`.
   */
  private decaler(f: Feuille, axe: "ligne" | "colonne", depuis: number, delta: number): void {
    for (const row of children(f.sheetData, "row")) {
      const r = Number(attr(row, "r"));
      if (axe === "ligne" && Number.isFinite(r) && r >= depuis) setAttr(row, "r", String(r + delta));
      for (const cell of children(row, "c")) {
        const pos = analyserRef(attr(cell, "r") ?? "");
        if (!pos) continue;
        const nr = axe === "ligne" && pos.row >= depuis ? pos.row + delta : pos.row;
        const nc = axe === "colonne" && pos.col >= depuis ? pos.col + delta : pos.col;
        if (nr !== pos.row || nc !== pos.col) setAttr(cell, "r", formerRef(nr, nc));
        const fEl = child(cell, "f");
        if (fEl) {
          const reecrite = decalerFormule(textOf(fEl), axe, depuis, delta);
          fEl.children = [textNode(reecrite)];
          fEl.children[0].parent = fEl;
          markDirty(fEl);
        }
      }
    }
    this.invaliderCache();
  }

  private insererLigne(f: Feuille, c: CommandeArtefact): EffetCommande {
    const r = c.ligne ?? 1;
    this.decaler(f, "ligne", r, 1);
    return effetOk(`Ligne insérée en position ${r} dans ${f.nom}.`, []);
  }

  private supprimerLigne(f: Feuille, c: CommandeArtefact): EffetCommande {
    const r = c.ligne ?? 1;
    const cible = children(f.sheetData, "row").find((x) => Number(attr(x, "r")) === r);
    if (!cible) return effetEchec(`la ligne ${r} de ${f.nom} est déjà vide`);
    removeChild(f.sheetData, cible);
    this.decaler(f, "ligne", r + 1, -1);
    return effetOk(`Ligne ${r} de ${f.nom} supprimée.`, []);
  }

  private insererColonne(f: Feuille, c: CommandeArtefact): EffetCommande {
    const col = c.colonne ?? 1;
    this.decaler(f, "colonne", col, 1);
    return effetOk(`Colonne ${nombreEnColonne(col)} insérée dans ${f.nom}.`, []);
  }

  private supprimerColonne(f: Feuille, c: CommandeArtefact): EffetCommande {
    const col = c.colonne ?? 1;
    for (const row of children(f.sheetData, "row")) {
      const cible = children(row, "c").find((x) => analyserRef(attr(x, "r") ?? "")?.col === col);
      if (cible) removeChild(row, cible);
    }
    this.decaler(f, "colonne", col + 1, -1);
    return effetOk(`Colonne ${nombreEnColonne(col)} de ${f.nom} supprimée.`, []);
  }

  private figer(f: Feuille, c: CommandeArtefact): EffetCommande {
    const ws = child(f.racine, "worksheet");
    if (!ws) return effetEchec("feuille illisible");
    // `sheetViews` doit précéder `sheetData` — même contrainte d'ordre que `cols`.
    let views = child(ws, "sheetViews");
    if (!views) {
      views = element("sheetViews", {}, [element("sheetView", { workbookViewId: "0" })]);
      views.parent = ws;
      const sd = child(ws, "sheetData");
      if (sd) insertBefore(ws, sd, views);
      else { ws.children.push(views); markDirty(ws); }
    }
    const view = children(views, "sheetView")[0] ?? ensureChild(views, "sheetView", []);
    const x = c.colonne ?? 0;
    const y = c.ligne ?? 0;
    const pane = ensureChild(view, "pane", []);
    if (x) setAttr(pane, "xSplit", String(x)); else pane.attrs.delete("xSplit");
    if (y) setAttr(pane, "ySplit", String(y)); else pane.attrs.delete("ySplit");
    setAttr(pane, "topLeftCell", formerRef(y + 1, x + 1));
    setAttr(pane, "activePane", "bottomRight");
    setAttr(pane, "state", "frozen");
    return effetOk(`${f.nom} : ${y} ligne(s) et ${x} colonne(s) figées.`, []);
  }

  private fusionner(f: Feuille, c: CommandeArtefact): EffetCommande {
    const ws = child(f.racine, "worksheet");
    if (!ws) return effetEchec("feuille illisible");
    // `mergeCells` se place APRÈS `sheetData` : l'ordre du schéma, là encore.
    let merges = child(ws, "mergeCells");
    if (!merges) {
      merges = element("mergeCells", { count: "0" });
      merges.parent = ws;
      const sd = child(ws, "sheetData");
      const i = sd ? ws.children.indexOf(sd) + 1 : ws.children.length;
      ws.children.splice(i, 0, merges);
      markDirty(ws);
    }
    const ref = (c.plage ?? "").toUpperCase();
    if (children(merges, "mergeCell").some((m) => attr(m, "ref") === ref)) {
      return effetEchec(`${ref} est déjà fusionnée`);
    }
    const m = element("mergeCell", { ref });
    m.parent = merges;
    merges.children.push(m);
    merges.selfClosing = false;
    setAttr(merges, "count", String(children(merges, "mergeCell").length));
    markDirty(merges);
    return effetOk(`${f.nom}!${ref} fusionnée.`, []);
  }

  private trier(f: Feuille, c: CommandeArtefact): EffetCommande {
    const plage = analyserPlage(c.plage ?? "");
    if (!plage) return effetEchec(`plage « ${c.plage} » illisible`);
    const colTri = plage.from.col + (c.colonne ?? 1) - 1;
    if (colTri > plage.to.col) return effetEchec(`la colonne de tri ${c.colonne} sort de la plage`);
    const descendant = (c.direction ?? "").toLowerCase().startsWith("desc") || c.ordre?.[0] === -1;

    // On déplace les CELLULES entières (valeur, formule, style) et pas seulement les valeurs :
    // trier un tableau en laissant les couleurs sur place produit un tableau faux à l'œil.
    const lignes: { cle: string; cellules: Map<number, XmlNode> }[] = [];
    for (let r = plage.from.row; r <= plage.to.row; r += 1) {
      const row = children(f.sheetData, "row").find((x) => Number(attr(x, "r")) === r);
      const cellules = new Map<number, XmlNode>();
      let cle = "";
      if (row) {
        for (const cell of children(row, "c")) {
          const pos = analyserRef(attr(cell, "r") ?? "");
          if (!pos || pos.col < plage.from.col || pos.col > plage.to.col) continue;
          cellules.set(pos.col, cloneNode(cell));
          if (pos.col === colTri) cle = valeurCellule(cell, this.chaines);
        }
      }
      lignes.push({ cle, cellules });
    }
    const nombre = (s: string): number => Number(s.replace(/\s/g, "").replace(",", "."));
    lignes.sort((a, b) => {
      const na = nombre(a.cle);
      const nb = nombre(b.cle);
      const cmp = Number.isFinite(na) && Number.isFinite(nb) && a.cle.trim() && b.cle.trim()
        ? na - nb
        : a.cle.localeCompare(b.cle, "fr", { numeric: true, sensitivity: "base" });
      return descendant ? -cmp : cmp;
    });

    lignes.forEach((l, i) => {
      const r = plage.from.row + i;
      for (let col = plage.from.col; col <= plage.to.col; col += 1) {
        const cible = this.cellule(f, r, col);
        const source = l.cellules.get(col);
        cible.children = source ? source.children.map((x) => cloneNode(x, cible)) : [];
        cible.attrs = new Map(source ? source.attrs : new Map());
        setAttr(cible, "r", formerRef(r, col));
        cible.selfClosing = cible.children.length === 0;
        markDirty(cible);
      }
    });
    this.invaliderCache();
    return effetOk(`${f.nom}!${c.plage} trié sur la colonne ${c.colonne} (${descendant ? "décroissant" : "croissant"}).`, []);
  }

  private ajouterFeuille(c: CommandeArtefact): EffetCommande {
    const nom = (c.nom ?? "").slice(0, 31);
    if (this.feuilles.some((f) => normaliserTexte(f.nom) === normaliserTexte(nom))) {
      return effetEchec(`ce classeur a déjà une feuille « ${nom} »`);
    }
    const sheets = child(this.workbook, "workbook") ? child(child(this.workbook, "workbook")!, "sheets") : null;
    if (!sheets) return effetEchec("classeur illisible : liste des feuilles introuvable");

    // Un identifiant de relation et un numéro de fichier qui ne collisionnent avec RIEN.
    const numeros = Object.keys(this.zip.files)
      .map((f) => /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(f))
      .filter(Boolean)
      .map((m) => Number(m![1]));
    const num = (numeros.length ? Math.max(...numeros) : 0) + 1;
    const rels = this.zip.file("xl/_rels/workbook.xml.rels");
    if (!rels) return effetEchec("classeur illisible : relations introuvables");
    const relsRacine = parseXml(rels.asText());
    const relsEl = child(relsRacine, "Relationships");
    if (!relsEl) return effetEchec("classeur illisible : relations vides");
    const ids = children(relsEl, "Relationship").map((r) => Number((attr(r, "Id") ?? "").replace(/\D/g, "")) || 0);
    const rId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
    const rel = element("Relationship", {
      Id: rId,
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
      Target: `worksheets/sheet${num}.xml`,
    });
    rel.parent = relsEl;
    relsEl.children.push(rel);
    markDirty(relsEl);
    this.zip.file("xl/_rels/workbook.xml.rels", serializeXml(relsRacine));

    const sheetIds = children(sheets, "sheet").map((s) => Number(attr(s, "sheetId")) || 0);
    const feuilleEl = element("sheet", { name: nom, sheetId: String((sheetIds.length ? Math.max(...sheetIds) : 0) + 1), "r:id": rId });
    feuilleEl.parent = sheets;
    sheets.children.push(feuilleEl);
    sheets.selfClosing = false;
    markDirty(sheets);

    const chemin = `xl/worksheets/sheet${num}.xml`;
    const contenu = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;
    this.zip.file(chemin, contenu);
    // `[Content_Types].xml` doit DÉCLARER la nouvelle feuille, sinon Excel dit « fichier illisible ».
    const ct = this.zip.file("[Content_Types].xml");
    if (ct) {
      const ctRacine = parseXml(ct.asText());
      const types = child(ctRacine, "Types");
      if (types) {
        const o = element("Override", {
          PartName: `/${chemin}`,
          ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
        });
        o.parent = types;
        types.children.push(o);
        markDirty(types);
        this.zip.file("[Content_Types].xml", serializeXml(ctRacine));
      }
    }
    const racine = parseXml(contenu);
    const ws = child(racine, "worksheet")!;
    this.feuilles.push({ nom, chemin, racine, sheetData: child(ws, "sheetData")! });
    return effetOk(`Feuille « ${nom} » ajoutée.`, []);
  }

  private renommerFeuille(f: Feuille, c: CommandeArtefact): EffetCommande {
    const sheets = child(this.workbook, "workbook") ? child(child(this.workbook, "workbook")!, "sheets") : null;
    if (!sheets) return effetEchec("classeur illisible");
    const el = children(sheets, "sheet").find((s) => attr(s, "name") === f.nom);
    if (!el) return effetEchec(`feuille « ${f.nom} » introuvable dans le classeur`);
    const nom = (c.nom ?? "").slice(0, 31);
    setAttr(el, "name", nom);
    const ancien = f.nom;
    f.nom = nom;
    return effetOk(`Feuille « ${ancien} » renommée « ${nom} ».`, []);
  }

  private supprimerFeuille(f: Feuille): EffetCommande {
    if (this.feuilles.length <= 1) return effetEchec("un classeur doit garder au moins une feuille");
    const sheets = child(this.workbook, "workbook") ? child(child(this.workbook, "workbook")!, "sheets") : null;
    if (!sheets) return effetEchec("classeur illisible");
    const el = children(sheets, "sheet").find((s) => attr(s, "name") === f.nom);
    if (el) removeChild(sheets, el);
    this.feuilles = this.feuilles.filter((x) => x !== f);
    // On laisse le fichier de feuille dans le ZIP : le retirer casserait les identifiants de
    // relation des feuilles suivantes. Excel ignore une pièce qui n'est plus référencée.
    return effetOk(`Feuille « ${f.nom} » supprimée.`, []);
  }

  async serialiser(): Promise<Buffer> {
    this.zip.file("xl/workbook.xml", serializeXml(this.workbook));
    for (const f of this.feuilles) this.zip.file(f.chemin, serializeXml(f.racine));
    if (this.styles) this.zip.file("xl/styles.xml", serializeXml(this.styles.racine));
    return this.zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  async valider(): Promise<Validation> {
    const problemes: string[] = [];
    try {
      const octets = await this.serialiser();
      const relu = new PizZip(octets);
      for (const requis of ["[Content_Types].xml", "xl/workbook.xml"]) {
        if (!relu.file(requis)) problemes.push(`pièce obligatoire perdue : ${requis}`);
      }
      for (const f of this.feuilles) {
        const el = relu.file(f.chemin);
        if (!el) { problemes.push(`feuille perdue : ${f.chemin}`); continue; }
        const xml = el.asText();
        if (!xml.includes("<sheetData")) problemes.push(`${f.nom} : données de feuille absentes`);
      }
    } catch (e) {
      problemes.push(`le classeur produit ne se relit pas : ${(e as Error).message}`);
    }
    return { ok: problemes.length === 0, problemes };
  }
}

/**
 * RÉÉCRIT les références A1 d'une formule après un décalage.
 *
 * Une référence ABSOLUE (`$B$4`) ne bouge pas — c'est sa définition et c'est ce qu'attend
 * quiconque a écrit `$B$4` exprès. Une référence relative se décale. Les références précédées
 * d'un `!` (autre feuille) sont laissées telles quelles.
 */
export function decalerFormule(formule: string, axe: "ligne" | "colonne", depuis: number, delta: number): string {
  return formule.replace(/(!?)(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/g, (tout, bang, dCol, lettres, dRow, chiffres) => {
    if (bang === "!") return tout;
    const pos = analyserRef(`${lettres}${chiffres}`);
    if (!pos) return tout;
    if (axe === "ligne") {
      if (dRow === "$" || pos.row < depuis) return tout;
      return `${bang}${dCol}${lettres}${dRow}${pos.row + delta}`;
    }
    if (dCol === "$" || pos.col < depuis) return tout;
    return `${bang}${dCol}${nombreEnColonne(pos.col + delta)}${dRow}${chiffres}`;
  });
}

export const adaptateurXlsx: AdaptateurArtefact = {
  format: "XLSX",
  mimes: [MIME_XLSX],
  extensions: [".xlsx", ".xlsm"],
  async ouvrir(octets: Buffer): Promise<DocumentOuvert> {
    const zip = new PizZip(octets);
    const wbFichier = zip.file("xl/workbook.xml");
    if (!wbFichier) throw new Error("Ce fichier .xlsx ne contient pas xl/workbook.xml — il est probablement endommagé.");
    const workbook = parseXml(wbFichier.asText());
    const wb = child(workbook, "workbook");
    const sheets = wb ? child(wb, "sheets") : null;
    if (!sheets) throw new Error("Ce classeur ne déclare aucune feuille.");

    // rId → chemin de la feuille, lu dans les relations du classeur.
    const relsFichier = zip.file("xl/_rels/workbook.xml.rels");
    const cheminParId = new Map<string, string>();
    if (relsFichier) {
      const relsRacine = parseXml(relsFichier.asText());
      const relsEl = child(relsRacine, "Relationships");
      for (const r of relsEl ? children(relsEl, "Relationship") : []) {
        const id = attr(r, "Id");
        const cible = attr(r, "Target");
        if (id && cible) cheminParId.set(id, cible.startsWith("/") ? cible.slice(1) : `xl/${cible.replace(/^\.\//, "")}`);
      }
    }

    const feuilles: Feuille[] = [];
    for (const s of children(sheets, "sheet")) {
      const nom = attr(s, "name") ?? `Feuille${feuilles.length + 1}`;
      const rid = attr(s, "r:id") ?? attr(s, "id") ?? "";
      const chemin = cheminParId.get(rid) ?? `xl/worksheets/sheet${feuilles.length + 1}.xml`;
      const fichier = zip.file(chemin);
      if (!fichier) continue;
      const racine = parseXml(fichier.asText());
      const ws = child(racine, "worksheet");
      if (!ws) continue;
      // Une feuille vide peut n'avoir aucun `sheetData` : on le crée pour pouvoir y écrire.
      const sheetData = child(ws, "sheetData") ?? ensureChild(ws, "sheetData", ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols"]);
      feuilles.push({ nom, chemin, racine, sheetData });
    }
    if (feuilles.length === 0) throw new Error("Aucune feuille lisible dans ce classeur.");
    return new XlsxOuvert(zip, workbook, feuilles, lireChainesPartagees(zip), lireStyles(zip));
  },
};
