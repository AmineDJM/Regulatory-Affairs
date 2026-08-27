import {
  type ModelCallOptions,
  type ModelReply,
  type ModelRole,
  type ModelTurn,
  textOf,
} from "./contract";
import { bindingFor } from "./registry";
import { callOpenAi, streamOpenAi } from "./openai";
import { callOpenAiResponses, streamOpenAiResponses } from "./openai-responses";
import { protocolFor, protocolViolation } from "./protocol";
import { callAnthropic, streamAnthropic } from "./anthropic";
import { recordModelCall } from "./telemetry";
import { emptyUsage } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PASSERELLE — le SEUL endroit d'Adam qui parle à un fournisseur de modèle.
 *
 * Trois choses, et rien d'autre :
 *   1. résoudre le RÔLE en liaison concrète (quel modèle, chez qui, avec quel effort) ;
 *   2. router vers l'adaptateur correspondant ;
 *   3. consigner l'usage — automatiquement, pour qu'aucun appel ne puisse échapper au compteur.
 *
 * Le point 3 est la raison pour laquelle la passerelle existe plutôt que d'appeler les
 * adaptateurs directement : une mesure qu'on peut oublier de faire finit par ne mesurer qu'une
 * partie, et un chiffre partiel présenté comme un total est pire que pas de chiffre.
 *
 * ── CE QUE CETTE COUCHE NE FAIT PAS ──────────────────────────────────────────────────────
 *
 * Elle ne décide pas QUOI faire, ne boucle pas sur les outils, n'exécute aucune action métier.
 * Elle transporte. La boucle d'agent est au-dessus ; l'exécution réelle est ailleurs encore, et
 * c'est du code — pas un modèle.
 *
 * ── LE QUATRIÈME TRAVAIL, AJOUTÉ APRÈS UN HTTP 400 EN PRODUCTION ─────────────────────────
 *
 * 4. choisir le PROTOCOLE — par quelle porte OpenAI on parle.
 *
 * Il est ici pour la même raison que le point 3 : c'est le seul passage obligé. Tant que
 * l'adaptateur était unique, la question ne se posait pas et ne se testait donc pas. Terra qui
 * raisonne et qui outille n'existe pas sur `/v1/chat/completions` ; l'apprendre par un 400 chez
 * l'utilisateur est le symptôme d'une décision que personne ne prenait.
 *
 * La règle vit dans `protocol.ts`, isolée et vérifiable sans réseau. La passerelle l'applique et
 * REFUSE un appel qui la violerait, plutôt que de l'envoyer voir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * L'appel refusé AVANT le réseau. Rendu sous forme de `ModelReply` et non levé : la boucle
 * d'agent sait déjà lire un `ok: false`, elle ne sait pas rattraper une exception sans perdre
 * l'usage déjà consommé.
 */
function refus(binding: ReturnType<typeof bindingFor>, motif: string): ModelReply {
  console.error(`[models] appel refusé — ${motif}`);
  return {
    ok: false,
    configured: true,
    stop: "error",
    blocks: [],
    usage: emptyUsage(binding.role, binding.model, binding.provider),
    error: `Protocole incompatible : ${motif}`,
  };
}

export async function callModel(
  role: ModelRole,
  turns: ModelTurn[],
  opts: ModelCallOptions = {},
): Promise<ModelReply> {
  const binding = bindingFor(role);

  if (binding.provider === "anthropic") {
    const reply = await callAnthropic(binding, turns, opts);
    recordModelCall(reply.usage);
    return reply;
  }

  const protocol = protocolFor(binding, opts);
  const violation = protocolViolation(binding, opts, protocol);
  if (violation) return refus(binding, violation);

  const reply =
    protocol === "responses"
      ? await callOpenAiResponses(binding, turns, opts)
      : await callOpenAi(binding, turns, opts);
  recordModelCall(reply.usage);
  return reply;
}

export async function streamModel(
  role: ModelRole,
  turns: ModelTurn[],
  opts: ModelCallOptions,
  onText: (chunk: string) => void,
): Promise<ModelReply> {
  const binding = bindingFor(role);

  if (binding.provider === "anthropic") {
    const reply = await streamAnthropic(binding, turns, opts, onText);
    recordModelCall(reply.usage);
    return reply;
  }

  const protocol = protocolFor(binding, opts);
  const violation = protocolViolation(binding, opts, protocol);
  if (violation) return refus(binding, violation);

  const reply =
    protocol === "responses"
      ? await streamOpenAiResponses(binding, turns, opts, onText)
      : await streamOpenAi(binding, turns, opts, onText);
  recordModelCall(reply.usage);
  return reply;
}

/**
 * UNE QUESTION, UNE RÉPONSE EN TEXTE. La forme la plus courante — extraction, classification,
 * petit résumé — et celle qu'on veut voir partir sur `worker` ou `bulk`, pas sur l'orchestrateur.
 *
 * Rend `null` en cas d'échec plutôt qu'une chaîne vide : une chaîne vide est une réponse valide
 * pour certaines extractions, et les confondre fait passer une panne pour un résultat.
 */
export async function askModel(
  role: ModelRole,
  prompt: string,
  opts: Omit<ModelCallOptions, "tools"> = {},
): Promise<{ text: string | null; reply: ModelReply }> {
  const reply = await callModel(role, [{ role: "user", content: prompt }], opts);
  return { text: reply.ok ? textOf(reply.blocks) : null, reply };
}

/**
 * UNE RÉPONSE JSON CONFORME À UN SCHÉMA. Le schéma est imposé au fournisseur, donc la conformité
 * est garantie par l'API — pas par la bonne volonté du modèle, ni par un `JSON.parse` optimiste
 * suivi d'un `catch` qui avale l'erreur.
 */
export async function askModelJson<T>(
  role: ModelRole,
  prompt: string,
  schema: { name: string; schema: Record<string, unknown> },
  opts: Omit<ModelCallOptions, "tools" | "jsonSchema"> = {},
): Promise<{ data: T | null; reply: ModelReply }> {
  const reply = await callModel(role, [{ role: "user", content: prompt }], { ...opts, jsonSchema: schema });
  if (!reply.ok) return { data: null, reply };
  const raw = textOf(reply.blocks);
  if (!raw) return { data: null, reply };
  try {
    return { data: JSON.parse(raw) as T, reply };
  } catch {
    return { data: null, reply };
  }
}

export { bindingFor, allBindings, roleConfigured, activeProvider } from "./registry";
export { protocolFor, protocolViolation, needsResponses, isReasoningModel } from "./protocol";
export type { WireProtocol } from "./protocol";
export type {
  ModelBlock,
  ModelCallOptions,
  ModelReply,
  ModelRole,
  ModelToolDef,
  ModelTurn,
  ModelUsage,
  ReasoningEffort,
} from "./contract";
export { textOf, toolCallsOf } from "./contract";
