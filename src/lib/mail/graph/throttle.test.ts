import { describe, it, expect } from "vitest";
import { isRetryable, retryDelayMs, withRetry, MAX_ATTEMPTS } from "./throttle";

describe("Ce qui mérite un réessai, et ce qui ne s'améliorera jamais", () => {
  it("réessaie sur 429, 408 et 5xx", () => {
    for (const s of [429, 408, 500, 502, 503, 504]) expect(isRetryable(s), String(s)).toBe(true);
  });

  it("n'insiste pas sur 401, 403, 404, 400", () => {
    // Un jeton mort ne ressuscite pas en réessayant : insister ne fait que retarder le message
    // « reconnectez-vous », seul utile ici.
    for (const s of [400, 401, 403, 404, 409]) expect(isRetryable(s), String(s)).toBe(false);
  });

  it("un succès n'est pas réessayé", () => {
    expect(isRetryable(200)).toBe(false);
    expect(isRetryable(204)).toBe(false);
  });
});

describe("Combien de temps attendre", () => {
  it("respecte Retry-After en secondes — c'est Microsoft qui sait", () => {
    expect(retryDelayMs(0, "12")).toBe(12000);
  });

  it("respecte Retry-After donné en date HTTP", () => {
    const now = Date.parse("2026-08-16T10:00:00Z");
    expect(retryDelayMs(0, "Sun, 16 Aug 2026 10:00:05 GMT", now)).toBe(5000);
  });

  it("une date déjà passée ne donne pas une attente négative", () => {
    const now = Date.parse("2026-08-16T10:00:10Z");
    expect(retryDelayMs(0, "Sun, 16 Aug 2026 10:00:00 GMT", now)).toBe(0);
  });

  it("plafonne une consigne déraisonnable", () => {
    // Attendre une heure dans une requête d'écran revient à ne jamais répondre.
    expect(retryDelayMs(0, "3600")).toBeLessThanOrEqual(30_000);
  });

  it("sans Retry-After, l'attente double à chaque essai", () => {
    const d0 = retryDelayMs(0, null);
    const d2 = retryDelayMs(2, null);
    expect(d0).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d0);
    expect(d2).toBeLessThanOrEqual(30_000);
  });

  it("ajoute un peu d'aléa — dix requêtes ne doivent pas repartir à la même milliseconde", () => {
    const values = new Set(Array.from({ length: 20 }, () => retryDelayMs(1, null)));
    expect(values.size).toBeGreaterThan(1);
  });

  it("un Retry-After illisible ne casse pas le calcul", () => {
    expect(retryDelayMs(0, "bientôt")).toBeGreaterThan(0);
  });
});

describe("La boucle de réessai", () => {
  const noSleep = async () => {};

  it("rend le premier succès sans attendre", async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls += 1; return { status: 200, retryAfter: null }; }, { sleep: noSleep });
    expect(r.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("réessaie après un 429, puis réussit", async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls += 1;
      return calls === 1 ? { status: 429, retryAfter: "1" } : { status: 200, retryAfter: null };
    }, { sleep: noSleep });
    expect(r.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("rend la main aussitôt sur une erreur définitive", async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls += 1; return { status: 401, retryAfter: null }; }, { sleep: noSleep });
    expect(r.status).toBe(401);
    expect(calls).toBe(1);
  });

  it("abandonne après le nombre d'essais prévu, sans boucler indéfiniment", async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls += 1; return { status: 503, retryAfter: null }; }, { sleep: noSleep });
    expect(calls).toBe(MAX_ATTEMPTS);
    expect(r.status).toBe(503); // le dernier résultat est rendu : l'appelant décide quoi en dire
  });

  it("attend RÉELLEMENT entre deux essais — sinon on aggrave le blocage", async () => {
    // Réessayer aussitôt après un 429 prolonge la limitation au lieu de la résorber.
    const waited: number[] = [];
    let calls = 0;
    await withRetry(async () => {
      calls += 1;
      return calls < 3 ? { status: 429, retryAfter: "2" } : { status: 200, retryAfter: null };
    }, { sleep: async (ms) => { waited.push(ms); } });
    expect(waited).toEqual([2000, 2000]);
  });
});
