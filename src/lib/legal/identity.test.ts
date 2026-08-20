import { describe, it, expect } from "vitest";
import { IDENTITY_SECTIONS, identityFieldKeys, identityBlock, filledCount } from "./identity";

describe("IDENTITY_SECTIONS — la carte est un document, pas une liste de champs", () => {
  it("chaque champ porte une clé unique, sur toute la carte", () => {
    const keys = identityFieldKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("chaque section a un titre et au moins un champ", () => {
    for (const s of IDENTITY_SECTIONS) {
      expect(s.title.trim().length, s.key).toBeGreaterThan(0);
      expect(s.fields.length, s.key).toBeGreaterThan(0);
    }
  });

  it("l'ordre de lecture va de l'identité à la représentation", () => {
    expect(IDENTITY_SECTIONS.map((s) => s.key)).toEqual(["identity", "tax", "contact", "bank", "manager"]);
  });

  it("les identifiants qu'on recolle sont copiables ; les notes ne le sont pas", () => {
    const all = IDENTITY_SECTIONS.flatMap((s) => s.fields);
    expect(all.find((f) => f.key === "nif")?.copyable).toBe(true);
    expect(all.find((f) => f.key === "rib")?.copyable).toBe(true);
    expect(all.find((f) => f.key === "notes")?.copyable).toBe(false);
  });
});

describe("identityBlock — ce qu'on colle dans un appel d'offres", () => {
  it("n'écrit que les champs renseignés, dans l'ordre de la carte", () => {
    const block = identityBlock({ legalName: "Adventum Pharma SPA", nif: "0001", rib: "123" });
    expect(block).toBe("Dénomination exacte : Adventum Pharma SPA\nNIF : 0001\nRIB : 123");
  });

  // Une ligne « NIS : — » collée dans un dossier officiel donne l'air d'avoir répondu.
  it("n'écrit JAMAIS de ligne vide pour un champ non renseigné", () => {
    const block = identityBlock({ legalName: "X", nif: "", nis: null, rib: undefined, taxArticle: "   " });
    expect(block).toBe("Dénomination exacte : X");
  });

  it("laisse les notes de côté — on ne les recolle pas telles quelles", () => {
    expect(identityBlock({ notes: "Attention au RIB de 2019" })).toBe("");
  });

  it("rend une chaîne vide plutôt que des sauts de ligne quand rien n'est rempli", () => {
    expect(identityBlock({})).toBe("");
  });
});

describe("filledCount", () => {
  it("compte les champs renseignés sur le total de la carte", () => {
    const r = filledCount({ legalName: "X", nif: "0001", notes: "   " });
    expect(r.filled).toBe(2);
    expect(r.total).toBe(identityFieldKeys().length);
  });

  it("une carte vide vaut zéro, pas une erreur", () => {
    expect(filledCount({}).filled).toBe(0);
  });
});
