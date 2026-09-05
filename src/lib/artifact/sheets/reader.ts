import { Unzip, UnzipInflate } from "fflate";
import { traduireFormulePartagee } from "@/lib/artifact/sheets/formula";
import { coordDeA1 } from "@/lib/artifact/sheets/refs";
import { nouvelleFeuille, poserCellule, type Cellule, type Classeur, type Feuille, type NomDefini, type TypeCellule } from "@/lib/artifact/sheets/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LECTEUR À GRANDE ÉCHELLE — un classeur de cent mille lignes, lu en flux, sans arbre XML,
 * sans ExcelJS.
 *
 * ── POURQUOI PAS L'ADAPTATEUR LIVE OFFICE, NI EXCELJS ────────────────────────────────────
 *
 * `adapters/xlsx/adapter.ts` ouvre le classeur ENTIER dans un arbre XML pour pouvoir le
 * REFERMER à l'octet près : c'est ce qui rend une retouche fidèle, et c'est ce qui le borne à
 * vingt mille cellules par feuille. Raisonner (graphe, recalcul, audit, comparaison) n'a pas
 * besoin de refermer : il a besoin de TOUT lire, exactement.
 *
 * Le lecteur en flux d'ExcelJS a été essayé d'abord (§118-5 : ne rien recréer), et MESURÉ
 * infidèle sur trois points qu'un audit ne peut pas se permettre : il jette les résultats 0, « »
 * et FAUX des formules et transforme `#REF!` en NaN (`_copyModel` ne copie que ce qui est vrai,
 * les résultats passent par `parseFloat`) ; il perd les formules PARTAGÉES (95 % des formules
 * d'un modèle recopié arrivent vides) ; et il décode l'UTF-8 morceau par morceau, ce qui coupe un
 * « é » sur deux tampons une fois sur cinquante mille cellules — « Sétif » devient « S��tif », et
 * un SOMME.SI ne le trouve plus. On lit donc le XML soi-même : `fflate` gonfle en flux, un
 * `TextDecoder` en flux ne coupe jamais un caractère, et un seul motif reconnaît les cellules.
 *
 * ── CE QU'IL LIT, ET CE QU'IL DIT NE PAS LIRE ────────────────────────────────────────────
 *
 * Valeurs typées (nombre, texte, booléen, erreur, date), formules (partagées traduites pour
 * chaque esclave par notre analyseur ; matricielles gardées sur leur maîtresse), formats de
 * nombre, feuilles masquées, noms définis, ordre des onglets. Il NE lit PAS les styles au-delà du
 * format de nombre, les graphiques, les tableaux croisés, les validations, les commentaires :
 * `limites` le dit. Une limite qu'on tait est un mensonge par omission.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface OptionsLecture {
  /** Plafond de cellules TOTAL au-delà duquel le lecteur s'arrête et le dit (défaut : 4 000 000). */
  maxCellules?: number;
  /** Lire les formats de nombre (utile aux dates). Défaut : oui. */
  formats?: boolean;
}

// ─────────────────────────── XML : les quelques outils qu'il faut ───────────────────────────

const ENTITES: Record<string, string> = { lt: "<", gt: ">", quot: "\"", apos: "'", amp: "&" };
function decoderXml(t: string): string {
  if (t.indexOf("&") === -1) return t;
  return t.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (tout, code: string) => {
    if (code[0] === "#") return String.fromCodePoint(code[1] === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    return ENTITES[code] ?? tout;
  });
}
const attribut = (attrs: string, nom: string): string | undefined => {
  const m = new RegExp(`(?:^|\\s)${nom}="([^"]*)"`).exec(attrs);
  return m ? m[1] : undefined;
};
/** Le texte d'un fragment `<is>` / `<si>` : tous les `<t>`, hors phonétique `<rPh>`. */
function texteRiche(fragment: string): string {
  const sans = fragment.indexOf("<rPh") === -1 ? fragment : fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sans)) !== null) if (m[1]) out += decoderXml(m[1]);
  return out;
}

/** Gonfle UNE entrée du zip, entièrement (les petites : workbook, rels, chaînes, styles). */
function entrees(octets: Uint8Array, voulues: (nom: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  const unzip = new Unzip((fichier) => {
    if (!voulues(fichier.name)) return;
    const morceaux: Uint8Array[] = [];
    fichier.ondata = (err, morceau, final) => {
      if (err) return;
      morceaux.push(morceau);
      if (final) {
        const total = morceaux.reduce((s, m) => s + m.length, 0);
        const tout = new Uint8Array(total);
        let o = 0;
        for (const m of morceaux) { tout.set(m, o); o += m.length; }
        out.set(fichier.name, new TextDecoder().decode(tout));
      }
    };
    fichier.start();
  });
  unzip.register(UnzipInflate);
  unzip.push(octets, true);
  return out;
}

// ─────────────────────────── L'en-tête : feuilles, noms, chaînes, formats ───────────────────────────

interface Entete {
  noms: NomDefini[];
  /** Les feuilles dans l'ordre des onglets : nom, chemin dans le zip, masquée. */
  feuilles: { nom: string; chemin: string | null; masquee: boolean }[];
  chaines: string[];
  /** Index de style `s` → code de format de nombre (`null` = Général). */
  formats: (string | null)[];
  date1904: boolean;
  xlsb: boolean;
}

const FORMATS_INTEGRES: Record<number, string> = {
  1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
  14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yy h:mm",
  27: "yyyy/m/d", 28: "m/d", 29: "m/d", 30: "m/d/yy", 31: "yyyy/m/d", 32: "h:mm", 33: "h:mm:ss", 34: "yyyy/m/d", 35: "yyyy/m/d", 36: "yyyy/m/d",
  37: "#,##0 ;(#,##0)", 38: "#,##0 ;[Red](#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss", 46: "[h]:mm:ss", 47: "mmss.0", 48: "##0.0E+0", 49: "@", 50: "yyyy/m/d", 51: "yyyy/m/d", 52: "yyyy/m/d", 53: "yyyy/m/d", 54: "yyyy/m/d", 55: "yyyy/m/d", 56: "yyyy/m/d", 57: "yyyy/m/d", 58: "yyyy/m/d",
};

function lireEntete(octets: Uint8Array, lireFormats: boolean): Entete {
  const fichiers = entrees(octets, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || (lireFormats && n === "xl/styles.xml") || n === "xl/workbook.bin");
  const workbook = fichiers.get("xl/workbook.xml") ?? "";
  const rels = fichiers.get("xl/_rels/workbook.xml.rels") ?? "";

  const cibles = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attribut(m[1], "Id"); const target = attribut(m[1], "Target");
    if (id && target) cibles.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const feuilles: Entete["feuilles"] = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const nom = decoderXml(attribut(attrs, "name") ?? "");
    const rid = attribut(attrs, "r:id");
    feuilles.push({ nom, chemin: rid ? cibles.get(rid) ?? null : null, masquee: /\bstate="(hidden|veryHidden)"/.test(attrs) });
  }
  const noms: NomDefini[] = [];
  for (const m of workbook.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
    const nom = attribut(m[1], "name");
    if (!nom || nom.startsWith("_xlnm.")) continue;
    const local = attribut(m[1], "localSheetId");
    noms.push({ nom: decoderXml(nom), refersTo: decoderXml(m[2]).trim(), feuille: local !== undefined ? Number(local) + 1 : null });
  }
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbook);

  const chaines: string[] = [];
  const sst = fichiers.get("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) chaines.push(m[1] === undefined ? "" : (" " + texteRiche(m[1])).slice(1));

  const formats: (string | null)[] = [];
  const styles = fichiers.get("xl/styles.xml");
  if (styles) {
    const personnalises = new Map<number, string>();
    for (const m of styles.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
      const id = attribut(m[1], "numFmtId"); const code = attribut(m[1], "formatCode");
      if (id !== undefined && code !== undefined) personnalises.set(Number(id), decoderXml(code));
    }
    const bloc = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
    for (const m of bloc.matchAll(/<xf\b([^>]*)\/?>/g)) {
      const id = Number(attribut(m[1], "numFmtId") ?? 0);
      const code = personnalises.get(id) ?? FORMATS_INTEGRES[id] ?? null;
      formats.push(code === "General" ? null : code);
    }
  }
  return { noms, feuilles, chaines, formats, date1904, xlsb: fichiers.has("xl/workbook.bin") };
}

/** Les noms définis et l'ordre des feuilles, relus dans `xl/workbook.xml` (exposé pour les tests et l'aperçu). */
export function lireWorkbookXml(octets: Uint8Array): { noms: NomDefini[]; feuilles: string[]; masquees: Set<string> } {
  const e = lireEntete(octets, false);
  return { noms: e.noms, feuilles: e.feuilles.map((f) => f.nom), masquees: new Set(e.feuilles.filter((f) => f.masquee).map((f) => f.nom)) };
}

/** Un instant JS → numéro de série Excel (1900), en UTC — la convention des dates du classeur. */
export function dateEnSerie(d: Date): number {
  return (d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const estFormatDate = (code: string): boolean => {
  const nu = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmyhs]/i.test(nu) && !/[#0?]/.test(nu);
};

// ─────────────────────────── Les feuilles, en flux ───────────────────────────

/** Une balise `<row …>` (pour le numéro de ligne quand une cellule ne porte pas d'adresse) ou une cellule complète. */
const MOTIF = /<row\b([^>]*)>|<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const MOTIF_F = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/;
const MOTIF_V = /<v>([\s\S]*?)<\/v>/;
const MOTIF_IS = /<is>([\s\S]*?)<\/is>/;

interface EtatFeuille {
  feuille: Feuille;
  /** si → maîtresse d'une formule partagée. */
  maitres: Map<string, { row: number; col: number; formule: string }>;
  nonTraduites: number;
  ligneCourante: number;
  colonneCourante: number;
}

/**
 * UNE COPIE PLATE d'une chaîne extraite par regex. V8 rend une capture de regex comme une
 * « tranche » qui garde VIVANT le tampon entier dont elle vient : quatre cent mille valeurs
 * texte retiendraient tout le XML de la feuille. `(" " + s).slice(1)` force une chaîne plate et
 * indépendante. Les valeurs répétées (régions, statuts) sont en plus INTERNÉES : une seule
 * instance pour cent mille cellules.
 */
const INTERNES_MAX = 200_000;
function aplatisseur(): (s: string) => string {
  const internes = new Map<string, string>();
  return (s) => {
    if (s.length === 0) return "";
    const connue = internes.get(s);
    if (connue !== undefined) return connue;
    const plate = (" " + s).slice(1);
    if (internes.size < INTERNES_MAX) internes.set(plate, plate);
    return plate;
  };
}

function lireCellulesXml(texte: string, etat: EtatFeuille, entete: Entete, lireFormats: boolean, compteur: { total: number; max: number; tronque: boolean }, plat: (s: string) => string): void {
  MOTIF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (!compteur.tronque && (m = MOTIF.exec(texte)) !== null) {
    if (m[1] !== undefined) { // <row r="…">
      const r = attribut(m[1], "r");
      if (r) { etat.ligneCourante = Number(r); etat.colonneCourante = 0; }
      continue;
    }
    const attrs = m[2];
    const contenu = m[3] ?? "";
    const adresse = attribut(attrs, "r");
    let row: number; let col: number;
    if (adresse) {
      const coord = coordDeA1(adresse);
      if (!coord) continue;
      row = coord.row; col = coord.col;
    } else {
      row = etat.ligneCourante; col = etat.colonneCourante + 1;
    }
    etat.ligneCourante = row; etat.colonneCourante = col;
    if (contenu === "" ) continue; // <c r="A1" s="3"/> : un style sans valeur

    const type = attribut(attrs, "t");
    const s = lireFormats ? attribut(attrs, "s") : undefined;
    const numFmt = s !== undefined ? entete.formats[Number(s)] ?? null : null;

    let f: string | null = null;
    const mf = contenu.indexOf("<f") === -1 ? null : MOTIF_F.exec(contenu);
    if (mf) {
      const fAttrs = mf[1]; const fTexte = mf[2] === undefined ? "" : plat(decoderXml(mf[2]));
      if (/\bt="shared"/.test(fAttrs)) {
        const si = attribut(fAttrs, "si") ?? "";
        if (fTexte !== "") { f = fTexte; etat.maitres.set(si, { row, col, formule: fTexte }); }
        else {
          const maitre = etat.maitres.get(si);
          f = maitre ? traduireFormulePartagee(maitre.formule, maitre, { row, col }) : null;
          if (f === null) etat.nonTraduites += 1;
        }
      } else if (fTexte !== "") f = fTexte;
    }

    let v: Cellule["v"] = null; let t: TypeCellule = "vide";
    const mis = type === "inlineStr" ? MOTIF_IS.exec(contenu) : null;
    const mv = mis ? null : MOTIF_V.exec(contenu);
    const brut = mv ? mv[1] : null;
    if (mis) { v = plat(texteRiche(mis[1])); t = "s"; }
    else if (brut !== null) {
      switch (type) {
        case "s": { const i = Number(brut); v = entete.chaines[i] ?? ""; t = "s"; break; }
        case "str": v = plat(decoderXml(brut)); t = "s"; break;
        case "b": v = brut === "1" || brut === "true"; t = "b"; break;
        case "e": v = plat(decoderXml(brut)); t = "e"; break;
        case "d": { const d = new Date(brut); v = Number.isNaN(d.getTime()) ? plat(decoderXml(brut)) : dateEnSerie(d); t = typeof v === "number" ? "d" : "s"; break; }
        default: {
          const n = Number(brut);
          if (Number.isFinite(n)) {
            const date = numFmt !== null && estFormatDate(numFmt);
            v = date && entete.date1904 ? n + 1462 : n; t = date ? "d" : "n";
          } else { v = plat(decoderXml(brut)); t = "s"; }
        }
      }
    }
    if (f === null && t === "vide") continue;
    poserCellule(etat.feuille, { row, col, v, t, f, numFmt });
    compteur.total += 1;
    if (compteur.total >= compteur.max) compteur.tronque = true;
  }
}

/**
 * LIT UN CLASSEUR depuis un Buffer. En flux : le zip est gonflé morceau par morceau, le texte
 * décodé sans jamais couper un caractère, et seules les cellules complètes sont analysées ; la
 * fin d'un morceau attend le suivant. Les feuilles sont rendues dans l'ordre des onglets.
 */
export async function lireClasseur(octets: Buffer | Uint8Array, opts: OptionsLecture = {}): Promise<Classeur> {
  const lireFormats = opts.formats ?? true;
  const limites: string[] = ["styles (hors format de nombre), graphiques, tableaux croisés, validations et commentaires non lus (analyse, pas édition)"];
  const entete = lireEntete(octets, lireFormats);
  if (entete.xlsb) throw new Error("format binaire .xlsb non pris en charge : enregistrer en .xlsx");
  if (entete.date1904) limites.push("classeur en calendrier 1904 : dates converties en série 1900");
  const compteur = { total: 0, max: opts.maxCellules ?? 4_000_000, tronque: false };

  const plat = aplatisseur();
  const parChemin = new Map<string, EtatFeuille>();
  entete.feuilles.forEach((f, i) => {
    const feuille = nouvelleFeuille(i + 1, f.nom || `Feuil${i + 1}`);
    if (f.masquee) feuille.masquee = true;
    parChemin.set(f.chemin ?? `xl/worksheets/sheet${i + 1}.xml`, { feuille, maitres: new Map(), nonTraduites: 0, ligneCourante: 0, colonneCourante: 0 });
  });

  const unzip = new Unzip((fichier) => {
    const etat = parChemin.get(fichier.name);
    if (!etat) return;
    const decodeur = new TextDecoder();
    let reste = "";
    fichier.ondata = (err, morceau, final) => {
      if (err || compteur.tronque) return;
      const texte = reste + decodeur.decode(morceau, { stream: !final });
      // On n'analyse que jusqu'à la DERNIÈRE cellule complète ; le reste attend le morceau suivant.
      // `<c` suivi d'une limite de mot ne peut être que `<c ` ou `<c>` : ni <cols>, ni <cfRule>.
      let coupe = texte.length;
      if (!final) {
        const dernierC = texte.lastIndexOf("<c");
        const dernierRow = texte.lastIndexOf("<row");
        const dernier = Math.max(dernierC, dernierRow);
        coupe = dernier === -1 ? 0 : dernier;
        // Une cellule complète se termine par `</c>` ou `/>` : si la dernière balise `<c` est close, tout passe.
        if (dernier === dernierC && dernierC !== -1) {
          const fin = texte.indexOf("</c>", dernierC);
          const auto = texte.indexOf("/>", dernierC);
          const finTag = texte.indexOf(">", dernierC);
          if (fin !== -1 || (auto !== -1 && finTag !== -1 && auto + 1 === finTag)) coupe = texte.length;
        } else if (dernier === dernierRow && dernierRow !== -1 && texte.indexOf(">", dernierRow) !== -1) coupe = texte.length;
      }
      lireCellulesXml(texte.slice(0, coupe), etat, entete, lireFormats, compteur, plat);
      reste = texte.slice(coupe);
      if (reste.length > 50_000_000) { reste = ""; limites.push(`feuille ${etat.feuille.nom} : XML inattendu, lecture partielle`); }
    };
    fichier.start();
  });
  unzip.register(UnzipInflate);
  try { unzip.push(Buffer.isBuffer(octets) ? new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength) : octets, true); }
  catch (e) { throw new Error(`classeur illisible : ${e instanceof Error ? e.message : String(e)}`); }

  const feuilles: Feuille[] = [];
  for (const etat of parChemin.values()) {
    if (etat.nonTraduites > 0) limites.push(`${etat.nonTraduites} formule(s) partagée(s) non traduite(s) en ${etat.feuille.nom} — lues comme valeurs`);
    feuilles.push(etat.feuille);
  }
  feuilles.sort((a, b) => a.index - b.index);
  if (compteur.tronque) limites.push(`lecture arrêtée à ${compteur.max} cellules`);
  return { feuilles, noms: entete.noms, limites };
}
