import { callModel, streamModel } from "./gateway";
import { roleConfigured } from "./registry";
import type { ModelBlock, ModelRole, ModelToolDef, ModelTurn, ReasoningEffort } from "./contract";
// La passerelle reste SANS dépendance métier : cet import est local à `models/`,
// comme l'exige `models.test.ts` — c'est ce qui la garde portable.
import { timedPhase } from "./telemetry";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT — comment un fichier de 6 200 lignes change de cerveau sans être réécrit.
 *
 * ── LE PROBLÈME ──────────────────────────────────────────────────────────────────────────
 *
 * `src/lib/assistant.ts` porte la boucle d'agent, les définitions d'outils, la construction du
 * contexte, les propositions d'action et l'exécution. Il parle la forme Anthropic partout :
 * `tool_use`, `input`, `stop_reason`, `ClaudeMessage`. Réécrire ces 6 200 lignes pour changer de
 * fournisseur, c'est risquer la seule chose qui marche — l'exécution — pour un changement qui ne
 * concerne que le transport.
 *
 * ── CE QUE FAIT CE MODULE ────────────────────────────────────────────────────────────────
 *
 * Il expose EXACTEMENT les signatures que le monolithe appelle déjà (`callClaude`,
 * `callClaudeStream`) et les route vers la passerelle par RÔLE. Un seul import change dans
 * `assistant.ts` ; pas une ligne de sa logique.
 *
 * Le nom « Claude » est conservé ICI et nulle part ailleurs : c'est la mémoire de ce qui reste à
 * migrer. Le jour où la boucle d'agent parlera la forme neutre, ce fichier disparaît — et sa
 * disparition sera la preuve que la migration est finie.
 *
 * ── CE QUE CE PONT NE FAIT PAS ───────────────────────────────────────────────────────────
 *
 * Il ne choisit pas le rôle à la place de l'appelant, et surtout il ne « devine » pas : le
 * défaut est `orchestrator` parce que le monolithe sert la conversation. Une lecture mécanique
 * qui passerait par ici sans dire son rôle paierait donc le prix fort — c'est voulu, et c'est
 * visible dans la ventilation par rôle de la télémétrie.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// Les types tels que le monolithe les connaît. Ils restent la forme ANTHROPIC en surface.
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

export interface CompatOptions {
  system?: string;
  tools?: ClaudeToolDef[];
  maxTokens?: number;
  temperature?: number;
  /** Modèle imposé pour cet appel — échappatoire d'administration, pas la voie normale. */
  model?: string;
  timeoutMs?: number;
  /** Le rôle qui paie l'appel. Défaut : `orchestrator` (c'est la conversation). */
  role?: ModelRole;
  signal?: AbortSignal;
  /** L'effort de raisonnement de CET appel — sans lui, celui du rôle (registre / env). */
  reasoning?: ReasoningEffort;
  /** La clé de cache de prompt : les tours d'une même personne partagent leur préfixe. */
  promptCacheKey?: string;
  /** L'identifiant de sûreté (déjà condensé — jamais une identité en clair). */
  safetyIdentifier?: string;
}

const toTurns = (messages: ClaudeMessage[]): ModelTurn[] =>
  messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content
        : m.content.map((b): ModelBlock =>
            b.type === "text"
              ? { type: "text", text: b.text }
              : b.type === "tool_use"
                ? { type: "tool_call", id: b.id, name: b.name, args: b.input ?? {} }
                : { type: "tool_result", callId: b.tool_use_id, content: b.content, ...(b.is_error ? { isError: true } : {}) },
          ),
  }));

const toTools = (tools: ClaudeToolDef[] | undefined): ModelToolDef[] | undefined =>
  tools?.length ? tools.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) : undefined;

const toClaudeBlocks = (blocks: ModelBlock[]): ClaudeContentBlock[] =>
  blocks
    // Une IMAGE (§38) n'a pas de forme dans l'ancien contrat : elle entre au modèle, elle n'en sort jamais.
    .filter((b): b is Exclude<ModelBlock, { type: "image" }> => b.type !== "image")
    .map((b): ClaudeContentBlock =>
      b.type === "text"
        ? { type: "text", text: b.text }
        : b.type === "tool_call"
          ? { type: "tool_use", id: b.id, name: b.name, input: b.args }
          : { type: "tool_result", tool_use_id: b.callId, content: b.content, ...(b.isError ? { is_error: true } : {}) },
    );

/**
 * `stop: "tools"` → `stopReason: "tool_use"`.
 *
 * La boucle du monolithe teste littéralement `res.stopReason !== "tool_use"` pour décider si le
 * tour est fini. Rendre le mot neutre ici ferait sortir la boucle alors que des outils sont
 * demandés : Adam annoncerait une réponse sans avoir rien lu.
 */
const toStopReason = (stop: string): string | undefined => {
  switch (stop) {
    case "tools": return "tool_use";
    case "length": return "max_tokens";
    case "refusal": return "refusal";
    case "end": return "end_turn";
    default: return undefined;
  }
};

const options = (opts: CompatOptions) => ({
  system: opts.system,
  tools: toTools(opts.tools),
  maxOutputTokens: opts.maxTokens,
  temperature: opts.temperature,
  timeoutMs: opts.timeoutMs,
  modelOverride: opts.model,
  signal: opts.signal,
  ...(opts.reasoning ? { reasoning: opts.reasoning } : {}),
  ...(opts.promptCacheKey ? { promptCacheKey: opts.promptCacheKey } : {}),
  ...(opts.safetyIdentifier ? { safetyIdentifier: opts.safetyIdentifier } : {}),
});

export async function callClaude(messages: ClaudeMessage[], opts: CompatOptions = {}): Promise<ClaudeRawResult> {
  const reply = await timedPhase("modele", () => callModel(opts.role ?? "orchestrator", toTurns(messages), options(opts)));
  return {
    ok: reply.ok,
    configured: reply.configured,
    stopReason: toStopReason(reply.stop),
    content: toClaudeBlocks(reply.blocks),
    ...(reply.error ? { error: reply.error } : {}),
  };
}

export async function callClaudeStream(
  messages: ClaudeMessage[],
  onText: (chunk: string) => void,
  opts: CompatOptions = {},
): Promise<ClaudeRawResult> {
  /**
   * LE TEMPS PASSÉ DANS LE MODÈLE, COMPTÉ ICI ET NULLE PART AILLEURS.
   *
   * Instrumenter chaque appelant aurait laissé passer celui qu'on oublie — et c'est toujours
   * celui-là qui explique les six secondes. La passerelle est le seul point par lequel tout
   * appel passe : la phase « modele » y est donc exhaustive par construction. Ce qui reste
   * en dehors d'elle est, par soustraction, le temps que NOTRE code a consommé.
   */
  const reply = await timedPhase("modele", () => streamModel(opts.role ?? "orchestrator", toTurns(messages), options(opts), onText));
  return {
    ok: reply.ok,
    configured: reply.configured,
    stopReason: toStopReason(reply.stop),
    content: toClaudeBlocks(reply.blocks),
    ...(reply.error ? { error: reply.error } : {}),
  };
}

/**
 * ADAM PEUT-IL PENSER ? Remplace `aiConfigured()`, qui ne regardait que la clé Anthropic et
 * répondait donc « non » alors que le cerveau a changé de maison.
 */
export function assistantConfigured(): boolean {
  return roleConfigured("orchestrator");
}
