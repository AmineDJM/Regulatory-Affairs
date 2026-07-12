import { describe, it, expect } from "vitest";
import { expandQueryTerms } from "./dossier-chat";
import { pageForOffset } from "./dossier-knowledge";

/**
 * Briques PURES de la récupération du chatbot (sans base) :
 *  - `expandQueryTerms` : décomposition question → termes saillants + synonymes du domaine + codes CTD ;
 *  - `pageForOffset` : décalage de caractère → PAGE exacte, via le cumul des `chars` par page océrisée.
 */

describe("expandQueryTerms — termes de recherche saillants", () => {
  it("garde les mots pleins, ajoute les synonymes du domaine, ignore les mots-vides", () => {
    const t = expandQueryTerms("Quelle est la durée de conservation du produit fini ?");
    expect(t).toContain("conservation");
    expect(t).toContain("stability"); // synonyme injecté (rappel FR↔EN)
    expect(t).not.toContain("quelle");
    expect(t).not.toContain("est");
    expect(t).not.toContain("la");
  });

  it("reconnaît un code CTD comme terme (renvoi vers l'en-tête)", () => {
    expect(expandQueryTerms("Où trouver la section 3.2.P.8 ?")).toContain("3.2.p.8");
  });

  it("plafonne à 8 termes et déduplique", () => {
    const t = expandQueryTerms("stabilité conservation stabilité fabricant dosage forme voie impureté excipient indication");
    expect(t.length).toBeLessThanOrEqual(8);
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("pageForOffset — décalage → page exacte", () => {
  const pages = [
    { page: 1, chars: 10 },
    { page: 5, chars: 20 }, // page « 5 » (numéro source) commence après 10 + « \n\n »
  ];
  it("attribue le décalage à la bonne page (bornes par cumul de chars)", () => {
    expect(pageForOffset(pages, 3)).toBe(1); // dans la page 1
    expect(pageForOffset(pages, 15)).toBe(5); // 0-based 14 ≥ 12 → page 2 (label 5)
  });
  it("au-delà de la dernière page → dernière page ; entrées invalides → null", () => {
    expect(pageForOffset(pages, 999)).toBe(5);
    expect(pageForOffset(null, 5)).toBeNull();
    expect(pageForOffset(pages, 0)).toBeNull();
  });
});
