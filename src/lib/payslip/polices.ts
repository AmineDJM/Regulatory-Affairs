import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProprietesTexte } from "./docx-lecture";
import type { Mesureur, PoliceRendu } from "./docx-composition";

/**
 * LES POLICES DU RENDU PDF — la meilleure police disponible pour chaque police du document, et ses
 * MÉTRIQUES WORD (hauteur de ligne, ligne de base), sans lesquelles les pages ne tombent pas au
 * même endroit que dans Word.
 *
 * ── DEUX NIVEAUX, ET POURQUOI ───────────────────────────────────────────────────────────────
 *
 * 1. La VRAIE police (ou sa jumelle métrique : Carlito pour Calibri, Liberation pour Arial / Times /
 *    Courier) quand le serveur l'a — elle est alors EMBARQUÉE (sous-ensemble) dans le PDF, en
 *    Unicode complet. Sur un poste Windows, c'est Calibri elle-même ; sur un serveur Linux, ce que
 *    `fonts-crosextra-carlito` / `fonts-liberation` installent ; `DOCX_PDF_POLICES` peut désigner un
 *    dossier de plus (et `DOCX_PDF_POLICES=standard` désactive la recherche).
 * 2. Sinon, la police STANDARD du PDF de la même famille (Helvetica, Times, Courier), COMPRESSÉE
 *    horizontalement pour reprendre la chasse de l'original : Calibri est nettement plus étroite
 *    qu'Helvetica, et sans cette correction un paragraphe de Word gagne une ligne sur trois, la
 *    signature glisse à la page suivante. Le texte est alors ramené à WinAnsi — qui couvre tout le
 *    français (é è à ç œ « » ’ — € …) ; le reste est substitué proprement plutôt qu'affiché en
 *    caractères illisibles.
 *
 * Les hauteurs de ligne viennent des tables `OS/2` des polices d'origine (winAscent + winDescent) :
 * Word s'en sert pour l'interligne simple, et c'est elle qui fait la position de chaque ligne.
 */

interface Famille {
  noms: string[];
  categorie: "sans" | "serif" | "mono";
  /**
   * Chasse de la police d'origine rapportée à la police standard de repli — mesurée sur de la
   * prose française (normal, gras, italique, gras italique quand elles diffèrent).
   */
  echelle: number | [number, number, number, number];
  /** Interligne simple de Word, en multiple de la taille. */
  interligne: number;
  /** Hauteur au-dessus de la ligne de base, en multiple de la taille. */
  ascent: number;
  /** Fichiers candidats : normal, gras, italique, gras italique. */
  fichiers?: [string[], string[], string[], string[]];
}

const FAMILLES: Famille[] = [
  { noms: ["calibri", "carlito"], categorie: "sans", echelle: [0.915, 0.875, 0.91, 0.87], interligne: 1.2207, ascent: 0.952,
    fichiers: [["calibri.ttf", "Carlito-Regular.ttf"], ["calibrib.ttf", "Carlito-Bold.ttf"], ["calibrii.ttf", "Carlito-Italic.ttf"], ["calibriz.ttf", "Carlito-BoldItalic.ttf"]] },
  { noms: ["calibri light"], categorie: "sans", echelle: [0.905, 0.875, 0.9, 0.87], interligne: 1.2207, ascent: 0.952,
    fichiers: [["calibril.ttf", "Carlito-Regular.ttf"], ["calibrib.ttf", "Carlito-Bold.ttf"], ["calibrili.ttf", "Carlito-Italic.ttf"], ["calibriz.ttf", "Carlito-BoldItalic.ttf"]] },
  { noms: ["arial", "helvetica", "liberation sans", "arimo", "arial unicode ms", "microsoft sans serif"], categorie: "sans", echelle: 1, interligne: 1.149, ascent: 0.905,
    fichiers: [["arial.ttf", "Arial.ttf", "LiberationSans-Regular.ttf", "Arimo-Regular.ttf"], ["arialbd.ttf", "Arial_Bold.ttf", "LiberationSans-Bold.ttf", "Arimo-Bold.ttf"], ["ariali.ttf", "Arial_Italic.ttf", "LiberationSans-Italic.ttf", "Arimo-Italic.ttf"], ["arialbi.ttf", "Arial_Bold_Italic.ttf", "LiberationSans-BoldItalic.ttf", "Arimo-BoldItalic.ttf"]] },
  { noms: ["arial narrow", "liberation sans narrow"], categorie: "sans", echelle: 0.82, interligne: 1.149, ascent: 0.935,
    fichiers: [["ARIALN.TTF", "arialn.ttf", "LiberationSansNarrow-Regular.ttf"], ["ARIALNB.TTF", "arialnb.ttf", "LiberationSansNarrow-Bold.ttf"], ["ARIALNI.TTF", "arialni.ttf", "LiberationSansNarrow-Italic.ttf"], ["ARIALNBI.TTF", "arialnbi.ttf", "LiberationSansNarrow-BoldItalic.ttf"]] },
  { noms: ["times new roman", "times", "liberation serif", "tinos"], categorie: "serif", echelle: 1, interligne: 1.149, ascent: 0.891,
    fichiers: [["times.ttf", "Times_New_Roman.ttf", "LiberationSerif-Regular.ttf", "Tinos-Regular.ttf"], ["timesbd.ttf", "Times_New_Roman_Bold.ttf", "LiberationSerif-Bold.ttf", "Tinos-Bold.ttf"], ["timesi.ttf", "Times_New_Roman_Italic.ttf", "LiberationSerif-Italic.ttf", "Tinos-Italic.ttf"], ["timesbi.ttf", "Times_New_Roman_Bold_Italic.ttf", "LiberationSerif-BoldItalic.ttf", "Tinos-BoldItalic.ttf"]] },
  { noms: ["courier new", "courier", "liberation mono", "cousine", "consolas", "lucida console"], categorie: "mono", echelle: 1, interligne: 1.133, ascent: 0.833,
    fichiers: [["cour.ttf", "Courier_New.ttf", "LiberationMono-Regular.ttf", "Cousine-Regular.ttf"], ["courbd.ttf", "Courier_New_Bold.ttf", "LiberationMono-Bold.ttf", "Cousine-Bold.ttf"], ["couri.ttf", "Courier_New_Italic.ttf", "LiberationMono-Italic.ttf", "Cousine-Italic.ttf"], ["courbi.ttf", "Courier_New_Bold_Italic.ttf", "LiberationMono-BoldItalic.ttf", "Cousine-BoldItalic.ttf"]] },
  { noms: ["cambria", "caladea"], categorie: "serif", echelle: 1.065, interligne: 1.172, ascent: 0.95,
    fichiers: [["Caladea-Regular.ttf"], ["Caladea-Bold.ttf"], ["Caladea-Italic.ttf"], ["Caladea-BoldItalic.ttf"]] },
  { noms: ["georgia", "gelasio"], categorie: "serif", echelle: 1.1, interligne: 1.136, ascent: 0.917,
    fichiers: [["georgia.ttf", "Gelasio-Regular.ttf"], ["georgiab.ttf", "Gelasio-Bold.ttf"], ["georgiai.ttf", "Gelasio-Italic.ttf"], ["georgiaz.ttf", "Gelasio-BoldItalic.ttf"]] },
  { noms: ["verdana", "dejavu sans"], categorie: "sans", echelle: 1.145, interligne: 1.215, ascent: 1.005,
    fichiers: [["verdana.ttf", "DejaVuSans.ttf"], ["verdanab.ttf", "DejaVuSans-Bold.ttf"], ["verdanai.ttf", "DejaVuSans-Oblique.ttf"], ["verdanaz.ttf", "DejaVuSans-BoldOblique.ttf"]] },
  { noms: ["tahoma"], categorie: "sans", echelle: 1.0, interligne: 1.207, ascent: 1.0,
    fichiers: [["tahoma.ttf"], ["tahomabd.ttf"], ["tahoma.ttf"], ["tahomabd.ttf"]] },
  { noms: ["segoe ui"], categorie: "sans", echelle: 0.99, interligne: 1.33, ascent: 1.079,
    fichiers: [["segoeui.ttf"], ["segoeuib.ttf"], ["segoeuii.ttf"], ["segoeuiz.ttf"]] },
  { noms: ["trebuchet ms"], categorie: "sans", echelle: 1.015, interligne: 1.16, ascent: 0.939,
    fichiers: [["trebuc.ttf"], ["trebucbd.ttf"], ["trebucit.ttf"], ["trebucbi.ttf"]] },
  { noms: ["century gothic"], categorie: "sans", echelle: 1.09, interligne: 1.226, ascent: 0.971,
    fichiers: [["GOTHIC.TTF", "gothic.ttf"], ["GOTHICB.TTF", "gothicb.ttf"], ["GOTHICI.TTF", "gothici.ttf"], ["GOTHICBI.TTF", "gothicbi.ttf"]] },
  { noms: ["garamond"], categorie: "serif", echelle: 0.97, interligne: 1.125, ascent: 0.862,
    fichiers: [["GARA.TTF", "gara.ttf"], ["GARABD.TTF", "garabd.ttf"], ["GARAIT.TTF", "garait.ttf"], ["GARABD.TTF", "garabd.ttf"]] },
  { noms: ["book antiqua", "palatino linotype", "palatino"], categorie: "serif", echelle: 1.1, interligne: 1.243, ascent: 0.96,
    fichiers: [["pala.ttf", "BKANT.TTF"], ["palab.ttf", "ANTQUAB.TTF"], ["palai.ttf", "ANTQUAI.TTF"], ["palabi.ttf", "ANTQUABI.TTF"]] },
  { noms: ["aptos", "aptos display", "aptos narrow"], categorie: "sans", echelle: 0.95, interligne: 1.2, ascent: 0.94 },
  { noms: ["candara", "corbel", "segoe ui light", "gill sans mt", "franklin gothic book", "lato", "open sans", "roboto"], categorie: "sans", echelle: 0.93, interligne: 1.2, ascent: 0.95 },
];

const STANDARD: Record<Famille["categorie"], [string, string, string, string]> = {
  sans: ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"],
  serif: ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"],
  mono: ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"],
};

function familleDe(nom: string): Famille {
  const n = nom.trim().toLowerCase();
  const connue = FAMILLES.find((f) => f.noms.includes(n));
  if (connue) return connue;
  const categorie: Famille["categorie"] = /mono|courier|consol|code|typewriter/.test(n)
    ? "mono"
    : /times|serif(?!.*sans)|roman|garamond|georgia|book|cambria|palatino|bodoni|didot|baskerville|minion|century(?! gothic)|constantia|bell|perpetua|rockwell|sylfaen/.test(n) && !/sans/.test(n)
      ? "serif"
      : "sans";
  return { noms: [n], categorie, echelle: 1, interligne: categorie === "sans" ? 1.17 : 1.15, ascent: 0.9 };
}

// ─────────────────────────── Les fichiers du système ───────────────────────────

function dossiersDePolices(): string[] {
  const env = process.env.DOCX_PDF_POLICES;
  if (env && env.trim().toLowerCase() === "standard") return [];
  const out: string[] = env ? env.split(path.delimiter).filter(Boolean) : [];
  if (process.platform === "win32") {
    out.push(path.join(process.env.WINDIR ?? "C:\\Windows", "Fonts"));
    if (process.env.LOCALAPPDATA) out.push(path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts"));
  } else {
    for (const d of [
      "/usr/share/fonts/truetype/crosextra", "/usr/share/fonts/truetype/liberation", "/usr/share/fonts/truetype/liberation2",
      "/usr/share/fonts/truetype/msttcorefonts", "/usr/share/fonts/truetype/croscore", "/usr/share/fonts/truetype/dejavu",
      "/usr/share/fonts/crosextra", "/usr/share/fonts/liberation", "/usr/share/fonts/liberation-sans", "/usr/share/fonts/liberation-serif",
      "/usr/share/fonts/liberation-mono", "/usr/share/fonts/google-carlito-fonts", "/usr/share/fonts/google-crosextra-carlito",
      "/usr/share/fonts/TTF", "/usr/share/fonts/truetype", "/usr/share/fonts/dejavu", "/usr/local/share/fonts",
      "/Library/Fonts", "/System/Library/Fonts/Supplemental",
    ]) out.push(d);
    if (process.env.HOME) out.push(path.join(process.env.HOME, ".fonts"), path.join(process.env.HOME, ".local", "share", "fonts"));
  }
  return out;
}

let DOSSIERS: string[] | null = null;
const FICHIERS = new Map<string, Buffer | null>();

/** Les octets du premier fichier candidat présent — mémorisés : une police se lit une fois par processus. */
function lireFichier(candidats: string[]): { cle: string; octets: Buffer } | null {
  DOSSIERS ??= dossiersDePolices().filter((d) => { try { return existsSync(d); } catch { return false; } });
  for (const nom of candidats) {
    for (const d of DOSSIERS) {
      const p = path.join(d, nom);
      if (!FICHIERS.has(p)) {
        let octets: Buffer | null = null;
        try { if (existsSync(p)) octets = readFileSync(p); } catch { octets = null; }
        FICHIERS.set(p, octets);
      }
      const o = FICHIERS.get(p);
      if (o && o.length > 1000) return { cle: p, octets: o };
    }
  }
  return null;
}

// ─────────────────────────── WinAnsi ───────────────────────────

const WINANSI_HORS_LATIN1 = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);

const estWinAnsi = (cp: number): boolean => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_HORS_LATIN1.has(cp);

/** Les remplaçants typographiques — ce qu'un œil lit comme le caractère d'origine. */
const SUBSTITUTS: Record<number, string> = {
  0x202f: "\u00a0", 0x2007: "\u00a0", 0x2060: "", 0x200b: "", 0x200c: "", 0x200d: "", 0xfeff: "", 0x00ad: "", 0x200e: "", 0x200f: "",
  0x2000: " ", 0x2001: " ", 0x2002: " ", 0x2003: " ", 0x2004: " ", 0x2005: " ", 0x2006: " ", 0x2008: " ", 0x2009: " ", 0x200a: " ", 0x205f: " ", 0x3000: " ",
  0x2010: "-", 0x2011: "-", 0x2012: "\u2013", 0x2015: "\u2014", 0x2212: "-", 0x2043: "-", 0x2032: "'", 0x2033: "\"", 0x2035: "'", 0x201b: "\u2019", 0x201f: "\u201d",
  0x2264: "<=", 0x2265: ">=", 0x2260: "!=", 0x2248: "~", 0x2192: "->", 0x2190: "<-", 0x2194: "<->", 0x21d2: "=>", 0x21d4: "<=>",
  0x2713: "v", 0x2714: "v", 0x2717: "x", 0x2718: "x", 0x2610: "[ ]", 0x2611: "[x]", 0x2612: "[x]",
  0x25cf: "\u2022", 0x25aa: "\u2022", 0x25a0: "\u2022", 0x2023: "\u2022", 0x2219: "\u00b7", 0x25e6: "o", 0x25cb: "o", 0x25ba: ">", 0x27a2: ">", 0x2756: "\u2022",
  0x2116: "N\u00b0", 0x2153: "1/3", 0x2154: "2/3", 0x215b: "1/8", 0x2161: "II", 0x2162: "III",
  0x02bc: "\u2019", 0x02b9: "'",
};

function substituer(c: string, garde: (cp: number) => boolean): string {
  const cp = c.codePointAt(0) ?? 0x3f;
  const s = SUBSTITUTS[cp];
  if (s !== undefined && [...s].every((x) => garde(x.codePointAt(0) ?? 0))) return s;
  // Une lettre accentuée hors jeu (ă, ș, ł…) : la lettre de base plutôt qu'un point d'interrogation.
  const base = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (base && base !== c && [...base].every((x) => garde(x.codePointAt(0) ?? 0))) return base;
  if (cp >= 0xf000 && cp <= 0xf0ff) return "\u2022";
  return "?";
}

// ─────────────────────────── Le mesureur ───────────────────────────

type Doc = PDFKit.PDFDocument;
interface FontePdfKit { widthOfString(s: string, taille: number, features?: unknown): number; font?: { hasGlyphForCodePoint(cp: number): boolean } }

/**
 * Le service de polices d'UN document : il enregistre les polices dans pdfkit, mesure les chaînes,
 * et nettoie le texte selon ce que la police choisie sait afficher.
 */
export class Polices implements Mesureur {
  private resolues = new Map<string, PoliceRendu>();
  private fontes = new Map<string, FontePdfKit>();
  private largeurs = new Map<string, number>();
  private enregistrees = new Map<string, boolean>();
  /** Les polices du document rendues par une police standard compressée — pour le dire. */
  readonly substituees = new Set<string>();

  constructor(private readonly doc: Doc, private readonly systeme: boolean) {}

  police(p: ProprietesTexte): PoliceRendu {
    const cle = `${p.police}|${p.gras ? 1 : 0}|${p.italique ? 1 : 0}`;
    const deja = this.resolues.get(cle);
    if (deja) return deja;
    const fam = familleDe(p.police);
    const variante = (p.gras ? 1 : 0) + (p.italique ? 2 : 0);
    let rendu: PoliceRendu | null = null;
    if (this.systeme && fam.fichiers) {
      const f = lireFichier(fam.fichiers[variante]!);
      if (f && this.enregistrer(f.cle, f.octets)) {
        rendu = { cle: f.cle, echelle: 1, interligne: fam.interligne, ascent: fam.ascent, standard: false, faux: { gras: false, italique: false } };
      } else if (variante) {
        // La variante manque (Tahoma n'a pas d'italique) : la normale, avec graisse / pente SIMULÉES.
        const normale = lireFichier(fam.fichiers[0]);
        if (normale && this.enregistrer(normale.cle, normale.octets)) {
          rendu = { cle: normale.cle, echelle: 1, interligne: fam.interligne, ascent: fam.ascent, standard: false, faux: { gras: p.gras, italique: p.italique } };
        }
      }
    }
    if (!rendu) {
      this.substituees.add(p.police);
      const echelle = Array.isArray(fam.echelle) ? fam.echelle[variante]! : fam.echelle;
      rendu = { cle: STANDARD[fam.categorie][variante]!, echelle, interligne: fam.interligne, ascent: fam.ascent, standard: true, faux: { gras: false, italique: false } };
    }
    this.resolues.set(cle, rendu);
    return rendu;
  }

  private enregistrer(cle: string, octets: Buffer): boolean {
    const deja = this.enregistrees.get(cle);
    if (deja !== undefined) return deja;
    let ok = false;
    try {
      this.doc.registerFont(cle, octets);
      this.fonte(cle);
      ok = true;
    } catch {
      ok = false;
    }
    this.enregistrees.set(cle, ok);
    return ok;
  }

  private fonte(cle: string): FontePdfKit {
    const deja = this.fontes.get(cle);
    if (deja) return deja;
    this.doc.font(cle);
    const f = (this.doc as unknown as { _font: FontePdfKit })._font;
    this.fontes.set(cle, f);
    return f;
  }

  largeur(police: PoliceRendu, texte: string, taille: number): number {
    if (!texte) return 0;
    const k = `${police.cle}\u0000${texte}`;
    let w = this.largeurs.get(k);
    if (w === undefined) {
      try { w = this.fonte(police.cle).widthOfString(texte, 1000); } catch { w = texte.length * 500; }
      this.largeurs.set(k, w);
    }
    return (w * taille * police.echelle) / 1000;
  }

  nettoyer(police: PoliceRendu, texte: string): string {
    if (police.standard) {
      let ok = true;
      for (const c of texte) if (!estWinAnsi(c.codePointAt(0) ?? 0)) { ok = false; break; }
      if (ok) return texte;
      let out = "";
      for (const c of texte) out += estWinAnsi(c.codePointAt(0) ?? 0) ? c : substituer(c, estWinAnsi);
      return out;
    }
    const f = this.fonte(police.cle).font;
    if (!f) return texte;
    const a = (cp: number) => { try { return f.hasGlyphForCodePoint(cp); } catch { return true; } };
    let out = "";
    for (const c of texte) out += a(c.codePointAt(0) ?? 0) ? c : substituer(c, a);
    return out;
  }
}
