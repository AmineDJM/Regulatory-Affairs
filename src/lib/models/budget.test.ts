import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUDGET_POLICY, budgetDeSecours, outputBudget, workloadOf } from "./budget";
import { buildResponsesBody, budgetEpuise } from "./openai-responses";
import { callModel } from "./gateway";
import { bindingFor } from "./registry";
import { summarize, withTurn, recordModelCall } from "./telemetry";
import { textOf } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BUDGET DE SORTIE — ce que ces épreuves défendent.
 *
 * Le défaut réel, celui qui tournait en production : la boucle d'agent demandait `maxTokens: 1400`
 * — un chiffre juste, écrit quand il voulait dire « longueur de la réponse » — et ces 1 400 jetons
 * partaient comme plafond TOTAL sur un Terra `medium`, réflexion comprise. Le modèle pouvait donc
 * dépenser l'intégralité du budget à penser et rendre une réponse vide.
 *
 * Les tests ci-dessous tiennent trois choses, et elles se contredisent facilement :
 *
 *   1. un appel qui RAISONNE reçoit une réserve, quoi qu'ait demandé l'appelant ;
 *   2. un appel qui NE RAISONNE PAS ne bouge pas d'un jeton — les workers et le volume ne paient
 *      pas la note d'un problème qui n'est pas le leur ;
 *   3. quand le plafond coupe quand même, cela se voit, se nomme et se compte.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("la charge de travail se LIT, elle ne se devine pas", () => {
  it("effort `none` = un worker, quel que soit le nombre d'outils", () => {
    expect(workloadOf({ role: "worker", effort: "none", toolCount: 0 })).toBe("worker");
    expect(workloadOf({ role: "bulk", effort: "none", toolCount: 40 })).toBe("worker");
  });

  it("raisonner sans outil = du texte ; avec outils = une boucle ; beaucoup d'outils = une découverte", () => {
    expect(workloadOf({ role: "orchestrator", effort: "medium", toolCount: 0 })).toBe("simple");
    expect(workloadOf({ role: "orchestrator", effort: "medium", toolCount: 12 })).toBe("loop");
    expect(workloadOf({ role: "orchestrator", effort: "medium", toolCount: 30 })).toBe("loop");
    // 30 est le plafond d'un niveau B chez le résolveur : au-delà, seul un C est servi.
    expect(workloadOf({ role: "orchestrator", effort: "medium", toolCount: 31 })).toBe("deep");
  });
});

describe("la politique de budget", () => {
  it("LE DÉFAUT DE L'ANCIEN CODE EST MORT : 1 400 demandés ne partent plus comme 1 400 totaux", () => {
    // C'est littéralement l'appel de `assistant.ts` : la boucle d'agent, outillée, sur Terra medium.
    const b = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 12, requested: 1400 });

    expect(b.workload).toBe("loop");
    expect(b.visible).toBe(1400);            // ce que l'appelant veut lire : respecté au jeton près
    expect(b.headroom).toBeGreaterThan(0);   // ce que le modèle a le droit de penser : ajouté
    expect(b.maxOutputTokens).toBe(1400 + b.headroom);
    // Le seuil qui compte : la réponse ne peut plus être intégralement mangée par la réflexion.
    expect(b.maxOutputTokens).toBeGreaterThanOrEqual(6000);
  });

  it("AUCUN BUDGET DE WORKER NE BOUGE — effort `none`, réserve nulle", () => {
    // La garantie de non-régression de tout le lot. Ces nombres sont ceux du dépôt : extraction
    // documentaire (16 000), OCR vision (12 000), étage de connaissance (600). Ils sont JUSTES
    // sur un modèle qui ne réfléchit pas, et rien ici n'a le droit de les gonfler.
    for (const demande of [600, 2000, 8000, 12_000, 16_000]) {
      const b = outputBudget({ role: "worker", effort: "none", toolCount: 0, requested: demande });
      expect(b.headroom).toBe(0);
      expect(b.maxOutputTokens).toBe(demande);
    }
  });

  it("la réserve croît avec l'effort, et une découverte reçoit plus qu'une boucle", () => {
    const bas = outputBudget({ role: "orchestrator", effort: "low", toolCount: 0, requested: 1000 });
    const moyen = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 0, requested: 1000 });
    const haut = outputBudget({ role: "orchestrator", effort: "high", toolCount: 0, requested: 1000 });
    expect(bas.headroom).toBeLessThan(moyen.headroom);
    expect(moyen.headroom).toBeLessThan(haut.headroom);

    const boucle = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 10, requested: 1000 });
    const decouverte = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 40, requested: 1000 });
    expect(decouverte.headroom).toBeGreaterThan(boucle.headroom);
  });

  it("sans demande, chaque charge a son défaut — et il reste dans l'échelle des usages du dépôt", () => {
    const worker = outputBudget({ role: "worker", effort: "none", toolCount: 0 });
    const mission = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 40 });
    expect(worker.maxOutputTokens).toBe(2000);
    expect(mission.maxOutputTokens).toBeGreaterThanOrEqual(8000);
    // Pas de valeur énorme choisie « au cas où » : la mission la plus lourde reste bornée.
    expect(mission.maxOutputTokens).toBeLessThanOrEqual(20_000);
  });

  it("un plafond absolu protège d'un réglage aberrant", () => {
    const fou = outputBudget({ role: "orchestrator", effort: "max", toolCount: 40, requested: 900_000 });
    expect(fou.maxOutputTokens).toBe(BUDGET_POLICY.PLAFOND);
  });

  it("une demande absurde ou vide retombe sur le défaut plutôt que sur zéro", () => {
    // Un `maxOutputTokens: 0` transmis par mégarde vaudrait « ne réponds pas ». On refuse de
    // l'envoyer : un appel payé pour rien n'est jamais l'intention de l'appelant.
    for (const mauvais of [0, -5, Number.NaN]) {
      const b = outputBudget({ role: "worker", effort: "none", toolCount: 0, requested: mauvais });
      expect(b.maxOutputTokens).toBe(2000);
    }
  });

  describe("le facteur de réglage", () => {
    afterEach(() => { delete process.env.ADAM_REASONING_HEADROOM_SCALE; });

    it("permet de corriger la réserve sur mesures réelles, sans redéployer", () => {
      const avant = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 0, requested: 1000 });
      process.env.ADAM_REASONING_HEADROOM_SCALE = "2";
      const apres = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 0, requested: 1000 });
      expect(apres.headroom).toBe(avant.headroom * 2);
    });

    it("reste borné : une valeur farfelue ne devient pas une facture", () => {
      process.env.ADAM_REASONING_HEADROOM_SCALE = "1000";
      const b = outputBudget({ role: "orchestrator", effort: "medium", toolCount: 0, requested: 1000 });
      expect(b.headroom).toBe(BUDGET_POLICY.RESERVE_RAISONNEMENT.medium * 4);
    });
  });
});

describe("le rattrapage de secours", () => {
  it("double, sans jamais dépasser le plafond", () => {
    expect(budgetDeSecours(4000)).toBe(8000);
    expect(budgetDeSecours(BUDGET_POLICY.PLAFOND)).toBe(BUDGET_POLICY.PLAFOND);
  });
});

describe("un budget épuisé se NOMME", () => {
  it("distingue « notre plafond a coupé » de « le modèle a refusé »", () => {
    expect(budgetEpuise({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } })).toBe(true);
    // Agrandir le budget ne change RIEN à un filtrage de contenu : les confondre fait payer
    // l'appel deux fois pour le même refus.
    expect(budgetEpuise({ status: "incomplete", incomplete_details: { reason: "content_filter" } })).toBe(false);
    expect(budgetEpuise({ status: "completed" })).toBe(false);
  });
});

// ─────────────────────────── Bout en bout, sans réseau ───────────────────────────

const OUTIL = (name: string) => ({
  name,
  description: "un outil",
  parameters: { type: "object", properties: {} } as Record<string, unknown>,
});

let captures: { body: Record<string, unknown> }[] = [];

function serveur(reponses: Record<string, unknown>[]): void {
  let i = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    captures.push({ body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const payload = reponses[Math.min(i++, reponses.length - 1)];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }));
}

const reponse = (extra: Record<string, unknown> = {}) => ({
  id: "resp_1",
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
  usage: { input_tokens: 10, output_tokens: 100, output_tokens_details: { reasoning_tokens: 70 } },
  ...extra,
});

describe("la passerelle applique la politique — et l'adaptateur ne la contredit pas", () => {
  beforeEach(() => {
    captures = [];
    process.env.OPENAI_API_KEY = "sk-test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it("un appel de boucle d'agent part avec la réserve, pas avec le budget nu de l'appelant", async () => {
    serveur([reponse()]);
    await callModel("orchestrator", [{ role: "user", content: "x" }], {
      maxOutputTokens: 1400,
      tools: [OUTIL("read_mail"), OUTIL("read_tasks")],
    });

    const envoye = Number(captures[0].body.max_output_tokens);
    expect(envoye).toBeGreaterThan(1400);
    expect(envoye).toBe(outputBudget({
      role: "orchestrator", effort: "medium", toolCount: 2, requested: 1400,
    }).maxOutputTokens);
  });

  it("le même appel sur un WORKER part inchangé — la garantie de non-régression", async () => {
    serveur([reponse()]);
    await callModel("worker", [{ role: "user", content: "x" }], { maxOutputTokens: 1400 });
    expect(captures[0].body.max_output_tokens).toBe(1400);
  });

  it("l'adaptateur appelé DIRECTEMENT retombe sur la même politique, jamais sur un autre nombre", () => {
    // Deux façons de choisir ce plafond, ce serait deux comportements — et un seul testé.
    const nu = buildResponsesBody(bindingFor("orchestrator"), [{ role: "user", content: "x" }], {});
    expect(nu.max_output_tokens).toBe(
      outputBudget({ role: "orchestrator", effort: "medium", toolCount: 0 }).maxOutputTokens,
    );
  });

  it("les jetons de RAISONNEMENT et le plafond remontent dans l'usage", async () => {
    serveur([reponse()]);
    const r = await callModel("orchestrator", [{ role: "user", content: "x" }], { maxOutputTokens: 1000 });

    expect(r.usage.outputTokens).toBe(100);
    expect(r.usage.reasoningTokens).toBe(70); // 70 des 100 jetons ont servi à penser, pas à répondre
    expect(r.usage.maxOutputTokens).toBe(captures[0].body.max_output_tokens);
    expect(r.usage.incompleteReason).toBeNull();
  });

  it("une coupure par NOTRE plafond est signalée, comptée, et rejouée UNE fois", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    serveur([
      {
        id: "r1", status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
        output: [{ type: "reasoning" }],
        usage: { input_tokens: 10, output_tokens: 500, output_tokens_details: { reasoning_tokens: 500 } },
      },
      reponse({ output: [{ type: "message", content: [{ type: "output_text", text: "Enfin." }] }] }),
    ]);

    const r = await callModel("orchestrator", [{ role: "user", content: "x" }], { maxOutputTokens: 500 });

    expect(textOf(r.blocks)).toBe("Enfin.");
    expect(captures).toHaveLength(2);
    // Le second essai est plus large que le premier — et le premier portait DÉJÀ la réserve.
    expect(Number(captures[1].body.max_output_tokens))
      .toBeGreaterThan(Number(captures[0].body.max_output_tokens));

    // La cause est NOMMÉE dans le journal, avec les nombres. Sans cela, le symptôme visible reste
    // « Adam n'a rien répondu », qu'on cherche alors dans le mauvais fichier.
    const dit = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(dit).toContain("BUDGET DE SORTIE ÉPUISÉ");
    expect(dit).toContain("reasoning_tokens");
    expect(dit).toContain("budget.ts");
  });

  it("un `content_filter` n'est PAS rejoué : agrandir le budget n'y changerait rien", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    serveur([{
      id: "r1", status: "incomplete", incomplete_details: { reason: "content_filter" },
      output: [], usage: { input_tokens: 10, output_tokens: 0 },
    }]);

    await callModel("orchestrator", [{ role: "user", content: "x" }], { maxOutputTokens: 500 });
    expect(captures).toHaveLength(1);
  });

  it("le tour entier compte sa réflexion et ses coupures", async () => {
    // « Ce tour a-t-il payé plus à penser qu'à répondre ? » ne se lit sur aucun appel isolé.
    const resume = await withTurn("text", async (trace) => {
      recordModelCall({
        role: "orchestrator", model: "m", provider: "openai",
        inputTokens: 10, outputTokens: 800, cachedInputTokens: 0, reasoningTokens: 600,
        maxOutputTokens: 800, incompleteReason: "max_output_tokens",
        costUsd: null, ms: 10, attempts: 1,
      });
      recordModelCall({
        role: "worker", model: "m", provider: "openai",
        inputTokens: 5, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0,
        maxOutputTokens: 2000, incompleteReason: null,
        costUsd: null, ms: 5, attempts: 1,
      });
      return summarize(trace);
    });

    expect(resume.reasoningTokens).toBe(600);
    expect(resume.outputTokens).toBe(850);
    // Zéro est la valeur normale : tout autre chiffre accuse `budget.ts`, pas le modèle.
    expect(resume.budgetTruncations).toBe(1);
  });
});
