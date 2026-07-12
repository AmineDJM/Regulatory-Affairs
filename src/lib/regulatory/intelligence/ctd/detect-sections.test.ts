import { describe, it, expect } from "vitest";
import { detectContainedSections } from "./detect-sections";
import { assessVersion, type TwinDoc } from "../rules/engine";

/**
 * Détection multi-sections d'un PDF consolidé (« Module 3.pdf » qui contient 3.2.S, 3.2.P, 3.2.P.8…)
 * + preuve que la complétude cesse de signaler ces sections comme « manquantes » à tort. PRÉCISION :
 * un code ne compte qu'en EN-TÊTE corroboré par son titre — un renvoi (« voir 3.2.P.8 ») ne compte pas.
 */

describe("detectContainedSections", () => {
  it("détecte plusieurs sections d'un module consolidé (code + titre)", () => {
    const toc = [
      "TABLE OF CONTENTS",
      "3.2.S Drug Substance .................... 5",
      "3.2.P Drug Product ...................... 40",
      "3.2.P.5 Control of Drug Product ......... 60",
      "3.2.P.8 Stability ....................... 80",
      "Corps du document sur le procédé de fabrication et les spécifications.",
    ].join("\n");
    const codes = detectContainedSections(toc).map((d) => d.code);
    expect(codes).toContain("3.2.S");
    expect(codes).toContain("3.2.P");
    expect(codes).toContain("3.2.P.5");
    expect(codes).toContain("3.2.P.8");
  });

  it("n'invente rien : un simple renvoi ou un nombre (sans titre proche) ne compte pas", () => {
    const codes = detectContainedSections("Se référer à 3.2.P.8 pour les détails. Un lot de 3.2 millions de comprimés.").map((d) => d.code);
    expect(codes).not.toContain("3.2.P.8"); // renvoi sans titre → pas un en-tête
    expect(codes).toHaveLength(0);
  });

  it("détecte 2.3 (QOS) et 1.2 (Formulaire) via leur titre", () => {
    expect(detectContainedSections("2.3 Quality Overall Summary\nCe QOS couvre la qualité...").map((d) => d.code)).toContain("2.3");
    expect(detectContainedSections("1.2 Formulaire de demande d'enregistrement\n...").map((d) => d.code)).toContain("1.2");
  });
});

describe("assessVersion — un PDF consolidé couvre ses sous-sections", () => {
  it("les sections contenues font tomber les fausses « sections obligatoires manquantes »", () => {
    const moduleText = "3.2.S Drug Substance\n3.2.P Drug Product\n3.2.P.5 Control of Drug Product\n3.2.P.8 Stability of the finished product";
    const contained = detectContainedSections(moduleText).map((d) => d.code);
    const docs: TwinDoc[] = [
      { id: "1", originalFilename: "Module 3.pdf", ctdSection: "3.2.A", ctdModule: "M3", containedSections: contained, securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", classificationMethod: "keyword" },
    ];
    const { findings } = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: docs });
    const missing = findings.filter((f) => f.code === "MISSING_REQUIRED_SECTION").map((f) => f.sectionCode);
    // 3.2.P / 3.2.P.5 / 3.2.P.8 sont DANS le PDF consolidé → plus signalées manquantes.
    expect(missing).not.toContain("3.2.P");
    expect(missing).not.toContain("3.2.P.5");
    expect(missing).not.toContain("3.2.P.8");
  });
});
