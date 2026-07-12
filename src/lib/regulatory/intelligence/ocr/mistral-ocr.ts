import type { OcrResult, OcrPage } from "./ocr-engine";

/**
 * MOTEUR OCR CLOUD — Mistral OCR (`mistral-ocr-latest`).
 *
 * Moteur PRIMAIRE quand `MISTRAL_API_KEY` est présent : un SEUL appel réseau par document
 * (multi-pages géré côté serveur Mistral), très rapide et précis. Repli automatique sur
 * Tesseract (auto-hébergé) géré dans `ocr-engine.ts` si la clé est absente ou en cas d'échec.
 *
 * ⚠️ Service TIERS PAYANT (facturé À LA PAGE) nécessitant un réseau sortant. Aucune donnée
 * simulée : sans clé, on n'appelle pas Mistral et on retombe sur l'OCR local.
 *
 * Mistral ne renvoie PAS de score de confiance par page. On présume donc une confiance haute
 * (95) sur toute page contenant du texte, et 0 (→ REVUE HUMAINE) sur une page vide/illisible.
 */

const DEFAULT_URL = "https://api.mistral.ai/v1/ocr";
const DEFAULT_MODEL = "mistral-ocr-latest";
const MISTRAL_CONFIDENCE = 95; // confiance présumée d'une page non vide (Mistral ne score pas)

/** Extensions supportées par Mistral OCR → type MIME du data-URL envoyé. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  gif: "image/gif",
};

/** Vrai si une clé Mistral OCR est configurée (moteur primaire activable). */
export function mistralOcrConfigured(): boolean {
  return Boolean((process.env.MISTRAL_API_KEY ?? "").trim());
}

function ocrUrl(): string {
  return (process.env.REG_MISTRAL_OCR_URL ?? "").trim() || DEFAULT_URL;
}
function ocrModel(): string {
  return (process.env.REG_MISTRAL_OCR_MODEL ?? "").trim() || DEFAULT_MODEL;
}
function maxAttempts(): number {
  const n = Number(process.env.REG_MISTRAL_OCR_ATTEMPTS ?? 4);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 4;
}
function timeoutMs(): number {
  const n = Number(process.env.REG_MISTRAL_OCR_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}
function backoffMs(attempt: number): number {
  const base = Number(process.env.REG_MISTRAL_OCR_BACKOFF_MS ?? 500);
  const b = Number.isFinite(base) && base >= 0 ? base : 500;
  return Math.min(b * 2 ** (attempt - 1), 8000);
}
function defaultMaxPages(): number {
  const n = Number(process.env.REG_MISTRAL_OCR_MAX_PAGES ?? 1000);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1000;
}
function lowConfidenceThreshold(): number {
  const n = Number(process.env.REG_OCR_MIN_CONFIDENCE ?? 62);
  return Number.isFinite(n) ? n : 62;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Convertit la réponse brute de l'API Mistral OCR en `OcrResult` (même contrat que Tesseract).
 * Exporté pour test unitaire (sans réseau). Ne dépend d'aucun état global hors variables d'env.
 */
export function parseMistralOcr(json: unknown, opts: { langs: string; maxPages: number; model: string }): OcrResult {
  const data = (json ?? {}) as {
    pages?: Array<{ index?: number; markdown?: string; text?: string }>;
    usage_info?: { pages_processed?: number };
  };
  const rawPages = Array.isArray(data.pages) ? data.pages : [];
  const processed = data.usage_info?.pages_processed ?? rawPages.length;
  const capped = rawPages.slice(0, Math.max(1, opts.maxPages));
  const truncated = rawPages.length > capped.length || processed > capped.length;
  const low = lowConfidenceThreshold();

  const pages: OcrPage[] = capped.map((p, i) => {
    const text = (p.markdown ?? p.text ?? "").trim();
    const hasText = text.length > 0;
    const confidence = hasText ? MISTRAL_CONFIDENCE : 0;
    return {
      page: typeof p.index === "number" && p.index >= 0 ? p.index + 1 : i + 1,
      text,
      confidence,
      chars: text.length,
      lowConfidence: confidence < low, // page vide → revue humaine
    };
  });

  const text = pages.map((p) => p.text).join("\n\n").trim();
  const withText = pages.filter((p) => p.chars > 0);
  const meanConfidence = withText.length > 0 ? Math.round(withText.reduce((s, p) => s + p.confidence, 0) / withText.length) : 0;
  const lowConfidencePages = pages.filter((p) => p.lowConfidence).length;

  return {
    engine: `mistral/${opts.model}`,
    langs: opts.langs,
    method: "ocr",
    pages,
    text,
    meanConfidence,
    pageCount: processed > 0 ? processed : pages.length,
    lowConfidencePages,
    needsReview: meanConfidence < low || lowConfidencePages > 0 || text.length === 0,
    truncated,
  };
}

/** POST vers l'API Mistral OCR avec réessais bornés (429/5xx/réseau) et délai d'attente. */
async function postOcr(apiKey: string, body: string): Promise<unknown> {
  const attempts = maxAttempts();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs());
    try {
      const res = await fetch(ocrUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
        signal: controller.signal,
      });
      if (res.ok) return (await res.json()) as unknown;
      const detail = await res.text().catch(() => "");
      const err = new Error(`Mistral OCR ${res.status} : ${detail.slice(0, 300)}`);
      // 4xx (hors 429) = erreur de requête → échec immédiat, inutile de réessayer.
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err; // 429 / 5xx → transitoire, on réessaie
    } catch (err) {
      // Erreur HTTP 4xx déjà formatée → propager sans réessai ; le reste (réseau/timeout/429/5xx) → réessai.
      if (err instanceof Error && /^Mistral OCR 4\d\d/.test(err.message) && !/^Mistral OCR 429/.test(err.message)) throw err;
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts) await sleep(backoffMs(attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Mistral OCR : échec après plusieurs tentatives.");
}

/**
 * Océrise UN document (PDF ou image) via Mistral OCR. Renvoie un `OcrResult` (contrat commun).
 * Lève si la clé est absente, l'extension non supportée, ou l'API en échec après réessais.
 */
export async function mistralOcrDocument(input: { ext: string; buffer: Buffer; langs?: string[]; maxPages?: number }): Promise<OcrResult> {
  const apiKey = (process.env.MISTRAL_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY absente — Mistral OCR indisponible.");
  const ext = input.ext.toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`Mistral OCR non supporté pour « ${ext} ».`);

  const langs = input.langs && input.langs.length > 0 ? input.langs.join("+") : "auto";
  const maxPages = input.maxPages ?? defaultMaxPages();
  const model = ocrModel();
  const dataUrl = `data:${mime};base64,${input.buffer.toString("base64")}`;
  // PDF → document_url ; image → image_url (le data-URL embarque le contenu, aucun upload séparé).
  const document = ext === "pdf" ? { type: "document_url", document_url: dataUrl } : { type: "image_url", image_url: dataUrl };
  const body = JSON.stringify({ model, document, include_image_base64: false });

  const json = await postOcr(apiKey, body);
  return parseMistralOcr(json, { langs, maxPages, model });
}
