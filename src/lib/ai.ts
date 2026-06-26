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

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
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
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: `Erreur IA (HTTP ${res.status}).` };
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
        max_tokens: opts.maxTokens ?? 1400,
        temperature: opts.temperature ?? 0.2,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic tools error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: `Erreur IA (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { content?: ClaudeContentBlock[]; stop_reason?: string };
    return { ok: true, configured: true, stopReason: data.stop_reason, content: data.content ?? [] };
  } catch (err) {
    console.error("[ai] tools call failed", err);
    return { ok: false, configured: true, error: "Appel à l'IA impossible (réseau)." };
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

/** Transcrit un audio en texte via l'API OpenAI Whisper (français). Serveur uniquement. */
export async function transcribeAudio(buffer: Buffer, filename: string, mime: string): Promise<TranscriptionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé OPENAI_API_KEY non configurée." };
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.STT_MODEL ?? "whisper-1";
  try {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mime || "audio/webm" }), filename || "audio.webm");
    form.append("model", model);
    form.append("language", "fr");
    const res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] whisper error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: `Erreur transcription (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { text?: string };
    return { ok: true, configured: true, text: (data.text ?? "").trim() };
  } catch (err) {
    console.error("[ai] whisper call failed", err);
    return { ok: false, configured: true, error: "Transcription impossible (réseau)." };
  }
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
  const r = await askClaude(`Transcription :\n"""${transcript.slice(0, 8000)}"""\n\nRenvoie le JSON structuré.`, {
    system: FIELD_REPORT_SYSTEM,
    maxTokens: 1024,
    temperature: 0.1,
  });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Analyse impossible." };
  const data = extractJson(r.text);
  if (!data) return { ok: false, configured: true, error: "Réponse IA non exploitable." };
  return { ok: true, configured: true, data };
}
