import { describe, expect, it } from "vitest";
import {
  lunaCostUsd, buildLunaBody, buildBatchLine, buildBatchJsonl, parseBatchOutput,
  readUsage, estimateTokens, BATCH_MULTIPLIER, LUNA_MODEL,
} from "./openai-luna";

/**
 * Le coût de l'analyse CTD se calcule ICI. Une erreur de facteur ou d'unité ne se voit pas —
 * elle se découvre sur la facture. D'où ces tests sur des valeurs connues.
 *
 * Tarifs officiels au 30 juillet 2026 : 0,20 $ / 1,20 $ par MILLION de jetons, Batch ×0,5.
 */

describe("Luna — calcul du coût", () => {
  it("applique les tarifs officiels au million de jetons", () => {
    // 1 M en entrée = 0,20 $ ; 1 M en sortie = 1,20 $.
    expect(lunaCostUsd(1_000_000, 0)).toBeCloseTo(0.2, 6);
    expect(lunaCostUsd(0, 1_000_000)).toBeCloseTo(1.2, 6);
    expect(lunaCostUsd(1_000_000, 1_000_000)).toBeCloseTo(1.4, 6);
  });

  it("le Batch coûte MOITIÉ prix, en entrée comme en sortie", () => {
    expect(BATCH_MULTIPLIER).toBe(0.5);
    expect(lunaCostUsd(1_000_000, 1_000_000, true)).toBeCloseTo(0.7, 6);
    expect(lunaCostUsd(500_000, 200_000, true)).toBeCloseTo(lunaCostUsd(500_000, 200_000) / 2, 6);
  });

  it("un dossier réaliste reste chiffrable au centime près", () => {
    // 300 pages ≈ 400 000 jetons en entrée, 40 000 en sortie, en Batch.
    const usd = lunaCostUsd(400_000, 40_000, true);
    expect(usd).toBeCloseTo((400_000 / 1e6) * 0.2 * 0.5 + (40_000 / 1e6) * 1.2 * 0.5, 6);
    expect(usd).toBeLessThan(0.07); // ~6 cents : c'est bien l'ordre de grandeur visé
  });

  it("zéro jeton coûte zéro", () => {
    expect(lunaCostUsd(0, 0)).toBe(0);
  });

  it("l'estimation de jetons est prudente et monotone", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(400))).toBe(100);
    expect(estimateTokens("a".repeat(800))).toBeGreaterThan(estimateTokens("a".repeat(400)));
  });
});

describe("Luna — corps de requête", () => {
  it("utilise le modèle attendu et un message simple sans image", () => {
    const b = buildLunaBody({ user: "Analyse ce document." }) as Record<string, unknown>;
    expect(b.model).toBe(LUNA_MODEL);
    const messages = b.messages as { role: string; content: unknown }[];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Analyse ce document.");
  });

  it("place la consigne système en tête quand elle existe", () => {
    const b = buildLunaBody({ system: "Tu extrais des réserves.", user: "Vas-y." }) as Record<string, unknown>;
    const messages = b.messages as { role: string }[];
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("encode les pages en images data: — c'est ce qui permet de LIRE un graphique", () => {
    const b = buildLunaBody({ user: "Lis la courbe.", images: [{ buffer: Buffer.from("PNGDATA") }] }) as Record<string, unknown>;
    const content = (b.messages as { content: { type: string; image_url?: { url: string } }[] }[])[0].content;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("text");
    expect(content[1].type).toBe("image_url");
    expect(content[1].image_url?.url).toMatch(/^data:image\/png;base64,/);
  });

  it("impose le schéma JSON en mode strict — fini les réponses inexploitables", () => {
    const b = buildLunaBody({
      user: "x",
      jsonSchema: { name: "reserves", schema: { type: "object" } },
    }) as Record<string, unknown>;
    const rf = b.response_format as { type: string; json_schema: { name: string; strict: boolean } };
    expect(rf.type).toBe("json_schema");
    expect(rf.json_schema.name).toBe("reserves");
    expect(rf.json_schema.strict).toBe(true);
  });
});

describe("Luna — lots (Batch)", () => {
  it("chaque ligne JSONL porte son identifiant, la méthode et l'URL attendus", () => {
    const line = JSON.parse(buildBatchLine({ customId: "doc-42:3.2.P.8", input: { user: "Analyse." } }));
    expect(line.custom_id).toBe("doc-42:3.2.P.8");
    expect(line.method).toBe("POST");
    expect(line.url).toBe("/v1/chat/completions");
    expect(line.body.model).toBe(LUNA_MODEL);
  });

  it("le JSONL est une ligne par requête, sans ligne vide", () => {
    const jsonl = buildBatchJsonl([
      { customId: "a", input: { user: "1" } },
      { customId: "b", input: { user: "2" } },
    ]);
    const lines = jsonl.split("\n");
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });

  it("lit les résultats et facture au tarif BATCH", () => {
    const jsonl = [
      JSON.stringify({
        custom_id: "a",
        response: { status_code: 200, body: { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1_000_000, completion_tokens: 0 } } },
      }),
    ].join("\n");
    const out = parseBatchOutput(jsonl);
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(true);
    expect(out[0].text).toBe('{"ok":true}');
    expect(out[0].usage.costUsd).toBeCloseTo(0.1, 6); // 0,20 $ ÷ 2
  });

  it("une ligne en erreur n'empêche pas les autres d'être lues", () => {
    const jsonl = [
      JSON.stringify({ custom_id: "ko", error: { message: "quota dépassé" } }),
      "{ ceci n'est pas du JSON",
      JSON.stringify({ custom_id: "ok", response: { status_code: 200, body: { choices: [{ message: { content: "bien" } }] } } }),
    ].join("\n");
    const out = parseBatchOutput(jsonl);
    expect(out).toHaveLength(2);
    expect(out.find((o) => o.customId === "ko")?.ok).toBe(false);
    expect(out.find((o) => o.customId === "ok")?.text).toBe("bien");
  });

  it("un statut HTTP d'erreur est rapporté, pas avalé", () => {
    const jsonl = JSON.stringify({ custom_id: "x", response: { status_code: 500, body: {} } });
    const out = parseBatchOutput(jsonl);
    expect(out[0].ok).toBe(false);
    expect(out[0].error).toContain("500");
  });

  it("un JSONL vide ne produit rien plutôt que de planter", () => {
    expect(parseBatchOutput("")).toEqual([]);
    expect(parseBatchOutput("\n\n  \n")).toEqual([]);
  });
});

describe("Luna — lecture de l'usage", () => {
  it("préfère les chiffres de l'API à l'estimation", () => {
    const u = readUsage({ prompt_tokens: 123, completion_tokens: 45 }, 999, 999);
    expect(u.inputTokens).toBe(123);
    expect(u.outputTokens).toBe(45);
  });

  it("retombe sur l'estimation quand l'API ne dit rien", () => {
    const u = readUsage(undefined, 10, 20);
    expect(u.inputTokens).toBe(10);
    expect(u.outputTokens).toBe(20);
  });

  it("remonte les jetons servis depuis le cache du fournisseur", () => {
    const u = readUsage({ prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 800 } }, 0, 0);
    expect(u.cachedInputTokens).toBe(800);
  });
});
