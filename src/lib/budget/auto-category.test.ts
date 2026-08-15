import { describe, it, expect } from "vitest";
import { pickAutoCategory, envelopeCovers } from "./auto-category";

const env = (id: string, over: Partial<Parameters<typeof envelopeCovers>[0]> = {}) => ({
  id, isActive: true, modules: [] as string[], periodStart: "2026-01-01", ...over,
});
const cat = (id: string, envelopeId: string, over: Partial<{ module: string | null; parentId: string | null; createdAt: string }> = {}) => ({
  id, envelopeId, module: null as string | null, parentId: null as string | null, createdAt: "2026-01-01", ...over,
});

describe("Une enveloppe qui couvre le module suffit — c'est ce qui branche les BV", () => {
  it("le bordereau payé tombe dans la première catégorie de l'enveloppe Regulatory", () => {
    // Le cas réel : on crée l'enveloppe, on coche « Regulatory », et on n'a RIEN d'autre à faire.
    const envelopes = [env("reg", { modules: ["REGULATORY"] })];
    const cats = [cat("droits", "reg"), cat("expertise", "reg", { createdAt: "2026-02-01" })];
    expect(pickAutoCategory("REGULATORY", envelopes, cats)).toBe("droits");
  });

  it("une catégorie qui déclare le module l'emporte sur le simple rattachement d'enveloppe", () => {
    const envelopes = [env("reg", { modules: ["REGULATORY"] })];
    const cats = [cat("divers", "reg"), cat("bv", "reg", { module: "REGULATORY", createdAt: "2026-03-01" })];
    expect(pickAutoCategory("REGULATORY", envelopes, cats)).toBe("bv");
  });

  it("ignore les enveloppes CLÔTURÉES — on n'alimente pas un exercice fermé", () => {
    const envelopes = [env("vieille", { modules: ["REGULATORY"], isActive: false })];
    expect(pickAutoCategory("REGULATORY", envelopes, [cat("x", "vieille")])).toBeNull();
  });

  it("entre deux enveloppes actives, la plus récente reçoit", () => {
    const envelopes = [
      env("2025", { modules: ["REGULATORY"], periodStart: "2025-01-01" }),
      env("2026", { modules: ["REGULATORY"], periodStart: "2026-01-01" }),
    ];
    const cats = [cat("c25", "2025"), cat("c26", "2026")];
    expect(pickAutoCategory("REGULATORY", envelopes, cats)).toBe("c26");
  });

  it("ne vise jamais une SOUS-catégorie : ce choix-là revient à la Direction", () => {
    const envelopes = [env("reg", { modules: ["REGULATORY"] })];
    const cats = [cat("sous", "reg", { parentId: "parent", module: "REGULATORY" })];
    expect(pickAutoCategory("REGULATORY", envelopes, cats)).toBeNull();
  });

  it("aucune enveloppe pour ce module : « à imputer », et non une enveloppe voisine", () => {
    const envelopes = [env("adpro", { modules: ["SPONSORING"] })];
    expect(pickAutoCategory("REGULATORY", envelopes, [cat("spons", "adpro")])).toBeNull();
  });

  it("une enveloppe couvrante mais VIDE ne capte rien — il n'y a pas où poser la somme", () => {
    const envelopes = [env("reg", { modules: ["REGULATORY"] })];
    expect(pickAutoCategory("REGULATORY", envelopes, [])).toBeNull();
  });

  it("sans module source, on n'invente pas de destination", () => {
    expect(pickAutoCategory(null, [env("reg", { modules: ["REGULATORY"] })], [cat("c", "reg")])).toBeNull();
  });

  it("reconnaît le champ historique `module` d'une enveloppe ancienne", () => {
    expect(envelopeCovers(env("x", { module: "REGULATORY" }), "REGULATORY")).toBe(true);
    expect(envelopeCovers(env("x", { modules: ["RH"] }), "REGULATORY")).toBe(false);
  });
});
