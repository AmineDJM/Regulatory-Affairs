import { afterEach, describe, expect, it } from "vitest";
import { guardMode } from "./guard";
import { PRODUCTION_SAFETY_PHRASE } from "./types";

const setEnv = (v: string) => { process.env.TEST_CENTER_ENV = v; };
afterEach(() => { delete process.env.TEST_CENTER_ENV; });

describe("Test Center — garde production (§1/§12)", () => {
  it("hors production, un mode d'écriture est autorisé sans confirmation", () => {
    setEnv("development");
    expect(guardMode("SAFE_SYNTHETIC_TEST", {}).ok).toBe(true);
  });

  it("en production, la lecture seule reste autorisée", () => {
    setEnv("production");
    expect(guardMode("READ_ONLY_AUDIT", {}).ok).toBe(true);
  });

  it("en production, un mode d'écriture SANS confirmation est refusé", () => {
    setEnv("production");
    const r = guardMode("SAFE_SYNTHETIC_TEST", {});
    expect(r.ok).toBe(false);
    expect(r.error).toContain("confirmation");
  });

  it("en production, confirmation cochée mais phrase erronée = refus", () => {
    setEnv("production");
    const r = guardMode("SAFE_SYNTHETIC_TEST", { productionConfirmed: true, safetyPhrase: "n'importe quoi" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Phrase de sécurité");
  });

  it("en production, confirmation + phrase exacte = autorisé", () => {
    setEnv("production");
    expect(guardMode("SAFE_SYNTHETIC_TEST", { productionConfirmed: true, safetyPhrase: PRODUCTION_SAFETY_PHRASE }).ok).toBe(true);
  });
});
