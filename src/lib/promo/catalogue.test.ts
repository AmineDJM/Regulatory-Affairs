import { describe, it, expect } from "vitest";
import {
  familleAValidite, familleDuType, familleQuantifiee, numeroDeReference, prochaineReference, referenceCatalogue, validerArticle,
} from "./catalogue";

/** LE CATALOGUE PROMOTIONNEL, RÈGLES PURES (§118.164) — la référence fixe, la famille, la saisie. */

const TYPES = new Set(["FICHE_POSO", "BANNER", "VIDEO", "STYLOS"]);

describe("La référence CAT-NNNN", () => {
  it("quatre chiffres AU MOINS, jamais au plus — la dix-millième ne retombe pas sur CAT-1000", () => {
    expect(referenceCatalogue(7)).toBe("CAT-0007");
    expect(referenceCatalogue(10000)).toBe("CAT-10000");
    expect(numeroDeReference("CAT-10000")).toBe(10000);
  });

  it("la suivante se lit sur le MAXIMUM, pas sur le compte — un trou ne refait pas une référence prise", () => {
    expect(prochaineReference(["CAT-0001", "CAT-0005"])).toBe("CAT-0006");
    expect(prochaineReference([])).toBe("CAT-0001");
    expect(prochaineReference(["MP-2026-001", "CAT-0002"]), "un dossier MP- n'est pas une référence du catalogue").toBe("CAT-0003");
  });
});

describe("La famille dit ce qu'on compte", () => {
  it("un support numérique n'a rien à compter ; seul un consommable périme", () => {
    expect(familleQuantifiee("NUMERIQUE")).toBe(false);
    expect(familleQuantifiee("DURABLE")).toBe(true);
    expect(familleAValidite("CONSOMMABLE")).toBe(true);
    expect(familleAValidite("DURABLE")).toBe(false);
  });

  it("la famille PROPOSÉE suit la nature du support — une proposition, que la personne peut changer", () => {
    expect(familleDuType("BANNER")).toBe("DURABLE");
    expect(familleDuType("VIDEO")).toBe("NUMERIQUE");
    expect(familleDuType("FICHE_POSO")).toBe("CONSOMMABLE");
    expect(familleDuType(null)).toBe("CONSOMMABLE");
  });
});

describe("Valider une saisie d'article", () => {
  it("dit TOUT ce qui manque, en une fois", () => {
    const v = validerArticle({ nom: " ", famille: null, materialType: null, unite: null, description: null, exigeProduit: false }, TYPES);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toMatch(/nom/);
    expect(v.error).toMatch(/famille/);
  });

  it("refuse une nature de support inconnue au lieu de l'écrire", () => {
    const v = validerArticle({ nom: "Kakémono", famille: "DURABLE", materialType: "KAKEMONO", unite: null, description: null, exigeProduit: false }, TYPES);
    expect(v.ok).toBe(false);
  });

  it("une unité vide redevient « pièce », et le reste est nettoyé", () => {
    const v = validerArticle({ nom: " Fiche posologique ", famille: "CONSOMMABLE", materialType: "FICHE_POSO", unite: "  ", description: " ", exigeProduit: true }, TYPES);
    expect(v).toEqual({ ok: true, article: { nom: "Fiche posologique", famille: "CONSOMMABLE", materialType: "FICHE_POSO", unite: "pièce", description: null, exigeProduit: true } });
  });
});
