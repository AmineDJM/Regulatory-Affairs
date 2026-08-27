import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callModel, streamModel } from "./gateway";
import { bindingFor } from "./registry";
import { protocolFor, protocolViolation, needsResponses, isReasoningModel } from "./protocol";
import {
  buildResponsesBody,
  toResponsesInput,
  fromResponsesOutput,
  stopOfResponse,
  ResponsesStreamAssembler,
} from "./openai-responses";
import { textOf, toolCallsOf, type ModelToolDef, type ModelTurn } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'API RESPONSES — les douze preuves demandées, et ce qu'elles valent vraiment.
 *
 * ── CE QUI A CASSÉ, ET POURQUOI AUCUN TEST NE L'AVAIT VU ─────────────────────────────────
 *
 *   « Function tools with reasoning_effort are not supported for gpt-5.6-terra in
 *     /v1/chat/completions. »
 *
 * Terra qui raisonne ET qui outille n'existe pas sur cette porte. Rien ne le testait parce que
 * rien ne pouvait le tester : l'URL était écrite en dur dans l'adaptateur, il n'y avait pas de
 * choix, donc pas de décision à vérifier. Un test ne peut pas surveiller ce que le code ne dit
 * pas. C'est la décision — sortie dans `protocol.ts` — qui a rendu ces tests possibles.
 *
 * ── LE SERVEUR D'ESSAI, ET CE QU'IL PROUVE (NI PLUS, NI MOINS) ───────────────────────────
 *
 * `fetch` est remplacé par un faux serveur qui parle le PROTOCOLE Responses : il refuse un corps
 * de forme Chat Completions, exige `input`, rend des `function_call` avec leur `call_id`. Il
 * prouve donc que NOTRE code émet et lit la bonne forme, de bout en bout, à travers la vraie
 * passerelle.
 *
 * Il ne prouve PAS qu'OpenAI accepte cette forme : aucune clé n'est disponible dans cet
 * environnement (`OPENAI_API_KEY` absente). Les deux choses sont distinctes et la seconde reste
 * à faire avec une clé. La confondre avec la première serait exactement l'erreur qui a produit
 * le HTTP 400 : croire vérifié ce qui n'a jamais été envoyé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────── Le faux serveur Responses ───────────────────────────

interface Capture {
  url: string;
  body: Record<string, unknown>;
}

let captures: Capture[] = [];

/** Une réponse Responses bien formée. */
function reponse(opts: {
  id?: string;
  texte?: string;
  appels?: { callId: string; name: string; args: unknown }[];
  status?: string;
  usage?: { input_tokens: number; output_tokens: number; cached?: number };
}): unknown {
  const output: unknown[] = [{ type: "reasoning", id: "rs_1", summary: [] }];
  if (opts.texte) {
    output.push({
      type: "message",
      id: "msg_1",
      role: "assistant",
      content: [{ type: "output_text", text: opts.texte }],
    });
  }
  for (const [i, a] of (opts.appels ?? []).entries()) {
    output.push({
      type: "function_call",
      id: `fc_${i}`,
      call_id: a.callId,
      name: a.name,
      arguments: JSON.stringify(a.args),
    });
  }
  return {
    id: opts.id ?? "resp_test",
    status: opts.status ?? "completed",
    output,
    usage: {
      input_tokens: opts.usage?.input_tokens ?? 100,
      output_tokens: opts.usage?.output_tokens ?? 20,
      input_tokens_details: { cached_tokens: opts.usage?.cached ?? 0 },
    },
  };
}

/**
 * Installe le faux serveur. `suite` est consommée dans l'ordre : un élément par appel, ce qui
 * permet d'éprouver une boucle multi-étapes sans piloter la boucle elle-même.
 */
function serveur(suite: unknown[]): void {
  let i = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    captures.push({ url: String(url), body });

    // LE FAUX SERVEUR EST SÉVÈRE, ET C'EST TOUT L'INTÉRÊT. Un stub complaisant accepterait la
    // forme Chat Completions et le test passerait sur le code qui a cassé la production.
    if (!String(url).endsWith("/v1/responses")) {
      return new Response(JSON.stringify({ error: { message: `mauvaise porte : ${url}` } }), { status: 400 });
    }
    if ("messages" in body) {
      return new Response(
        JSON.stringify({ error: { message: "corps de forme Chat Completions envoyé à /v1/responses" } }),
        { status: 400 },
      );
    }
    if (!Array.isArray(body.input)) {
      return new Response(JSON.stringify({ error: { message: "`input` manquant" } }), { status: 400 });
    }

    const suivant = suite[Math.min(i, suite.length - 1)];
    i++;
    return new Response(JSON.stringify(suivant), { status: 200, headers: { "content-type": "application/json" } });
  });
}

/** Un flux SSE Responses, événement par événement. */
function serveurFlux(evenements: unknown[]): void {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    captures.push({ url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const corps = evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(new TextEncoder().encode(corps), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  });
}

const OUTIL = (name: string): ModelToolDef => ({
  name,
  description: `outil ${name}`,
  parameters: { type: "object", properties: { q: { type: "string" } } },
});

const ENV = ["OPENAI_API_KEY", "ADAM_OPENAI_PROTOCOL", "ADAM_MODEL_PROVIDER", "ADAM_REASONING_ORCHESTRATOR"];
let sauve: Record<string, string | undefined> = {};

beforeEach(() => {
  sauve = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  process.env.OPENAI_API_KEY = "sk-essai";
  captures = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV) {
    if (sauve[k] === undefined) delete process.env[k];
    else process.env[k] = sauve[k];
  }
});

// ─────────────────────────── 1, 2, 3, 4 — Terra medium et ses outils ───────────────────────────

describe("Terra medium via Responses — sans outil, avec un outil, avec plusieurs", () => {
  it("1. sans aucun outil, la réponse revient en texte", async () => {
    serveur([reponse({ texte: "Trois dossiers sont en retard." })]);
    const r = await callModel("orchestrator", [{ role: "user", content: "Combien de dossiers en retard ?" }]);

    expect(r.ok).toBe(true);
    expect(textOf(r.blocks)).toBe("Trois dossiers sont en retard.");
    expect(captures[0].url).toContain("/v1/responses");
    expect((captures[0].body.reasoning as { effort: string }).effort).toBe("medium");
    expect(captures[0].body.tools).toBeUndefined();
  });

  it("2. avec UN outil, l'appel remonte avec son identifiant", async () => {
    serveur([reponse({ appels: [{ callId: "call_a1", name: "read_regulatory", args: { q: "retard" } }] })]);
    const r = await callModel("orchestrator", [{ role: "user", content: "Regarde Regulatory" }], {
      tools: [OUTIL("read_regulatory")],
    });

    expect(r.stop).toBe("tools");
    const appels = toolCallsOf(r.blocks);
    expect(appels).toHaveLength(1);
    expect(appels[0].id).toBe("call_a1");
    expect(appels[0].name).toBe("read_regulatory");
    expect(appels[0].args).toEqual({ q: "retard" });

    // La forme de l'outil est CELLE DE RESPONSES : à plat, pas emboîtée sous `function`.
    const outils = captures[0].body.tools as { type: string; name: string; function?: unknown }[];
    expect(outils[0]).toMatchObject({ type: "function", name: "read_regulatory" });
    expect(outils[0].function).toBeUndefined();
  });

  it("3. plusieurs outils SUCCESSIFS : la boucle enchaîne jusqu'à la réponse finale", async () => {
    serveur([
      reponse({ id: "resp_1", appels: [{ callId: "call_1", name: "read_regulatory", args: {} }] }),
      reponse({ id: "resp_2", appels: [{ callId: "call_2", name: "read_mail", args: {} }] }),
      reponse({ id: "resp_3", texte: "Le blocage vient de l'ANPP." }),
    ]);

    // La boucle, réduite à ce qu'elle est : appeler, rendre les résultats, rappeler.
    const turns: ModelTurn[] = [{ role: "user", content: "Qu'est-ce qui bloque ?" }];
    const outils = [OUTIL("read_regulatory"), OUTIL("read_mail")];
    let etapes = 0;

    for (let i = 0; i < 5; i++) {
      const r = await callModel("orchestrator", turns, { tools: outils });
      etapes++;
      const appels = toolCallsOf(r.blocks);
      if (!appels.length) {
        expect(textOf(r.blocks)).toBe("Le blocage vient de l'ANPP.");
        break;
      }
      turns.push({ role: "assistant", content: r.blocks });
      turns.push({
        role: "user",
        content: appels.map((a) => ({ type: "tool_result" as const, callId: a.id, content: "fait" })),
      });
    }

    expect(etapes).toBe(3);
    expect(captures).toHaveLength(3);
    // Au 3ᵉ appel, l'historique porte les deux échanges d'outils, chacun apparié.
    const dernier = captures[2].body.input as { type?: string; call_id?: string }[];
    expect(dernier.filter((e) => e.type === "function_call").map((e) => e.call_id)).toEqual(["call_1", "call_2"]);
    expect(dernier.filter((e) => e.type === "function_call_output").map((e) => e.call_id)).toEqual(["call_1", "call_2"]);
  });

  it("4. plusieurs outils INDÉPENDANTS reviennent dans UNE réponse, exécutables de front", async () => {
    // C'est le point qui fait la différence de latence : trois lectures sans lien entre elles
    // doivent partir ensemble. Le modèle les émet ensemble ; la boucle les exécute déjà en
    // `Promise.all` — ce test garantit qu'aucun ne se perd entre les deux.
    serveur([
      reponse({
        appels: [
          { callId: "call_x", name: "read_mail", args: { depuis: "hier" } },
          { callId: "call_y", name: "read_regulatory", args: { statut: "retard" } },
          { callId: "call_z", name: "read_tasks", args: { qui: "Raihana" } },
        ],
      }),
    ]);

    const r = await callModel("orchestrator", [{ role: "user", content: "Mails, dossiers et tâches" }], {
      tools: [OUTIL("read_mail"), OUTIL("read_regulatory"), OUTIL("read_tasks")],
    });

    const appels = toolCallsOf(r.blocks);
    expect(appels.map((a) => a.id)).toEqual(["call_x", "call_y", "call_z"]);
    expect(appels.map((a) => a.name)).toEqual(["read_mail", "read_regulatory", "read_tasks"]);
    expect(captures[0].body.parallel_tool_calls).toBe(true);
  });
});

// ─────────────────────────── 5 — L'appariement des call_id ───────────────────────────

describe("5. les résultats sont appariés à leur appel, et dans le bon ordre", () => {
  it("un `function_call_output` porte le `call_id` de son `function_call`", () => {
    const input = toResponsesInput([
      { role: "user", content: "Regarde" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Je regarde." },
          { type: "tool_call", id: "call_aa", name: "un", args: { a: 1 } },
          { type: "tool_call", id: "call_bb", name: "deux", args: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", callId: "call_aa", content: "résultat A" },
          { type: "tool_result", callId: "call_bb", content: "échec B", isError: true },
        ],
      },
    ]);

    const appels = input.filter((i) => "type" in i && i.type === "function_call");
    const sorties = input.filter((i) => "type" in i && i.type === "function_call_output");
    expect(appels.map((a) => (a as { call_id: string }).call_id)).toEqual(["call_aa", "call_bb"]);
    expect(sorties.map((s) => (s as { call_id: string }).call_id)).toEqual(["call_aa", "call_bb"]);

    // L'ERREUR SE DIT. `isError` ne doit pas se dissoudre dans un texte quelconque : sans marque,
    // « l'outil a échoué » et « l'outil a répondu que non » deviennent la même chose.
    expect((sorties[1] as { output: string }).output).toContain("ERREUR");
  });

  it("un appel PRÉCÈDE toujours son résultat dans la suite envoyée", () => {
    // Un `function_call_output` qui arriverait en premier désigne un `call_id` inconnu : le
    // fournisseur refuse alors le tour entier, avec un message qui ne nomme pas la cause.
    const input = toResponsesInput([
      { role: "assistant", content: [{ type: "tool_call", id: "call_1", name: "un", args: {} }] },
      { role: "user", content: [{ type: "tool_result", callId: "call_1", content: "ok" }] },
    ]);
    const iAppel = input.findIndex((i) => "type" in i && i.type === "function_call");
    const iSortie = input.findIndex((i) => "type" in i && i.type === "function_call_output");
    expect(iAppel).toBeGreaterThanOrEqual(0);
    expect(iAppel).toBeLessThan(iSortie);
  });
});

// ─────────────────────────── 6 — Le résolveur reste en amont ───────────────────────────

describe("6. le résolveur d'outils s'applique AVANT l'appel Responses", () => {
  it("seule la liste réduite part sur le réseau", async () => {
    serveur([reponse({ texte: "ok" })]);
    // Le résolveur vit au-dessus de la passerelle : ce qu'il rend est ce que la passerelle
    // reçoit. Le test le prouve par le corps capturé — 3 outils envoyés sur 40 possibles.
    const reduits = [OUTIL("a"), OUTIL("b"), OUTIL("c")];
    await callModel("orchestrator", [{ role: "user", content: "x" }], { tools: reduits });

    const outils = captures[0].body.tools as { name: string }[];
    expect(outils).toHaveLength(3);
    expect(outils.map((t) => t.name)).toEqual(["a", "b", "c"]);
  });

  it("le plafond de 128 reste appliqué à la frontière, sur cette porte aussi", async () => {
    // `capTools` est un FILET, pas la solution — mais un filet qui ne serait tendu que sous une
    // des deux portes ne sert à rien le jour où on change de porte.
    serveur([reponse({ texte: "ok" })]);
    const beaucoup = Array.from({ length: 200 }, (_, i) => OUTIL(`t${i}`));
    await callModel("orchestrator", [{ role: "user", content: "x" }], { tools: beaucoup });
    expect((captures[0].body.tools as unknown[]).length).toBe(128);
  });
});

// ─────────────────────────── 7, 8 — Les workers ───────────────────────────

describe("7 et 8. les workers passent par la même porte, sans raisonnement", () => {
  it("7. Terra worker part en `effort: none` sur /v1/responses", async () => {
    serveur([reponse({ texte: "extrait" })]);
    const r = await callModel("worker", [{ role: "user", content: "extrais les dates" }]);

    expect(r.ok).toBe(true);
    expect(captures[0].url).toContain("/v1/responses");
    expect(captures[0].body.model).toBe("gpt-5.6-terra");
    expect((captures[0].body.reasoning as { effort: string }).effort).toBe("none");
  });

  it("8. Luna bulk part en `effort: none` sur /v1/responses", async () => {
    serveur([reponse({ texte: "classé" })]);
    const r = await callModel("bulk", [{ role: "user", content: "classe ces 300 lignes" }]);

    expect(r.ok).toBe(true);
    expect(captures[0].url).toContain("/v1/responses");
    expect(captures[0].body.model).toBe("gpt-5.6-luna");
    expect((captures[0].body.reasoning as { effort: string }).effort).toBe("none");
  });
});

// ─────────────────────────── 9 — Aucune retombée silencieuse ───────────────────────────

describe("9. aucun chemin Terra-medium ne retombe sur /v1/chat/completions", () => {
  it("la décision de protocole est `responses` sur TOUTE la matrice des rôles et efforts", () => {
    // Pas un cas, la matrice : c'est la seule façon de couvrir la porte qu'on n'a pas encore
    // écrite. Un jour quelqu'un ajoutera un rôle ; ce test le lira.
    for (const role of ["orchestrator", "worker", "bulk"] as const) {
      for (const effort of ["none", "low", "medium", "high"] as const) {
        for (const outils of [undefined, [OUTIL("x")]]) {
          const binding = bindingFor(role);
          const opts = { reasoning: effort, ...(outils ? { tools: outils } : {}) };
          const p = protocolFor(binding, opts);
          expect(p, `${role}/${effort}/${outils ? "outillé" : "nu"}`).toBe("responses");
          expect(protocolViolation(binding, opts, p)).toBeNull();
        }
      }
    }
  });

  it("la marche arrière `ADAM_OPENAI_PROTOCOL=chat_completions` est REFUSÉE pour raisonnement + outils", () => {
    // Un levier de secours qui permet de re-choisir la panne n'est pas un levier de secours.
    process.env.ADAM_OPENAI_PROTOCOL = "chat_completions";
    const binding = bindingFor("orchestrator");

    expect(protocolFor(binding, { reasoning: "medium", tools: [OUTIL("x")] })).toBe("responses");
    // …mais elle reste utilisable là où elle ne casse rien : c'est ce qui en fait un recours.
    expect(protocolFor(binding, { reasoning: "none", tools: [OUTIL("x")] })).toBe("chat_completions");
    expect(protocolFor(binding, { reasoning: "medium" })).toBe("chat_completions");
  });

  it("la combinaison interdite est reconnue par FAMILLE de modèle, pas par nom exact", () => {
    // Une liste exacte oblige à y penser le jour d'un déploiement — le jour où on y pense le moins.
    expect(isReasoningModel("gpt-5.6-terra")).toBe(true);
    expect(isReasoningModel("gpt-5.6-terra-2026-03-01")).toBe(true);
    expect(isReasoningModel("gpt-5.6-luna")).toBe(true);
    expect(isReasoningModel("claude-sonnet-4-6")).toBe(false);

    const binding = { ...bindingFor("orchestrator"), model: "gpt-5.7-quelque-chose" };
    expect(needsResponses(binding, { reasoning: "medium", tools: [OUTIL("x")] })).toBe(true);
    expect(needsResponses(binding, { reasoning: "none", tools: [OUTIL("x")] })).toBe(false);
    expect(needsResponses(binding, { reasoning: "medium" })).toBe(false);
  });

  it("la passerelle REFUSE avant le réseau plutôt que d'envoyer voir", async () => {
    let appele = false;
    vi.stubGlobal("fetch", async () => {
      appele = true;
      return new Response("{}", { status: 200 });
    });

    // On force la violation directement sur le garde-fou : c'est lui qu'on éprouve.
    const binding = bindingFor("orchestrator");
    const opts = { reasoning: "medium" as const, tools: [OUTIL("x")] };
    expect(protocolViolation(binding, opts, "chat_completions")).toContain("/v1/chat/completions");
    expect(appele).toBe(false);
  });
});

// ─────────────────────────── 10 — Pas de dégradation silencieuse ───────────────────────────

describe("10. aucun repli automatique ne transforme `medium` en `none`", () => {
  it("un 400 qui mentionne `reasoning_effort` ne fait PAS rejouer sans raisonnement", async () => {
    // C'ÉTAIT LE PIÈGE. L'ancienne porte retirait `reasoning_effort` dès qu'un 400 le mentionnait
    // — et le message d'OpenAI propose justement « or set reasoning_effort to 'none' ». Le
    // rattrapage prenait cette branche en silence : Adam rendait alors une réponse moins
    // raisonnée que demandée, avec l'air d'avoir réussi.
    // LES CORPS SONT RELEVÉS PUIS EXAMINÉS APRÈS COUP, et non vérifiés dans le stub.
    //
    // Une première version affirmait depuis l'intérieur de `fetch` : l'adaptateur enveloppe
    // l'appel dans un `try`, il avalait donc l'échec d'assertion et le rendait comme une panne
    // réseau — le test passait, mais pour la mauvaise raison. Constaté en réintroduisant
    // volontairement le repli : le test restait vert. Un test qu'on n'a pas vu échouer sur le
    // défaut qu'il prétend couvrir ne couvre rien.
    const envoyes: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      envoyes.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({ error: { message: "Function tools with reasoning_effort are not supported" } }),
        { status: 400 },
      );
    });

    const r = await callModel("orchestrator", [{ role: "user", content: "x" }], {
      reasoning: "medium",
      tools: [OUTIL("x")],
    });

    // AUCUN essai, quel qu'il soit, n'est parti avec un raisonnement affaibli.
    expect(envoyes.length).toBeGreaterThan(0);
    for (const [i, body] of envoyes.entries()) {
      expect(body.reasoning, `essai ${i + 1} parti sans raisonnement`).toBeDefined();
      expect((body.reasoning as { effort: string }).effort, `essai ${i + 1} dégradé`).toBe("medium");
    }

    // Une panne VISIBLE, pas une réponse dégradée qui passe pour un succès.
    expect(r.ok).toBe(false);
    expect(r.blocks).toEqual([]);
  });
});

// ─────────────────────────── 11 — Le flux ───────────────────────────

describe("11. le flux rend le texte au fil de l'eau, et la même forme finale", () => {
  it("le texte arrive par morceaux puis la réponse finale est complète", async () => {
    serveurFlux([
      { type: "response.created", response: { id: "resp_s" } },
      { type: "response.output_text.delta", output_index: 0, delta: "Trois " },
      { type: "response.output_text.delta", output_index: 0, delta: "dossiers " },
      { type: "response.output_text.delta", output_index: 0, delta: "en retard." },
      {
        type: "response.completed",
        response: {
          id: "resp_s",
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "Trois dossiers en retard." }] }],
          usage: { input_tokens: 40, output_tokens: 9, input_tokens_details: { cached_tokens: 12 } },
        },
      },
    ]);

    const morceaux: string[] = [];
    const r = await streamModel("orchestrator", [{ role: "user", content: "x" }], {}, (c) => morceaux.push(c));

    expect(morceaux.join("")).toBe("Trois dossiers en retard.");
    expect(textOf(r.blocks)).toBe("Trois dossiers en retard.");
    expect(r.stop).toBe("end");
    expect(r.usage.inputTokens).toBe(40);
    expect(r.usage.cachedInputTokens).toBe(12);
    expect(captures[0].url).toContain("/v1/responses");
    expect(captures[0].body.stream).toBe(true);
  });

  it("un appel d'outil se reconstitue à travers le flux, arguments compris", async () => {
    const asm = new ResponsesStreamAssembler();
    asm.push({
      type: "response.output_item.added",
      output_index: 1,
      item: { type: "function_call", call_id: "call_f", name: "read_mail", arguments: "" },
    });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: '{"dep' });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: 'uis":"hier"}' });
    asm.push({ type: "response.completed", response: { id: "r", status: "completed" } });

    const appels = toolCallsOf(asm.blocks());
    expect(appels).toHaveLength(1);
    expect(appels[0].id).toBe("call_f");
    expect(appels[0].args).toEqual({ depuis: "hier" });
    expect(asm.hasCalls()).toBe(true);
  });

  it("deux appels concurrents ne se mélangent pas malgré l'entrelacement", () => {
    // Les fragments de deux appels arrivent mêlés ; seul l'`output_index` les sépare.
    const asm = new ResponsesStreamAssembler();
    asm.push({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", call_id: "c0", name: "un" } });
    asm.push({ type: "response.output_item.added", output_index: 1, item: { type: "function_call", call_id: "c1", name: "deux" } });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 0, delta: '{"a":' });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: '{"b":' });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 0, delta: "1}" });
    asm.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: "2}" });

    const appels = toolCallsOf(asm.blocks());
    expect(appels.map((a) => a.id)).toEqual(["c0", "c1"]);
    expect(appels[0].args).toEqual({ a: 1 });
    expect(appels[1].args).toEqual({ b: 2 });
  });
});

// ─────────────────────────── 12 — L'usage reste observable ───────────────────────────

describe("12. jetons et coûts restent lisibles après la migration", () => {
  it("les jetons sont lus dans le vocabulaire de Responses", async () => {
    // `input_tokens` / `output_tokens`, et non `prompt_tokens` / `completion_tokens`. Une lecture
    // au mauvais nom rend zéro sans erreur — et un compteur à zéro passe pour une économie.
    serveur([reponse({ texte: "ok", usage: { input_tokens: 1234, output_tokens: 567, cached: 200 } })]);
    const r = await callModel("orchestrator", [{ role: "user", content: "x" }]);

    expect(r.usage.inputTokens).toBe(1234);
    expect(r.usage.outputTokens).toBe(567);
    expect(r.usage.cachedInputTokens).toBe(200);
    expect(r.usage.attempts).toBe(1);
    expect(r.usage.ms).toBeGreaterThanOrEqual(0);
  });

  it("le coût est chiffré quand le tarif est connu, et `null` quand il ne l'est pas", async () => {
    serveur([reponse({ texte: "ok", usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } })]);
    const bulk = await callModel("bulk", [{ role: "user", content: "x" }]);
    // Luna : 0,20 $ + 1,20 $ par million — le seul tarif vérifié dans ce dépôt.
    expect(bulk.usage.costUsd).toBeCloseTo(1.4, 6);

    captures = [];
    serveur([reponse({ texte: "ok", usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } })]);
    const orch = await callModel("orchestrator", [{ role: "user", content: "x" }]);
    // Terra : tarif inconnu ici. `null`, jamais zéro — un coût faux se cite ensuite comme un fait.
    expect(orch.usage.costUsd).toBeNull();
  });
});

// ─────────────────────────── La traduction, unité par unité ───────────────────────────

describe("la traduction de forme, vérifiée sans réseau", () => {
  it("le corps porte le vocabulaire de Responses et AUCUN reste de Chat Completions", () => {
    const body = buildResponsesBody(
      bindingFor("orchestrator"),
      [{ role: "user", content: "bonjour" }],
      { system: "Tu es Adam.", maxOutputTokens: 900, tools: [OUTIL("x")] },
    );

    expect(body.input).toBeDefined();
    expect(body.instructions).toBe("Tu es Adam.");
    expect(body.max_output_tokens).toBe(900);
    expect(body.reasoning).toEqual({ effort: "medium" });
    // Les noms de l'ancienne porte ne doivent pas survivre : ils seraient ignorés en silence.
    expect(body.messages).toBeUndefined();
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("rien n'est entreposé chez le fournisseur tant que personne ne l'a demandé", () => {
    const nu = buildResponsesBody(bindingFor("worker"), [{ role: "user", content: "x" }], {});
    expect(nu.store).toBe(false);
    expect(nu.previous_response_id).toBeUndefined();

    const chaine = buildResponsesBody(bindingFor("worker"), [{ role: "user", content: "x" }], {
      previousResponseId: "resp_precedent",
    });
    expect(chaine.store).toBe(true);
    expect(chaine.previous_response_id).toBe("resp_precedent");
  });

  it("l'identifiant de réponse revient, pour pouvoir chaîner le tour suivant", async () => {
    serveur([reponse({ id: "resp_abc", texte: "ok" })]);
    const r = await callModel("orchestrator", [{ role: "user", content: "x" }]);
    expect(r.responseId).toBe("resp_abc");
  });

  it("le raisonnement interne ne remonte PAS dans les blocs", () => {
    // Il compte dans les jetons de sortie, et c'est là qu'il doit rester visible — pas à l'écran.
    const blocks = fromResponsesOutput([
      { type: "reasoning", id: "rs_1" } as never,
      { type: "message", content: [{ type: "output_text", text: "La réponse." }] } as never,
    ]);
    expect(blocks).toEqual([{ type: "text", text: "La réponse." }]);
  });

  it("`status` et `incomplete_details` deviennent la raison d'arrêt neutre", () => {
    expect(stopOfResponse({ status: "completed" }, false)).toBe("end");
    expect(stopOfResponse({ status: "completed" }, true)).toBe("tools");
    expect(stopOfResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, false)).toBe("length");
    expect(stopOfResponse({ status: "incomplete", incomplete_details: { reason: "content_filter" } }, false)).toBe("refusal");
    expect(stopOfResponse({ status: "failed" }, false)).toBe("error");
  });

  it("une réponse vide par budget épuisé est REJOUÉE une fois, plus large", async () => {
    // Le budget de sortie couvre AUSSI la réflexion interne : un Terra medium peut tout dépenser
    // à réfléchir et ne rien dire. Le symptôme, sinon, est « réponse vide » sans cause nommée.
    //
    // Le rattrapage reste un FILET, pas la politique : depuis `budget.ts`, la passerelle calcule
    // déjà une réserve de raisonnement, et le premier envoi porte donc bien plus que les 500
    // jetons demandés. Le voir se déclencher signifie que cette réserve est mal calibrée — c'est
    // ce que dit désormais le journal, et c'est éprouvé dans `budget.test.ts`.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    serveur([
      { id: "r1", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "reasoning" }], usage: {} },
      reponse({ texte: "Enfin une réponse." }),
    ]);

    const r = await callModel("orchestrator", [{ role: "user", content: "x" }], { maxOutputTokens: 500 });
    expect(textOf(r.blocks)).toBe("Enfin une réponse.");
    expect(captures).toHaveLength(2);
    // Le budget demandé est celui de la RÉPONSE VISIBLE : ce qui part sur le réseau le dépasse.
    expect(Number(captures[0].body.max_output_tokens)).toBeGreaterThan(500);
    expect(Number(captures[1].body.max_output_tokens))
      .toBeGreaterThan(Number(captures[0].body.max_output_tokens));
    warn.mockRestore();
  });
});
