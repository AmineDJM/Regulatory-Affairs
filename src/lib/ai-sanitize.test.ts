import { describe, it, expect } from "vitest";
import { sanitizeForModel } from "./ai";

/**
 * Le texte envoyé au modèle vient de PDF et d'OCR, pas d'un clavier. Un seul caractère invalide
 * — un demi-substitut UTF-16, un octet nul — rend le corps de la requête non conforme et l'API
 * répond 400 : la revue de fond du dossier ENTIER échoue à cause d'un caractère invisible.
 * Ces tests figent le nettoyage minimal qui l'évite, sans abîmer le texte utile.
 */
describe("sanitizeForModel — un caractère invisible ne doit pas faire échouer une analyse", () => {
  it("retire les demi-paires de substituts (haut et bas orphelins)", () => {
    expect(sanitizeForModel("Amoxicilline \uD800 500 mg")).toBe("Amoxicilline  500 mg");
    expect(sanitizeForModel("Dosage \uDC00 unitaire")).toBe("Dosage  unitaire");
  });

  it("conserve les paires VALIDES (un emoji reste un emoji)", () => {
    expect(sanitizeForModel("Conforme \u{1F9EA} test")).toBe("Conforme \u{1F9EA} test");
  });

  it("remplace les nuls et caractères de contrôle par une espace", () => {
    expect(sanitizeForModel("Lot A\u0000B")).toBe("Lot A B");
    expect(sanitizeForModel("Page\u001F2")).toBe("Page 2");
  });

  it("préserve tabulations et retours à la ligne (la mise en forme d'un tableau extrait)", () => {
    expect(sanitizeForModel("DCI\tDosage\nParacétamol\t500")).toBe("DCI\tDosage\nParacétamol\t500");
  });

  it("laisse intact un texte réglementaire ordinaire, accents compris", () => {
    const t = "Spécification : teneur 95,0 – 105,0 % (méthode CLHP). Conservation < 25 °C.";
    expect(sanitizeForModel(t)).toBe(t);
  });
});
