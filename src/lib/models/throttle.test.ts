import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  prendrePlace,
  noterEnTetes,
  noter429,
  noterSucces,
  etatPorte,
  reinitialiserPorte,
  lireDuree,
  estimerJetons,
} from "./throttle";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTE DE CONCURRENCE, ÉPROUVÉE À L'HORLOGE VIRTUELLE (§60-61).
 *
 * Chaque scénario est un incident RÉEL en miniature : le fournisseur qui rend 429 avec un
 * `Retry-After`, le solde qui fond avant le refus, la fenêtre de jetons trop petite pour un
 * éventail, la place fuitée par un appelant qui a planté. Le code éprouvé est EXACTEMENT celui
 * de production — seule l'horloge est virtuelle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

beforeEach(() => {
  vi.useFakeTimers();
  reinitialiserPorte();
  delete process.env.ADAM_MODEL_CONCURRENCY;
});

afterEach(() => {
  reinitialiserPorte();
  vi.useRealTimers();
  delete process.env.ADAM_MODEL_CONCURRENCY;
});

describe("lireDuree — le vocabulaire des en-têtes, jamais deviné", () => {
  it("lit les formes réelles d'OpenAI et rend null sur le reste", () => {
    expect(lireDuree("1s")).toBe(1_000);
    expect(lireDuree("250ms")).toBe(250);
    expect(lireDuree("6m0s")).toBe(360_000);
    expect(lireDuree("1m30s")).toBe(90_000);
    expect(lireDuree("12.5s")).toBe(12_500);
    expect(lireDuree("30")).toBe(30_000); // Retry-After nu = secondes
    expect(lireDuree("bientôt")).toBeNull();
    expect(lireDuree("")).toBeNull();
    expect(lireDuree(null)).toBeNull();
  });
});

describe("la capacité — configurée, puis gouvernée par l'AIMD", () => {
  it("au-delà de la capacité, le suivant ATTEND la libération — en FIFO", async () => {
    process.env.ADAM_MODEL_CONCURRENCY = "2";
    reinitialiserPorte();

    const r1 = await prendrePlace();
    const r2 = await prendrePlace();

    const ordre: string[] = [];
    const p3 = prendrePlace().then((r) => { ordre.push("troisieme"); return r; });
    const p4 = prendrePlace().then((r) => { ordre.push("quatrieme"); return r; });
    await vi.advanceTimersByTimeAsync(0);
    expect(etatPorte().enFile).toBe(2);
    expect(ordre).toEqual([]); // personne ne passe tant que rien n'est rendu

    r1();
    await vi.advanceTimersByTimeAsync(0);
    expect(ordre).toEqual(["troisieme"]); // le premier arrivé passe le premier

    r2();
    await vi.advanceTimersByTimeAsync(0);
    expect(ordre).toEqual(["troisieme", "quatrieme"]);

    (await p3)();
    (await p4)();
    expect(etatPorte().enVol).toBe(0);
  });

  it("rendre deux fois la même place ne crée pas de place fantôme", async () => {
    process.env.ADAM_MODEL_CONCURRENCY = "1";
    reinitialiserPorte();
    const r1 = await prendrePlace();
    r1();
    r1(); // double libération — idempotente
    expect(etatPorte().enVol).toBe(0);
    const r2 = await prendrePlace();
    expect(etatPorte().enVol).toBe(1);
    r2();
  });

  it("un 429 DIVISE la capacité et impose la pause demandée par Retry-After", async () => {
    process.env.ADAM_MODEL_CONCURRENCY = "8";
    reinitialiserPorte();

    noter429("3"); // Retry-After: 3 secondes
    expect(etatPorte().capacite).toBe(4);
    expect(etatPorte().refus429).toBe(1);

    let passe = false;
    const p = prendrePlace().then((r) => { passe = true; return r; });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(passe).toBe(false); // la pause se respecte
    await vi.advanceTimersByTimeAsync(2_100);
    expect(passe).toBe(true);
    (await p)();
  });

  it("sous 10 % de solde de requêtes, la porte RETRÉCIT AVANT le 429", () => {
    process.env.ADAM_MODEL_CONCURRENCY = "8";
    reinitialiserPorte();
    noterEnTetes({ "x-ratelimit-remaining-requests": "5", "x-ratelimit-limit-requests": "100" });
    expect(etatPorte().capacite).toBe(4);
    expect(etatPorte().retrecissements).toBe(1);
    expect(etatPorte().requetesRestantes).toBe(5);
  });

  it("dix succès d'affilée regagnent UN cran — l'additif, jamais un bond", () => {
    process.env.ADAM_MODEL_CONCURRENCY = "8";
    reinitialiserPorte();
    noter429(null); // 8 → 4
    for (let i = 0; i < 9; i++) noterSucces();
    expect(etatPorte().capacite).toBe(4);
    noterSucces(); // le dixième
    expect(etatPorte().capacite).toBe(5);
    // Et jamais au-delà du plafond configuré.
    for (let i = 0; i < 100; i++) noterSucces();
    expect(etatPorte().capacite).toBeLessThanOrEqual(8);
  });
});

describe("la fenêtre de jetons (§61) — l'éventail ne crève pas le plafond par minute", () => {
  it("réserve contre le solde observé et ATTEND le reset quand il ne loge plus", async () => {
    process.env.ADAM_MODEL_CONCURRENCY = "8";
    reinitialiserPorte();
    noterEnTetes({
      "x-ratelimit-remaining-tokens": "1000",
      "x-ratelimit-limit-tokens": "100000",
      "x-ratelimit-reset-tokens": "30s",
    });

    const r1 = await prendrePlace(800); // loge : 800 ≤ 1000
    expect(etatPorte().jetonsReserves).toBe(800);

    let passe = false;
    const p2 = prendrePlace(800).then((r) => { passe = true; return r; }); // 1600 > 1000 → attend
    await vi.advanceTimersByTimeAsync(5_000);
    expect(passe).toBe(false);
    expect(etatPorte().attentesJetons).toBe(1);

    await vi.advanceTimersByTimeAsync(26_000); // le reset annoncé est passé
    expect(passe).toBe(true);
    // La fenêtre périmée est OUBLIÉE — on ne raisonne pas sur un solde d'avant le reset.
    expect(etatPorte().jetonsRestants).toBeNull();

    r1();
    (await p2)();
    expect(etatPorte().jetonsReserves).toBe(0);
  });

  it("sans fenêtre observée, aucune réservation — on n'invente pas un solde", async () => {
    const r = await prendrePlace(50_000);
    expect(etatPorte().jetonsReserves).toBe(0);
    r();
  });

  it("l'estimation compte l'entrée à ~4 caractères par jeton PLUS le plafond de sortie", () => {
    expect(estimerJetons(4_000, 2_000)).toBe(3_000);
    expect(estimerJetons(0, null)).toBe(0);
  });
});

describe("le filet — une place fuitée ne gèle pas le produit", () => {
  it("après l'attente maximale, le passage est forcé et DIT", async () => {
    process.env.ADAM_MODEL_CONCURRENCY = "1";
    reinitialiserPorte();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await prendrePlace(); // jamais rendue — le bug d'appelant simulé
    let passe = false;
    const p = prendrePlace().then((r) => { passe = true; return r; });
    await vi.advanceTimersByTimeAsync(119_000);
    expect(passe).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(passe).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("passage forcé"));

    (await p)();
    warn.mockRestore();
  });
});

describe("le câblage réel — la passerelle passe par la porte, l'adaptateur la nourrit", () => {
  it("un 429 du fournisseur, VU à travers callModel, divise la capacité et compte", async () => {
    vi.useRealTimers(); // la boucle de réessai de l'adaptateur dort réellement (600 ms)
    reinitialiserPorte();
    process.env.OPENAI_API_KEY = "sk-essai";

    let appel = 0;
    vi.stubGlobal("fetch", async () => {
      appel++;
      if (appel === 1) {
        return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: { "retry-after": "2", "x-ratelimit-remaining-requests": "0", "x-ratelimit-limit-requests": "100" },
        });
      }
      return new Response(JSON.stringify({
        id: "r_ok", status: "completed",
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "ok" }] }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json", "x-ratelimit-remaining-tokens": "90000", "x-ratelimit-limit-tokens": "100000" } });
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { callModel } = await import("./gateway");
    const avant = etatPorte().capacite;
    const r = await callModel("bulk", [{ role: "user", content: "x" }]);

    expect(r.ok).toBe(true);
    expect(etatPorte().refus429).toBe(1);
    expect(etatPorte().capacite).toBeLessThan(avant);
    // Les en-têtes du 200 ont nourri la fenêtre de jetons.
    expect(etatPorte().jetonsRestants).toBe(90_000);

    errSpy.mockRestore();
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  }, 15_000);
});
