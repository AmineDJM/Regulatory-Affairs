/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ARTIFACT OBJECT MODEL (§10–11) — ce dont Adam parle quand il parle d'un document.
 *
 * ── POURQUOI UN MODÈLE, ET PAS L'XML DIRECTEMENT ────────────────────────────────────────
 *
 * « Centre le titre » désigne un OBJET : le premier paragraphe. « Supprime le troisième
 * paragraphe » désigne le troisième — au sens où un humain compte, pas au sens où l'OOXML
 * compte (qui inclut les paragraphes vides de mise en page, les cellules de tableau, les
 * en-têtes). Sans un modèle intermédiaire, chaque commande devrait redécouvrir cette
 * arithmétique, et chacune la ferait un peu différemment.
 *
 * ── IDENTIFIANTS STABLES ────────────────────────────────────────────────────────────────
 *
 * Chaque objet porte un `id` (`p3`, `t1.r2.c1`, `s4.sh2`, `page7`) qui NE BOUGE PAS entre deux
 * inspections tant que le document ne change pas. C'est ce qui rend possible :
 *   • la sélection au clic (§31) — l'UI renvoie l'id, pas une description ;
 *   • les commandes relatives (§57) — « encore un peu à gauche » réutilise la même cible ;
 *   • la mise en évidence des candidats en cas d'ambiguïté (§32).
 *
 * ── NUMÉROTATION HUMAINE (§17) ──────────────────────────────────────────────────────────
 *
 * `index` est TOUJOURS 1-indexé, partout, sans exception : page 1 est la première page,
 * paragraphe 3 est le troisième. La conversion vers les index 0-indexés des bibliothèques se
 * fait DANS les adaptateurs, à un seul endroit par format, et `numbering.test.ts` la vérifie.
 * Un décalage d'un rang, ici, supprime la mauvaise page d'un contrat signé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const ARTIFACT_FORMATS = ["DOCX", "XLSX", "PPTX", "PDF"] as const;
export type ArtifactFormat = (typeof ARTIFACT_FORMATS)[number];

export type Alignment = "left" | "center" | "right" | "justify";

/** Mise en forme d'un fragment de texte, dans les unités où l'HUMAIN parle (points, nom de police). */
export interface TextStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Taille en POINTS (Word stocke des demi-points ; la conversion est dans l'adaptateur). */
  sizePt: number | null;
  font: string | null;
  /** Couleur hexadécimale sans dièse, ex. `1B7F79`. */
  color: string | null;
}

export const STYLE_NEUTRE: TextStyle = { bold: false, italic: false, underline: false, sizePt: null, font: null, color: null };

/** Un fragment homogène de texte (un `w:r` Word, un `a:r` PowerPoint). */
export interface RunNode {
  id: string;
  index: number;
  text: string;
  style: TextStyle;
}

export interface ParagraphNode {
  id: string;
  /** Rang HUMAIN parmi les paragraphes de corps du document (1 = le premier). */
  index: number;
  text: string;
  alignment: Alignment | null;
  /** Nom de style Word (`Heading1`, `Titre`, `Normal`…) quand il est déclaré. */
  styleName: string | null;
  /** Style dominant du paragraphe — celui de son premier fragment non vide. */
  style: TextStyle;
  runs: RunNode[];
  /** Retraits en centimètres, tels qu'un humain les dit. */
  indentLeftCm: number | null;
  indentRightCm: number | null;
  spacingBeforePt: number | null;
  spacingAfterPt: number | null;
  /** Vrai si le paragraphe vit dans une cellule de tableau (il ne compte pas dans `index`). */
  inTable: boolean;
  /** Le paragraphe porte-t-il une image ancrée ? */
  images: ImageNode[];
}

export interface CellNode {
  id: string;
  row: number;
  col: number;
  text: string;
}

export interface TableNode {
  id: string;
  index: number;
  rows: number;
  cols: number;
  cells: CellNode[];
  /** Première ligne, en clair — sert à désigner « le tableau des montants ». */
  header: string[];
}

export interface ImageNode {
  id: string;
  index: number;
  /** Dimensions en centimètres (OOXML les stocke en EMU : 360 000 EMU = 1 cm). */
  widthCm: number;
  heightCm: number;
  /** Texte alternatif / description, quand l'auteur en a mis un. */
  description: string | null;
}

export interface DocxModel {
  kind: "DOCX";
  paragraphs: ParagraphNode[];
  tables: TableNode[];
  images: ImageNode[];
  /** Dimensions de page en centimètres, lues dans `w:sectPr`. */
  pageWidthCm: number;
  pageHeightCm: number;
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  /** Présence d'en-têtes / pieds de page — on ne les édite pas, on garantit qu'ils survivent. */
  hasHeader: boolean;
  hasFooter: boolean;
}

// ─────────────────────────── XLSX ───────────────────────────

export interface SheetCellNode {
  id: string;
  /** Référence Excel telle qu'on l'écrit : `B4`. */
  ref: string;
  row: number;
  col: number;
  value: string;
  formula: string | null;
  numFmt: string | null;
  style: TextStyle;
  fill: string | null;
  align: Alignment | null;
}

export interface SheetNode {
  id: string;
  index: number;
  name: string;
  rows: number;
  cols: number;
  cells: SheetCellNode[];
  columnWidths: (number | null)[];
  frozenRows: number;
  frozenCols: number;
  merges: string[];
}

export interface XlsxModel {
  kind: "XLSX";
  sheets: SheetNode[];
}

// ─────────────────────────── PPTX ───────────────────────────

export interface ShapeNode {
  id: string;
  index: number;
  name: string;
  /** Position et taille en centimètres — les unités dans lesquelles on parle. */
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  text: string;
  style: TextStyle;
  alignment: Alignment | null;
  /** `text`, `picture`, `table`, `chart`, `other` — dit ce qu'on peut lui demander. */
  role: "text" | "picture" | "table" | "chart" | "other";
}

export interface SlideNode {
  id: string;
  index: number;
  /** Titre lu dans la forme de titre, sinon le premier texte — sert aux miniatures. */
  title: string;
  shapes: ShapeNode[];
}

export interface PptxModel {
  kind: "PPTX";
  slides: SlideNode[];
  slideWidthCm: number;
  slideHeightCm: number;
}

// ─────────────────────────── PDF ───────────────────────────

export interface PdfPageNode {
  id: string;
  index: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  /** Premières lignes de texte — sert à désigner « la page du sommaire ». */
  preview: string;
}

export interface PdfModel {
  kind: "PDF";
  pages: PdfPageNode[];
  /** Le PDF autorise-t-il la modification ? Un fichier chiffré se lit mais ne s'édite pas. */
  encrypted: boolean;
}

export type ArtifactModel = DocxModel | XlsxModel | PptxModel | PdfModel;

// ─────────────────────────── Conversions d'unités ───────────────────────────

/** OOXML stocke les longueurs en EMU (English Metric Units). 360 000 EMU = 1 cm, exactement. */
export const EMU_PAR_CM = 360_000;
/** Word stocke les longueurs de mise en page en TWIPS : 1 440 twips = 1 pouce = 2,54 cm. */
export const TWIP_PAR_CM = 1440 / 2.54;

export const emuEnCm = (emu: number): number => Math.round((emu / EMU_PAR_CM) * 1000) / 1000;
export const cmEnEmu = (cm: number): number => Math.round(cm * EMU_PAR_CM);
export const twipEnCm = (twip: number): number => Math.round((twip / TWIP_PAR_CM) * 1000) / 1000;
export const cmEnTwip = (cm: number): number => Math.round(cm * TWIP_PAR_CM);
/** Word écrit les tailles de police en DEMI-points : `w:sz w:val="24"` = 12 pt. */
export const demiPtEnPt = (demi: number): number => demi / 2;
export const ptEnDemiPt = (pt: number): number => Math.round(pt * 2);

// ─────────────────────────── Colonnes Excel ───────────────────────────

/** `A` → 1, `Z` → 26, `AA` → 27. Excel compte à partir de 1, et nous aussi. */
export function colonneEnNombre(lettres: string): number {
  let n = 0;
  for (const ch of lettres.toUpperCase()) {
    const v = ch.charCodeAt(0) - 64;
    if (v < 1 || v > 26) return 0;
    n = n * 26 + v;
  }
  return n;
}

/** 1 → `A`, 27 → `AA`. */
export function nombreEnColonne(n: number): string {
  if (n < 1) return "";
  let s = "";
  let v = n;
  while (v > 0) {
    const r = (v - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    v = Math.floor((v - r) / 26);
  }
  return s;
}

export interface RefCellule { row: number; col: number; }

/** `B4` → `{row: 4, col: 2}`. Rend `null` sur une référence qui n'en est pas une. */
export function analyserRef(ref: string): RefCellule | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref.trim());
  if (!m) return null;
  const col = colonneEnNombre(m[1]);
  const row = Number(m[2]);
  if (!col || !row) return null;
  return { row, col };
}

export const formerRef = (row: number, col: number): string => `${nombreEnColonne(col)}${row}`;

export interface Plage { from: RefCellule; to: RefCellule; }

/** `B4:D20` → la plage NORMALISÉE (from ≤ to sur les deux axes). `B4` seul = plage d'une case. */
export function analyserPlage(plage: string): Plage | null {
  const parts = plage.trim().split(":");
  if (parts.length === 1) {
    const c = analyserRef(parts[0]);
    return c ? { from: c, to: c } : null;
  }
  if (parts.length !== 2) return null;
  const a = analyserRef(parts[0]);
  const b = analyserRef(parts[1]);
  if (!a || !b) return null;
  return {
    from: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    to: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}

/** Énumère les cellules d'une plage, bornée pour ne jamais matérialiser un million de cases. */
export function cellulesDePlage(plage: Plage, max = 20_000): RefCellule[] {
  const out: RefCellule[] = [];
  for (let r = plage.from.row; r <= plage.to.row; r += 1) {
    for (let c = plage.from.col; c <= plage.to.col; c += 1) {
      if (out.length >= max) return out;
      out.push({ row: r, col: c });
    }
  }
  return out;
}
