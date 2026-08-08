/**
 * Couche IA partagée (Anthropic / Claude) — **serveur uniquement**.
 *
 * La clé n'est jamais exposée au client : tous les appels passent par des routes
 * serveur ou des server actions qui importent ce module. Sans `ANTHROPIC_API_KEY`,
 * les fonctions renvoient `{ configured: false }` et l'UI affiche un état
 * « IA non configurée » plutôt que de planter — la clé se pose sur Render.
 *
 * Réutilisé par : Process Intelligence (synthèse), Rapports vocaux (analyse), Chatbot.
 */

export interface AiTextResult {
  ok: boolean;
  configured: boolean;
  text?: string;
  error?: string;
}

// Deux PALIERS de modèle pour maîtriser drastiquement le coût sans sacrifier la qualité là
// où elle compte réellement :
//  - PALIER QUALITÉ (raisonnement) : revue CTD exigeante (14 agents), simulateur d'examen,
//    réponse aux réserves, assistant conversationnel, cockpit Adventum Brain. Surchargable
//    par AI_MODEL.
//  - PALIER ÉCO : tâches MÉCANIQUES — extraction structurée, résumé, brouillon d'e-mail,
//    Q&R ANCRÉE sur des sources, nudge proactif. Modèle bon marché (≈ 3× moins cher en
//    entrée ET en sortie). Surchargable par AI_MODEL_CHEAP. Les garde-fous en aval (schéma
//    Zod, ancrage des preuves, citations RAG) rendent ces tâches sûres sur un petit modèle.
const QUALITY_MODEL = "claude-sonnet-4-6";
const CHEAP_MODEL = "claude-haiku-4-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * RAISON EXACTE d'un refus de l'API, au lieu d'un code nu.
 *
 * « Erreur IA (HTTP 400) » ne dit pas quoi corriger — ni à l'utilisateur, ni à celui qui
 * dépanne : un 400 peut être un texte trop long, un paramètre invalide, un contenu illisible.
 * L'API renvoie toujours la raison dans son corps ; on la remonte telle quelle.
 */
function apiErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; type?: string } };
    const msg = parsed.error?.message?.trim();
    if (msg) return `Erreur IA (HTTP ${status}) : ${msg.slice(0, 300)}`;
  } catch {
    /* corps non JSON — on retombe sur l'extrait brut ci-dessous */
  }
  const raw = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return raw ? `Erreur IA (HTTP ${status}) : ${raw}` : `Erreur IA (HTTP ${status}).`;
}

/**
 * ASSAINISSEMENT DU TEXTE ENVOYÉ AU MODÈLE — indispensable sur du texte EXTRAIT.
 *
 * Le contenu vient de PDF et d'OCR, pas d'un clavier : il contient régulièrement des demi-paires
 * de substituts UTF-16 (un `\uD800` sans son complément), des octets nuls et des caractères de
 * contrôle. `JSON.stringify` les recopie tels quels, le corps de la requête n'est alors pas de
 * l'UTF-8 valide, et l'API répond **400** — pour tout le dossier, alors que le fautif est un
 * caractère invisible dans une seule pièce. On les retire : ils ne portent aucun sens à analyser.
 */
export function sanitizeForModel(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "") // substitut haut orphelin
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") // substitut bas orphelin
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "); // nuls et contrôles (on garde \t \n \r)
}

/** Modèle du palier QUALITÉ (raisonnement) — revue CTD, simulateur, assistant, Brain. */
export function aiModel(): string {
  return process.env.AI_MODEL ?? QUALITY_MODEL;
}

/** Modèle du palier ÉCO (tâches mécaniques) — ~3× moins cher, largement suffisant ici. */
export function aiModelCheap(): string {
  return process.env.AI_MODEL_CHEAP ?? CHEAP_MODEL;
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface AnthropicBlock {
  type: string;
  text?: string;
}

/** Appel texte simple à Claude. Renvoie le texte concaténé des blocs de réponse. */
export async function askClaude(prompt: string, opts: AskOptions = {}): Promise<AiTextResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = opts.model ?? aiModel();
  // Prompt caching du bloc system STABLE : quand le même system est réutilisé dans la fenêtre
  // de cache (analyses en lot, tours successifs d'un chat de dossier, agents en série), le préfixe
  // est relu à ~0,1× de son coût. Sans réutilisation l'effet est neutre (préfixe court ignoré, ou
  // surcoût d'écriture négligeable). Même principe que callClaude côté assistant.
  const system = opts.system
    ? [{ type: "text" as const, text: opts.system, cache_control: { type: "ephemeral" as const } }]
    : undefined;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.3,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: sanitizeForModel(prompt) }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: apiErrorMessage(res.status, body) };
    }
    const data = (await res.json()) as { content?: AnthropicBlock[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    return { ok: true, configured: true, text };
  } catch (err) {
    console.error("[ai] call failed", err);
    return { ok: false, configured: true, error: "Appel à l'IA impossible (réseau)." };
  }
}

/**
 * Variante ÉCO de `askClaude` : identique, mais route sur le modèle bon marché par défaut
 * (tâches mécaniques : extraction, résumé, brouillon, Q&R ancrée). Un `opts.model` explicite
 * reste prioritaire (les tests injectent leur propre fonction, donc inchangés).
 */
export async function askClaudeCheap(prompt: string, opts: AskOptions = {}): Promise<AiTextResult> {
  return askClaude(prompt, { ...opts, model: opts.model ?? aiModelCheap() });
}

// ─────────────────────────── Sonde de santé (test quotidien du chatbot) ───────────────────────────

export interface AiHealthResult {
  ok: boolean;
  configured: boolean;
  model: string;
  latencyMs: number;
  status?: number; // code HTTP si une réponse a été reçue
  error?: string; // message EXACT (statut + message de l'API, ou erreur réseau)
}

/**
 * PING RÉEL de l'API IA (un `POST /v1/messages` minimal). Contrairement à `askClaude`,
 * renvoie le message d'erreur EXACT (statut HTTP + `error.message` de l'API, ou l'erreur
 * réseau) — pour que le Super Admin sache précisément quoi corriger (clé, crédit, réseau).
 */
export async function aiSelfTest(): Promise<AiHealthResult> {
  const model = aiModel();
  const key = process.env.ANTHROPIC_API_KEY;
  const started = Date.now();
  if (!key) {
    return { ok: false, configured: false, model, latencyMs: 0, error: "Clé ANTHROPIC_API_KEY absente : le chatbot et toutes les fonctions IA sont désactivés. Ajoutez la clé (Render → variables d'environnement)." };
  }
  const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }),
      signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Date.now() - started;
    if (res.ok) {
      await res.json().catch(() => null); // draine le corps
      return { ok: true, configured: true, model, latencyMs, status: res.status };
    }
    const raw = (await res.text().catch(() => "")).slice(0, 500);
    let detail = raw;
    try { detail = (JSON.parse(raw) as { error?: { message?: string } })?.error?.message ?? raw; } catch { /* corps non-JSON */ }
    return { ok: false, configured: true, model, latencyMs, status: res.status, error: `HTTP ${res.status} — ${detail || res.statusText}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, configured: true, model, latencyMs: Date.now() - started, error: `Échec réseau lors de l'appel à l'IA : ${msg}` };
  }
}

// ─────────────────────────── Tool-use (boucle agent — Chatbot) ───────────────────────────

export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeRawResult {
  ok: boolean;
  configured: boolean;
  stopReason?: string;
  content?: ClaudeContentBlock[];
  error?: string;
}

interface CallOptions {
  system?: string;
  tools?: ClaudeToolDef[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/**
 * Appel bas niveau à l'API Messages avec support des outils (function calling) et
 * d'un historique multi-tours. Utilisé par la boucle agent de l'assistant : on lui
 * passe la conversation + les définitions d'outils, il renvoie les blocs bruts
 * (texte et/ou `tool_use`) et le `stop_reason` pour piloter la boucle. Serveur uniquement.
 */
export async function callClaude(messages: ClaudeMessage[], opts: CallOptions = {}): Promise<ClaudeRawResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = opts.model ?? aiModel();
  // Prompt caching (GA) du préfixe STABLE system+outils. La boucle agent de
  // l'assistant rappelle l'API plusieurs fois avec le même system et les mêmes
  // outils ; en posant un point de cache `cache_control` sur le bloc system (qui,
  // dans l'ordre de rendu outils→system→messages, couvre AUSSI les outils), les
  // tours suivants — et les messages suivants dans la fenêtre de 5 min — relisent
  // ce préfixe à ~0,1× du coût et surtout bien plus vite (latence réduite).
  const system = opts.system
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : undefined;
  // Même assainissement que `askClaude` : les résultats d'outils rapportent du texte EXTRAIT de
  // documents, qui peut contenir des caractères invalides suffisants à faire refuser la requête.
  const cleanMessages: ClaudeMessage[] = messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? sanitizeForModel(m.content)
        : m.content.map((b) =>
            b.type === "text" ? { ...b, text: sanitizeForModel(b.text) }
            : b.type === "tool_result" ? { ...b, content: sanitizeForModel(b.content) }
            : b),
  }));
  const payload = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 1400,
    temperature: opts.temperature ?? 0.2,
    ...(system ? { system } : {}),
    ...(opts.tools?.length ? { tools: opts.tools } : {}),
    messages: cleanMessages,
  });

  // Jusqu'à 3 tentatives : on réessaie sur surcharge / limite de débit (429, 529,
  // 500/502/503) et sur timeout réseau, avec un léger backoff. Chaque appel est
  // borné par un timeout pour ne jamais bloquer la requête serveur indéfiniment.
  const MAX_ATTEMPTS = 3;
  let lastError = "Appel à l'IA impossible (réseau).";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { content?: ClaudeContentBlock[]; stop_reason?: string };
        return { ok: true, configured: true, stopReason: data.stop_reason, content: data.content ?? [] };
      }

      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic tools error", res.status, body.slice(0, 300));
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      lastError = apiErrorMessage(res.status, body);
      if (!retryable || attempt === MAX_ATTEMPTS) return { ok: false, configured: true, error: lastError };
    } catch (err) {
      console.error(`[ai] tools call failed (attempt ${attempt})`, err);
      lastError = "Appel à l'IA impossible (réseau ou délai dépassé).";
      if (attempt === MAX_ATTEMPTS) return { ok: false, configured: true, error: lastError };
    }
    await new Promise((r) => setTimeout(r, 600 * attempt)); // backoff léger
  }
  return { ok: false, configured: true, error: lastError };
}

/**
 * Variante STREAMING de `callClaude` : identique en entrée et en sortie, mais le texte est
 * remonté **au fil de l'eau** via `onText` au lieu d'attendre la fin de la génération.
 *
 * C'est ce qui fait la différence entre « rien pendant huit secondes puis un pavé » et une
 * réponse qui s'écrit sous les yeux. Le résultat final reste le même objet que `callClaude`
 * (blocs reconstitués + `stop_reason`), pour que la boucle agent n'ait rien à changer :
 * les `tool_use` sont réassemblés à partir des fragments JSON reçus.
 *
 * Pas de réessai automatique ici : une fois que du texte a commencé à s'afficher, on ne peut
 * pas le rejouer proprement. En cas d'échec AVANT le premier caractère, l'appelant peut
 * retomber sur `callClaude`.
 */
export async function callClaudeStream(
  messages: ClaudeMessage[],
  onText: (chunk: string) => void,
  opts: CallOptions = {},
): Promise<ClaudeRawResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const system = opts.system
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : undefined;
  const payload = JSON.stringify({
    model: opts.model ?? aiModel(),
    max_tokens: opts.maxTokens ?? 1400,
    temperature: opts.temperature ?? 0.2,
    stream: true,
    ...(system ? { system } : {}),
    ...(opts.tools?.length ? { tools: opts.tools } : {}),
    messages,
  });

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic stream error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: `Erreur IA (HTTP ${res.status}).` };
    }

    // Reconstitution des blocs : le texte arrive par fragments, l'entrée d'un outil aussi
    // (JSON partiel, à concaténer avant d'être analysé).
    const blocks: ClaudeContentBlock[] = [];
    const partialJson = new Map<number, string>();
    let stopReason: string | undefined;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Les événements SSE sont séparés par une ligne vide.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const line = raw.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let evt: Record<string, unknown>;
        try { evt = JSON.parse(line.slice(5).trim()) as Record<string, unknown>; } catch { continue; }

        const type = evt.type;
        const index = typeof evt.index === "number" ? evt.index : 0;

        if (type === "content_block_start") {
          const block = evt.content_block as ClaudeContentBlock | undefined;
          if (block) {
            blocks[index] = block.type === "text" ? { type: "text", text: "" } : block;
            if (block.type === "tool_use") partialJson.set(index, "");
          }
        } else if (type === "content_block_delta") {
          const delta = evt.delta as { type?: string; text?: string; partial_json?: string } | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            const b = blocks[index];
            if (b && b.type === "text") b.text += delta.text;
            onText(delta.text);
          } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
            partialJson.set(index, (partialJson.get(index) ?? "") + delta.partial_json);
          }
        } else if (type === "content_block_stop") {
          const b = blocks[index];
          const json = partialJson.get(index);
          if (b && b.type === "tool_use" && json !== undefined) {
            try { b.input = json ? (JSON.parse(json) as Record<string, unknown>) : {}; } catch { b.input = {}; }
          }
        } else if (type === "message_delta") {
          const d = evt.delta as { stop_reason?: string } | undefined;
          if (d?.stop_reason) stopReason = d.stop_reason;
        } else if (type === "error") {
          const e = evt.error as { message?: string } | undefined;
          return { ok: false, configured: true, error: e?.message ?? "Erreur IA pendant la génération." };
        }
      }
    }

    return { ok: true, configured: true, stopReason, content: blocks.filter(Boolean) };
  } catch (err) {
    console.error("[ai] stream call failed", err);
    return { ok: false, configured: true, error: "Appel à l'IA impossible (réseau ou délai dépassé)." };
  }
}

// ─────────────────────────── Speech-to-text (Whisper / OpenAI) ───────────────────────────

export function sttConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface TranscriptionResult {
  ok: boolean;
  configured: boolean;
  text?: string;
  error?: string;
}

/** Transcrit un audio en texte via l'API OpenAI Whisper (français). Serveur uniquement.
 *  Réessaie sur 429/5xx (limite de débit transitoire) ; message clair si quota dépassé. */
export async function transcribeAudio(buffer: Buffer, filename: string, mime: string): Promise<TranscriptionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé OPENAI_API_KEY non configurée." };
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.STT_MODEL ?? "whisper-1";

  const MAX_ATTEMPTS = 4;
  let lastError = "Transcription impossible (réseau).";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: mime || "audio/webm" }), filename || "audio.webm");
      form.append("model", model);
      form.append("language", "fr");
      const res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        return { ok: true, configured: true, text: (data.text ?? "").trim() };
      }
      const body = await res.text().catch(() => "");
      console.error("[ai] whisper error", res.status, body.slice(0, 400));
      if (res.status === 429) {
        // 429 = limite de débit OU quota/crédit épuisé. On réessaie les limites
        // transitoires ; sinon message explicite (la cause la plus fréquente est
        // l'absence de crédit/facturation sur le compte OpenAI).
        const quota = /quota|billing|insufficient/i.test(body);
        lastError = quota
          ? "Transcription indisponible : quota/crédit OpenAI épuisé. Ajoutez du crédit (ou activez la facturation) sur votre compte OpenAI, puis réessayez."
          : "Limite de débit OpenAI atteinte (trop de requêtes). Réessayez dans un instant.";
        if (quota || attempt === MAX_ATTEMPTS) return { ok: false, configured: true, error: lastError };
      } else if (res.status >= 500) {
        lastError = `Service de transcription momentanément indisponible (HTTP ${res.status}).`;
        if (attempt === MAX_ATTEMPTS) return { ok: false, configured: true, error: lastError };
      } else {
        return { ok: false, configured: true, error: `Erreur transcription (HTTP ${res.status}).` };
      }
    } catch (err) {
      console.error(`[ai] whisper call failed (attempt ${attempt})`, err);
      lastError = "Transcription impossible (réseau ou délai dépassé).";
      if (attempt === MAX_ATTEMPTS) return { ok: false, configured: true, error: lastError };
    }
    await new Promise((r) => setTimeout(r, 800 * attempt)); // backoff
  }
  return { ok: false, configured: true, error: lastError };
}

// ─────────────────────────── Analyse IA d'un rapport terrain ───────────────────────────

export interface FieldReportExtraction {
  doctorName?: string;
  institution?: string;
  specialty?: string;
  products?: string;
  interest?: string;
  objection?: string;
  medicalQuestion?: string;
  documentRequest?: string;
  sponsoringRequest?: string;
  careRequest?: string;
  competitorInfo?: string;
  opportunity?: string;
  qualitySignal?: string;
  nextAction?: string;
  summary?: string;
  aiNotes?: string;
}

const FIELD_REPORT_SYSTEM = `Tu structures un compte rendu de visite médicale pour un délégué d'Adventum Pharma
(laboratoire algérien), à partir d'une transcription orale en français. Tu renvoies UNIQUEMENT un objet
JSON valide (sans texte autour) avec ces clés (chaîne vide si absent) :
doctorName, institution, specialty, products, interest, objection, medicalQuestion, documentRequest,
sponsoringRequest, careRequest, competitorInfo, opportunity, qualitySignal, nextAction, summary, aiNotes.
RÈGLES : n'invente jamais un médecin, un produit ou un établissement absent de la transcription. Si une
information est incertaine, mets-la quand même mais ajoute-la à "aiNotes" préfixée par "à confirmer:".
"qualitySignal" = tout signalement qualité ou de pharmacovigilance (à confirmer systématiquement).
"summary" = compte rendu synthétique en 1-2 phrases.`;

export interface FieldAnalysisResult {
  ok: boolean;
  configured: boolean;
  data?: FieldReportExtraction;
  error?: string;
}

function extractJson(text: string): FieldReportExtraction | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as FieldReportExtraction;
  } catch {
    return null;
  }
}

/** Analyse une transcription en champs structurés (Claude). */
export async function analyzeFieldReport(transcript: string): Promise<FieldAnalysisResult> {
  if (!aiConfigured()) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };
  // Extraction structurée mécanique → palier ÉCO (schéma Zod + ancrage en aval = sûr).
  const r = await askClaudeCheap(`Transcription :\n"""${transcript.slice(0, 8000)}"""\n\nRenvoie le JSON structuré.`, {
    system: FIELD_REPORT_SYSTEM,
    maxTokens: 1024,
    temperature: 0.1,
  });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Analyse impossible." };
  const data = extractJson(r.text);
  if (!data) return { ok: false, configured: true, error: "Réponse IA non exploitable." };
  return { ok: true, configured: true, data };
}

// ───────────────────────── Compte rendu de réunion ─────────────────────────

const MEETING_SYSTEM = `Tu rédiges le COMPTE RENDU d'une réunion interne d'Adventum Pharma (laboratoire algérien,
devise DZD), à partir de sa transcription en français. Tu renvoies UNIQUEMENT un objet JSON valide (sans
texte autour) avec ces clés :
- "summary" : compte rendu clair et structuré en français (points clés, décisions, échéances), en quelques
  phrases ou puces séparées par des retours à la ligne. Reste factuel.
- "tasks" : tableau des actions à entreprendre déduites de la réunion. Chaque élément = un objet
  { "title": "...", "description": "...", "assignee": "..." }. "assignee" = nom de la personne désignée
  dans la réunion (chaîne vide si personne n'est nommé). 0 à 8 tâches, uniquement celles réellement évoquées.
RÈGLES : n'invente jamais une décision, un chiffre ou une personne absente de la transcription. Si rien
n'est exploitable, renvoie summary="" et tasks=[].`;

export interface MeetingTaskSuggestion {
  title: string;
  description?: string;
  assignee?: string;
}
export interface MeetingSummary {
  summary: string;
  tasks: MeetingTaskSuggestion[];
}
export interface MeetingSummaryResult {
  ok: boolean;
  configured: boolean;
  data?: MeetingSummary;
  error?: string;
}

/** Produit un compte rendu + des tâches proposées à partir d'une transcription de réunion. */
export async function summarizeMeetingTranscript(transcript: string): Promise<MeetingSummaryResult> {
  if (!aiConfigured()) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };
  const clean = transcript.trim();
  if (!clean) return { ok: false, configured: true, error: "Transcription vide." };
  // Résumé + tâches d'une réunion = tâche mécanique → palier ÉCO.
  const r = await askClaudeCheap(`Transcription de la réunion :\n"""${clean.slice(0, 12000)}"""\n\nRenvoie le JSON (summary + tasks).`, {
    system: MEETING_SYSTEM,
    maxTokens: 1500,
    temperature: 0.2,
  });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Compte rendu impossible." };
  const start = r.text.indexOf("{");
  const end = r.text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, configured: true, error: "Réponse IA non exploitable." };
  try {
    const parsed = JSON.parse(r.text.slice(start, end + 1)) as Partial<MeetingSummary>;
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t): t is MeetingTaskSuggestion => Boolean(t && typeof t.title === "string" && t.title.trim()))
          .slice(0, 8)
          .map((t) => ({ title: String(t.title).trim(), description: t.description ? String(t.description).trim() : undefined, assignee: t.assignee ? String(t.assignee).trim() : undefined }))
      : [];
    return { ok: true, configured: true, data: { summary: (parsed.summary ?? "").trim(), tasks } };
  } catch {
    return { ok: false, configured: true, error: "Réponse IA non exploitable." };
  }
}
