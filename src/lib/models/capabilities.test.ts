import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MODEL_CAPABILITIES, PARAM_NAMES, capabilityFor, supportsParam, isReasoningModel,
  validateModelRequest, describeRequest, type ModelRequestShape, type ParamName,
} from "./capabilities";
import { buildResponsesBody, safetyIdentifierFor } from "./openai-responses";
import { buildBody as buildChatBody } from "./openai";
import { bindingFor, DEFAULT_VERBOSITY } from "./registry";
import { defaultProtocolOf } from "./protocol";
import type { ModelToolDef } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MATRICE DE COMPATIBILITÉ — ce que ces tests empêchent de revenir.
 *
 * ── DEUX HTTP 400, ET LA MÊME MÉTHODE DERRIÈRE LES DEUX ──────────────────────────────────
 *
 *   1. « Function tools with reasoning_effort are not supported for gpt-5.6-terra in
 *        /v1/chat/completions. »
 *   2. « Unsupported parameter: 'temperature' is not supported with this model. »
 *
 * Les corriger un par un aurait produit un troisième, puis un quatrième — parce que la méthode
 * était en cause, pas les champs : assembler un objet générique, l'envoyer, retirer ce qu'OpenAI
 * refuse. Ces tests vérifient donc la MÉTHODE, pas seulement les deux symptômes connus.
 *
 * ── CE QU'UN TEST NE PEUT PAS FAIRE ICI ──────────────────────────────────────────────────
 *
 * Il ne prouve pas qu'OpenAI accepte notre forme : aucune clé n'est disponible dans cet
 * environnement. Il prouve que nous n'envoyons JAMAIS ce que la fiche interdit — ce qui est la
 * moitié vérifiable, et la moitié qui a cassé. `scripts/smoke/openai-live.ts` couvre l'autre,
 * avec une vraie clé, hors CI.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const OUTIL = (name: string): ModelToolDef => ({
  name, description: `outil ${name}`, parameters: { type: "object", properties: {} },
});

/** Les quatre paramètres d'échantillonnage : ceux qui ne doivent JAMAIS partir. */
const ECHANTILLONNAGE = ["temperature", "top_p", "logprobs", "top_logprobs"];

const ENV = ["ADAM_REASONING_ORCHESTRATOR", "ADAM_MODEL_ORCHESTRATOR", "ADAM_OPENAI_PROTOCOL", "ADAM_SAFETY_SALT"];
let sauve: Record<string, string | undefined> = {};
beforeEach(() => {
  sauve = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV) { if (sauve[k] === undefined) delete process.env[k]; else process.env[k] = sauve[k]; }
});

// ─────────────────────────── Le registre lui-même ───────────────────────────

describe("le registre des capacités — une liste BLANCHE, pas une liste noire", () => {
  it("aucun modèle de raisonnement n'autorise un paramètre d'échantillonnage", () => {
    // LE CŒUR DU CHANTIER. Si cette assertion tombe un jour, c'est que quelqu'un a « réactivé »
    // temperature pour régler un style — le détournement même qui a produit le 400.
    for (const [nom, cap] of Object.entries(MODEL_CAPABILITIES)) {
      if (cap.reasoning === null) continue;
      for (const p of ["temperature", "topP", "logprobs", "topLogprobs"] as ParamName[]) {
        expect(cap.parameters[p], `${nom} autorise ${p}`).not.toBe(true);
      }
    }
  });

  it("la liste des paramètres connus est FERMÉE — on ne peut pas glisser un champ inconnu", () => {
    // C'est ce qui donne sa force au garde-fou : ajouter un champ au produit oblige à passer
    // par ici, donc à décider modèle par modèle s'il est permis.
    for (const cap of Object.values(MODEL_CAPABILITIES)) {
      for (const cle of Object.keys(cap.parameters)) {
        expect(PARAM_NAMES as readonly string[]).toContain(cle);
      }
    }
  });

  it("un modèle INCONNU ne se voit accorder aucun raisonnement — il doit se signaler", () => {
    // Le repli ne donne pas les permissions d'un autre modèle. Demander un effort à un modèle
    // qu'on n'a pas décrit ÉCHOUE clairement, au lieu de partir au hasard ou d'être retiré.
    expect(isReasoningModel("claude-sonnet-4-6")).toBe(false);
    expect(capabilityFor("un-modele-jamais-vu").reasoning).toBeNull();
  });

  it("les familles couvrent les suffixes de version — un déploiement ne perd pas la fiche", () => {
    expect(capabilityFor("gpt-5.6-terra-2026-03-01").reasoning).not.toBeNull();
    // Et la famille large attrape la version suivante : sans cela, `gpt-5.7` tomberait dans
    // l'inconnu et perdrait son raisonnement EN SILENCE.
    expect(isReasoningModel("gpt-5.7-quelque-chose")).toBe(true);
  });

  it("les six efforts de GPT-5.6 sont reconnus, et rien d'autre", () => {
    const efforts = capabilityFor("gpt-5.6-terra").reasoning;
    expect(efforts).toEqual(["none", "low", "medium", "high", "xhigh", "max"]);
  });

  it("le temps réel ne déclare QUE sa propre porte", () => {
    // C'est ce qui l'empêche structurellement de traverser le constructeur Responses.
    expect(capabilityFor("gpt-realtime-2.1").protocols).toEqual(["realtime"]);
    expect(defaultProtocolOf("gpt-realtime-2.1")).toBe("realtime");
    expect(supportsParam("gpt-realtime-2.1", "reasoning")).toBe(false);
    expect(supportsParam("gpt-realtime-2.1", "tools")).toBe(false);
  });
});

// ─────────────────────────── Terra medium — la configuration principale ───────────────────────────

describe("Terra medium — le payload attendu, et surtout ce qu'il ne contient PAS", () => {
  const CAS = [
    { nom: "sans aucun outil", tools: undefined },
    { nom: "avec un outil", tools: [OUTIL("a")] },
    { nom: "avec plusieurs outils", tools: [OUTIL("a"), OUTIL("b"), OUTIL("c")] },
  ];

  it.each(CAS)("$nom : reasoning.effort=medium et zéro paramètre d'échantillonnage", ({ tools }) => {
    const body = buildResponsesBody(
      bindingFor("orchestrator"),
      [{ role: "user", content: "x" }],
      { ...(tools ? { tools } : {}), verbosity: "low" },
    );

    expect(body.model).toBe("gpt-5.6-terra");
    expect(body.reasoning).toEqual({ effort: "medium" });
    for (const p of ECHANTILLONNAGE) expect(body[p], `${p} est parti`).toBeUndefined();
    // Les noms de l'ancienne porte non plus : ignorés en silence, ils feraient croire à un réglage.
    expect(body.messages).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.response_format).toBeUndefined();
  });

  it("avec des outils : tool_choice et parallel_tool_calls accompagnent la liste", () => {
    const body = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {
      tools: [OUTIL("a"), OUTIL("b")],
    });
    expect((body.tools as unknown[]).length).toBe(2);
    expect(body.tool_choice).toBe("auto");
    expect(body.parallel_tool_calls).toBe(true);
  });

  it("sans outil : ni tool_choice ni parallel_tool_calls — on n'envoie pas des réglages sans objet", () => {
    const body = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {});
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.parallel_tool_calls).toBeUndefined();
  });

  it("Structured Output : `text.format`, et JAMAIS `response_format`", () => {
    const body = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {
      jsonSchema: { name: "plan", schema: { type: "object" } },
      verbosity: "low",
    });
    const texte = body.text as { format?: { type?: string; name?: string; strict?: boolean }; verbosity?: string };
    expect(texte.format).toMatchObject({ type: "json_schema", name: "plan", strict: true });
    // `text.format` et `text.verbosity` partagent le même objet : les poser séparément faisait
    // perdre le premier. Les deux doivent survivre.
    expect(texte.verbosity).toBe("low");
    expect(body.response_format).toBeUndefined();
  });

  it("la concision remplace la température, et elle vient du RÔLE", () => {
    // On ne règle plus « fais court » avec un hasard réduit : on le demande.
    expect(DEFAULT_VERBOSITY.orchestrator).toBe("medium");
    expect(DEFAULT_VERBOSITY.worker).toBe("low");
    const body = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {
      verbosity: "medium",
    });
    expect((body.text as { verbosity?: string }).verbosity).toBe("medium");
  });

  it("le budget de sortie SUIT l'effort — il couvre aussi les jetons de raisonnement", () => {
    // Le piège : `max_output_tokens` inclut la réflexion. Un plafond calibré pour la seule
    // réponse est englouti par le raisonnement, et le modèle rend une réponse VIDE — pas une
    // réponse courte. 2000 convenait à un worker ; pas à un Terra medium.
    const medium = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {});
    const none = buildResponsesBody(bindingFor("worker"), [{ role: "user", content: "x" }], {});
    expect(medium.max_output_tokens).toBeGreaterThan(none.max_output_tokens as number);
    expect(medium.max_output_tokens).toBeGreaterThanOrEqual(8000);

    // …et l'appelant garde la main.
    const impose = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {
      maxOutputTokens: 1234,
    });
    expect(impose.max_output_tokens).toBe(1234);
  });

  it("`store` reste false tant que personne n'a demandé le chaînage", () => {
    const nu = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {});
    expect(nu.store).toBe(false);
    expect(nu.previous_response_id).toBeUndefined();
  });
});

// ─────────────────────────── Les workers ───────────────────────────

describe("les workers — même politique, sans exception", () => {
  it("Terra none : effort none, aucun échantillonnage", () => {
    const body = buildResponsesBody(bindingFor("worker"), [{ role: "user", content: "x" }], {});
    expect(body.model).toBe("gpt-5.6-terra");
    expect(body.reasoning).toEqual({ effort: "none" });
    for (const p of ECHANTILLONNAGE) expect(body[p]).toBeUndefined();
  });

  it("Luna none : effort none, aucun échantillonnage", () => {
    const body = buildResponsesBody(bindingFor("bulk"), [{ role: "user", content: "x" }], {});
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.reasoning).toEqual({ effort: "none" });
    for (const p of ECHANTILLONNAGE) expect(body[p]).toBeUndefined();
  });

  it("même en INSISTANT, `temperature` ne traverse pas le constructeur", () => {
    // L'appelant peut encore porter une température (le chemin Anthropic s'en sert). Le
    // constructeur Responses, lui, ne la fabrique pas — c'est la fiche qui tranche, pas l'envie
    // de l'appelant.
    const body = buildResponsesBody(
      bindingFor("orchestrator"),
      [{ role: "user", content: "x" }],
      { temperature: 0.2, tools: [OUTIL("a")] },
    );
    expect(body.temperature).toBeUndefined();
  });
});

// ─────────────────────────── Le contrôle local ───────────────────────────

describe("le sanitizer — la faute est dite ICI, pas par OpenAI", () => {
  const forme = (over: Partial<ModelRequestShape> = {}): ModelRequestShape => ({
    model: "gpt-5.6-terra", protocol: "responses", reasoning: "medium", params: {}, ...over,
  });

  it("Terra + medium + temperature est REFUSÉ localement, avec les trois termes nommés", () => {
    const pbs = validateModelRequest(forme({ params: { temperature: 0.2 } }));
    expect(pbs).toHaveLength(1);
    expect(pbs[0].kind).toBe("parametre");
    expect(pbs[0].param).toBe("temperature");
    // Le message doit permettre le diagnostic sans relire le code : modèle, effort, porte.
    expect(pbs[0].message).toContain("temperature");
    expect(pbs[0].message).toContain("gpt-5.6-terra");
    expect(pbs[0].message).toContain("reasoning=medium");
    expect(pbs[0].message).toContain("/v1/responses".slice(4)); // « responses »
  });

  it("top_p et les logprobs sont refusés au même titre", () => {
    for (const p of ["topP", "logprobs", "topLogprobs"] as ParamName[]) {
      const pbs = validateModelRequest(forme({ params: { [p]: 1 } }));
      expect(pbs.some((x) => x.param === p), `${p} accepté à tort`).toBe(true);
    }
  });

  it("un effort inconnu du modèle est refusé, et les valeurs admises sont listées", () => {
    const pbs = validateModelRequest(forme({ reasoning: "ultra" as never }));
    expect(pbs[0].kind).toBe("effort");
    expect(pbs[0].message).toContain("none, low, medium, high, xhigh, max");
  });

  it("Terra sur la mauvaise porte est refusé", () => {
    const pbs = validateModelRequest(forme({ protocol: "chat_completions" }));
    expect(pbs.some((x) => x.kind === "protocole")).toBe(true);
  });

  it("le temps réel passé au constructeur textuel est refusé", () => {
    // L'oubli le plus facile le jour où l'on « factorise les modèles ».
    const pbs = validateModelRequest(forme({ model: "gpt-realtime-2.1", protocol: "responses" }));
    expect(pbs.some((x) => x.kind === "protocole")).toBe(true);
  });

  it("une requête bien formée ne remonte AUCUN problème", () => {
    const pbs = validateModelRequest(forme({
      params: {
        reasoning: { effort: "medium" }, textVerbosity: "low", maxOutputTokens: 4000,
        tools: [OUTIL("a")], toolChoice: "auto", parallelToolCalls: true, store: false,
      },
    }));
    expect(pbs).toEqual([]);
  });
});

// ─────────────────────────── Le journal expurgé ───────────────────────────

describe("le journal de mise au point — la forme, jamais le contenu", () => {
  it("il rend la fiche de l'appel et compte ZÉRO paramètre douteux", () => {
    const d = describeRequest({
      model: "gpt-5.6-terra", protocol: "responses", reasoning: "medium", toolCount: 12,
      params: { textVerbosity: "low", maxOutputTokens: 4000, store: false, toolChoice: "auto", parallelToolCalls: true },
    });
    expect(d.model).toBe("gpt-5.6-terra");
    expect(d.endpoint).toBe("/v1/responses");
    expect(d.reasoningEffort).toBe("medium");
    expect(d.toolCount).toBe(12);
    expect(d.unsupportedParameterCandidates).toBe(0);
  });

  it("il compte ce qui cloche quand quelque chose cloche", () => {
    const d = describeRequest({
      model: "gpt-5.6-terra", protocol: "responses", reasoning: "medium",
      params: { temperature: 0.2, topP: 1 },
    });
    expect(d.unsupportedParameterCandidates).toBe(2);
  });

  it("aucun contenu de conversation ne figure dans la fiche", () => {
    // Un journal qui recopie ce qu'il transporte finit par publier ce qu'on lui a confié.
    const d = describeRequest({
      model: "gpt-5.6-terra", protocol: "responses", reasoning: "medium",
      params: { tools: [OUTIL("secret_business")] },
    });
    expect(JSON.stringify(d)).not.toContain("secret_business");
  });
});

// ─────────────────────────── L'identifiant de sûreté ───────────────────────────

describe("safety_identifier — stable, mais jamais l'identité", () => {
  it("le même utilisateur donne toujours le même jeton", () => {
    expect(safetyIdentifierFor("u-42")).toBe(safetyIdentifierFor("u-42"));
    expect(safetyIdentifierFor("u-42")).not.toBe(safetyIdentifierFor("u-43"));
  });

  it("l'identifiant d'origine n'apparaît nulle part dans le jeton", () => {
    // Ce champ sort de l'entreprise à chaque appel : y mettre une adresse e-mail exporterait
    // l'annuaire d'Adventum un tour de conversation à la fois.
    const jeton = safetyIdentifierFor("amine.djouamaii@example.invalid") ?? "";
    expect(jeton).not.toContain("amine");
    expect(jeton).not.toContain("@");
    expect(jeton).toMatch(/^[0-9a-f]{32}$/);
  });

  it("un sel d'installation change le jeton — un condensat nu se compare à un dictionnaire", () => {
    const sans = safetyIdentifierFor("u-42");
    process.env.ADAM_SAFETY_SALT = "sel-adventum";
    expect(safetyIdentifierFor("u-42")).not.toBe(sans);
  });

  it("un identifiant vide ne produit pas de jeton", () => {
    expect(safetyIdentifierFor("")).toBeUndefined();
    expect(safetyIdentifierFor("   ")).toBeUndefined();
  });
});

// ─────────────────────────── L'ancienne porte, ce qu'elle garde ───────────────────────────

describe("Chat Completions — ce qui y reste légitimement", () => {
  it("elle porte encore `temperature` : c'est son vocabulaire, pour les modèles qui l'acceptent", () => {
    // Ce constructeur n'est plus emprunté par Terra ni Luna (leur fiche ne déclare que
    // `responses`). Le laisser intact évite de casser un repli qui pourrait servir à un modèle
    // NON raisonnant — mais rien de ce qui raisonne ne peut plus l'atteindre.
    const body = buildChatBody(
      { ...bindingFor("orchestrator"), model: "un-modele-sans-raisonnement" },
      [{ role: "user", content: "x" }],
      { temperature: 0.2 },
    );
    expect(body.temperature).toBe(0.2);
    expect(body.messages).toBeDefined();
  });
});
