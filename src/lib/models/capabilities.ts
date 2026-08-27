/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DES CAPACITÉS — ce que chaque modèle accepte, SU AVANT LE RÉSEAU.
 *
 * ── LES DEUX 400 QUI ONT PAYÉ CE FICHIER ─────────────────────────────────────────────────
 *
 *   1. « Function tools with reasoning_effort are not supported for gpt-5.6-terra in
 *        /v1/chat/completions. »
 *   2. « Unsupported parameter: 'temperature' is not supported with this model. »
 *
 * Deux corrections séparées auraient suivi. Elles auraient été suivies d'une troisième, puis
 * d'une quatrième — parce que la méthode était la même à chaque fois : assembler un objet
 * générique, l'envoyer, et laisser OpenAI nous dire ce qu'il refuse. Une architecture qui
 * apprend ses contraintes par les pannes de production n'apprend jamais assez vite.
 *
 * ── LE RENVERSEMENT : LISTE BLANCHE, PAS LISTE NOIRE ─────────────────────────────────────
 *
 * `parameters` n'énumère pas ce qui est interdit : il énumère ce qui est PERMIS. Tout ce qui
 * n'y figure pas explicitement n'est jamais construit, donc jamais envoyé, donc ne peut pas
 * être refusé.
 *
 * C'est ce qui rend l'incertitude SÛRE. La documentation d'OpenAI n'est pas joignable depuis cet
 * environnement (proxy d'egress) ; une liste noire écrite de mémoire aurait donc été un pari sur
 * ce dont on se souvient. Une liste blanche transforme le doute en simple abstention : au pire on
 * n'envoie pas un paramètre facultatif, jamais on n'en envoie un qui casse.
 *
 * ── GÉNÉRIQUE ≠ SUPPORTÉ, ET C'EST TOUT LE PIÈGE ─────────────────────────────────────────
 *
 * Le type Responses du SDK PORTE `temperature`. Ce n'est pas une preuve que Terra l'accepte :
 * l'endpoint est générique, le modèle ne l'est pas. La validation croise donc TROIS choses —
 * le protocole, le MODÈLE, et l'effort de raisonnement demandé — et jamais une seule.
 *
 * ── SOURCES, ET CE QU'ELLES VALENT ───────────────────────────────────────────────────────
 *
 *   • les deux HTTP 400 RÉELS ci-dessus — la preuve la plus forte, observée en production ;
 *   • la documentation officielle, lue par recherche (platform.openai.com et
 *     developers.openai.com sont bloqués en accès direct depuis cet environnement) :
 *     les modèles de raisonnement refusent `temperature`, `top_p`, `presence_penalty`,
 *     `frequency_penalty`, `logprobs`, `top_logprobs`, `logit_bias`, `max_tokens` ;
 *     GPT-5.6 accepte les efforts `none | low | medium | high | xhigh | max` ;
 *     `text.verbosity` (`low | medium | high`) n'existe QUE sur Responses ;
 *     `max_output_tokens` couvre AUSSI les jetons de raisonnement.
 *
 * Quand un 400 réel contredit ce fichier, c'est ce fichier qui a tort : il manque une contrainte,
 * et on l'ajoute ICI — jamais un `delete` de rattrapage dans un adaptateur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ReasoningEffort, Verbosity } from "./contract";

/** Les portes. Le temps réel a la sienne et ne partage aucun constructeur avec les deux autres. */
export type WireProtocol = "responses" | "chat_completions" | "realtime";

// Les deux vocabulaires viennent du CONTRAT — une seule définition, sinon les listes divergent
// et l'une des deux finit par autoriser ce que l'autre refuse.
export type { ReasoningEffort, Verbosity };

/**
 * TOUS LES PARAMÈTRES QUE NOTRE CONSTRUCTEUR SAIT ÉMETTRE.
 *
 * Cette liste est FERMÉE, et c'est ce qui donne sa force au garde-fou : ajouter un paramètre au
 * produit oblige à l'ajouter ici, donc à décider modèle par modèle s'il est permis. On ne peut
 * plus « glisser » un champ dans un payload sans que le registre en ait connaissance.
 */
export const PARAM_NAMES = [
  // — Les quatre qui ont cassé, ou qui casseraient —
  "temperature", "topP", "logprobs", "topLogprobs",
  // — Le socle Responses —
  "reasoning", "textVerbosity", "textFormat", "maxOutputTokens",
  "tools", "toolChoice", "parallelToolCalls",
  "store", "previousResponseId", "include", "stream",
  "serviceTier", "promptCacheKey", "safetyIdentifier", "metadata",
] as const;

export type ParamName = (typeof PARAM_NAMES)[number];

export interface ModelCapability {
  /** Par quelle(s) porte(s) ce modèle se parle. La première est la porte par défaut. */
  protocols: readonly WireProtocol[];
  /** Les efforts acceptés. `null` = ce modèle ne raisonne pas (le champ n'est jamais envoyé). */
  reasoning: readonly ReasoningEffort[] | null;
  functionCalling: boolean;
  structuredOutputs: boolean;
  parallelToolCalls: boolean;
  /** LISTE BLANCHE. Absent ou `false` = jamais construit, et refusé s'il arrive quand même. */
  parameters: Partial<Record<ParamName, boolean>>;
}

/**
 * LE SOCLE COMMUN AUX MODÈLES DE RAISONNEMENT GPT-5.6.
 *
 * Les quatre paramètres d'échantillonnage sont ABSENTS — pas mis à `false` par politesse :
 * absents. Un lecteur qui cherche `temperature` ici ne le trouve pas, et c'est le message.
 */
const RAISONNEMENT_5_6: Omit<ModelCapability, "reasoning"> = {
  protocols: ["responses"],
  functionCalling: true,
  structuredOutputs: true,
  parallelToolCalls: true,
  parameters: {
    reasoning: true,
    textVerbosity: true,
    textFormat: true,
    maxOutputTokens: true,
    tools: true,
    toolChoice: true,
    parallelToolCalls: true,
    store: true,
    previousResponseId: true,
    include: true,
    stream: true,
    serviceTier: true,
    promptCacheKey: true,
    safetyIdentifier: true,
    metadata: true,
  },
};

/** Les six efforts de GPT-5.6. */
const EFFORTS_5_6: readonly ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh", "max"];

/**
 * LA TABLE. Un modèle absent est traité par `capabilityFor` avec le repli le plus PRUDENT :
 * Responses, aucun paramètre facultatif. Un modèle inconnu doit pouvoir parler, pas tout tenter.
 */
export const MODEL_CAPABILITIES: Readonly<Record<string, ModelCapability>> = {
  "gpt-5.6-terra": { ...RAISONNEMENT_5_6, reasoning: EFFORTS_5_6 },
  "gpt-5.6-luna": { ...RAISONNEMENT_5_6, reasoning: EFFORTS_5_6 },

  /**
   * LE TEMPS RÉEL N'A RIEN À VOIR. Sa session se négocie, sa configuration passe par un
   * `session.update` sur le canal, et aucun des champs ci-dessus n'y a de sens. Il figure ici
   * pour UNE raison : qu'un test puisse vérifier qu'il ne traverse jamais le constructeur
   * Responses — l'oubli le plus facile à commettre le jour où l'on factorise « les modèles ».
   */
  "gpt-realtime-2.1": {
    protocols: ["realtime"],
    reasoning: null,
    functionCalling: true,
    structuredOutputs: false,
    parallelToolCalls: true,
    parameters: {},
  },
};

/**
 * LES FAMILLES, reconnues par préfixe — du plus précis au plus général.
 *
 * Un suffixe de date (`gpt-5.6-terra-2026-03-01`) ne doit pas faire perdre la fiche. Et la
 * famille large `gpt-5` attrape les versions à venir : le jour où l'on branche `gpt-5.7`, il
 * hérite des contraintes de raisonnement au lieu de tomber dans l'inconnu — où il aurait perdu
 * son `reasoning` EN SILENCE, ce qui est précisément la dégradation qu'on refuse.
 */
const FAMILLES: [string, () => ModelCapability][] = [
  ["gpt-5.6-terra", () => MODEL_CAPABILITIES["gpt-5.6-terra"]],
  ["gpt-5.6-luna", () => MODEL_CAPABILITIES["gpt-5.6-luna"]],
  ["gpt-realtime", () => MODEL_CAPABILITIES["gpt-realtime-2.1"]],
  ["gpt-5", () => MODEL_CAPABILITIES["gpt-5.6-terra"]],
  ["o1", () => MODEL_CAPABILITIES["gpt-5.6-terra"]],
  ["o3", () => MODEL_CAPABILITIES["gpt-5.6-terra"]],
  ["o4", () => MODEL_CAPABILITIES["gpt-5.6-terra"]],
];

/**
 * LE REPLI D'UN MODÈLE INCONNU — délibérément pauvre, et SANS RAISONNEMENT.
 *
 * `reasoning: null` ne dit pas « ce modèle est bête » : il dit « nous ne savons pas s'il
 * raisonne ». La conséquence est voulue — demander un effort à un modèle inconnu fait ÉCHOUER
 * la validation avec un message clair, au lieu d'envoyer un champ au hasard ou de le retirer en
 * douce. Un modèle qu'on branche sans l'avoir décrit doit se signaler, pas se débrouiller.
 *
 * Les familles ci-dessus couvrent les modèles OpenAI plausibles, suffixes de version compris ;
 * ce repli sert surtout à un identifiant d'un autre fournisseur qui arriverait ici par erreur.
 */
const INCONNU: ModelCapability = {
  protocols: ["responses"],
  reasoning: null,
  functionCalling: true,
  structuredOutputs: false,
  parallelToolCalls: true,
  parameters: { maxOutputTokens: true, tools: true, toolChoice: true, store: true, stream: true },
};

/** La fiche d'un modèle : exacte, puis par famille, puis le repli prudent. */
export function capabilityFor(model: string): ModelCapability {
  const m = (model ?? "").trim().toLowerCase();
  const exact = MODEL_CAPABILITIES[m];
  if (exact) return exact;
  for (const [prefixe, fiche] of FAMILLES) if (m.startsWith(prefixe)) return fiche();
  return INCONNU;
}

/** Ce modèle accepte-t-il ce paramètre ? La question se pose AVANT de le construire. */
export function supportsParam(model: string, param: ParamName): boolean {
  return capabilityFor(model).parameters[param] === true;
}

/** Ce modèle raisonne-t-il ? (`reasoning` non nul) */
export function isReasoningModel(model: string): boolean {
  return capabilityFor(model).reasoning !== null;
}

// ─────────────────────────── Le contrôle avant réseau ───────────────────────────

/** Ce qu'on s'apprête à demander, décrit dans NOS termes — pas encore dans ceux d'OpenAI. */
export interface ModelRequestShape {
  model: string;
  protocol: WireProtocol;
  reasoning?: ReasoningEffort;
  /** Les paramètres que l'appelant veut réellement voir partir. */
  params: Partial<Record<ParamName, unknown>>;
  toolCount?: number;
}

export interface RequestProblem {
  kind: "protocole" | "parametre" | "effort" | "capacite";
  param?: ParamName;
  message: string;
}

/**
 * LE CONTRÔLE LOCAL — il doit échouer ICI, pas chez OpenAI.
 *
 * Il ne « nettoie » rien : il REFUSE. Nettoyer en silence, c'est reproduire le défaut qu'on
 * vient de retirer (un `delete` discret qui dégrade la demande sans le dire). Le constructeur,
 * lui, ne fabrique jamais un champ interdit — si bien qu'en marche normale cette fonction ne
 * trouve rien. Elle existe pour le jour où quelqu'un contournera le constructeur.
 */
export function validateModelRequest(req: ModelRequestShape): RequestProblem[] {
  const cap = capabilityFor(req.model);
  const problemes: RequestProblem[] = [];

  if (!cap.protocols.includes(req.protocol)) {
    problemes.push({
      kind: "protocole",
      message: `${req.model} ne se parle pas via ${req.protocol} (attendu : ${cap.protocols.join(", ")}).`,
    });
  }

  if (req.reasoning !== undefined) {
    if (cap.reasoning === null) {
      problemes.push({ kind: "effort", message: `${req.model} ne prend pas de niveau de raisonnement.` });
    } else if (!cap.reasoning.includes(req.reasoning)) {
      problemes.push({
        kind: "effort",
        message: `reasoning.effort="${req.reasoning}" inconnu de ${req.model} (accepté : ${cap.reasoning.join(", ")}).`,
      });
    }
  }

  for (const [nom, valeur] of Object.entries(req.params) as [ParamName, unknown][]) {
    if (valeur === undefined || valeur === null) continue;
    if (cap.parameters[nom] === true) continue;
    problemes.push({
      kind: "parametre",
      param: nom,
      // Le message NOMME les trois termes de la décision : c'est ce qui rend le diagnostic
      // possible sans relire le code.
      message:
        `${nom} n'est pas supporté par ${req.model}`
        + `${req.reasoning ? ` avec reasoning=${req.reasoning}` : ""}`
        + ` sur ${req.protocol}. Voir src/lib/models/capabilities.ts.`,
    });
  }

  if ((req.toolCount ?? 0) > 0 && !cap.functionCalling) {
    problemes.push({ kind: "capacite", message: `${req.model} n'appelle pas d'outils.` });
  }

  return problemes;
}

/**
 * LE JOURNAL DE MISE AU POINT, expurgé.
 *
 * Ce qu'on veut voir d'un appel : le modèle, la porte, l'effort, COMBIEN d'outils — jamais leur
 * contenu —, et surtout le compte des paramètres douteux, qui doit valoir zéro. Aucun contenu
 * de conversation, aucun corps de document, aucune clé : un journal qui recopie ce qu'il
 * transporte finit par publier ce qu'on lui a confié.
 */
export function describeRequest(req: ModelRequestShape): Record<string, unknown> {
  const problemes = validateModelRequest(req);
  const p = req.params;
  return {
    model: req.model,
    endpoint: req.protocol === "responses" ? "/v1/responses" : req.protocol === "chat_completions" ? "/v1/chat/completions" : "realtime",
    reasoningEffort: req.reasoning ?? null,
    toolCount: req.toolCount ?? 0,
    toolChoice: p.toolChoice ?? null,
    parallelToolCalls: p.parallelToolCalls ?? null,
    textVerbosity: p.textVerbosity ?? null,
    maxOutputTokens: p.maxOutputTokens ?? null,
    store: p.store ?? null,
    stream: p.stream ?? null,
    serviceTier: p.serviceTier ?? null,
    unsupportedParameterCandidates: problemes.filter((x) => x.kind === "parametre").length,
  };
}
