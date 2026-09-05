import { chargerMupdf } from "@/lib/artifact/adapters/pdf/adapter";
import { normaliserTexte } from "@/lib/artifact/object-model/text";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN PDF DE CINQ CENTS PAGES — le texte natif, page par page, sans jamais tout charger dans
 * un modèle de langage.
 *
 * ── LA RÈGLE ÉCONOMIQUE ─────────────────────────────────────────────────────────────────
 *
 * Cinq cents pages dans le contexte d'un modèle coûtent cent fois trop cher et ne tiennent pas.
 * Ce module fait le travail déterministe : extraire le texte NATIF d'une plage de pages (MuPDF,
 * quelques millisecondes par page), CHERCHER une expression dans tout le document et rendre les
 * pages qui la portent avec un extrait, lire le PLAN (les signets). Le modèle ne voit que ce qui
 * répond à la question. Les pages SANS texte (scan) sont nommées, pas devinées : c'est le pont
 * (`in-process/artifact/pdf.ts`) qui décide de les océriser, dans une limite qu'il annonce.
 *
 * ── LA NUMÉROTATION, TOUJOURS HUMAINE (§17) ─────────────────────────────────────────────
 *
 * La page 1 est la première. MuPDF compte à partir de 0 ; la conversion se fait ICI, une fois.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PageTexte {
  n: number;
  texte: string;
  /** `natif` : du texte extrait ; `vide` : aucun caractère (page scannée, image, ou vraiment blanche). */
  methode: "natif" | "vide";
  caracteres: number;
}

export interface LecturePdf {
  pages: PageTexte[];
  /** Le nombre total de pages du document. */
  total: number;
  /** Les pages demandées qui n'ont AUCUN texte natif — candidates à l'OCR. */
  sansTexte: number[];
  /** Vrai si la plage demandée dépassait le plafond et a été coupée. */
  tronque: boolean;
  ms: number;
}

// mupdf ne publie pas de types complets : on garde une surface `unknown` élargie, comme l'adaptateur.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

async function ouvrirPdf(octets: Buffer | Uint8Array): Promise<Doc> {
  const mupdf = await chargerMupdf();
  return mupdf.PDFDocument.openDocument(new Uint8Array(octets), "application/pdf");
}

function texteDePage(doc: Doc, index: number): string {
  try {
    const page = doc.loadPage(index);
    const st = page.toStructuredText("preserve-whitespace");
    const texte: string = st.asText();
    return texte.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

/**
 * INTERPRÈTE une demande de pages : « 12-15 », « 3, 5, 9 », `[1, 2]`, ou rien (= depuis le début).
 * Bornée à `max` pages, et au nombre de pages du document ; le résultat dit si elle a été coupée.
 */
export function plagePages(spec: string | number[] | null | undefined, total: number, max: number): { pages: number[]; tronque: boolean } {
  const voulues = new Set<number>();
  if (Array.isArray(spec)) {
    for (const n of spec) if (Number.isInteger(n) && n >= 1) voulues.add(n);
  } else if (typeof spec === "string" && spec.trim()) {
    for (const morceau of spec.split(/[;,]/)) {
      const m = /^\s*(\d{1,5})\s*(?:-|–|à|a)\s*(\d{1,5})\s*$/.exec(morceau);
      if (m) { const de = Number(m[1]); const a = Number(m[2]); for (let k = Math.min(de, a); k <= Math.max(de, a); k++) voulues.add(k); continue; }
      const n = Number(morceau.trim());
      if (Number.isInteger(n) && n >= 1) voulues.add(n);
    }
  }
  const liste = (voulues.size ? [...voulues] : Array.from({ length: total }, (_, i) => i + 1)).filter((n) => n <= total).sort((a, b) => a - b);
  return { pages: liste.slice(0, max), tronque: liste.length > max };
}

/** LE TEXTE NATIF d'une plage de pages. */
export async function lireTextePdf(octets: Buffer | Uint8Array, opts: { pages?: string | number[] | null; max?: number } = {}): Promise<LecturePdf> {
  const debut = Date.now();
  const doc = await ouvrirPdf(octets);
  const total: number = doc.countPages();
  const { pages, tronque } = plagePages(opts.pages, total, opts.max ?? 40);
  const out: PageTexte[] = [];
  const sansTexte: number[] = [];
  for (const n of pages) {
    const texte = texteDePage(doc, n - 1);
    out.push({ n, texte, methode: texte ? "natif" : "vide", caracteres: texte.length });
    if (!texte) sansTexte.push(n);
  }
  return { pages: out, total, sansTexte, tronque, ms: Date.now() - debut };
}

export interface Occurrence { page: number; extrait: string }

/**
 * CHERCHE une expression dans TOUT le document, accents et casse repliés, et rend les pages avec
 * un extrait autour de chaque occurrence. « Où parle-t-on de la garantie ? » → pages 12, 47, 210.
 */
export async function chercherDansPdf(octets: Buffer | Uint8Array, requete: string, opts: { max?: number; contexte?: number } = {}): Promise<{ occurrences: Occurrence[]; pagesTouchees: number[]; pagesSansTexte: number; total: number; tronque: boolean; ms: number }> {
  const debut = Date.now();
  const besoin = normaliserTexte(requete);
  const doc = await ouvrirPdf(octets);
  const total: number = doc.countPages();
  const max = opts.max ?? 30;
  const contexte = opts.contexte ?? 90;
  const occurrences: Occurrence[] = [];
  const pagesTouchees: number[] = [];
  let pagesSansTexte = 0;
  let tronque = false;
  if (!besoin) return { occurrences, pagesTouchees, pagesSansTexte, total, tronque, ms: 0 };
  for (let i = 0; i < total; i++) {
    const texte = texteDePage(doc, i);
    if (!texte) { pagesSansTexte += 1; continue; }
    // On cherche dans le texte NORMALISÉ mais on extrait dans le texte ORIGINAL : les deux ont la
    // même longueur caractère à caractère (la normalisation replie sans supprimer), sauf les
    // espaces multiples — d'où l'alignement approximatif par recherche du premier mot.
    const norm = normaliserTexte(texte);
    let pos = norm.indexOf(besoin);
    if (pos === -1) continue;
    pagesTouchees.push(i + 1);
    while (pos !== -1 && occurrences.length < max) {
      const de = Math.max(0, pos - contexte);
      const a = Math.min(texte.length, pos + besoin.length + contexte);
      occurrences.push({ page: i + 1, extrait: `${de > 0 ? "…" : ""}${texte.slice(de, a).replace(/\s+/g, " ").trim()}${a < texte.length ? "…" : ""}` });
      pos = norm.indexOf(besoin, pos + besoin.length);
    }
    if (occurrences.length >= max) { tronque = i < total - 1; break; }
  }
  return { occurrences, pagesTouchees, pagesSansTexte, total, tronque, ms: Date.now() - debut };
}

export interface EntreePlanPdf { titre: string; page: number | null; niveau: number }

/** LE PLAN (les signets) d'un PDF — vide quand le document n'en a pas, ce qui est fréquent. */
export async function planPdf(octets: Buffer | Uint8Array): Promise<{ entrees: EntreePlanPdf[]; total: number }> {
  const doc = await ouvrirPdf(octets);
  const total: number = doc.countPages();
  const entrees: EntreePlanPdf[] = [];
  const parcourir = (items: { title?: string; page?: number; uri?: string; down?: unknown[] }[] | null | undefined, niveau: number) => {
    for (const it of items ?? []) {
      let page: number | null = typeof it.page === "number" ? it.page + 1 : null;
      if (page === null && it.uri) {
        try { const r = doc.resolveLinkDestination?.(it.uri) ?? doc.resolveLink?.(it.uri); const idx = typeof r === "number" ? r : r?.page; if (typeof idx === "number") page = idx + 1; } catch { /* lien externe */ }
      }
      entrees.push({ titre: (it.title ?? "").trim(), page, niveau });
      if (Array.isArray(it.down)) parcourir(it.down as never, niveau + 1);
    }
  };
  try { parcourir(doc.loadOutline(), 1); } catch { /* pas de plan */ }
  return { entrees: entrees.slice(0, 500), total };
}

/**
 * EXTRAIT des pages dans un PDF autonome — ce qu'on donne à un moteur d'OCR quand seules trois
 * pages sur cinq cents sont scannées : on n'envoie pas le document entier.
 */
export async function extrairePages(octets: Buffer | Uint8Array, pages: number[]): Promise<Buffer> {
  const mupdf = await chargerMupdf();
  const src = await ouvrirPdf(octets);
  const total: number = src.countPages();
  const dst = new mupdf.PDFDocument();
  for (const n of pages) {
    if (!Number.isInteger(n) || n < 1 || n > total) continue;
    dst.graftPage(-1, src, n - 1);
  }
  return Buffer.from(dst.saveToBuffer("compress").asUint8Array());
}
