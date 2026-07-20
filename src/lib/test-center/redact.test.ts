import { describe, expect, it } from "vitest";
import { redact } from "./redact";

describe("Test Center — expurgation : secrets masqués, métriques préservées", () => {
  it("masque les VRAIS secrets", () => {
    const r = redact({ password: "p", passwordHash: "h", token: "t", apiKey: "k", secret: "s", salt: "x" }) as Record<string, unknown>;
    for (const k of ["password", "passwordHash", "token", "apiKey", "secret", "salt"]) expect(r[k]).toBe("[redacted]");
  });

  it("ne masque PAS « passed » ni le « hash » d'intégrité (faux positifs corrigés)", () => {
    const r = redact({ invariants: { total: 8, passed: 7, failed: 1, skipped: 0 }, hash: "d5bc0b19", findingsFingerprint: "abc" }) as {
      invariants: { passed: number; total: number }; hash: string; findingsFingerprint: string;
    };
    expect(r.invariants.passed).toBe(7);
    expect(r.invariants.total).toBe(8);
    expect(r.hash).toBe("d5bc0b19");
    expect(r.findingsFingerprint).toBe("abc");
  });

  it("masque toujours les hash de secrets (tokenHash, passHash)", () => {
    const r = redact({ tokenHash: "a", passHash: "b" }) as Record<string, unknown>;
    expect(r.tokenHash).toBe("[redacted]");
    expect(r.passHash).toBe("[redacted]");
  });

  it("tronque les chaînes très longues", () => {
    const long = "x".repeat(900);
    expect((redact({ note: long }) as { note: string }).note.length).toBeLessThan(520);
  });
});
