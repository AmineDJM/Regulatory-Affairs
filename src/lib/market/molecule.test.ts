import { describe, expect, it } from "vitest";
import { moleculeStem, moleculeMatches, canonicalForm, extractDosage, dosageMatches } from "./galenic";
import { labKey } from "./molecule";

/**
 * Ces normalisations sont le PONT entre trois sources qui n'écrivent rien pareil :
 * IQVIA (anglais, présentations abrégées), PCH (français, dosage dans le texte) et la
 * Nomenclature (structurée, avec les sels). Si le pont casse, l'analyse concurrentielle
 * compte le même laboratoire deux fois, ou rate la moitié d'un marché.
 *
 * Tous les cas ci-dessous sont tirés des données RÉELLES du projet.
 */

describe("Molécule — le radical rapproche les trois sources", () => {
  it("rapproche l'anglais d'IQVIA et le français de la nomenclature", () => {
    expect(moleculeMatches("AMOXICILLIN", "AMOXICILLINE")).toBe(true);
    expect(moleculeMatches("AMOXICILLINE", "AMOXICILLIN")).toBe(true);
  });

  it("ignore le sel et l'état d'hydratation — c'est la même molécule", () => {
    expect(moleculeStem("AMOXICILLINE SODIQUE")).toBe(moleculeStem("AMOXICILLINE"));
    expect(moleculeStem("CETIRIZINE DICHLORHYDRATE")).toBe(moleculeStem("CETIRIZINE"));
    expect(moleculeMatches("AMOXICILLINE TRIHYDRATEE EXPRIME EN AMOXICILLINE", "AMOXICILLINE")).toBe(true);
  });

  it("retrouve une molécule au sein d'une association", () => {
    expect(moleculeMatches("AMOXICILLINE ACIDE CLAVULANIQUE", "AMOXICILLINE")).toBe(true);
    expect(moleculeMatches("PARACETAMOL CODEINE PHOSPHATE", "PARACETAMOL")).toBe(true);
  });

  it("mais une association demandée exige TOUS ses composants", () => {
    expect(moleculeMatches("PARACETAMOL", "PARACETAMOL CODEINE")).toBe(false);
    expect(moleculeMatches("PARACETAMOL CODEINE", "PARACETAMOL CODEINE")).toBe(true);
  });

  it("ne confond pas deux molécules différentes", () => {
    expect(moleculeMatches("PARACETAMOL", "AMOXICILLINE")).toBe(false);
    expect(moleculeMatches("IBUPROFENE", "PARACETAMOL")).toBe(false);
  });

  it("une saisie trop courte ne ramène rien plutôt que tout", () => {
    expect(moleculeMatches("PARACETAMOL", "PA")).toBe(false);
  });
});

describe("Forme galénique — les abréviations IQVIA réelles", () => {
  it("reconnaît les formes orales sèches", () => {
    expect(canonicalForm("CP.PE 875MG/ 125 MG 10")).toBe("COMPRIME");
    expect(canonicalForm("CPR. DISPERS 1 G 14")).toBe("COMPRIME");
    expect(canonicalForm("GELULE 500 MG 12")).toBe("GELULE");
    expect(canonicalForm("COMPRIME PELLICULE SECABLE")).toBe("COMPRIME");
  });

  it("reconnaît les poudres pour suspension buvable, quelle que soit l'abréviation", () => {
    for (const p of ["P.S.S 500MG/ 62.5 MG 14", "PDR/SIR 500 MG /5ML 1 60 ML", "P/SUS E 8/1 12.5 MG", "PDR.SUS.100/ 12.5 MG", "SOLUTION BUVABLE"]) {
      expect(canonicalForm(p)).toBe("SIROP");
    }
  });

  it("reconnaît les sachets et granulés", () => {
    expect(canonicalForm("P.SU.SAC 1G/ 125 MG 14")).toBe("SACHET");
    expect(canonicalForm("PD.SAC A 8/1 1125 MG 12")).toBe("SACHET");
    expect(canonicalForm("GRA.SOLU.SAC 20")).toBe("SACHET");
  });

  it("compte les stylos et seringues préremplies comme des INJECTABLES — c'est ainsi qu'ils s'achètent", () => {
    for (const p of ["STYL PRE REM 100 UI", "SER PREREMPL 40 MG", "FLEXPEN 100 UI/ML", "KWIKPEN 100 UI", "SOLOSTAR 300 UI", "SOLUTION INJECTABLE", "AMOXICILLINE INJ 1G"]) {
      expect(canonicalForm(p)).toBe("INJECTABLE");
    }
  });

  it("ne prend pas un gel dermique pour une gélule", () => {
    expect(canonicalForm("GELULE 500 MG")).toBe("GELULE");
    expect(canonicalForm("GEL DERMIQUE 1 30 G")).toBe("POMMADE");
  });

  it("classe les dispositifs à part, plutôt que de les déguiser en médicaments", () => {
    expect(canonicalForm("BANDELETTES 50")).toBe("DISPOSITIF");
    expect(canonicalForm("LECTEUR GLYCEMIE")).toBe("DISPOSITIF");
  });

  it("retrouve la forme même écrite APRÈS le dosage", () => {
    expect(canonicalForm("500 MG COMPRIME PELLICULE")).toBe("COMPRIME");
  });
});

describe("Dosage — extraction et comparaison", () => {
  it("extrait un dosage simple et une association", () => {
    expect(extractDosage("GELULE 500 MG 12")).toBe("500MG");
    expect(extractDosage("CP.PE 875MG/ 125 MG 10")).toBe("875MG/125MG");
    expect(extractDosage("AMOXICILLINE INJ 1G")).toBe("1G");
  });

  it("n'invente rien quand il n'y a pas de dosage", () => {
    expect(extractDosage("BANDELETTES")).toBeNull();
    expect(extractDosage("")).toBeNull();
  });

  it("compare sans se soucier des espaces ni de la casse", () => {
    expect(dosageMatches("500MG", "500 mg")).toBe(true);
    expect(dosageMatches("875MG/125MG", "875mg")).toBe(true);
    expect(dosageMatches("500MG", "1G")).toBe(false);
  });

  it("aucun dosage demandé = aucune exclusion", () => {
    expect(dosageMatches("500MG", "")).toBe(true);
  });
});

describe("Laboratoire — un acteur, un seul, malgré trois raisons sociales", () => {
  it("réconcilie les écritures des trois sources", () => {
    const k = labKey("SAIDAL");
    expect(labKey("GROUPE SAIDAL")).toBe(k);
    expect(labKey("EPE / SPA GROUPE SAIDAL")).toBe(k);
  });

  it("réconcilie les formes juridiques et les mots génériques", () => {
    expect(labKey("SPA LABORATOIRES FRATER RAZES")).toBe(labKey("FRATER RAZES"));
    expect(labKey("EL KENDI INDUSTRIE DU MEDICAMENT")).toBe(labKey("EL KENDI"));
  });

  it("ne fusionne pas deux laboratoires distincts", () => {
    expect(labKey("SAIDAL")).not.toBe(labKey("BIOCARE"));
    expect(labKey("HIKMA PHARMA")).not.toBe(labKey("SANOFI"));
  });
});
