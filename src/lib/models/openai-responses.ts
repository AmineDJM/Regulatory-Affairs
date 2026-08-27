import { sanitizeForModel } from "@/lib/ai-text";
import { mentionsUnsupportedTemperature, providerErrorMessage, isRetryableStatus } from "./errors";
import { capTools } from "./openai";
import {
  type ModelBinding,
  type ModelBlock,
  type ModelCallOptions,
  type ModelReply,
  type ModelStop,
  type ModelTurn,
  costOf,
  emptyUsage,
} from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR RESPONSES — la porte par laquelle Terra et Luna parlent désormais.
 *
 * ── CE QUI CHANGE VRAIMENT PAR RAPPORT À CHAT COMPLETIONS ────────────────────────────────
 *
 * Changer l'URL n'aurait rien réglé : les deux API ne décrivent pas la même chose.
 *
 *   `messages`             → `input`, une SUITE D'ÉLÉMENTS et non une suite de messages. Un appel
 *                            d'outil et son résultat sont des éléments à part entière, plus des
 *                            messages déguisés (`role: "tool"`) portant un identifiant en douce.
 *   `system`               → `instructions`, au sommet de la requête.
 *   `tools[].function.*`   → `tools[].*` — la fonction n'est plus emboîtée d'un cran.
 *   `reasoning_effort: x`  → `reasoning: { effort: x }`.
 *   `max_completion_tokens`→ `max_output_tokens`.
 *   `choices[0].message`   → `output[]`, un TABLEAU d'éléments hétérogènes : du raisonnement, un
 *                            message, et zéro à N appels d'outils, chacun avec son `call_id`.
 *   `finish_reason`        → `status` + `incomplete_details.reason`.
 *
 * Le dernier point est celui qui compte pour la boucle d'agent : `output` porte NATURELLEMENT
 * plusieurs appels d'outils. Ils remontent tels quels, et la boucle les exécute déjà de front
 * (`Promise.all` dans `assistant.ts`) — la parallélisation ne demandait pas de code neuf, elle
 * demandait de ne pas perdre les appels en route.
 *
 * ── LE CHAÎNAGE `previous_response_id`, ET POURQUOI IL EST FERMÉ PAR DÉFAUT ──────────────
 *
 * Responses sait reprendre une réponse précédente par son identifiant — à condition qu'OpenAI
 * l'ait CONSERVÉE (`store: true`). C'est un vrai gain de jetons, et c'est aussi de la donnée
 * d'entreprise qui reste chez un tiers.
 *
 * Le défaut est donc `store: false` : on n'entrepose rien sans qu'on l'ait demandé. Le chaînage
 * s'active appel par appel (`previousResponseId`), et n'active la conservation que pour les
 * appels concernés. L'inverse — tout conserver au cas où — aurait marché aussi, et aurait fait
 * sortir l'historique complet de l'ERP sans que personne ait eu à le décider.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────── Les formes du fournisseur ───────────────────────────────

interface RespFunctionCall {
  type: "function_call";
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

interface RespMessage {
  type: "message";
  role?: string;
  content?: { type?: string; text?: string }[];
}

interface RespReasoning {
  type: "reasoning";
}

type RespOutputItem = RespFunctionCall | RespMessage | RespReasoning | { type: string };

interface RespUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
}

interface RespPayload {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  error?: { message?: string };
  output?: RespOutputItem[];
  usage?: RespUsage;
}

/** Un élément d'entrée. Trois formes, exactement celles dont une boucle d'agent a besoin. */
type RespInputItem =
  | { role: "user" | "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

// ─────────────────────────────── Entrée : neutre → Responses ───────────────────────────────

/**
 * LES TOURS NEUTRES → LES ÉLÉMENTS D'ENTRÉE.
 *
 * L'ORDRE EST LA CORRECTION, pas un détail de présentation. Un `function_call_output` qui
 * précéderait son `function_call` désigne un `call_id` que la conversation n'a pas encore vu :
 * le fournisseur refuse l'appel entier. C'est pourquoi les appels d'un tour assistant sont émis
 * AVANT le texte du tour suivant, et jamais regroupés en fin de liste.
 */
export function toResponsesInput(turns: ModelTurn[]): RespInputItem[] {
  const out: RespInputItem[] = [];

  for (const turn of turns) {
    if (typeof turn.content === "string") {
      const texte = sanitizeForModel(turn.content);
      if (texte) out.push({ role: turn.role, content: texte });
      continue;
    }

    const textes = turn.content.filter(
      (b): b is Extract<ModelBlock, { type: "text" }> => b.type === "text",
    );
    const appels = turn.content.filter(
      (b): b is Extract<ModelBlock, { type: "tool_call" }> => b.type === "tool_call",
    );
    const resultats = turn.content.filter(
      (b): b is Extract<ModelBlock, { type: "tool_result" }> => b.type === "tool_result",
    );

    if (turn.role === "assistant") {
      const texte = sanitizeForModel(textes.map((t) => t.text).join(""));
      if (texte) out.push({ role: "assistant", content: texte });
      for (const a of appels) {
        out.push({
          type: "function_call",
          call_id: a.id,
          name: a.name,
          arguments: JSON.stringify(a.args ?? {}),
        });
      }
      continue;
    }

    // Côté utilisateur : les résultats d'abord — ils répondent à ce qui précède — puis la parole.
    for (const r of resultats) {
      out.push({
        type: "function_call_output",
        call_id: r.callId,
        output: sanitizeForModel(r.isError ? `ERREUR : ${r.content}` : r.content),
      });
    }
    const texte = sanitizeForModel(textes.map((t) => t.text).join(""));
    if (texte) out.push({ role: "user", content: texte });
  }

  return out;
}

/**
 * LE CORPS DE LA REQUÊTE. Séparé de l'envoi pour être vérifiable sans réseau — c'est ce qui
 * permet de figer par un test la forme exacte qui a manqué en production.
 */
export function buildResponsesBody(
  binding: ModelBinding,
  turns: ModelTurn[],
  opts: ModelCallOptions,
): Record<string, unknown> {
  const reasoning = opts.reasoning ?? binding.reasoning;
  const chainage = Boolean(opts.previousResponseId);

  return {
    model: opts.modelOverride || binding.model,
    input: toResponsesInput(turns),
    ...(opts.system ? { instructions: sanitizeForModel(opts.system) } : {}),
    max_output_tokens: opts.maxOutputTokens ?? 2000,
    reasoning: { effort: reasoning },
    // Voir l'en-tête : on n'entrepose rien chez le fournisseur sans l'avoir demandé.
    store: chainage,
    ...(chainage ? { previous_response_id: opts.previousResponseId } : {}),
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.tools?.length
      ? {
          // La fonction n'est plus emboîtée : `{type, name, description, parameters}` à plat.
          tools: capTools(opts.tools).map((t) => ({
            type: "function",
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
          // Plusieurs outils indépendants dans une seule réponse — la boucle les exécute de front.
          parallel_tool_calls: true,
        }
      : {}),
    ...(opts.jsonSchema
      ? {
          text: {
            format: {
              type: "json_schema",
              name: opts.jsonSchema.name,
              schema: opts.jsonSchema.schema,
              strict: true,
            },
          },
        }
      : {}),
  };
}

// ─────────────────────────────── Sortie : Responses → neutre ───────────────────────────────

/**
 * ARGUMENTS D'UN APPEL D'OUTIL. Même règle que sur l'autre porte : le fournisseur rend une
 * chaîne, la boucle veut un objet, et un objet VIDE vaut mieux qu'un `null` qui plante trois
 * couches plus loin. Dupliqué depuis `openai.ts` plutôt qu'importé : les deux formats peuvent
 * diverger, et un correctif fait pour l'un ne doit pas s'appliquer à l'autre par surprise.
 */
function parseArgs(raw: string | undefined): Record<string, unknown> {
  const s = (raw ?? "").trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * `output[]` → LES BLOCS NEUTRES.
 *
 * Les éléments `reasoning` sont IGNORÉS volontairement : ils portent la réflexion interne, que
 * la boucle d'agent n'a pas à relire et qu'on ne veut surtout pas afficher. Ils comptent dans
 * les jetons de sortie, et c'est là — dans l'usage — qu'ils restent visibles.
 */
export function fromResponsesOutput(output: RespOutputItem[] | undefined): ModelBlock[] {
  const blocks: ModelBlock[] = [];
  let texte = "";

  for (const [i, item] of (output ?? []).entries()) {
    if (item.type === "message") {
      for (const part of (item as RespMessage).content ?? []) {
        if (part?.type === "output_text" && part.text) texte += part.text;
      }
      continue;
    }
    if (item.type === "function_call") {
      const call = item as RespFunctionCall;
      if (!call.name) continue;
      blocks.push({
        type: "tool_call",
        // `call_id` est celui qu'il faudra rendre ; `id` identifie l'élément. Confondre les deux
        // fait refuser le tour suivant, avec un message qui ne nomme pas la confusion.
        id: call.call_id || call.id || `call_${i}`,
        name: call.name,
        args: parseArgs(call.arguments),
      });
    }
  }

  // Le texte passe DEVANT : c'est ce que le modèle dit avant d'agir, et l'ordre est lu.
  return texte.trim() ? [{ type: "text", text: texte.trim() }, ...blocks] : blocks;
}

/** `status` + `incomplete_details` → la raison d'arrêt NEUTRE. */
export function stopOfResponse(payload: RespPayload, hasCalls: boolean): ModelStop {
  if (hasCalls) return "tools"; // fait foi, comme sur l'autre porte
  switch (payload.status) {
    case "completed":
      return "end";
    case "incomplete":
      return payload.incomplete_details?.reason === "content_filter" ? "refusal" : "length";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return payload.status ? "end" : "error";
  }
}

// ─────────────────────────────── L'appel ───────────────────────────────

function urlDe(): string {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  return `${base}/v1/responses`;
}

function sansCle(binding: ModelBinding): ModelReply {
  return {
    ok: false,
    configured: false,
    stop: "error",
    blocks: [],
    usage: emptyUsage(binding.role, binding.model, "openai"),
    error: "Clé OPENAI_API_KEY non configurée.",
  };
}

function usageDe(
  binding: ModelBinding,
  u: RespUsage | undefined,
  started: number,
  attempts: number,
): ModelReply["usage"] {
  const inputTokens = u?.input_tokens ?? 0;
  const outputTokens = u?.output_tokens ?? 0;
  return {
    role: binding.role,
    model: binding.model,
    provider: "openai",
    inputTokens,
    outputTokens,
    cachedInputTokens: u?.input_tokens_details?.cached_tokens ?? 0,
    costUsd: costOf(binding, inputTokens, outputTokens),
    ms: Date.now() - started,
    attempts,
  };
}

/**
 * UN APPEL. Ne lève jamais — même règle que l'autre adaptateur : une exception qui traverse une
 * boucle d'agent perd l'usage déjà consommé, donc le coût déjà payé.
 */
export async function callOpenAiResponses(
  binding: ModelBinding,
  turns: ModelTurn[],
  opts: ModelCallOptions = {},
): Promise<ModelReply> {
  const started = Date.now();
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return sansCle(binding);

  const body = buildResponsesBody(binding, turns, opts);

  let lastError = "Appel au modèle impossible (réseau).";
  let droppedTemperature = false;
  let grewBudget = false;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(urlDe(), {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 120_000),
      });

      if (res.ok) {
        const data = (await res.json()) as RespPayload;
        const blocks = fromResponsesOutput(data.output);

        // LE PIÈGE DE LA RÉPONSE VIDE, qui existe ici AUSSI et pour la même raison : le budget de
        // sortie couvre la réflexion interne. Un Terra medium peut donc consommer tout son budget
        // à réfléchir et ne rien dire. On rejoue UNE fois, budget triplé — au-delà, c'est le
        // budget de l'appelant qui est mal calibré, et le masquer ne l'aiderait pas.
        if (!blocks.length && data.status === "incomplete" && !grewBudget) {
          grewBudget = true;
          const courant = Number(body.max_output_tokens ?? 2000);
          body.max_output_tokens = courant * 3;
          console.warn(
            `[models] ${binding.role}/${binding.model} — réponse vide (${data.incomplete_details?.reason ?? "incomplete"}), `
            + `budget ${courant} → ${courant * 3}`,
          );
          continue;
        }

        if (data.status === "failed") {
          return {
            ok: false,
            configured: true,
            stop: "error",
            blocks: [],
            usage: usageDe(binding, data.usage, started, attempt),
            error: data.error?.message || "Le modèle a échoué sans message.",
          };
        }

        return {
          ok: true,
          configured: true,
          stop: stopOfResponse(data, blocks.some((b) => b.type === "tool_call")),
          blocks,
          usage: usageDe(binding, data.usage, started, attempt),
          ...(data.id ? { responseId: data.id } : {}),
        };
      }

      const raw = await res.text().catch(() => "");
      lastError = providerErrorMessage(res.status, raw);

      // Un modèle qui refuse `temperature` n'est pas une panne : on retire et on rejoue.
      //
      // IL N'Y A PAS D'ÉQUIVALENT POUR `reasoning`, ET C'EST DÉLIBÉRÉ. L'autre porte retirait
      // `reasoning_effort` dès qu'un 400 le mentionnait — ce qui, sur l'erreur même qui a
      // motivé cette migration, dégradait silencieusement un Terra medium en Terra par défaut.
      // Une réponse rendue avec moins de réflexion que demandée, sans que personne le sache,
      // est pire qu'une erreur : elle a l'air d'avoir marché.
      if (res.status === 400 && !droppedTemperature && mentionsUnsupportedTemperature(raw)) {
        droppedTemperature = true;
        delete body.temperature;
        continue;
      }

      console.error("[models] openai responses error", binding.role, binding.model, res.status, raw.slice(0, 300));
      if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS) break;
    } catch (err) {
      if (opts.signal?.aborted) {
        lastError = "Appel interrompu.";
        break;
      }
      console.error(`[models] openai responses failed (${binding.role}, tentative ${attempt})`, err);
      lastError = "Appel au modèle impossible (réseau ou délai dépassé).";
      if (attempt === MAX_ATTEMPTS) break;
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }

  return {
    ok: false,
    configured: true,
    stop: "error",
    blocks: [],
    usage: { ...emptyUsage(binding.role, binding.model, "openai"), ms: Date.now() - started },
    error: lastError,
  };
}

// ─────────────────────────────── Le flux ───────────────────────────────

/**
 * ACCUMULATEUR D'ÉVÉNEMENTS RESPONSES.
 *
 * Le flux ne rend pas des fragments de message : il rend des événements TYPÉS, chacun désignant
 * l'élément de sortie qu'il complète par son `output_index`. Un appel d'outil arrive donc en deux
 * temps — son identité (`output_item.added`), puis ses arguments par morceaux — et deux appels
 * concurrents s'entrelacent. Les regrouper par index est la seule façon de n'en perdre aucun.
 */
export class ResponsesStreamAssembler {
  private texte = "";
  private appels = new Map<number, { callId: string; name: string; args: string }>();
  statut: string | undefined;
  raison: string | undefined;
  responseId: string | undefined;

  /** Traite un événement. Rend le fragment de TEXTE à afficher, s'il y en a un. */
  push(evt: Record<string, unknown>): string {
    const type = String(evt.type ?? "");

    if (type === "response.output_text.delta") {
      const chunk = String(evt.delta ?? "");
      this.texte += chunk;
      return chunk;
    }

    if (type === "response.output_item.added") {
      const item = evt.item as RespFunctionCall | undefined;
      if (item?.type === "function_call") {
        const idx = Number(evt.output_index ?? 0);
        const acc = this.appels.get(idx) ?? { callId: "", name: "", args: "" };
        if (item.call_id) acc.callId = item.call_id;
        if (item.name) acc.name = item.name;
        if (item.arguments) acc.args = item.arguments;
        this.appels.set(idx, acc);
      }
      return "";
    }

    if (type === "response.function_call_arguments.delta") {
      const idx = Number(evt.output_index ?? 0);
      const acc = this.appels.get(idx) ?? { callId: "", name: "", args: "" };
      acc.args += String(evt.delta ?? "");
      this.appels.set(idx, acc);
      return "";
    }

    if (type === "response.function_call_arguments.done") {
      const idx = Number(evt.output_index ?? 0);
      const acc = this.appels.get(idx) ?? { callId: "", name: "", args: "" };
      // La forme complète fait foi sur l'accumulation : un fragment perdu ne se voit pas.
      if (typeof evt.arguments === "string") acc.args = evt.arguments;
      this.appels.set(idx, acc);
      return "";
    }

    if (type === "response.completed" || type === "response.incomplete" || type === "response.failed") {
      const payload = evt.response as RespPayload | undefined;
      this.statut = payload?.status ?? type.slice("response.".length);
      this.raison = payload?.incomplete_details?.reason;
      this.responseId = payload?.id;
    }

    return "";
  }

  blocks(): ModelBlock[] {
    const out: ModelBlock[] = [];
    if (this.texte.trim()) out.push({ type: "text", text: this.texte.trim() });
    for (const [idx, a] of [...this.appels.entries()].sort((x, y) => x[0] - y[0])) {
      if (!a.name) continue;
      out.push({ type: "tool_call", id: a.callId || `call_${idx}`, name: a.name, args: parseArgs(a.args) });
    }
    return out;
  }

  hasCalls(): boolean {
    return [...this.appels.values()].some((a) => a.name);
  }
}

/**
 * APPEL EN FLUX. Le texte remonte au fil de l'eau ; le résultat final a exactement la même forme
 * que `callOpenAiResponses`, pour que la boucle d'agent n'ait pas deux chemins à connaître.
 *
 * Aucun réessai, volontairement : une fois qu'un caractère s'est affiché, on ne peut pas rejouer.
 */
export async function streamOpenAiResponses(
  binding: ModelBinding,
  turns: ModelTurn[],
  opts: ModelCallOptions,
  onText: (chunk: string) => void,
): Promise<ModelReply> {
  const started = Date.now();
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) return sansCle(binding);

  const body = { ...buildResponsesBody(binding, turns, opts), stream: true };
  const asm = new ResponsesStreamAssembler();
  let usage: RespUsage | undefined;
  let sortieFinale: RespOutputItem[] | undefined;

  try {
    const res = await fetch(urlDe(), {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 180_000),
    });

    if (!res.ok || !res.body) {
      const raw = await res.text().catch(() => "");
      console.error("[models] openai responses stream error", binding.role, res.status, raw.slice(0, 300));
      return {
        ok: false,
        configured: true,
        stop: "error",
        blocks: [],
        usage: { ...emptyUsage(binding.role, binding.model, "openai"), ms: Date.now() - started },
        error: providerErrorMessage(res.status, raw),
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE. Les lignes `event:` sont ignorées : la charge utile porte déjà son propre `type`,
      // et se fier à un seul des deux évite qu'un désaccord entre eux passe inaperçu.
      let cut: number;
      while ((cut = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, cut).trim();
        buffer = buffer.slice(cut + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as Record<string, unknown>;
          const chunk = asm.push(evt);
          if (chunk) onText(chunk);
          const fin = evt.response as RespPayload | undefined;
          if (fin?.usage) usage = fin.usage;
          if (fin?.output?.length) sortieFinale = fin.output;
        } catch {
          /* fragment SSE illisible — on continue, le flux reste exploitable */
        }
      }
    }

    // LA SORTIE FINALE FAIT FOI QUAND ELLE ARRIVE. `response.completed` porte l'état complet ;
    // s'y fier ferme le cas où un fragment d'événement s'est perdu en route, et l'accumulateur
    // reste le filet quand l'événement final manque (flux coupé, proxy bavard).
    const blocks = sortieFinale ? fromResponsesOutput(sortieFinale) : asm.blocks();
    const hasCalls = blocks.some((b) => b.type === "tool_call");

    return {
      ok: asm.statut !== "failed",
      configured: true,
      stop: stopOfResponse({ status: asm.statut, incomplete_details: { reason: asm.raison } }, hasCalls),
      blocks,
      usage: usageDe(binding, usage, started, 1),
      ...(asm.responseId ? { responseId: asm.responseId } : {}),
    };
  } catch (err) {
    if (opts.signal?.aborted) {
      // Interruption VOULUE (barge-in vocal, client parti) : ce n'est pas une panne, et ce qui a
      // déjà été dit reste valable.
      return {
        ok: true,
        configured: true,
        stop: "end",
        blocks: asm.blocks(),
        usage: usageDe(binding, usage, started, 1),
      };
    }
    console.error("[models] openai responses stream failed", binding.role, err);
    return {
      ok: false,
      configured: true,
      stop: "error",
      blocks: [],
      usage: { ...emptyUsage(binding.role, binding.model, "openai"), ms: Date.now() - started },
      error: "Appel au modèle impossible (réseau ou délai dépassé).",
    };
  }
}
