import { describe, it, expect } from "vitest";
import { quotaVerdict, makeTtlCache, GB } from "./quota";

describe("Deux plafonds, et le plus actionnable d'abord", () => {
  const base = { userUsageBytes: 0, physicalUsageBytes: 0, fileSize: 1024, userQuotaGb: 10, capacityGb: 100 };

  it("laisse passer ce qui tient dans les deux", () => {
    expect(quotaVerdict(base).ok).toBe(true);
  });

  it("refuse au quota de la personne, en le NOMMANT", () => {
    const v = quotaVerdict({ ...base, userUsageBytes: 10 * GB });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.error).toContain("10 Go par utilisateur");
  });

  it("quand les deux sont dépassés, on dit celui que la personne peut régler", () => {
    // « Votre quota est atteint » se traite soi-même ; « capacité globale » n'est actionnable que
    // par l'administrateur. Annoncer le second en premier envoie déranger quelqu'un pour rien.
    const v = quotaVerdict({ ...base, userUsageBytes: 10 * GB, physicalUsageBytes: 100 * GB });
    expect(v.ok === false && v.error).toContain("par utilisateur");
  });

  it("refuse à la capacité de la machine", () => {
    const v = quotaVerdict({ ...base, physicalUsageBytes: 100 * GB });
    expect(v.ok === false && v.error).toContain("Capacité globale");
  });

  it("le fichier compte dans le total — un envoi qui ferait déborder est refusé AVANT d'être écrit", () => {
    expect(quotaVerdict({ ...base, userUsageBytes: 10 * GB - 512, fileSize: 1024 }).ok).toBe(false);
    expect(quotaVerdict({ ...base, userUsageBytes: 10 * GB - 2048, fileSize: 1024 }).ok).toBe(true);
  });
});

describe("Une valeur coûteuse, relue rarement, corrigée entre-temps", () => {
  const cacheOf = (ttl = 30_000) => {
    let now = 0;
    let calls = 0;
    const c = makeTtlCache(async () => { calls += 1; return calls * 100; }, ttl, () => now);
    return { c, tick: (ms: number) => { now += ms; }, calls: () => calls };
  };

  it("ne relit pas la source tant que la valeur est fraîche", async () => {
    const { c, tick, calls } = cacheOf();
    expect(await c.get()).toBe(100);
    tick(29_000);
    expect(await c.get()).toBe(100);
    expect(calls()).toBe(1);
  });

  it("relit une fois la valeur périmée", async () => {
    const { c, tick, calls } = cacheOf();
    await c.get();
    tick(31_000);
    expect(await c.get()).toBe(200);
    expect(calls()).toBe(2);
  });

  it("dix envois simultanés sur un cache froid ne déclenchent qu'UNE lecture", async () => {
    // C'est exactement la situation qu'on voulait supprimer : six fichiers en parallèle, six
    // parcours de table lancés avant que le premier octet ne soit écrit.
    const { c, calls } = cacheOf();
    const all = await Promise.all(Array.from({ length: 10 }, () => c.get()));
    expect(all.every((v) => v === 100)).toBe(true);
    expect(calls()).toBe(1);
  });

  it("une correction reste visible sans rafraîchir l'horloge", async () => {
    const { c, calls } = cacheOf();
    await c.get();
    c.patch((v) => v + 42);
    expect(await c.get()).toBe(142);
    expect(calls()).toBe(1);
  });

  it("corriger un cache vide ne fabrique pas une valeur inventée", async () => {
    const { c, calls } = cacheOf();
    c.patch((v) => v + 42); // rien en mémoire : la correction est sans objet
    expect(await c.get()).toBe(100);
    expect(calls()).toBe(1);
  });

  it("l'invalidation force la relecture au prochain appel", async () => {
    const { c, calls } = cacheOf();
    await c.get();
    c.invalidate();
    expect(await c.get()).toBe(200);
    expect(calls()).toBe(2);
  });

  it("une lecture en échec ne se fige pas — le prochain appel réessaie", async () => {
    let calls = 0;
    const c = makeTtlCache(async () => {
      calls += 1;
      if (calls === 1) throw new Error("base injoignable");
      return 7;
    }, 30_000, () => 0);
    await expect(c.get()).rejects.toThrow("injoignable");
    expect(await c.get()).toBe(7);
  });
});
