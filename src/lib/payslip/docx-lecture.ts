/**
 * LIRE UN `.docx` COMME WORD LE MET EN PAGE — le modèle complet dont le rendu PDF a besoin.
 *
 * `docx-blocks.ts` rend une suite de blocs « à plat » (texte, graisse, cellules) : suffisant pour
 * relire un bulletin, insuffisant pour le REDESSINER à l'identique. La Direction l'a constaté sur
 * l'ordre de mission : le PDF ne reprenait que le texte — la date poussée à droite par ses
 * tabulations revenait à gauche, les intertitres soulignés perdaient leur trait, les tailles du
 * document étaient ignorées.
 *
 * Ce module relit donc ce qui FAIT la page :
 *   • la CASCADE DES STYLES — `docDefaults` → style de tableau → style de paragraphe (et sa chaîne
 *     `basedOn`) → style de caractère → mise en forme directe ; polices du THÈME (`minorHAnsi`…) ;
 *   • les paragraphes : alignement, retraits, espacements (y compris l'espacement AUTOMATIQUE
 *     `beforeAutospacing` des documents issus du web), interligne, TABULATIONS (gauche, droite,
 *     centrée, décimale, points de suite), bordures, trame, enchaînements ;
 *   • les fragments : police, taille, graisse, italique, soulignement, barré, couleur, surlignage,
 *     majuscules, exposant/indice, espacement des caractères, liens hypertexte ;
 *   • les LISTES (`numbering.xml`) : puces et numéros, compteurs par liste, remises à zéro ;
 *   • les champs PAGE / NUMPAGES (numéro de page dans un pied) ;
 *   • les IMAGES en ligne et ANCRÉES (position, alignement, rognage, devant/derrière le texte),
 *     les FORMES (rectangles, filets, ellipses) et les ZONES DE TEXTE, groupes compris — et leur
 *     équivalent VML des documents anciens ;
 *   • les tableaux : grille, largeurs, fusions horizontales ET verticales, bordures cellule par
 *     cellule (style de tableau, mise en forme conditionnelle de la ligne d'en-tête et des bandes),
 *     marges de cellule, trames, alignement vertical, hauteurs de ligne, lignes d'en-tête répétées ;
 *   • les SECTIONS : format, marges, distances d'en-tête et de pied, en-têtes/pieds par défaut,
 *     de première page et de pages paires, numérotation des pages.
 *
 * Module PUR : il prend des octets, il rend un modèle. Ni fichier, ni PDF, ni base.
 */

import PizZip from "pizzip";
import { attr, child, children, parseXml, textOf, type XmlNode } from "@/lib/artifact/object-model/xml";

// ─────────────────────────── Le modèle ───────────────────────────

export interface Bordure {
  epaisseurPt: number;
  couleur: string;
  style: "simple" | "double" | "pointille" | "tirets";
  /** `w:space` : l'air entre le filet et le texte (bordures de paragraphe), en points. */
  espacePt: number;
}

export interface ProprietesTexte {
  /** Le nom de police tel que Word l'utilise (thème résolu) : « Calibri », « Times New Roman »… */
  police: string;
  taillePt: number;
  gras: boolean;
  italique: boolean;
  souligne: "simple" | "double" | null;
  barre: boolean;
  /** Hexadécimal sans dièse ; `null` = automatique (noir). */
  couleur: string | null;
  surlignage: string | null;
  fond: string | null;
  majuscules: boolean;
  petitesMajuscules: boolean;
  position: "normal" | "exposant" | "indice";
  masque: boolean;
  espacementPt: number;
  lien: string | null;
}

export interface Tabulation {
  pos: number;
  type: "left" | "center" | "right" | "decimal" | "bar" | "clear";
  points: "dot" | "hyphen" | "underscore" | "middleDot" | null;
}

export interface ProprietesParagraphe {
  alignement: "left" | "center" | "right" | "justify";
  retraitGauche: number;
  retraitDroit: number;
  /** Positif : retrait de première ligne ; négatif : retrait suspendu. */
  retraitPremiere: number;
  avant: number;
  apres: number;
  avantAuto: boolean;
  apresAuto: boolean;
  interligne: { regle: "auto" | "exact" | "atLeast"; valeur: number };
  tabulations: Tabulation[];
  garderAvecSuivant: boolean;
  garderLignes: boolean;
  sautAvant: boolean;
  veuves: boolean;
  espacementContextuel: boolean;
  fond: string | null;
  bordures: { haut: Bordure | null; bas: Bordure | null; gauche: Bordure | null; droite: Bordure | null };
  styleId: string | null;
}

export interface Rognage { gauche: number; haut: number; droite: number; bas: number }

/** Ce qu'un dessin contient, en points, relativement au coin haut-gauche de son cadre. */
export type ElementGraphique =
  | { type: "image"; x: number; y: number; largeur: number; hauteur: number; image: ImageDocx; rognage: Rognage | null }
  | {
      type: "forme";
      x: number; y: number; largeur: number; hauteur: number;
      geometrie: "rect" | "roundRect" | "ellipse" | "ligne";
      fond: string | null;
      trait: { couleur: string; epaisseur: number } | null;
      retourneH: boolean;
      retourneV: boolean;
      texte: { blocs: Bloc[]; marges: { gauche: number; haut: number; droite: number; bas: number }; ancrageV: "haut" | "centre" | "bas" } | null;
    };

export interface ImageDocx { cle: string; octets: Buffer }

export type Inline =
  | { k: "texte"; texte: string; p: ProprietesTexte }
  | { k: "tab"; p: ProprietesTexte }
  | { k: "ptab"; alignement: "left" | "center" | "right"; p: ProprietesTexte }
  | { k: "saut"; type: "ligne" | "page" | "colonne"; p: ProprietesTexte }
  | { k: "dessin"; largeur: number; hauteur: number; contenu: ElementGraphique[]; p: ProprietesTexte }
  | { k: "champ"; code: "PAGE" | "NUMPAGES"; repli: string; p: ProprietesTexte };

export interface PositionAncre {
  /** `page`, `margin`, `column`, `character`, `leftMargin`, `rightMargin`, `paragraph`, `line`, `topMargin`, `bottomMargin`… */
  rel: string;
  decalage: number | null;
  align: string | null;
  pct: number | null;
}

export interface Ancre {
  largeur: number;
  hauteur: number;
  h: PositionAncre;
  v: PositionAncre;
  derriere: boolean;
  habillage: "none" | "square" | "tight" | "through" | "topAndBottom";
  contenu: ElementGraphique[];
}

export interface Etiquette {
  texte: string;
  p: ProprietesTexte;
  puce: "disque" | "cercle" | "carre" | "losange" | "fleche" | null;
  suffixe: "tab" | "space" | "nothing";
  /** La puce vient d'une police Symbol / Wingdings : ses métriques (plus hautes) font la ligne. */
  symbole: boolean;
}

export interface Paragraphe {
  type: "paragraphe";
  pp: ProprietesParagraphe;
  /** Les propriétés de la MARQUE de paragraphe : la hauteur d'un paragraphe vide, de la dernière ligne. */
  marque: ProprietesTexte;
  contenu: Inline[];
  ancres: Ancre[];
  etiquette: Etiquette | null;
}

export interface Cellule {
  blocs: Bloc[];
  colonne: number;
  span: number;
  fusionV: "debut" | "suite" | null;
  fond: string | null;
  bordures: { haut: Bordure | null; bas: Bordure | null; gauche: Bordure | null; droite: Bordure | null };
  alignV: "haut" | "centre" | "bas";
  marges: { gauche: number; haut: number; droite: number; bas: number };
}

export interface Rangee {
  cellules: Cellule[];
  hauteur: { valeur: number; regle: "atLeast" | "exact" } | null;
  entete: boolean;
}

export interface Tableau {
  type: "tableau";
  grille: number[];
  alignement: "left" | "center" | "right";
  retrait: number;
  rangees: Rangee[];
}

export type Bloc = Paragraphe | Tableau;

export interface Bande { blocs: Bloc[] }

export interface Section {
  largeur: number;
  hauteur: number;
  marges: { haut: number; bas: number; gauche: number; droite: number; entete: number; pied: number };
  /** Marge haute « exacte » (négative dans Word) : l'en-tête ne repousse pas le corps. */
  hautExact: boolean;
  basExact: boolean;
  entetes: { defaut?: Bande | null; premiere?: Bande | null; paire?: Bande | null };
  pieds: { defaut?: Bande | null; premiere?: Bande | null; paire?: Bande | null };
  titrePage: boolean;
  type: "nextPage" | "continuous" | "evenPage" | "oddPage";
  debutNumero: number | null;
  formatNumero: string;
  colonnes: number;
}

export interface DocumentDocx {
  sections: { section: Section; blocs: Bloc[] }[];
  tabDefaut: number;
  pairesImpaires: boolean;
  /** Ce qui a été rencontré sans pouvoir être restitué — pour le dire, jamais pour le taire. */
  ignores: Set<string>;
}

// ─────────────────────────── Unités et petits lecteurs ───────────────────────────

const TWIP = 20;
const EMU = 12_700;
const AUTO_ESPACEMENT = 14;

const nombre = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const att = (n: XmlNode | null | undefined, nom: string): string | null => (n ? attr(n, nom) : null);
const enfant = (n: XmlNode | null | undefined, nom: string): XmlNode | null => (n ? child(n, nom) : null);
const hex6 = (v: string | null): string | null => (v && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : null);
const elements = (n: XmlNode): XmlNode[] => n.children.filter((c) => c.type === "element");

/** Une bascule OOXML (`<w:b/>`, `<w:b w:val="0"/>`) : `undefined` quand l'élément manque. */
function bascule(n: XmlNode | null): boolean | undefined {
  if (!n) return undefined;
  const v = attr(n, "w:val");
  return !(v === "0" || v === "false" || v === "off");
}

/** Le premier descendant d'un nom donné, sans jamais entrer dans `mc:Fallback`. */
function premier(n: XmlNode, nom: string): XmlNode | null {
  for (const c of n.children) {
    if (c.type !== "element" || c.name === "mc:Fallback") continue;
    if (c.name === nom) return c;
    const t = premier(c, nom);
    if (t) return t;
  }
  return null;
}

// ─────────────────────────── Le thème ───────────────────────────

interface Theme { majeure: string; mineure: string; couleurs: Map<string, string> }

function lireTheme(zip: PizZip): Theme {
  const theme: Theme = { majeure: "Calibri Light", mineure: "Calibri", couleurs: new Map() };
  const nom = Object.keys(zip.files).find((f) => /^word\/theme\/theme\d*\.xml$/.test(f));
  const f = nom ? zip.file(nom) : null;
  if (!f) return theme;
  const racine = parseXml(f.asText());
  const maj = premier(racine, "a:majorFont");
  const min = premier(racine, "a:minorFont");
  const latin = (n: XmlNode | null) => att(enfant(n, "a:latin"), "typeface");
  theme.majeure = latin(maj) || theme.majeure;
  theme.mineure = latin(min) || theme.mineure;
  const schema = premier(racine, "a:clrScheme");
  if (schema) {
    for (const c of elements(schema)) {
      const srgb = enfant(c, "a:srgbClr");
      const sys = enfant(c, "a:sysClr");
      const v = hex6(att(srgb, "val")) ?? hex6(att(sys, "lastClr"));
      if (v) theme.couleurs.set(c.name.replace(/^a:/, ""), v);
    }
  }
  return theme;
}

const ALIAS_THEME: Record<string, string> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2", text1: "dk1", background1: "lt1", text2: "dk2", background2: "lt2", dark1: "dk1", light1: "lt1", dark2: "dk2", light2: "lt2", hyperlink: "hlink", followedHyperlink: "folHlink" };

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function versHex([r, g, b]: [number, number, number]): string {
  return [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function versHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h / 6, s, l];
}
function depuisHsl([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Une couleur DrawingML (`a:srgbClr`, `a:schemeClr`, `a:sysClr`, `a:prstClr`) et ses modificateurs. */
function couleurDrawing(n: XmlNode | null, theme: Theme): string | null {
  if (!n) return null;
  const c = elements(n).find((e) => /^a:(srgbClr|schemeClr|sysClr|prstClr|scrgbClr)$/.test(e.name));
  if (!c) return null;
  let base: string | null = null;
  if (c.name === "a:srgbClr") base = hex6(attr(c, "val"));
  else if (c.name === "a:sysClr") base = hex6(attr(c, "lastClr")) ?? (attr(c, "val") === "window" ? "FFFFFF" : "000000");
  else if (c.name === "a:schemeClr") {
    const v = attr(c, "val") ?? "";
    base = theme.couleurs.get(ALIAS_THEME[v] ?? v) ?? (v === "bg1" || v === "lt1" ? "FFFFFF" : null);
  } else if (c.name === "a:prstClr") base = COULEURS_NOMMEES[attr(c, "val") ?? ""] ?? null;
  if (!base) return null;
  let col = rgb(base);
  for (const m of elements(c)) {
    const val = (nombre(attr(m, "val")) ?? 100000) / 100000;
    if (m.name === "a:lumMod" || m.name === "a:lumOff") {
      const hsl = versHsl(col);
      hsl[2] = m.name === "a:lumMod" ? hsl[2] * val : hsl[2] + val;
      hsl[2] = Math.max(0, Math.min(1, hsl[2]));
      col = depuisHsl(hsl);
    } else if (m.name === "a:shade") col = col.map((x) => x * val) as [number, number, number];
    else if (m.name === "a:tint") col = col.map((x) => x + (255 - x) * (1 - val)) as [number, number, number];
  }
  return versHex(col);
}

/** `w:color` / `w:shd` : la valeur explicite, sinon la couleur du thème nuancée. */
function couleurWord(val: string | null, themeColor: string | null, shade: string | null, tint: string | null, theme: Theme): string | null {
  if (val && val !== "auto") {
    const h = hex6(val);
    if (h) return h;
  }
  if (!themeColor) return null;
  const base = theme.couleurs.get(ALIAS_THEME[themeColor] ?? themeColor);
  if (!base) return null;
  let col = rgb(base);
  const s = shade ? parseInt(shade, 16) / 255 : null;
  const t = tint ? parseInt(tint, 16) / 255 : null;
  if (s != null && Number.isFinite(s)) col = col.map((x) => x * s) as [number, number, number];
  if (t != null && Number.isFinite(t)) col = col.map((x) => x + (255 - x) * (1 - t)) as [number, number, number];
  return versHex(col);
}

const COULEURS_NOMMEES: Record<string, string> = {
  black: "000000", blue: "0000FF", cyan: "00FFFF", green: "00FF00", magenta: "FF00FF", red: "FF0000", yellow: "FFFF00", white: "FFFFFF",
  darkBlue: "000080", darkCyan: "008080", darkGreen: "008000", darkMagenta: "800080", darkRed: "800000", darkYellow: "808000",
  darkGray: "808080", lightGray: "C0C0C0",
};

// ─────────────────────────── Propriétés partielles (avant cascade) ───────────────────────────

type RPr = Partial<ProprietesTexte>;

interface PPr {
  alignement?: ProprietesParagraphe["alignement"];
  retraitGauche?: number;
  retraitDroit?: number;
  retraitPremiere?: number;
  avant?: number;
  apres?: number;
  avantAuto?: boolean;
  apresAuto?: boolean;
  interligne?: ProprietesParagraphe["interligne"];
  tabs?: Tabulation[];
  garderAvecSuivant?: boolean;
  garderLignes?: boolean;
  sautAvant?: boolean;
  veuves?: boolean;
  espacementContextuel?: boolean;
  fond?: string | null;
  bordures?: Partial<ProprietesParagraphe["bordures"]>;
  numId?: string;
  niveau?: number;
}

function lireBordure(n: XmlNode | null, theme: Theme): Bordure | null | undefined {
  if (!n) return undefined;
  const val = attr(n, "w:val") ?? "single";
  if (val === "nil" || val === "none") return null;
  const sz = nombre(attr(n, "w:sz")) ?? 4;
  const couleur = couleurWord(attr(n, "w:color"), attr(n, "w:themeColor"), attr(n, "w:themeShade"), attr(n, "w:themeTint"), theme) ?? "000000";
  const style: Bordure["style"] = /double/i.test(val) ? "double" : /dot/i.test(val) ? "pointille" : /dash/i.test(val) ? "tirets" : "simple";
  return { epaisseurPt: Math.max(0.25, sz / 8), couleur, style, espacePt: Math.max(0, Math.min(31, nombre(attr(n, "w:space")) ?? 0)) };
}

function lireRPr(rPr: XmlNode | null, theme: Theme): RPr {
  const r: RPr = {};
  if (!rPr) return r;
  const polices = enfant(rPr, "w:rFonts");
  if (polices) {
    const th = attr(polices, "w:asciiTheme") ?? attr(polices, "w:hAnsiTheme");
    const nom = th ? (/^major/.test(th) ? theme.majeure : theme.mineure) : attr(polices, "w:ascii") ?? attr(polices, "w:hAnsi");
    if (nom) r.police = nom;
  }
  const b = bascule(enfant(rPr, "w:b"));
  if (b !== undefined) r.gras = b;
  const i = bascule(enfant(rPr, "w:i"));
  if (i !== undefined) r.italique = i;
  const caps = bascule(enfant(rPr, "w:caps"));
  if (caps !== undefined) r.majuscules = caps;
  const pcaps = bascule(enfant(rPr, "w:smallCaps"));
  if (pcaps !== undefined) r.petitesMajuscules = pcaps;
  const barre = bascule(enfant(rPr, "w:strike")) ?? bascule(enfant(rPr, "w:dstrike"));
  if (barre !== undefined) r.barre = barre;
  const masque = bascule(enfant(rPr, "w:vanish"));
  if (masque !== undefined) r.masque = masque;
  const sz = nombre(att(enfant(rPr, "w:sz"), "w:val"));
  if (sz != null && sz > 0) r.taillePt = sz / 2;
  const c = enfant(rPr, "w:color");
  if (c) r.couleur = couleurWord(attr(c, "w:val"), attr(c, "w:themeColor"), attr(c, "w:themeShade"), attr(c, "w:themeTint"), theme);
  const u = enfant(rPr, "w:u");
  if (u) {
    const v = attr(u, "w:val") ?? "single";
    r.souligne = v === "none" || v === "0" ? null : /double/i.test(v) ? "double" : "simple";
  }
  const hl = att(enfant(rPr, "w:highlight"), "w:val");
  if (hl) r.surlignage = hl === "none" ? null : COULEURS_NOMMEES[hl] ?? null;
  const shd = enfant(rPr, "w:shd");
  if (shd) r.fond = couleurWord(attr(shd, "w:fill"), attr(shd, "w:themeFill"), attr(shd, "w:themeFillShade"), attr(shd, "w:themeFillTint"), theme);
  const va = att(enfant(rPr, "w:vertAlign"), "w:val");
  if (va) r.position = va === "superscript" ? "exposant" : va === "subscript" ? "indice" : "normal";
  const esp = nombre(att(enfant(rPr, "w:spacing"), "w:val"));
  if (esp != null) r.espacementPt = esp / TWIP;
  return r;
}

function lirePPr(pPr: XmlNode | null, theme: Theme): PPr {
  const p: PPr = {};
  if (!pPr) return p;
  const jc = att(enfant(pPr, "w:jc"), "w:val");
  if (jc) p.alignement = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" || jc === "distribute" || /Kashida/.test(jc) ? "justify" : "left";
  const ind = enfant(pPr, "w:ind");
  if (ind) {
    const g = nombre(attr(ind, "w:left") ?? attr(ind, "w:start"));
    const d = nombre(attr(ind, "w:right") ?? attr(ind, "w:end"));
    const fl = nombre(attr(ind, "w:firstLine"));
    const hg = nombre(attr(ind, "w:hanging"));
    if (g != null) p.retraitGauche = g / TWIP;
    if (d != null) p.retraitDroit = d / TWIP;
    if (hg != null) p.retraitPremiere = -hg / TWIP;
    else if (fl != null) p.retraitPremiere = fl / TWIP;
  }
  const sp = enfant(pPr, "w:spacing");
  if (sp) {
    const av = nombre(attr(sp, "w:before"));
    const ap = nombre(attr(sp, "w:after"));
    if (av != null) p.avant = av / TWIP;
    if (ap != null) p.apres = ap / TWIP;
    const vrai = (v: string) => v === "1" || v === "true" || v === "on";
    const aa = attr(sp, "w:beforeAutospacing");
    const pa = attr(sp, "w:afterAutospacing");
    if (aa != null) p.avantAuto = vrai(aa);
    if (pa != null) p.apresAuto = vrai(pa);
    const ligne = nombre(attr(sp, "w:line"));
    if (ligne != null && ligne > 0) {
      const regle = attr(sp, "w:lineRule") ?? "auto";
      p.interligne = regle === "exact" ? { regle: "exact", valeur: ligne / TWIP } : regle === "atLeast" ? { regle: "atLeast", valeur: ligne / TWIP } : { regle: "auto", valeur: ligne / 240 };
    }
  }
  const tabs = enfant(pPr, "w:tabs");
  if (tabs) {
    p.tabs = children(tabs, "w:tab").map((t) => {
      const v = attr(t, "w:val") ?? "left";
      const type: Tabulation["type"] = v === "clear" ? "clear" : v === "center" ? "center" : v === "right" || v === "end" ? "right" : v === "decimal" ? "decimal" : v === "bar" ? "bar" : "left";
      const l = attr(t, "w:leader");
      return { pos: (nombre(attr(t, "w:pos")) ?? 0) / TWIP, type, points: l === "dot" || l === "hyphen" || l === "underscore" || l === "middleDot" ? l : null };
    });
  }
  const b = (nom: string): boolean | undefined => bascule(enfant(pPr, nom));
  if (b("w:keepNext") !== undefined) p.garderAvecSuivant = b("w:keepNext");
  if (b("w:keepLines") !== undefined) p.garderLignes = b("w:keepLines");
  if (b("w:pageBreakBefore") !== undefined) p.sautAvant = b("w:pageBreakBefore");
  if (b("w:widowControl") !== undefined) p.veuves = b("w:widowControl");
  if (b("w:contextualSpacing") !== undefined) p.espacementContextuel = b("w:contextualSpacing");
  const shd = enfant(pPr, "w:shd");
  if (shd) p.fond = couleurWord(attr(shd, "w:fill"), attr(shd, "w:themeFill"), attr(shd, "w:themeFillShade"), attr(shd, "w:themeFillTint"), theme);
  const bdr = enfant(pPr, "w:pBdr");
  if (bdr) {
    p.bordures = {};
    const h = lireBordure(enfant(bdr, "w:top"), theme);
    const bas = lireBordure(enfant(bdr, "w:bottom"), theme);
    const g = lireBordure(enfant(bdr, "w:left") ?? enfant(bdr, "w:start"), theme);
    const d = lireBordure(enfant(bdr, "w:right") ?? enfant(bdr, "w:end"), theme);
    if (h !== undefined) p.bordures.haut = h;
    if (bas !== undefined) p.bordures.bas = bas;
    if (g !== undefined) p.bordures.gauche = g;
    if (d !== undefined) p.bordures.droite = d;
  }
  const numPr = enfant(pPr, "w:numPr");
  if (numPr) {
    const id = att(enfant(numPr, "w:numId"), "w:val");
    const lvl = nombre(att(enfant(numPr, "w:ilvl"), "w:val"));
    if (id != null) p.numId = id;
    if (lvl != null) p.niveau = lvl;
  }
  return p;
}

function fusionPPr(...couches: (PPr | null | undefined)[]): PPr {
  const out: PPr = {};
  for (const c of couches) {
    if (!c) continue;
    const { tabs, bordures, ...reste } = c;
    Object.assign(out, reste);
    if (tabs) out.tabs = [...(out.tabs ?? []), ...tabs];
    if (bordures) out.bordures = { ...(out.bordures ?? {}), ...bordures };
  }
  return out;
}

const fusionRPr = (...couches: (RPr | null | undefined)[]): RPr => Object.assign({}, ...couches.filter(Boolean));

const TEXTE_DEFAUT: ProprietesTexte = {
  police: "Times New Roman", taillePt: 10, gras: false, italique: false, souligne: null, barre: false, couleur: null,
  surlignage: null, fond: null, majuscules: false, petitesMajuscules: false, position: "normal", masque: false, espacementPt: 0, lien: null,
};

function resoudreTexte(r: RPr): ProprietesTexte {
  return { ...TEXTE_DEFAUT, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) } as ProprietesTexte;
}

function resoudreParagraphe(p: PPr, styleId: string | null): ProprietesParagraphe {
  // Les tabulations : chaque couche AJOUTE ou EFFACE (`clear`) — l'ordre des couches fait foi.
  const tabs: Tabulation[] = [];
  for (const t of p.tabs ?? []) {
    const i = tabs.findIndex((x) => Math.abs(x.pos - t.pos) < 0.6);
    if (i >= 0) tabs.splice(i, 1);
    if (t.type !== "clear") tabs.push(t);
  }
  tabs.sort((a, b) => a.pos - b.pos);
  return {
    alignement: p.alignement ?? "left",
    retraitGauche: p.retraitGauche ?? 0,
    retraitDroit: p.retraitDroit ?? 0,
    retraitPremiere: p.retraitPremiere ?? 0,
    avant: p.avantAuto ? AUTO_ESPACEMENT : p.avant ?? 0,
    apres: p.apresAuto ? AUTO_ESPACEMENT : p.apres ?? 0,
    avantAuto: !!p.avantAuto,
    apresAuto: !!p.apresAuto,
    interligne: p.interligne ?? { regle: "auto", valeur: 1 },
    tabulations: tabs,
    garderAvecSuivant: !!p.garderAvecSuivant,
    garderLignes: !!p.garderLignes,
    sautAvant: !!p.sautAvant,
    veuves: p.veuves ?? true,
    espacementContextuel: !!p.espacementContextuel,
    fond: p.fond ?? null,
    bordures: { haut: p.bordures?.haut ?? null, bas: p.bordures?.bas ?? null, gauche: p.bordures?.gauche ?? null, droite: p.bordures?.droite ?? null },
    styleId,
  };
}

// ─────────────────────────── Les styles ───────────────────────────

interface BordsTableau { haut?: Bordure | null; bas?: Bordure | null; gauche?: Bordure | null; droite?: Bordure | null; interieurH?: Bordure | null; interieurV?: Bordure | null }
interface MargesCellule { gauche?: number; haut?: number; droite?: number; bas?: number }
interface Conditionnel { pPr: PPr; rPr: RPr; fond?: string | null; bords: BordsTableau }

interface StyleBrut {
  id: string;
  type: string;
  base: string | null;
  pPr: PPr;
  rPr: RPr;
  bords: BordsTableau;
  marges: MargesCellule;
  conditionnels: Map<string, Conditionnel>;
}

interface Styles {
  bruts: Map<string, StyleBrut>;
  defautRPr: RPr;
  defautPPr: PPr;
  paragrapheDefaut: string | null;
  tableauDefaut: string | null;
}

function lireBordsTableau(n: XmlNode | null, theme: Theme): BordsTableau {
  const b: BordsTableau = {};
  if (!n) return b;
  const pose = (cle: keyof BordsTableau, ...noms: string[]) => {
    for (const nom of noms) {
      const v = lireBordure(enfant(n, nom), theme);
      if (v !== undefined) { b[cle] = v; return; }
    }
  };
  pose("haut", "w:top");
  pose("bas", "w:bottom");
  pose("gauche", "w:left", "w:start");
  pose("droite", "w:right", "w:end");
  pose("interieurH", "w:insideH");
  pose("interieurV", "w:insideV");
  return b;
}

function lireMarges(n: XmlNode | null): MargesCellule {
  const m: MargesCellule = {};
  if (!n) return m;
  const w = (nom: string) => { const e = enfant(n, nom); const v = nombre(att(e, "w:w")); return e && v != null && att(e, "w:type") !== "pct" ? v / TWIP : undefined; };
  const g = w("w:left") ?? w("w:start"), h = w("w:top"), d = w("w:right") ?? w("w:end"), b = w("w:bottom");
  if (g !== undefined) m.gauche = g;
  if (h !== undefined) m.haut = h;
  if (d !== undefined) m.droite = d;
  if (b !== undefined) m.bas = b;
  return m;
}

function lireStyles(zip: PizZip, theme: Theme): Styles {
  const s: Styles = { bruts: new Map(), defautRPr: {}, defautPPr: {}, paragrapheDefaut: null, tableauDefaut: null };
  const f = zip.file("word/styles.xml");
  if (!f) return s;
  const racine = parseXml(f.asText());
  const styles = premier(racine, "w:styles") ?? racine;
  const defs = enfant(styles, "w:docDefaults");
  s.defautRPr = lireRPr(enfant(enfant(defs, "w:rPrDefault"), "w:rPr"), theme);
  s.defautPPr = lirePPr(enfant(enfant(defs, "w:pPrDefault"), "w:pPr"), theme);
  for (const st of children(styles, "w:style")) {
    const id = attr(st, "w:styleId");
    if (!id) continue;
    const type = attr(st, "w:type") ?? "paragraph";
    const defaut = attr(st, "w:default") === "1" || attr(st, "w:default") === "true";
    if (defaut && type === "paragraph") s.paragrapheDefaut = id;
    if (defaut && type === "table") s.tableauDefaut = id;
    const tblPr = enfant(st, "w:tblPr");
    const conditionnels = new Map<string, Conditionnel>();
    for (const c of children(st, "w:tblStylePr")) {
      const t = attr(c, "w:type");
      if (!t) continue;
      const tcPr = enfant(c, "w:tcPr");
      const shd = enfant(tcPr, "w:shd");
      conditionnels.set(t, {
        pPr: lirePPr(enfant(c, "w:pPr"), theme),
        rPr: lireRPr(enfant(c, "w:rPr"), theme),
        fond: shd ? couleurWord(attr(shd, "w:fill"), attr(shd, "w:themeFill"), attr(shd, "w:themeFillShade"), attr(shd, "w:themeFillTint"), theme) : undefined,
        bords: { ...lireBordsTableau(enfant(enfant(c, "w:tblPr"), "w:tblBorders"), theme), ...lireBordsTableau(enfant(tcPr, "w:tcBorders"), theme) },
      });
    }
    s.bruts.set(id, {
      id,
      type,
      base: att(enfant(st, "w:basedOn"), "w:val"),
      pPr: lirePPr(enfant(st, "w:pPr"), theme),
      rPr: lireRPr(enfant(st, "w:rPr"), theme),
      bords: lireBordsTableau(enfant(tblPr, "w:tblBorders"), theme),
      marges: lireMarges(enfant(tblPr, "w:tblCellMar")),
      conditionnels,
    });
  }
  return s;
}

/** La CHAÎNE d'un style, de la base la plus lointaine au style lui-même (bornée : un cycle ne boucle pas). */
function chaine(styles: Styles, id: string | null): StyleBrut[] {
  const out: StyleBrut[] = [];
  let cur = id ? styles.bruts.get(id) ?? null : null;
  while (cur && out.length < 20 && !out.includes(cur)) {
    out.unshift(cur);
    cur = cur.base ? styles.bruts.get(cur.base) ?? null : null;
  }
  return out;
}

// ─────────────────────────── Les listes ───────────────────────────

interface Niveau { debut: number; format: string; texte: string; suffixe: Etiquette["suffixe"]; pPr: PPr; rPr: RPr; policeSymbole: string | null }
interface Numerotation {
  abstraits: Map<string, Map<number, Niveau>>;
  nums: Map<string, { abstrait: string; surcharges: Map<number, { debut?: number; niveau?: Niveau }> }>;
  compteurs: Map<string, (number | undefined)[]>;
  dejaVus: Set<string>;
}

function lireNiveau(lvl: XmlNode, theme: Theme): Niveau {
  const rPrN = enfant(lvl, "w:rPr");
  const polices = enfant(rPrN, "w:rFonts");
  const suff = att(enfant(lvl, "w:suff"), "w:val");
  return {
    debut: nombre(att(enfant(lvl, "w:start"), "w:val")) ?? 1,
    format: att(enfant(lvl, "w:numFmt"), "w:val") ?? "decimal",
    texte: att(enfant(lvl, "w:lvlText"), "w:val") ?? "",
    suffixe: suff === "space" ? "space" : suff === "nothing" ? "nothing" : "tab",
    pPr: lirePPr(enfant(lvl, "w:pPr"), theme),
    rPr: lireRPr(rPrN, theme),
    policeSymbole: polices ? attr(polices, "w:ascii") ?? attr(polices, "w:hAnsi") : null,
  };
}

function lireNumerotation(zip: PizZip, theme: Theme): Numerotation {
  const n: Numerotation = { abstraits: new Map(), nums: new Map(), compteurs: new Map(), dejaVus: new Set() };
  const f = zip.file("word/numbering.xml");
  if (!f) return n;
  const racine = premier(parseXml(f.asText()), "w:numbering");
  if (!racine) return n;
  for (const a of children(racine, "w:abstractNum")) {
    const id = attr(a, "w:abstractNumId");
    if (id == null) continue;
    const niveaux = new Map<number, Niveau>();
    for (const lvl of children(a, "w:lvl")) niveaux.set(nombre(attr(lvl, "w:ilvl")) ?? 0, lireNiveau(lvl, theme));
    n.abstraits.set(id, niveaux);
  }
  for (const num of children(racine, "w:num")) {
    const id = attr(num, "w:numId");
    const abs = att(enfant(num, "w:abstractNumId"), "w:val");
    if (id == null || abs == null) continue;
    const surcharges = new Map<number, { debut?: number; niveau?: Niveau }>();
    for (const o of children(num, "w:lvlOverride")) {
      const ilvl = nombre(attr(o, "w:ilvl")) ?? 0;
      const debut = nombre(att(enfant(o, "w:startOverride"), "w:val"));
      const lvl = enfant(o, "w:lvl");
      surcharges.set(ilvl, { debut: debut ?? undefined, niveau: lvl ? lireNiveau(lvl, theme) : undefined });
    }
    n.nums.set(id, { abstrait: abs, surcharges });
  }
  return n;
}

function niveauDe(num: Numerotation, numId: string, ilvl: number): Niveau | null {
  const def = num.nums.get(numId);
  if (!def) return null;
  return def.surcharges.get(ilvl)?.niveau ?? num.abstraits.get(def.abstrait)?.get(ilvl) ?? null;
}

const ROMAINS: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
export function romain(n: number): string {
  let out = "";
  let r = Math.max(1, Math.floor(n));
  for (const [v, s] of ROMAINS) while (r >= v) { out += s; r -= v; }
  return out;
}
function lettres(n: number): string {
  const k = Math.max(1, n);
  const l = String.fromCharCode(97 + ((k - 1) % 26));
  return l.repeat(Math.floor((k - 1) / 26) + 1);
}
export function formaterNombre(n: number, format: string): string {
  switch (format) {
    case "lowerRoman": return romain(n);
    case "upperRoman": return romain(n).toUpperCase();
    case "lowerLetter": return lettres(n);
    case "upperLetter": return lettres(n).toUpperCase();
    case "decimalZero": return n < 10 ? `0${n}` : String(n);
    case "none": return "";
    case "ordinal": return n === 1 ? "1er" : `${n}e`;
    default: return String(n);
  }
}

/** Le caractère de puce, ramené à une forme qu'on DESSINE (les polices Symbol/Wingdings ne sont pas embarquées). */
function puceDe(texte: string, police: string | null): Etiquette["puce"] | "texte" {
  const c = texte.codePointAt(0) ?? 0;
  const p = (police ?? "").toLowerCase();
  if (texte === "o" && /courier/.test(p)) return "cercle";
  if (c === 0xf0a7 || (p.includes("wingdings") && c === 0xa7) || c === 0x25aa || c === 0x25a0) return "carre";
  if (c === 0xf076 || c === 0x2756) return "losange";
  if (c === 0xf0d8 || c === 0xf0e0 || c === 0xf0e8 || c === 0x27a2 || c === 0x25ba) return "fleche";
  if (c === 0xf0b7 || c === 0x2022 || c === 0xb7 || c === 0x25cf || (c >= 0xf000 && c <= 0xf0ff) || p.includes("symbol") || p.includes("wingdings")) return "disque";
  if (c === 0x25cb || c === 0x25e6) return "cercle";
  return "texte";
}

// ─────────────────────────── Le contexte de lecture ───────────────────────────

interface Ctx {
  zip: PizZip;
  rels: Map<string, { cible: string; externe: boolean }>;
  styles: Styles;
  theme: Theme;
  num: Numerotation;
  images: Map<string, ImageDocx>;
  ignores: Set<string>;
  /** Le style de tableau en vigueur (cellules) : ses propriétés passent SOUS le style de paragraphe. */
  tableau: { pPr: PPr; rPr: RPr } | null;
}

function lireRels(zip: PizZip, chemin: string): Map<string, { cible: string; externe: boolean }> {
  const dossier = chemin.slice(0, chemin.lastIndexOf("/") + 1);
  const nom = chemin.slice(dossier.length);
  const out = new Map<string, { cible: string; externe: boolean }>();
  const f = zip.file(`${dossier}_rels/${nom}.rels`);
  if (!f) return out;
  const racine = parseXml(f.asText());
  const visiter = (n: XmlNode) => {
    for (const r of elements(n)) {
      if (r.name === "Relationship") {
        const id = attr(r, "Id");
        const cible = attr(r, "Target");
        if (!id || !cible) continue;
        const externe = attr(r, "TargetMode") === "External";
        out.set(id, { cible: externe ? cible : cible.startsWith("/") ? cible.slice(1) : resoudre(dossier, cible), externe });
      } else visiter(r);
    }
  };
  visiter(racine);
  return out;
}

function resoudre(dossier: string, relatif: string): string {
  const pile: string[] = [];
  for (const p of `${dossier}${relatif}`.split("/")) {
    if (p === "..") pile.pop();
    else if (p !== "." && p !== "") pile.push(p);
  }
  return pile.join("/");
}

function image(ctx: Ctx, rid: string | null): ImageDocx | null {
  if (!rid) return null;
  const rel = ctx.rels.get(rid);
  if (!rel || rel.externe) return null;
  const deja = ctx.images.get(rel.cible);
  if (deja) return deja;
  const f = ctx.zip.file(rel.cible);
  if (!f) return null;
  const im = { cle: rel.cible, octets: f.asNodeBuffer() };
  ctx.images.set(rel.cible, im);
  return im;
}

// ─────────────────────────── Dessins DrawingML ───────────────────────────

interface Cadre { x: number; y: number; largeur: number; hauteur: number }

function lireRognage(blipFill: XmlNode | null): Rognage | null {
  const r = enfant(blipFill, "a:srcRect");
  if (!r) return null;
  const v = (n: string) => (nombre(attr(r, n)) ?? 0) / 100000;
  const g = { gauche: v("l"), haut: v("t"), droite: v("r"), bas: v("b") };
  return g.gauche || g.haut || g.droite || g.bas ? g : null;
}

function xfrm(n: XmlNode | null): { off: [number, number]; ext: [number, number]; chOff: [number, number]; chExt: [number, number]; flipH: boolean; flipV: boolean } | null {
  if (!n) return null;
  const off = enfant(n, "a:off"), ext = enfant(n, "a:ext"), chOff = enfant(n, "a:chOff"), chExt = enfant(n, "a:chExt");
  const p = (e: XmlNode | null, a: string, b: string): [number, number] => [nombre(att(e, a)) ?? 0, nombre(att(e, b)) ?? 0];
  return { off: p(off, "x", "y"), ext: p(ext, "cx", "cy"), chOff: p(chOff, "x", "y"), chExt: p(chExt, "cx", "cy"), flipH: attr(n, "flipH") === "1", flipV: attr(n, "flipV") === "1" };
}

function lireForme(sp: XmlNode, cadre: Cadre, ctx: Ctx, flip: { h: boolean; v: boolean }): ElementGraphique {
  const spPr = enfant(sp, "wps:spPr") ?? enfant(sp, "pic:spPr");
  const geom = att(enfant(spPr, "a:prstGeom"), "prst") ?? "rect";
  const style = enfant(sp, "wps:style");
  let fond: string | null = null;
  if (enfant(spPr, "a:solidFill")) fond = couleurDrawing(enfant(spPr, "a:solidFill"), ctx.theme);
  else if (enfant(spPr, "a:gradFill")) fond = couleurDrawing(premier(enfant(spPr, "a:gradFill")!, "a:gs"), ctx.theme);
  else if (!enfant(spPr, "a:noFill") && style) {
    const ref = enfant(style, "a:fillRef");
    if (ref && (nombre(attr(ref, "idx")) ?? 0) > 0) fond = couleurDrawing(ref, ctx.theme);
  }
  let trait: { couleur: string; epaisseur: number } | null = null;
  const ln = enfant(spPr, "a:ln");
  const largeurTrait = (nombre(att(ln, "w")) ?? 9525) / EMU;
  if (ln && enfant(ln, "a:solidFill")) {
    const c = couleurDrawing(enfant(ln, "a:solidFill"), ctx.theme);
    if (c) trait = { couleur: c, epaisseur: largeurTrait };
  } else if (!(ln && enfant(ln, "a:noFill")) && style) {
    const ref = enfant(style, "a:lnRef");
    if (ref && (nombre(attr(ref, "idx")) ?? 0) > 0) {
      const c = couleurDrawing(ref, ctx.theme);
      if (c) trait = { couleur: c, epaisseur: largeurTrait };
    }
  }
  const geometrie: "rect" | "roundRect" | "ellipse" | "ligne" =
    /^(line|straightConnector\d*)$/.test(geom) ? "ligne" : geom === "ellipse" ? "ellipse" : /^roundRect$/.test(geom) ? "roundRect" : "rect";
  let texte: Extract<ElementGraphique, { type: "forme" }>["texte"] = null;
  const txbx = enfant(sp, "wps:txbx");
  const contenu = txbx ? enfant(txbx, "w:txbxContent") : null;
  if (contenu) {
    const bodyPr = enfant(sp, "wps:bodyPr");
    const ins = (n: string, d: number) => (nombre(att(bodyPr, n)) ?? d) / EMU;
    const a = att(bodyPr, "anchor");
    texte = {
      blocs: lireBlocs(contenu, { ...ctx, tableau: null }),
      marges: { gauche: ins("lIns", 91440), haut: ins("tIns", 45720), droite: ins("rIns", 91440), bas: ins("bIns", 45720) },
      ancrageV: a === "ctr" ? "centre" : a === "b" ? "bas" : "haut",
    };
  }
  const x = xfrm(enfant(spPr, "a:xfrm"));
  return { type: "forme", ...cadre, geometrie, fond, trait, retourneH: flip.h || !!x?.flipH, retourneV: flip.v || !!x?.flipV, texte };
}

function lireImage(pic: XmlNode, cadre: Cadre, ctx: Ctx): ElementGraphique | null {
  const blipFill = enfant(pic, "pic:blipFill");
  const blip = enfant(blipFill, "a:blip");
  const im = image(ctx, blip ? attr(blip, "r:embed") : null);
  if (!im) { ctx.ignores.add("image externe ou introuvable"); return null; }
  return { type: "image", ...cadre, image: im, rognage: lireRognage(blipFill) };
}

/** Un groupe : chaque enfant est placé dans l'espace de coordonnées du groupe, puis ramené au cadre. */
function lireGroupe(g: XmlNode, cadre: Cadre, ctx: Ctx, out: ElementGraphique[]): void {
  const t = xfrm(enfant(enfant(g, "wpg:grpSpPr"), "a:xfrm"));
  const chOff = t?.chOff ?? [0, 0];
  const chExt = t && t.chExt[0] > 0 && t.chExt[1] > 0 ? t.chExt : null;
  const kx = chExt ? cadre.largeur / chExt[0] : 1 / EMU;
  const ky = chExt ? cadre.hauteur / chExt[1] : 1 / EMU;
  for (const c of elements(g)) {
    const spPr = enfant(c, "wps:spPr") ?? enfant(c, "pic:spPr") ?? enfant(c, "wpg:grpSpPr");
    const x = xfrm(enfant(spPr, "a:xfrm"));
    if (!x) continue;
    const sous: Cadre = { x: cadre.x + (x.off[0] - chOff[0]) * kx, y: cadre.y + (x.off[1] - chOff[1]) * ky, largeur: x.ext[0] * kx, hauteur: x.ext[1] * ky };
    if (c.name === "wps:wsp") out.push(lireForme(c, sous, ctx, { h: false, v: false }));
    else if (c.name === "pic:pic") { const im = lireImage(c, sous, ctx); if (im) out.push(im); }
    else if (c.name === "wpg:grpSp") lireGroupe(c, sous, ctx, out);
  }
}

function lireGraphique(graphicData: XmlNode | null, largeur: number, hauteur: number, ctx: Ctx): ElementGraphique[] {
  const out: ElementGraphique[] = [];
  if (!graphicData) return out;
  const cadre: Cadre = { x: 0, y: 0, largeur, hauteur };
  for (const c of elements(graphicData)) {
    if (c.name === "pic:pic") { const im = lireImage(c, cadre, ctx); if (im) out.push(im); }
    else if (c.name === "wps:wsp") out.push(lireForme(c, cadre, ctx, { h: false, v: false }));
    else if (c.name === "wpg:wgp") lireGroupe(c, cadre, ctx, out);
    else ctx.ignores.add(c.name === "c:chart" ? "graphique" : c.name === "dgm:relIds" ? "diagramme SmartArt" : "objet dessiné");
  }
  return out;
}

function positionAncre(n: XmlNode | null, defaut: string): PositionAncre {
  if (!n) return { rel: defaut, decalage: 0, align: null, pct: null };
  const off = enfant(n, "wp:posOffset");
  const al = enfant(n, "wp:align");
  const pct = enfant(n, "wp14:pctPosHOffset") ?? enfant(n, "wp14:pctPosVOffset");
  return {
    rel: attr(n, "relativeFrom") ?? defaut,
    decalage: off ? (nombre(textOf(off).trim()) ?? 0) / EMU : null,
    align: al ? textOf(al).trim() : null,
    pct: pct ? (nombre(textOf(pct).trim()) ?? 0) / 100000 : null,
  };
}

function lireDessin(d: XmlNode, ctx: Ctx, p: ProprietesTexte): { inline?: Inline; ancre?: Ancre } {
  const inline = enfant(d, "wp:inline");
  const anchor = enfant(d, "wp:anchor");
  const cont = inline ?? anchor;
  if (!cont) return {};
  const ext = enfant(cont, "wp:extent");
  const largeur = (nombre(att(ext, "cx")) ?? 0) / EMU;
  const hauteur = (nombre(att(ext, "cy")) ?? 0) / EMU;
  if (largeur <= 0 && hauteur <= 0) return {};
  const contenu = lireGraphique(enfant(enfant(cont, "a:graphic"), "a:graphicData"), largeur, hauteur, ctx);
  if (contenu.length === 0) return {};
  if (inline) return { inline: { k: "dessin", largeur, hauteur, contenu, p } };
  const a = anchor!;
  const simple = attr(a, "simplePos") === "1";
  const sp = enfant(a, "wp:simplePos");
  const h = simple ? { rel: "page", decalage: (nombre(att(sp, "x")) ?? 0) / EMU, align: null, pct: null } : positionAncre(enfant(a, "wp:positionH"), "column");
  const v = simple ? { rel: "page", decalage: (nombre(att(sp, "y")) ?? 0) / EMU, align: null, pct: null } : positionAncre(enfant(a, "wp:positionV"), "paragraph");
  const hab = elements(a).find((e) => /^wp:wrap/.test(e.name));
  const habillage = (hab ? hab.name.replace("wp:wrap", "") : "None").replace(/^./, (c) => c.toLowerCase()) as Ancre["habillage"];
  return { ancre: { largeur, hauteur, h, v, derriere: attr(a, "behindDoc") === "1", habillage: ["none", "square", "tight", "through", "topAndBottom"].includes(habillage) ? habillage : "none", contenu } };
}

// ─────────────────────────── VML (documents anciens) ───────────────────────────

function longueurCss(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^(-?[\d.]+)\s*(pt|in|cm|mm|px|pc|emu)?$/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "in": return n * 72;
    case "cm": return (n * 72) / 2.54;
    case "mm": return (n * 72) / 25.4;
    case "px": return n * 0.75;
    case "pc": return n * 12;
    case "emu": return n / EMU;
    case undefined: return n / EMU > 0 && n > 10000 ? n / EMU : n * 0.75;
    default: return n;
  }
}

function couleurVml(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().split(/\s+/)[0]!;
  const h = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (h) return h[1]!.toUpperCase();
  const c = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (c) return `${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toUpperCase();
  return COULEURS_NOMMEES[s] ?? COULEURS_NOMMEES[s.toLowerCase()] ?? null;
}

function lireVml(pict: XmlNode, ctx: Ctx, p: ProprietesTexte): { inline?: Inline; ancre?: Ancre }[] {
  const out: { inline?: Inline; ancre?: Ancre }[] = [];
  for (const forme of elements(pict)) {
    if (!/^v:(shape|rect|roundrect|oval|line|image)$/.test(forme.name)) continue;
    if (premier(forme, "v:textpath")) { ctx.ignores.add("filigrane WordArt"); continue; }
    const style = new Map((attr(forme, "style") ?? "").split(";").map((d) => d.split(":").map((x) => x.trim()) as [string, string]).filter(([k]) => k));
    const largeur = longueurCss(style.get("width")) ?? 0;
    const hauteur = longueurCss(style.get("height")) ?? 0;
    if (largeur <= 0 || hauteur <= 0) continue;
    const contenu: ElementGraphique[] = [];
    const cadre = { x: 0, y: 0, largeur, hauteur };
    const imd = enfant(forme, "v:imagedata");
    const tb = enfant(forme, "v:textbox");
    const filled = attr(forme, "filled");
    const stroked = attr(forme, "stroked");
    const fond = filled === "f" || filled === "false" ? null : couleurVml(attr(forme, "fillcolor")) ?? (tb ? "FFFFFF" : null);
    const trait = stroked === "f" || stroked === "false" ? null : { couleur: couleurVml(attr(forme, "strokecolor")) ?? "000000", epaisseur: longueurCss(attr(forme, "strokeweight") ?? "0.75pt") ?? 0.75 };
    if (imd) {
      const im = image(ctx, attr(imd, "r:id") ?? attr(imd, "o:relid"));
      if (im) contenu.push({ type: "image", ...cadre, image: im, rognage: null });
    } else {
      const corps = tb ? enfant(tb, "w:txbxContent") : null;
      contenu.push({
        type: "forme", ...cadre,
        geometrie: forme.name === "v:oval" ? "ellipse" : forme.name === "v:roundrect" ? "roundRect" : forme.name === "v:line" ? "ligne" : "rect",
        fond, trait: forme.name === "v:shape" && !attr(forme, "strokecolor") && tb ? null : trait, retourneH: false, retourneV: false,
        texte: corps ? { blocs: lireBlocs(corps, { ...ctx, tableau: null }), marges: { gauche: 7.2, haut: 3.6, droite: 7.2, bas: 3.6 }, ancrageV: "haut" } : null,
      });
    }
    if (contenu.length === 0) continue;
    if (style.get("position") === "absolute") {
      const relH = style.get("mso-position-horizontal-relative") ?? "column";
      const relV = style.get("mso-position-vertical-relative") ?? "paragraph";
      const alH = style.get("mso-position-horizontal");
      const alV = style.get("mso-position-vertical");
      const z = Number(style.get("z-index") ?? "0");
      out.push({
        ancre: {
          largeur, hauteur,
          h: { rel: relH === "text" ? "column" : relH, decalage: alH && alH !== "absolute" ? null : (longueurCss(style.get("margin-left")) ?? 0) + (longueurCss(style.get("left")) ?? 0), align: alH && alH !== "absolute" ? alH : null, pct: null },
          v: { rel: relV === "text" ? "paragraph" : relV, decalage: alV && alV !== "absolute" ? null : (longueurCss(style.get("margin-top")) ?? 0) + (longueurCss(style.get("top")) ?? 0), align: alV && alV !== "absolute" ? alV : null, pct: null },
          derriere: z < 0, habillage: "none", contenu,
        },
      });
    } else out.push({ inline: { k: "dessin", largeur, hauteur, contenu, p } });
  }
  return out;
}

// ─────────────────────────── Paragraphes ───────────────────────────

interface EtatChamp { instr: string; phase: "instr" | "resultat"; masquer: boolean; emis: boolean }

const codeChamp = (instr: string): "PAGE" | "NUMPAGES" | null => {
  const m = /^\s*(PAGE|NUMPAGES|SECTIONPAGES)\b/i.exec(instr);
  if (!m) return null;
  return m[1]!.toUpperCase() === "PAGE" ? "PAGE" : "NUMPAGES";
};

function proprietesDuParagraphe(pPr: XmlNode | null, ctx: Ctx): { pPr: PPr; rPrStyle: RPr; styleId: string | null } {
  const direct = lirePPr(pPr, ctx.theme);
  const styleId = att(enfant(pPr, "w:pStyle"), "w:val") ?? ctx.styles.paragrapheDefaut;
  const ch = chaine(ctx.styles, styleId);
  const pStyle = fusionPPr(...ch.map((s) => s.pPr));
  const rStyle = fusionRPr(...ch.map((s) => s.rPr));
  // La liste : celle de la mise en forme directe, sinon celle du style.
  const numId = direct.numId ?? pStyle.numId;
  const niveau = direct.niveau ?? pStyle.niveau ?? 0;
  const lvl = numId && numId !== "0" ? niveauDe(ctx.num, numId, niveau) : null;
  const pPrFinal = fusionPPr(ctx.styles.defautPPr, ctx.tableau?.pPr, pStyle, lvl?.pPr, direct);
  pPrFinal.numId = numId;
  pPrFinal.niveau = niveau;
  return { pPr: pPrFinal, rPrStyle: fusionRPr(ctx.styles.defautRPr, ctx.tableau?.rPr, rStyle), styleId };
}

function etiquette(ctx: Ctx, numId: string | undefined, ilvl: number, marque: ProprietesTexte): Etiquette | null {
  if (!numId || numId === "0") return null;
  const def = ctx.num.nums.get(numId);
  const lvl = niveauDe(ctx.num, numId, ilvl);
  if (!def || !lvl) return null;
  // Les compteurs vivent par LISTE ABSTRAITE : deux `w:num` d'une même liste se suivent, sauf `startOverride`.
  const cle = def.abstrait;
  const cpt = ctx.num.compteurs.get(cle) ?? [];
  const surcharge = def.surcharges.get(ilvl)?.debut;
  const premiereFois = !ctx.num.dejaVus.has(`${numId}:${ilvl}`);
  ctx.num.dejaVus.add(`${numId}:${ilvl}`);
  if (surcharge != null && premiereFois) cpt[ilvl] = surcharge;
  else cpt[ilvl] = cpt[ilvl] == null ? lvl.debut : cpt[ilvl]! + 1;
  for (let i = ilvl + 1; i < 9; i++) cpt[i] = undefined;
  ctx.num.compteurs.set(cle, cpt);
  const symbole = !!lvl.policeSymbole && /symbol|wingdings|webdings/i.test(lvl.policeSymbole);
  const p = resoudreTexte({ ...marque, ...lvl.rPr, souligne: lvl.rPr.souligne ?? null, police: symbole ? marque.police : lvl.rPr.police ?? marque.police });
  if (lvl.format === "bullet") {
    const forme = puceDe(lvl.texte, lvl.policeSymbole);
    return { texte: forme === "texte" ? lvl.texte : "", p, puce: forme === "texte" ? null : forme, suffixe: lvl.suffixe, symbole };
  }
  const texte = lvl.texte.replace(/%(\d)/g, (_, d: string) => {
    const i = Number(d) - 1;
    const niv = niveauDe(ctx.num, numId, i);
    return formaterNombre(cpt[i] ?? niv?.debut ?? 1, niv?.format ?? "decimal");
  });
  return { texte, p, puce: null, suffixe: lvl.suffixe, symbole: false };
}

function lireParagraphe(pNode: XmlNode, ctx: Ctx): Paragraphe {
  const pPrNode = enfant(pNode, "w:pPr");
  const { pPr, rPrStyle, styleId } = proprietesDuParagraphe(pPrNode, ctx);
  const pp = resoudreParagraphe(pPr, styleId);
  const marque = resoudreTexte(fusionRPr(rPrStyle, lireRPr(enfant(pPrNode, "w:rPr"), ctx.theme)));
  const contenu: Inline[] = [];
  const ancres: Ancre[] = [];
  const pile: EtatChamp[] = [];
  const masque = () => pile.some((e) => e.phase === "instr" || e.masquer);

  const proprietesRun = (r: XmlNode, lien: string | null): ProprietesTexte => {
    const rPr = enfant(r, "w:rPr");
    const rStyle = att(enfant(rPr, "w:rStyle"), "w:val");
    const ch = rStyle ? chaine(ctx.styles, rStyle) : [];
    const props = resoudreTexte(fusionRPr(rPrStyle, ...ch.map((s) => s.rPr), lireRPr(rPr, ctx.theme)));
    if (lien) props.lien = lien;
    return props;
  };

  const ajouterDessins = (res: { inline?: Inline; ancre?: Ancre }[]) => {
    for (const d of res) {
      if (d.inline) contenu.push(d.inline);
      if (d.ancre) ancres.push(d.ancre);
    }
  };

  const lireContenuRun = (n: XmlNode, props: ProprietesTexte) => {
    for (const c of elements(n)) {
      switch (c.name) {
        case "w:t":
          if (!masque()) contenu.push({ k: "texte", texte: textOf(c), p: props });
          break;
        case "w:tab":
          if (!masque()) contenu.push({ k: "tab", p: props });
          break;
        case "w:ptab": {
          const a = attr(c, "w:alignment");
          if (!masque()) contenu.push({ k: "ptab", alignement: a === "center" ? "center" : a === "right" ? "right" : "left", p: props });
          break;
        }
        case "w:br": {
          if (masque()) break;
          const t = attr(c, "w:type");
          contenu.push({ k: "saut", type: t === "page" ? "page" : t === "column" ? "colonne" : "ligne", p: props });
          break;
        }
        case "w:cr":
          if (!masque()) contenu.push({ k: "saut", type: "ligne", p: props });
          break;
        case "w:noBreakHyphen":
          if (!masque()) contenu.push({ k: "texte", texte: "\u2011", p: props });
          break;
        case "w:sym": {
          if (masque()) break;
          const code = parseInt(attr(c, "w:char") ?? "", 16);
          if (!Number.isFinite(code)) break;
          const police = attr(c, "w:font") ?? "";
          const forme = puceDe(String.fromCodePoint(code), police);
          contenu.push({ k: "texte", texte: forme === "texte" ? String.fromCodePoint(code >= 0xf000 ? code - 0xf000 : code) : forme === "carre" ? "\u25aa" : "\u2022", p: props });
          break;
        }
        case "w:fldChar": {
          const t = attr(c, "w:fldCharType");
          if (t === "begin") pile.push({ instr: "", phase: "instr", masquer: false, emis: false });
          else if (t === "separate") {
            const e = pile[pile.length - 1];
            if (e) {
              e.phase = "resultat";
              const code = codeChamp(e.instr);
              if (code && !pile.slice(0, -1).some((x) => x.phase === "instr" || x.masquer)) {
                contenu.push({ k: "champ", code, repli: "1", p: props });
                e.emis = true;
                e.masquer = true;
              }
            }
          } else if (t === "end") {
            const e = pile.pop();
            if (e && !e.emis && e.phase === "instr") {
              const code = codeChamp(e.instr);
              if (code && !masque()) contenu.push({ k: "champ", code, repli: "1", p: props });
            }
          }
          break;
        }
        case "w:instrText": {
          const e = pile[pile.length - 1];
          if (e && e.phase === "instr") e.instr += textOf(c);
          break;
        }
        case "w:drawing":
          if (!masque()) ajouterDessins([lireDessin(c, ctx, props)]);
          break;
        case "w:pict":
        case "w:object":
          if (!masque()) ajouterDessins(lireVml(c, ctx, props));
          break;
        case "mc:AlternateContent": {
          const choix = children(c, "mc:Choice").find((x) => /wps|wpg|wp14|w14/.test(attr(x, "Requires") ?? "")) ?? child(c, "mc:Choice");
          const avant = contenu.length + ancres.length;
          if (choix) lireContenuRun(choix, props);
          if (contenu.length + ancres.length === avant) {
            const repli = child(c, "mc:Fallback");
            if (repli) lireContenuRun(repli, props);
          }
          break;
        }
        case "w:footnoteReference":
        case "w:endnoteReference":
          ctx.ignores.add("notes de bas de page");
          break;
        default:
          break;
      }
    }
  };

  const marcher = (n: XmlNode, lien: string | null) => {
    for (const c of elements(n)) {
      switch (c.name) {
        case "w:r": {
          const props = proprietesRun(c, lien);
          if (props.masque) {
            // Le texte masqué ne s'imprime pas — mais ses marques de champ comptent pour l'état.
            for (const e of elements(c)) if (e.name === "w:fldChar" || e.name === "w:instrText") lireContenuRun({ ...c, children: [e] }, props);
            break;
          }
          lireContenuRun(c, props);
          break;
        }
        case "w:hyperlink": {
          const rid = attr(c, "r:id");
          const rel = rid ? ctx.rels.get(rid) : undefined;
          marcher(c, rel?.externe ? rel.cible : lien);
          break;
        }
        case "w:fldSimple": {
          const code = codeChamp(attr(c, "w:instr") ?? "");
          if (code) {
            const r = child(c, "w:r");
            contenu.push({ k: "champ", code, repli: r ? textOf(r) || "1" : "1", p: r ? proprietesRun(r, lien) : marque });
          } else marcher(c, lien);
          break;
        }
        case "w:sdt": {
          const sc = child(c, "w:sdtContent");
          if (sc) marcher(sc, lien);
          break;
        }
        case "w:ins":
        case "w:moveTo":
        case "w:smartTag":
        case "w:customXml":
        case "w:dir":
        case "w:bdo":
          marcher(c, lien);
          break;
        case "m:oMathPara":
        case "m:oMath": {
          const t = textOf(c);
          if (t) contenu.push({ k: "texte", texte: t, p: marque });
          ctx.ignores.add("équations (rendues en texte)");
          break;
        }
        default:
          break;
      }
    }
  };
  marcher(pNode, null);
  return { type: "paragraphe", pp, marque, contenu, ancres, etiquette: etiquette(ctx, pPr.numId, pPr.niveau ?? 0, marque) };
}

// ─────────────────────────── Tableaux ───────────────────────────

const CONDITIONS = ["wholeTable", "band1Vert", "band2Vert", "band1Horz", "band2Horz", "firstCol", "lastCol", "firstRow", "lastRow", "neCell", "nwCell", "seCell", "swCell"] as const;

function lireTableau(tbl: XmlNode, ctx: Ctx): Tableau {
  const tblPr = enfant(tbl, "w:tblPr");
  const styleId = att(enfant(tblPr, "w:tblStyle"), "w:val") ?? ctx.styles.tableauDefaut;
  const ch = chaine(ctx.styles, styleId);
  const bordsStyle: BordsTableau = Object.assign({}, ...ch.map((s) => s.bords));
  const margesStyle: MargesCellule = Object.assign({}, ...ch.map((s) => s.marges));
  const conditionnels = new Map<string, Conditionnel>();
  for (const s of ch) for (const [k, v] of s.conditionnels) {
    const avant = conditionnels.get(k);
    conditionnels.set(k, avant ? { pPr: fusionPPr(avant.pPr, v.pPr), rPr: fusionRPr(avant.rPr, v.rPr), fond: v.fond !== undefined ? v.fond : avant.fond, bords: { ...avant.bords, ...v.bords } } : v);
  }
  const pStyleTable = fusionPPr(...ch.map((s) => s.pPr));
  const rStyleTable = fusionRPr(...ch.map((s) => s.rPr));
  const bords: BordsTableau = { ...bordsStyle, ...lireBordsTableau(enfant(tblPr, "w:tblBorders"), ctx.theme) };
  const marges = { gauche: 108 / TWIP, haut: 0, droite: 108 / TWIP, bas: 0, ...margesStyle, ...lireMarges(enfant(tblPr, "w:tblCellMar")) };
  const look = enfant(tblPr, "w:tblLook");
  const masqueLook = parseInt(att(look, "w:val") ?? "04A0", 16);
  const drapeau = (nom: string, bit: number) => { const v = att(look, nom); return v != null ? v === "1" || v === "true" : (masqueLook & bit) !== 0; };
  const lk = { firstRow: drapeau("w:firstRow", 0x20), lastRow: drapeau("w:lastRow", 0x40), firstCol: drapeau("w:firstColumn", 0x80), lastCol: drapeau("w:lastColumn", 0x100), noH: drapeau("w:noHBand", 0x200), noV: drapeau("w:noVBand", 0x400) };
  const jc = att(enfant(tblPr, "w:jc"), "w:val");
  const ind = enfant(tblPr, "w:tblInd");
  const retrait = att(ind, "w:type") === "pct" ? 0 : (nombre(att(ind, "w:w")) ?? 0) / TWIP;
  let grille = children(enfant(tbl, "w:tblGrid") ?? tbl, "w:gridCol").map((g) => (nombre(attr(g, "w:w")) ?? 0) / TWIP);

  const trs = children(tbl, "w:tr");
  const nbLignes = trs.length;
  const rangees: Rangee[] = [];
  let enTete = true;
  trs.forEach((tr, r) => {
    const trPr = enfant(tr, "w:trPr");
    const estEntete = enTete && bascule(enfant(trPr, "w:tblHeader")) === true;
    if (!estEntete) enTete = false;
    const trH = enfant(trPr, "w:trHeight");
    const hv = nombre(att(trH, "w:val"));
    const hauteur = hv && hv > 0 ? { valeur: hv / TWIP, regle: att(trH, "w:hRule") === "exact" ? "exact" as const : "atLeast" as const } : null;
    let col = nombre(att(enfant(trPr, "w:gridBefore"), "w:val")) ?? 0;
    const tcs = children(tr, "w:tc");
    const cellules: Cellule[] = [];
    const nbCols = Math.max(grille.length, tcs.reduce((s, tc) => s + (nombre(att(enfant(enfant(tc, "w:tcPr"), "w:gridSpan"), "w:val")) ?? 1), col));
    tcs.forEach((tc, ci) => {
      const tcPr = enfant(tc, "w:tcPr");
      const span = Math.max(1, nombre(att(enfant(tcPr, "w:gridSpan"), "w:val")) ?? 1);
      const vm = enfant(tcPr, "w:vMerge");
      const fusionV = vm ? (attr(vm, "w:val") === "restart" ? "debut" : "suite") : null;
      // Les conditions qui s'appliquent à CETTE cellule, de la plus faible à la plus forte.
      const bandeIndex = r - rangees.filter((x) => x.entete).length - (lk.firstRow && !rangees.some((x) => x.entete) && r > 0 ? 1 : 0);
      const conds: string[] = ["wholeTable"];
      if (!lk.noH && !(lk.firstRow && r === 0) && !(lk.lastRow && r === nbLignes - 1)) conds.push(bandeIndex % 2 === 0 ? "band1Horz" : "band2Horz");
      if (!lk.noV) conds.push(ci % 2 === 0 ? "band1Vert" : "band2Vert");
      if (lk.firstCol && col === 0) conds.push("firstCol");
      if (lk.lastCol && col + span >= nbCols) conds.push("lastCol");
      if (lk.firstRow && (r === 0 || estEntete)) conds.push("firstRow");
      if (lk.lastRow && r === nbLignes - 1) conds.push("lastRow");
      const actifs = CONDITIONS.filter((c) => conds.includes(c)).map((c) => conditionnels.get(c)).filter((c): c is Conditionnel => !!c);
      const ctxCellule: Ctx = { ...ctx, tableau: { pPr: fusionPPr(pStyleTable, ...actifs.map((a) => a.pPr)), rPr: fusionRPr(rStyleTable, ...actifs.map((a) => a.rPr)) } };
      const blocs = lireBlocs(tc, ctxCellule);
      const shd = enfant(tcPr, "w:shd");
      const fondDirect = shd ? couleurWord(attr(shd, "w:fill"), attr(shd, "w:themeFill"), attr(shd, "w:themeFillShade"), attr(shd, "w:themeFillTint"), ctx.theme) : undefined;
      let fond: string | null = null;
      for (const a of actifs) if (a.fond !== undefined) fond = a.fond;
      if (fondDirect) fond = fondDirect;
      // Les bordures : la cellule d'abord, puis le style conditionnel, puis le tableau selon la position.
      const tcB = lireBordsTableau(enfant(tcPr, "w:tcBorders"), ctx.theme);
      const condB: BordsTableau = Object.assign({}, ...actifs.map((a) => a.bords));
      const premiereL = r === 0, derniereL = r === nbLignes - 1, premiereC = col === 0, derniereC = col + span >= nbCols;
      const choisir = (cell: Bordure | null | undefined, cond: Bordure | null | undefined, ext: keyof BordsTableau, int: keyof BordsTableau, estBord: boolean): Bordure | null => {
        if (cell !== undefined) return cell;
        const condV = estBord ? cond ?? condB[ext] : cond ?? condB[int];
        if (condV !== undefined) return condV;
        const v = estBord ? bords[ext] : bords[int];
        return v ?? null;
      };
      const tcMar = lireMarges(enfant(tcPr, "w:tcMar"));
      const va = att(enfant(tcPr, "w:vAlign"), "w:val");
      cellules.push({
        blocs,
        colonne: col,
        span,
        fusionV,
        fond,
        bordures: {
          haut: choisir(tcB.haut, condB.haut, "haut", "interieurH", premiereL),
          bas: choisir(tcB.bas, condB.bas, "bas", "interieurH", derniereL),
          gauche: choisir(tcB.gauche, condB.gauche, "gauche", "interieurV", premiereC),
          droite: choisir(tcB.droite, condB.droite, "droite", "interieurV", derniereC),
        },
        alignV: va === "center" ? "centre" : va === "bottom" ? "bas" : "haut",
        marges: { ...marges, ...tcMar },
      });
      col += span;
    });
    rangees.push({ cellules, hauteur, entete: estEntete });
  });

  // Sans grille utilisable, la largeur déclarée des cellules de la première ligne.
  const nbCols = Math.max(0, ...rangees.map((rg) => rg.cellules.reduce((m, c) => Math.max(m, c.colonne + c.span), 0)));
  if (grille.length < nbCols || grille.every((w) => w <= 0)) {
    const premiere = trs[0];
    const largeurs: number[] = [];
    if (premiere) for (const tc of children(premiere, "w:tc")) {
      const tcW = enfant(enfant(tc, "w:tcPr"), "w:tcW");
      const w = att(tcW, "w:type") === "dxa" || att(tcW, "w:type") == null ? (nombre(att(tcW, "w:w")) ?? 0) / TWIP : 0;
      const span = Math.max(1, nombre(att(enfant(enfant(tc, "w:tcPr"), "w:gridSpan"), "w:val")) ?? 1);
      for (let i = 0; i < span; i++) largeurs.push(w / span);
    }
    grille = largeurs.length >= nbCols && largeurs.every((w) => w > 0) ? largeurs : [];
  }
  return { type: "tableau", grille, alignement: jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : "left", retrait, rangees };
}

// ─────────────────────────── Conteneurs, bandes, sections ───────────────────────────

/**
 * Les blocs d'un conteneur, dans l'ordre. `fins` (corps du document seulement) note les paragraphes
 * qui portent un `sectPr` : chacun FERME sa section.
 */
function lireBlocs(conteneur: XmlNode, ctx: Ctx, fins?: Map<Bloc, XmlNode>): Bloc[] {
  const blocs: Bloc[] = [];
  for (const n of elements(conteneur)) {
    if (n.name === "w:p") {
      const p = lireParagraphe(n, ctx);
      blocs.push(p);
      const sp = enfant(enfant(n, "w:pPr"), "w:sectPr");
      if (sp && fins) fins.set(p, sp);
    } else if (n.name === "w:tbl") blocs.push(lireTableau(n, ctx));
    else if (n.name === "w:sdt") {
      const c = child(n, "w:sdtContent");
      if (c) blocs.push(...lireBlocs(c, ctx, fins));
    } else if (n.name === "w:customXml" || n.name === "w:ins" || n.name === "w:moveTo") blocs.push(...lireBlocs(n, ctx, fins));
    else if (n.name === "mc:AlternateContent") {
      const c = child(n, "mc:Choice") ?? child(n, "mc:Fallback");
      if (c) blocs.push(...lireBlocs(c, ctx, fins));
    }
  }
  return blocs;
}

function lireBande(ctx: Ctx, rid: string | null): Bande | null {
  const rel = rid ? ctx.rels.get(rid) : undefined;
  if (!rel || rel.externe) return null;
  const f = ctx.zip.file(rel.cible);
  if (!f) return null;
  const racine = parseXml(f.asText());
  const conteneur = premier(racine, "w:hdr") ?? premier(racine, "w:ftr") ?? racine;
  const sous: Ctx = { ...ctx, rels: lireRels(ctx.zip, rel.cible), tableau: null };
  return { blocs: lireBlocs(conteneur, sous) };
}

const A4 = { largeur: 11906 / TWIP, hauteur: 16838 / TWIP };

function lireSection(sectPr: XmlNode | null, ctx: Ctx, precedente: Section | null): Section {
  const pgSz = enfant(sectPr, "w:pgSz");
  const pgMar = enfant(sectPr, "w:pgMar");
  let largeur = (nombre(att(pgSz, "w:w")) ?? 0) / TWIP || precedente?.largeur || A4.largeur;
  let hauteur = (nombre(att(pgSz, "w:h")) ?? 0) / TWIP || precedente?.hauteur || A4.hauteur;
  if (att(pgSz, "w:orient") === "landscape" && largeur < hauteur) [largeur, hauteur] = [hauteur, largeur];
  const m = (nom: string, defaut: number) => { const v = nombre(att(pgMar, nom)); return v == null ? defaut : v / TWIP; };
  const pm = precedente?.marges;
  const haut = m("w:top", pm?.haut ?? 72);
  const bas = m("w:bottom", pm?.bas ?? 72);
  const gouttiere = m("w:gutter", 0);
  const borne = (v: number, max: number, defaut: number) => (Number.isFinite(v) && Math.abs(v) < max ? v : defaut);
  const marges = {
    haut: borne(Math.abs(haut), hauteur / 2, 72),
    bas: borne(Math.abs(bas), hauteur / 2, 72),
    gauche: borne(m("w:left", pm?.gauche ?? 72) + gouttiere, largeur / 2, 72),
    droite: borne(m("w:right", pm?.droite ?? 72), largeur / 2, 72),
    entete: borne(m("w:header", pm?.entete ?? 35.4), hauteur / 2, 35.4),
    pied: borne(m("w:footer", pm?.pied ?? 35.4), hauteur / 2, 35.4),
  };
  const bandes = (genre: "header" | "footer"): Section["entetes"] => {
    const out: Section["entetes"] = {};
    for (const ref of sectPr ? children(sectPr, `w:${genre}Reference`) : []) {
      const t = attr(ref, "w:type") ?? "default";
      const b = lireBande(ctx, attr(ref, "r:id"));
      if (t === "first") out.premiere = b;
      else if (t === "even") out.paire = b;
      else out.defaut = b;
    }
    // Une section sans référence HÉRITE des bandes de la précédente (règle Word).
    const prec = genre === "header" ? precedente?.entetes : precedente?.pieds;
    return { defaut: out.defaut !== undefined ? out.defaut : prec?.defaut, premiere: out.premiere !== undefined ? out.premiere : prec?.premiere, paire: out.paire !== undefined ? out.paire : prec?.paire };
  };
  const type = att(enfant(sectPr, "w:type"), "w:val");
  const pgNum = enfant(sectPr, "w:pgNumType");
  return {
    largeur, hauteur, marges,
    hautExact: haut < 0,
    basExact: bas < 0,
    entetes: bandes("header"),
    pieds: bandes("footer"),
    titrePage: bascule(enfant(sectPr, "w:titlePg")) === true,
    type: type === "continuous" ? "continuous" : type === "evenPage" ? "evenPage" : type === "oddPage" ? "oddPage" : "nextPage",
    debutNumero: nombre(att(pgNum, "w:start")),
    formatNumero: att(pgNum, "w:fmt") ?? "decimal",
    colonnes: Math.max(1, nombre(att(enfant(sectPr, "w:cols"), "w:num")) ?? 1),
  };
}

/**
 * LE DOCUMENT, SECTION PAR SECTION.
 *
 * Lève si le fichier n'est pas un `.docx` lisible : l'appelant garde alors l'original.
 */
export function lireDocx(octets: Buffer | Uint8Array): DocumentDocx {
  const zip = new PizZip(octets);
  const entree = zip.file("word/document.xml");
  if (!entree) throw new Error("Ce fichier ne contient pas de document Word (word/document.xml absent).");
  const racine = parseXml(entree.asText());
  const body = premier(racine, "w:body");
  if (!body) throw new Error("Document Word sans corps (w:body absent).");
  const theme = lireTheme(zip);
  const ctx: Ctx = {
    zip, rels: lireRels(zip, "word/document.xml"), styles: lireStyles(zip, theme), theme,
    num: lireNumerotation(zip, theme), images: new Map(), ignores: new Set(), tableau: null,
  };
  const reglages = zip.file("word/settings.xml");
  const xmlReglages = reglages ? parseXml(reglages.asText()) : null;
  const tab = xmlReglages ? nombre(att(premier(xmlReglages, "w:defaultTabStop"), "w:val")) : null;
  const pairesImpaires = xmlReglages ? bascule(premier(xmlReglages, "w:evenAndOddHeaders")) === true : false;

  // Les sections se TERMINENT par leur `sectPr` : on accumule les blocs, et chaque `sectPr` de
  // paragraphe ferme la section en cours avec les blocs lus jusque-là.
  const sections: DocumentDocx["sections"] = [];
  let courant: Bloc[] = [];
  let precedente: Section | null = null;
  const fins = new Map<Bloc, XmlNode>();
  for (const b of lireBlocs(body, ctx, fins)) {
    courant.push(b);
    const sp = fins.get(b);
    if (sp) {
      const s = lireSection(sp, ctx, precedente);
      sections.push({ section: s, blocs: courant });
      precedente = s;
      courant = [];
    }
  }
  const finale = lireSection(child(body, "w:sectPr"), ctx, precedente);
  if (courant.length > 0 || sections.length === 0) sections.push({ section: finale, blocs: courant });
  return { sections, tabDefaut: tab && tab > 0 ? tab / TWIP : 36, pairesImpaires, ignores: ctx.ignores };
}
