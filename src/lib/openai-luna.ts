/**
 * OPENAI GPT-5.6 LUNA — palier économique de l'analyseur CTD.
 *
 * Pourquoi ce modèle ici, au-delà du prix :
 *   • **multimodal** (texte + image) → on lui envoie les pages RASTÉRISÉES, ce que l'OCR
 *     réduisait à du texte. C'est ce qui permet enfin de lire une courbe de stabilité, un
 *     chromatogramme ou un schéma de procédé ;
 *   • **1 050 000 jetons de contexte** → beaucoup moins de découpage en parts, donc moins
 *     d'appels et moins de perte de contexte entre les parts ;
 *   • **sorties structurées par schéma JSON** → fini le « réponse IA non exploitable » ;
 *   • **0,20 $ / 1,20 $** par million de jetons, **×0,5 en Batch**.
 *
 * Claude reste le palier QUALITÉ (arbitrage des ambiguïtés, findings critiques, rédaction des
 * réponses aux réserves) : ce fichier ne le remplace pas, il travaille à côté.
 *
 * Serveur uniquement. Ne lève jamais : tout échec revient en résultat structuré.
 */

import { sanitizeForModel } from "./ai-text";

// Tarifs officiels (30 juillet 2026), en dollars par MILLION de jetons.
const PRICE_INPUT_PER_M = 0.2;
const PRICE_OUTPUT_PER_M = 1.2;
/** Le Batch (fenêtre 24 h) est facturé à moitié prix, en entrée comme en sortie. */
export const BATCH_MULTIPLIER = 0.5;

export const LUNA_MODEL = "gpt-5.6-luna";

export function lunaConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? "").trim());
}

/** Modèle économique effectif (surchargeable sans toucher au code). */
export function lunaModel(): string {
  return (process.env.CTD_MODEL_CHEAP ?? "").trim() || LUNA_MODEL;
}

/**
 * Coût d'un appel, en dollars. Les jetons mis en cache sont facturés par OpenAI à un tarif
 * réduit, mais on reste **volontairement conservateur** : mieux vaut annoncer un coût
 * légèrement supérieur au réel que de faire exploser un budget qu'on croyait tenu.
 */
export function lunaCostUsd(inputTokens: number, outputTokens: number, batch = false): number {
  const m = batch ? BATCH_MULTIPLIER : 1;
  const usd = ((inputTokens / 1_000_000) * PRICE_INPUT_PER_M + (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M) * m;
  return Math.round(usd * 1_000_000) / 1_000_000; // au millionième de dollar
}

/** Estimation de jetons quand l'API n'en renvoie pas (~4 caractères par jeton). */
export const estimateTokens = (text: string): number => Math.ceil((text ?? "").length / 4);

// ───────────────────────────── Appel unitaire ─────────────────────────────

export interface LunaImage {
  /** Données brutes de l'image (page rastérisée). */
  buffer: Buffer;
  mime?: string;
}

export interface LunaCallInput {
  system?: string;
  user: string;
  /** Pages rastérisées à faire LIRE au modèle (graphiques, schémas, tableaux scannés). */
  images?: LunaImage[];
  /** Schéma JSON attendu — la réponse est alors garantie conforme. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxOutputTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LunaUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}

export interface LunaResult<T = unknown> {
  ok: boolean;
  configured: boolean;
  /** Texte brut de la réponse. */
  text: string;
  /** Objet analysé quand un schéma JSON a été demandé. */
  data?: T;
  usage: LunaUsage;
  error?: string;
}

const EMPTY_USAGE: LunaUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 };

interface ChatMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/** Construit le corps d'un appel Chat Completions (texte + images + schéma JSON). */
export function buildLunaBody(input: LunaCallInput, batch = false): Record<string, unknown> {
  // ASSAINISSEMENT au point de passage UNIQUE de l'appel synchrone ET du Batch : aucune voie ne
  // peut l'oublier. Un caractère invalide hérité de l'OCR faisait refuser la requête (400) et,
  // avec elle, la revue de fond du dossier entier.
  const user = sanitizeForModel(input.user);
  const system = input.system ? sanitizeForModel(input.system) : undefined;
  const content: ChatMessageContent[] = [{ type: "text", text: user }];
  for (const img of input.images ?? []) {
    const mime = img.mime ?? "image/png";
    content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${img.buffer.toString("base64")}` } });
  }

  const messages: { role: string; content: string | ChatMessageContent[] }[] = [];
  if (system) messages.push({ role: "system", content: system });
  // Une seule partie texte et pas d'image → forme simple (payload plus léger).
  messages.push({ role: "user", content: content.length === 1 ? user : content });

  return {
    model: input.model ?? lunaModel(),
    messages,
    max_completion_tokens: input.maxOutputTokens ?? 2000,
    ...(input.temperature != null ? { temperature: input.temperature } : {}),
    ...(input.jsonSchema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: input.jsonSchema.name, schema: input.jsonSchema.schema, strict: true },
          },
        }
      : {}),
    ...(batch ? {} : { service_tier: "default" }),
  };
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/** Lit l'usage renvoyé par l'API et en déduit le coût. */
export function readUsage(raw: ChatResponse["usage"], fallbackIn: number, fallbackOut: number, batch = false): LunaUsage {
  const inputTokens = raw?.prompt_tokens ?? fallbackIn;
  const outputTokens = raw?.completion_tokens ?? fallbackOut;
  const cachedInputTokens = raw?.prompt_tokens_details?.cached_tokens ?? 0;
  return { inputTokens, outputTokens, cachedInputTokens, costUsd: lunaCostUsd(inputTokens, outputTokens, batch) };
}

/**
 * Le refus porte-t-il sur `temperature` ? (message d'erreur du fournisseur, formulations variées)
 * Isolée et PURE pour être testable sans réseau : c'est la porte de sortie d'une panne totale.
 */
export function mentionsUnsupportedTemperature(body: string): boolean {
  const b = body.toLowerCase();
  if (!b.includes("temperature")) return false;
  return b.includes("unsupported") || b.includes("not supported") || b.includes("unrecognized")
    || b.includes("does not support") || b.includes("invalid_request_error") || b.includes("unknown parameter");
}

/**
 * RAISON EXACTE d'un refus de l'API, au lieu d'un code nu.
 *
 * « Erreur IA (HTTP 400) » n'apprend rien : un 400 peut être un texte trop long, un schéma refusé,
 * un contenu illisible. Le corps de la réponse porte toujours la raison — on la remonte jusqu'à la
 * notification, pour qu'une panne se NOMME au lieu de se deviner.
 */
export function lunaErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } };
    const msg = parsed.error?.message?.trim();
    if (msg) return `Erreur IA (HTTP ${status}) : ${msg.slice(0, 300)}`;
  } catch {
    /* corps non JSON — extrait brut ci-dessous */
  }
  const raw = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return raw ? `Erreur IA (HTTP ${status}) : ${raw}` : `Erreur IA (HTTP ${status}).`;
}

/**
 * Appel synchrone. À réserver aux cas INTERACTIFS (l'utilisateur attend) ; pour l'analyse d'un
 * dossier entier, passer par le Batch — même travail, moitié prix.
 */
export async function callLuna<T = unknown>(input: LunaCallInput): Promise<LunaResult<T>> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return { ok: false, configured: false, text: "", usage: EMPTY_USAGE, error: "Clé OPENAI_API_KEY non configurée." };

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  const body = buildLunaBody(input);
  const approxIn = estimateTokens(`${input.system ?? ""}${input.user}`) + (input.images?.length ?? 0) * 800;

  // Jusqu'à 3 tentatives sur surcharge / limite de débit / réseau.
  let lastError = "Appel à l'IA impossible (réseau).";
  let droppedTemperature = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      if (res.ok) {
        const data = (await res.json()) as ChatResponse;
        const text = data.choices?.[0]?.message?.content ?? "";
        const usage = readUsage(data.usage, approxIn, estimateTokens(text));
        let parsed: T | undefined;
        if (input.jsonSchema && text) {
          try { parsed = JSON.parse(text) as T; } catch { /* le schéma strict rend ce cas très rare */ }
        }
        return { ok: true, configured: true, text, data: parsed, usage };
      }

      const raw = await res.text().catch(() => "");
      console.error("[luna] erreur API", res.status, raw.slice(0, 300));
      lastError = lunaErrorMessage(res.status, raw);

      // PARAMÈTRE REFUSÉ PAR LE MODÈLE → on le retire et on rejoue, une fois.
      //
      // Les modèles de raisonnement récents n'acceptent plus `temperature` : ils répondent 400
      // « Unsupported value », de façon DÉTERMINISTE. Envoyé à chaque part, ce paramètre faisait
      // donc échouer la revue de fond du dossier ENTIER — pas une part de temps en temps, TOUT,
      // à chaque tentative. Or la température n'est pas essentielle ici : les garde-fous en aval
      // (schéma de sortie, ancrage des preuves) ne dépendent pas d'elle. On la retire et on
      // continue, plutôt que de rendre un dossier non analysé.
      if (res.status === 400 && !droppedTemperature && mentionsUnsupportedTemperature(raw)) {
        droppedTemperature = true;
        delete (body as { temperature?: number }).temperature;
        console.warn("[luna] `temperature` refusée par le modèle — retirée, nouvelle tentative");
        continue;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === 3) return { ok: false, configured: true, text: "", usage: EMPTY_USAGE, error: lastError };
    } catch (err) {
      console.error(`[luna] appel échoué (tentative ${attempt})`, err);
      lastError = "Appel à l'IA impossible (réseau ou délai dépassé).";
      if (attempt === 3) return { ok: false, configured: true, text: "", usage: EMPTY_USAGE, error: lastError };
    }
    await new Promise((r) => setTimeout(r, 700 * attempt));
  }
  return { ok: false, configured: true, text: "", usage: EMPTY_USAGE, error: lastError };
}

// ───────────────────────────── Batch (moitié prix) ─────────────────────────────

export interface BatchRequest {
  /** Identifiant que l'on retrouvera dans le résultat (ex. `documentId:section`). */
  customId: string;
  input: LunaCallInput;
}

/**
 * Une ligne du fichier JSONL attendu par l'API Batch. Fonction PURE : c'est elle qui est
 * testée, sans réseau.
 */
export function buildBatchLine(req: BatchRequest): string {
  return JSON.stringify({
    custom_id: req.customId,
    method: "POST",
    url: "/v1/chat/completions",
    body: buildLunaBody(req.input, true),
  });
}

export function buildBatchJsonl(requests: BatchRequest[]): string {
  return requests.map(buildBatchLine).join("\n");
}

export interface BatchSubmitResult {
  ok: boolean;
  batchId?: string;
  error?: string;
}

/**
 * Dépose un lot et renvoie son identifiant. Le lot est traité sous 24 h à **moitié prix** —
 * c'est le mode normal d'analyse d'un dossier, qui n'a aucune raison d'être synchrone.
 */
export async function submitBatch(requests: BatchRequest[]): Promise<BatchSubmitResult> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "Clé OPENAI_API_KEY non configurée." };
  if (requests.length === 0) return { ok: false, error: "Lot vide." };

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  try {
    // 1) Téléverser le JSONL.
    const form = new FormData();
    form.set("purpose", "batch");
    form.set("file", new Blob([buildBatchJsonl(requests)], { type: "application/jsonl" }), "batch.jsonl");
    const up = await fetch(`${base}/v1/files`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!up.ok) return { ok: false, error: `Dépôt du lot refusé (HTTP ${up.status}).` };
    const file = (await up.json()) as { id?: string };
    if (!file.id) return { ok: false, error: "Dépôt du lot : identifiant de fichier manquant." };

    // 2) Créer le lot.
    const created = await fetch(`${base}/v1/batches`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ input_file_id: file.id, endpoint: "/v1/chat/completions", completion_window: "24h" }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!created.ok) return { ok: false, error: `Création du lot refusée (HTTP ${created.status}).` };
    const batch = (await created.json()) as { id?: string };
    return batch.id ? { ok: true, batchId: batch.id } : { ok: false, error: "Création du lot : identifiant manquant." };
  } catch (err) {
    console.error("[luna] dépôt de lot impossible", err);
    return { ok: false, error: "Dépôt du lot impossible (réseau)." };
  }
}

export interface BatchOutcome {
  customId: string;
  ok: boolean;
  text: string;
  usage: LunaUsage;
  error?: string;
}

/** Analyse le JSONL de résultats d'un lot. Fonction PURE — testée sans réseau. */
export function parseBatchOutput(jsonl: string): BatchOutcome[] {
  const out: BatchOutcome[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        custom_id?: string;
        response?: { status_code?: number; body?: ChatResponse };
        error?: { message?: string } | null;
      };
      const customId = row.custom_id ?? "";
      if (row.error) {
        out.push({ customId, ok: false, text: "", usage: EMPTY_USAGE, error: row.error.message ?? "Échec." });
        continue;
      }
      const body = row.response?.body;
      const text = body?.choices?.[0]?.message?.content ?? "";
      const okStatus = (row.response?.status_code ?? 200) < 400;
      out.push({
        customId, ok: okStatus && Boolean(text), text,
        usage: readUsage(body?.usage, 0, estimateTokens(text), true),
        ...(okStatus ? {} : { error: `HTTP ${row.response?.status_code}` }),
      });
    } catch {
      // Une ligne illisible ne doit pas faire perdre tout le lot.
    }
  }
  return out;
}

export interface BatchStatus {
  ok: boolean;
  status?: string; // validating | in_progress | finalizing | completed | failed | expired | cancelled
  outputFileId?: string | null;
  counts?: { total: number; completed: number; failed: number };
  error?: string;
}

export async function getBatchStatus(batchId: string): Promise<BatchStatus> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "Clé OPENAI_API_KEY non configurée." };
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/batches/${batchId}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, error: `Lecture du lot refusée (HTTP ${res.status}).` };
    const b = (await res.json()) as {
      status?: string; output_file_id?: string | null;
      request_counts?: { total?: number; completed?: number; failed?: number };
    };
    return {
      ok: true,
      status: b.status,
      outputFileId: b.output_file_id ?? null,
      counts: { total: b.request_counts?.total ?? 0, completed: b.request_counts?.completed ?? 0, failed: b.request_counts?.failed ?? 0 },
    };
  } catch (err) {
    console.error("[luna] lecture de lot impossible", err);
    return { ok: false, error: "Lecture du lot impossible (réseau)." };
  }
}

/** Récupère le JSONL de résultats d'un lot terminé. */
export async function fetchBatchOutput(outputFileId: string): Promise<string | null> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return null;
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/files/${outputFileId}/content`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(180_000),
    });
    return res.ok ? await res.text() : null;
  } catch (err) {
    console.error("[luna] récupération des résultats impossible", err);
    return null;
  }
}

// ───────────────────────────── Embeddings (recherche sémantique) ─────────────────────────────

/** Modèle d'embedding (surchargable). 512 dimensions suffisent et divisent le stockage par trois. */
export function lunaEmbedModel(): string {
  return (process.env.CTD_EMBED_MODEL ?? "").trim() || "text-embedding-3-small";
}
export const EMBED_DIMS = 512;

/**
 * Vectorise des textes pour la recherche SÉMANTIQUE — celle qui comprend qu'une « durée de
 * conservation » et une « shelf life » parlent de la même chose. C'est le chaînon qui manquait
 * au RAG : le corpus est largement en ANGLAIS (ICH, EMA) et les dossiers en FRANÇAIS — une
 * recherche lexicale ne les fera jamais se rencontrer.
 *
 * Ne lève jamais : sans clé ou en cas d'échec, `null` — l'appelant reste en lexical pur.
 */
export async function lunaEmbed(texts: string[], dims: number = EMBED_DIMS): Promise<number[][] | null> {
  if (!lunaConfigured() || texts.length === 0) return null;
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: lunaEmbedModel(), input: texts.map((t) => t.slice(0, 6000)), dimensions: dims }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    if (!Array.isArray(json.data) || json.data.length !== texts.length) return null;
    const out: number[][] = new Array(texts.length);
    for (const d of json.data) out[d.index] = d.embedding;
    return out;
  } catch {
    return null;
  }
}
