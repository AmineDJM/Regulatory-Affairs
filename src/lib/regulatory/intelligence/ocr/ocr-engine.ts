import { buildPagedContent } from "../extract/pages";
import { ensureLangData, ocrCacheDir, defaultOcrLangs } from "./lang-data";
import { mistralOcrConfigured, mistralOcrDocument, mistralOcrEligible } from "./mistral-ocr";

/**
 * MOTEUR OCR (G13) — deux moteurs, contrat commun (`OcrResult`) :
 *  1. PRIMAIRE — Mistral OCR (cloud, `mistral-ocr-latest`) quand `MISTRAL_API_KEY` est présent :
 *     un appel réseau par document, rapide et précis (multi-pages géré côté serveur) ;
 *  2. REPLI/AUTO-HÉBERGÉ — `mupdf` (rastérisation) + `sharp` (pré-traitement) + `tesseract.js`
 *     (reconnaissance fr/en/ar, score de confiance par page), sans service tiers ni clé.
 *
 * Sélection par `REG_OCR_ENGINE` : "auto" (défaut — Mistral si clé, sinon Tesseract, avec repli
 * automatique sur Tesseract en cas d'échec Mistral), "mistral" (forcé, pas de repli), "tesseract"
 * (forcé local). Le texte OCR est stocké SÉPARÉMENT du texte natif (méthode = "ocr"). Les pages de
 * faible confiance sont signalées pour REVUE HUMAINE (jamais présumées correctes).
 */

export interface OcrPage {
  page: number;
  text: string;
  confidence: number; // 0..100
  chars: number;
  lowConfidence: boolean;
}

export interface OcrResult {
  engine: string; // "tesseract.js" (+ version)
  langs: string;
  method: "ocr";
  pages: OcrPage[];
  text: string;
  meanConfidence: number;
  pageCount: number;
  lowConfidencePages: number;
  needsReview: boolean;
  truncated: boolean; // pages au-delà du plafond non océrisées
  /** Carte des pages : position du début de chaque page dans `text`. */
  pageOffsets?: number[] | null;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "tif", "tiff", "bmp", "gif"]);
const LOW_CONFIDENCE = Number(process.env.REG_OCR_MIN_CONFIDENCE ?? 62); // seuil de revue humaine
/**
 * Pages océrisées par document. **0 = ILLIMITÉ, et c'est le défaut.**
 *
 * Le plafond valait 25 pages : un dossier scanné de 800 pages ressortait « océrisé » avec 3 % de
 * son contenu lu. Il n'existait que pour tenir la mémoire — problème désormais réglé à la source
 * par la rastérisation EN FLUX (une page vit à la fois), qui rend le plafond inutile.
 */
const MAX_PAGES = Number(process.env.REG_OCR_MAX_PAGES ?? 0);
const RASTER_SCALE = Number(process.env.REG_OCR_SCALE ?? 2.0); // ~200 DPI
const MAX_DIM = 2600; // borne mémoire par page

export function canOcr(ext: string): boolean {
  const e = ext.toLowerCase();
  return e === "pdf" || IMAGE_EXTS.has(e);
}

/**
 * Rastérise les pages d'un PDF en PNG via mupdf (auto-réparation des PDF imparfaits).
 * ROBUSTE PAR PAGE : une page qui refuse de se rastériser (page corrompue) est SAUTÉE — on
 * rastérise toutes les autres. Jamais une seule mauvaise page ne fait perdre tout le document.
 */
export async function rasterizePdf(buffer: Buffer, maxPages: number): Promise<{ pages: Buffer[]; total: number; failedPages: number }> {
  const pages: Buffer[] = [];
  let failedPages = 0;
  const total = await rasterizePdfStream(buffer, maxPages, async (png) => { pages.push(png); }, () => { failedPages++; });
  return { pages, total, failedPages };
}

/**
 * RASTÉRISATION EN FLUX — la clé des dossiers volumineux.
 *
 * La version qui accumulait `Buffer[]` gardait TOUTES les pages en mémoire : à ~1,5 Mo la page
 * rendue, un dossier de 15 000 pages demandait des dizaines de gigaoctets. C'est ce qui imposait
 * un plafond de 25 pages — un plafond qui faisait passer un dossier lu à 3 % pour un dossier lu.
 *
 * Ici, chaque page est rendue, remise à l'appelant, puis **relâchée immédiatement**. La mémoire
 * ne dépend plus du nombre de pages, seulement de la plus grande d'entre elles — et le nombre de
 * pages devient illimité.
 *
 * `onPage` est attendu (`await`) avant de rendre la suivante : c'est ce qui garantit qu'on ne
 * fabrique pas les pages plus vite qu'on ne les consomme, sinon la file d'attente reconstituerait
 * exactement le tas qu'on vient de supprimer.
 *
 * ROBUSTE PAR PAGE : une page corrompue est signalée et sautée, jamais fatale au document.
 * Renvoie le nombre TOTAL de pages du document (pas le nombre de pages traitées).
 */
export async function rasterizePdfStream(
  buffer: Buffer,
  maxPages: number,
  onPage: (png: Buffer, index: number) => Promise<void>,
  onFailure?: (index: number) => void,
): Promise<number> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  const total = doc.countPages();
  // `maxPages <= 0` ⇒ tout le document.
  const limit = maxPages > 0 ? Math.min(total, maxPages) : total;
  try {
    for (let i = 0; i < limit; i++) {
      let png: Buffer | null = null;
      try {
        const page = doc.loadPage(i);
        const pix = page.toPixmap(mupdf.Matrix.scale(RASTER_SCALE, RASTER_SCALE), mupdf.ColorSpace.DeviceRGB, false);
        png = Buffer.from(pix.asPNG());
        pix.destroy?.();
        page.destroy?.();
      } catch (err) {
        onFailure?.(i);
        console.error("[reg-ocr] page non rastérisée", i + 1, err instanceof Error ? err.message : err);
        continue;
      }
      await onPage(png, i);
      png = null; // relâche explicite : la page suivante ne doit pas cohabiter avec celle-ci
    }
  } finally {
    doc.destroy?.();
  }
  return total;
}

/** Pré-traitement image (auto-rotation, niveaux de gris, normalisation, borne de taille). */
async function preprocess(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer)
    .rotate() // applique l'orientation EXIF
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
}

type Worker = { recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };

async function createOcrWorker(langs: string[]): Promise<{ worker: Worker; version: string }> {
  const langPath = await ensureLangData(langs);
  const tesseract = await import("tesseract.js");
  const worker = (await tesseract.createWorker(langs.join("+"), 1, {
    langPath,
    cachePath: ocrCacheDir(),
    gzip: true,
  })) as unknown as Worker;
  return { worker, version: "tesseract.js/7" };
}

/**
 * Océrise un document (image ou PDF scanné). Aiguille vers Mistral OCR (cloud) quand il est
 * configuré et autorisé, sinon vers Tesseract (auto-hébergé). En mode "auto", tout échec Mistral
 * (réseau, quota, indisponibilité) bascule silencieusement sur Tesseract — jamais de perte.
 */
export async function ocrDocument(input: { ext: string; buffer: Buffer; langs?: string[]; maxPages?: number }): Promise<OcrResult> {
  const ext = input.ext.toLowerCase();
  if (!canOcr(ext)) throw new Error(`OCR non supporté pour « ${ext} ».`);

  const engine = (process.env.REG_OCR_ENGINE ?? "auto").trim().toLowerCase();
  const mistralUsable = engine !== "tesseract" && mistralOcrConfigured();
  if (mistralUsable && mistralOcrEligible(ext, input.buffer)) {
    try {
      return await mistralOcrDocument(input);
    } catch (err) {
      if (engine === "mistral") throw err; // moteur forcé → pas de repli silencieux
      console.error("[reg-ocr] Mistral OCR indisponible → repli Tesseract :", err instanceof Error ? err.message : err);
    }
  } else if (mistralUsable) {
    // Document hors limites Mistral (taille) → OCR local direct : Mistral le refuserait de toute
    // façon, inutile de dépenser un appel réseau voué à l'échec. Aucune perte (Tesseract prend le relais).
    console.warn(`[reg-ocr] document hors limites Mistral (${(input.buffer.length / 1048576).toFixed(1)} Mo) → OCR local Tesseract.`);
  }
  return ocrWithTesseract(input, ext);
}

/** OCR auto-hébergé : rastérisation mupdf + pré-traitement sharp + reconnaissance Tesseract. */
async function ocrWithTesseract(input: { ext: string; buffer: Buffer; langs?: string[]; maxPages?: number }, ext: string): Promise<OcrResult> {
  const langs = input.langs && input.langs.length > 0 ? input.langs : defaultOcrLangs();
  const maxPages = input.maxPages ?? MAX_PAGES;

  // RASTÉRISER PUIS RECONNAÎTRE **PAGE PAR PAGE**, jamais document par document : c'est ce qui
  // permet d'océriser 15 000 pages sans que la mémoire ne dépende du nombre de pages. Une seule
  // image de page vit à la fois ; le worker Tesseract, lui, est créé une seule fois.
  //
  // ROBUSTE PAR PAGE : une page qui échoue au pré-traitement OU à la reconnaissance est
  // enregistrée VIDE (revue humaine) et on continue — les pages lisibles sont océrisées.
  const { worker, version } = await createOcrWorker(langs);
  const pages: OcrPage[] = [];
  let total = 1;
  let failedPages = 0;

  const recognizeOne = async (raw: Buffer, index: number): Promise<void> => {
    let img = raw;
    try {
      img = await preprocess(img);
    } catch {
      /* pré-traitement best-effort : on OCR l'image brute si sharp échoue */
    }
    try {
      const { data } = await worker.recognize(img);
      const text = (data.text ?? "").trim();
      const confidence = Math.round(data.confidence ?? 0);
      pages.push({ page: index + 1, text, confidence, chars: text.length, lowConfidence: confidence < LOW_CONFIDENCE });
    } catch (err) {
      console.error("[reg-ocr] reconnaissance page échouée", index + 1, err instanceof Error ? err.message : err);
      pages.push({ page: index + 1, text: "", confidence: 0, chars: 0, lowConfidence: true }); // illisible → revue humaine
    }
  };

  try {
    if (ext === "pdf") {
      total = await rasterizePdfStream(input.buffer, maxPages, recognizeOne, () => { failedPages++; });
    } else {
      await recognizeOne(input.buffer, 0);
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  // « Tronqué » ne veut dire qu'une chose : des pages n'ont pas été lues. Qu'elles aient été
  // écartées par un plafond ou par une corruption, l'utilisateur doit le savoir.
  const truncated = pages.length < total;
  if (failedPages > 0) console.warn(`[reg-ocr] ${failedPages} page(s) corrompue(s) sautée(s) sur ${total}.`);

  // Contenu PAGINÉ (jamais retaillé : la carte des pages pointe dans CE texte).
  const paged = buildPagedContent(pages.map((p) => p.text));
  const text = paged.content;
  const withText = pages.filter((p) => p.chars > 0);
  const meanConfidence = withText.length > 0 ? Math.round(withText.reduce((s, p) => s + p.confidence, 0) / withText.length) : 0;
  const lowConfidencePages = pages.filter((p) => p.lowConfidence).length;

  return {
    engine: version, langs: langs.join("+"), method: "ocr", pages, text,
    meanConfidence, pageCount: total, lowConfidencePages,
    needsReview: meanConfidence < LOW_CONFIDENCE || lowConfidencePages > 0 || text.trim().length === 0,
    truncated,
    pageOffsets: paged.pageMap,
  };
}
