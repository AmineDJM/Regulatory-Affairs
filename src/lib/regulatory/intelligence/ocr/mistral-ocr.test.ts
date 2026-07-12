import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mistralOcrConfigured, mistralOcrEligible, parseMistralOcr, mistralOcrDocument, mistralOcrSelfTest } from "./mistral-ocr";

/**
 * Tests UNITAIRES du client Mistral OCR (aucun réseau, aucune base) : `fetch` est mocké.
 * On vérifie le gating par clé, le parsing de la réponse vers le contrat `OcrResult` commun,
 * la forme exacte de la requête (URL/auth/modèle/data-URL image vs PDF), et les réessais.
 */

const ENV_KEYS = [
  "MISTRAL_API_KEY",
  "REG_MISTRAL_OCR_URL",
  "REG_MISTRAL_OCR_MODEL",
  "REG_MISTRAL_OCR_ATTEMPTS",
  "REG_MISTRAL_OCR_BACKOFF_MS",
  "REG_MISTRAL_OCR_MAX_MB",
  "REG_OCR_MIN_CONFIDENCE",
] as const;

let saved: Record<string, string | undefined> = {};
const realFetch = global.fetch;

function mockFetch(...responses: Array<{ ok: boolean; status?: number; json?: unknown; text?: string }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json ?? {},
      text: async () => r.text ?? "",
    });
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

// Réponse Mistral OCR typique : 2 pages en markdown + compteur de pages traitées.
const SAMPLE = {
  pages: [
    { index: 0, markdown: "# Rapport de stabilité\n\nLot 001 — 25°C/60%HR" },
    { index: 1, markdown: "Résultats conformes aux spécifications." },
  ],
  usage_info: { pages_processed: 2 },
};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.REG_MISTRAL_OCR_BACKOFF_MS = "1"; // réessais quasi instantanés en test
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("mistralOcrConfigured — gating par clé", () => {
  it("faux sans clé, vrai avec clé non vide", () => {
    delete process.env.MISTRAL_API_KEY;
    expect(mistralOcrConfigured()).toBe(false);
    process.env.MISTRAL_API_KEY = "   ";
    expect(mistralOcrConfigured()).toBe(false); // espaces seuls → non configuré
    process.env.MISTRAL_API_KEY = "sk-abc";
    expect(mistralOcrConfigured()).toBe(true);
  });
});

describe("mistralOcrEligible — garde format + taille", () => {
  it("accepte une image sous la limite, refuse extension inconnue et document trop volumineux", () => {
    expect(mistralOcrEligible("png", Buffer.from("x"))).toBe(true);
    expect(mistralOcrEligible("pdf", Buffer.from("x"))).toBe(true);
    expect(mistralOcrEligible("zip", Buffer.from("x"))).toBe(false); // format non OCR-isable par Mistral
    process.env.REG_MISTRAL_OCR_MAX_MB = "1"; // plafond 1 Mo pour tester sans allouer 48 Mo
    expect(mistralOcrEligible("pdf", Buffer.alloc(2 * 1024 * 1024))).toBe(false); // 2 Mo > 1 Mo → hors limites
    expect(mistralOcrEligible("pdf", Buffer.alloc(512 * 1024))).toBe(true); // 0,5 Mo → OK
  });
});

describe("mistralOcrSelfTest — ping de diagnostic", () => {
  it("sans clé → non configuré (jamais d'exception)", async () => {
    delete process.env.MISTRAL_API_KEY;
    const d = await mistralOcrSelfTest();
    expect(d.configured).toBe(false);
    expect(d.ok).toBe(false);
  });

  it("avec clé + API OK → ping réussi", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    mockFetch({ ok: true, json: SAMPLE });
    const d = await mistralOcrSelfTest();
    expect(d.configured).toBe(true);
    expect(d.ok).toBe(true);
    expect(d.pagesProcessed).toBe(2);
  });
});

describe("parseMistralOcr — réponse → OcrResult", () => {
  it("assemble le texte, la confiance présumée et le nombre de pages", () => {
    const r = parseMistralOcr(SAMPLE, { langs: "auto", maxPages: 1000, model: "mistral-ocr-latest" });
    expect(r.method).toBe("ocr");
    expect(r.engine).toBe("mistral/mistral-ocr-latest");
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0].page).toBe(1); // index 0 → page 1
    expect(r.text).toContain("Rapport de stabilité");
    expect(r.text).toContain("Résultats conformes");
    expect(r.meanConfidence).toBe(95); // page non vide → confiance haute présumée
    expect(r.pageCount).toBe(2);
    expect(r.needsReview).toBe(false);
    expect(r.truncated).toBe(false);
  });

  it("page vide → revue humaine (confiance 0, needsReview)", () => {
    const r = parseMistralOcr({ pages: [{ index: 0, markdown: "   " }], usage_info: { pages_processed: 1 } }, { langs: "auto", maxPages: 1000, model: "m" });
    expect(r.pages[0].chars).toBe(0);
    expect(r.pages[0].lowConfidence).toBe(true);
    expect(r.lowConfidencePages).toBe(1);
    expect(r.needsReview).toBe(true);
    expect(r.text).toBe("");
  });

  it("tronque au-delà de maxPages et signale truncated", () => {
    const many = { pages: Array.from({ length: 5 }, (_, i) => ({ index: i, markdown: `Page ${i}` })), usage_info: { pages_processed: 5 } };
    const r = parseMistralOcr(many, { langs: "auto", maxPages: 2, model: "m" });
    expect(r.pages).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.pageCount).toBe(5); // total réel conservé
  });

  it("réponse vide/malformée → résultat vide, revue humaine (jamais de crash)", () => {
    const r = parseMistralOcr({}, { langs: "auto", maxPages: 1000, model: "m" });
    expect(r.pages).toHaveLength(0);
    expect(r.text).toBe("");
    expect(r.needsReview).toBe(true);
  });
});

describe("mistralOcrDocument — forme de la requête + résultat", () => {
  it("image → image_url + data-URL image, en-têtes et modèle corrects", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    const fetchMock = mockFetch({ ok: true, json: SAMPLE });
    const r = await mistralOcrDocument({ ext: "png", buffer: Buffer.from("hello") });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mistral.ai/v1/ocr");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("mistral-ocr-latest");
    expect(body.include_image_base64).toBe(false);
    expect(body.document.type).toBe("image_url");
    expect(body.document.image_url).toBe(`data:image/png;base64,${Buffer.from("hello").toString("base64")}`);
    expect(r.text).toContain("Rapport de stabilité");
  });

  it("PDF → document_url + data:application/pdf", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    const fetchMock = mockFetch({ ok: true, json: SAMPLE });
    await mistralOcrDocument({ ext: "pdf", buffer: Buffer.from("%PDF-1.4") });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.document.type).toBe("document_url");
    expect(body.document.document_url).toMatch(/^data:application\/pdf;base64,/);
  });

  it("sans clé → lève (le repli Tesseract est géré en amont)", async () => {
    delete process.env.MISTRAL_API_KEY;
    await expect(mistralOcrDocument({ ext: "png", buffer: Buffer.from("x") })).rejects.toThrow(/MISTRAL_API_KEY/);
  });

  it("extension non supportée → lève", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    await expect(mistralOcrDocument({ ext: "zip", buffer: Buffer.from("x") })).rejects.toThrow(/non supporté/);
  });

  it("429 puis 200 → réessaie et réussit", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    const fetchMock = mockFetch({ ok: false, status: 429, text: "rate limited" }, { ok: true, json: SAMPLE });
    const r = await mistralOcrDocument({ ext: "png", buffer: Buffer.from("x") });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.pageCount).toBe(2);
  });

  it("400 → échec immédiat sans réessai", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    const fetchMock = mockFetch({ ok: false, status: 400, text: "bad request" }, { ok: true, json: SAMPLE });
    await expect(mistralOcrDocument({ ext: "png", buffer: Buffer.from("x") })).rejects.toThrow(/Mistral OCR 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas de réessai sur 4xx
  });

  it("5xx persistant → lève après épuisement des tentatives", async () => {
    process.env.MISTRAL_API_KEY = "sk-test";
    process.env.REG_MISTRAL_OCR_ATTEMPTS = "3";
    const fetchMock = mockFetch(
      { ok: false, status: 503, text: "down" },
      { ok: false, status: 503, text: "down" },
      { ok: false, status: 503, text: "down" },
    );
    await expect(mistralOcrDocument({ ext: "png", buffer: Buffer.from("x") })).rejects.toThrow(/Mistral OCR 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
