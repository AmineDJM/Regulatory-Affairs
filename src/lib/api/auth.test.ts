import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, sameHash, readBearer } from "./auth";

describe("clé d'API", () => {
  it("émet une clé reconnaissable, et n'en stocke que l'empreinte", () => {
    const { key, keyHash, keyPrefix } = generateApiKey();
    expect(key.startsWith("amd_sk_")).toBe(true);
    expect(key.length).toBeGreaterThan(40);
    expect(keyHash).toHaveLength(64);
    expect(keyHash).not.toContain(key.slice(7));
    expect(key.startsWith(keyPrefix)).toBe(true);
  });

  it("deux clés ne se ressemblent pas", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });

  it("l'empreinte est stable et discriminante", () => {
    expect(hashApiKey("amd_sk_a")).toBe(hashApiKey("amd_sk_a"));
    expect(hashApiKey("amd_sk_a")).not.toBe(hashApiKey("amd_sk_b"));
  });

  it("compare à temps constant, et refuse des longueurs différentes", () => {
    expect(sameHash("abc", "abc")).toBe(true);
    expect(sameHash("abc", "abd")).toBe(false);
    expect(sameHash("abc", "ab")).toBe(false);
  });

  it("lit la clé en « Bearer », et rejette ce qui n'est pas une clé", () => {
    expect(readBearer("Bearer amd_sk_x")).toBe("amd_sk_x");
    expect(readBearer("bearer amd_sk_x")).toBe("amd_sk_x");
    expect(readBearer("amd_sk_x")).toBe("amd_sk_x");
    expect(readBearer("Bearer un-jeton-quelconque")).toBeNull();
    expect(readBearer(null)).toBeNull();
  });
});
