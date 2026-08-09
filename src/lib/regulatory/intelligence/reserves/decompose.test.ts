import { describe, it, expect } from "vitest";
import { decomposeReserveText, categorizeReserve, classifyReserveType } from "./decompose";

describe("decomposeReserveText — décomposition des réserves (G9)", () => {
  it("découpe par numérotation et catégorise", () => {
    const letter = [
      "1. Fournir les données de stabilité en zone climatique IVb.",
      "2. Préciser la méthode de dosage validée (HPLC).",
      "3. Compléter le certificat GMP du fabricant.",
    ].join("\n");
    const points = decomposeReserveText(letter);
    expect(points).toHaveLength(3);
    expect(points[0].category).toBe("STABILITÉ");
    expect(points[1].category).toBe("ANALYTIQUE");
    expect(points[2].category).toBe("ADMINISTRATIF");
    expect(points[0].verbatim).toContain("zone climatique IVb"); // verbatim exact
  });

  it("reconnaît « Réserve N » et « Point N »", () => {
    const s = decomposeReserveText("Réserve 1 : Impuretés non spécifiées.\nRéserve 2 : Notice à corriger.");
    expect(s).toHaveLength(2);
    expect(s[0].category).toBe("QUALITÉ");
    expect(s[1].category).toBe("ÉTIQUETAGE");
  });

  it("sans numérotation : découpe par paragraphes", () => {
    const s = decomposeReserveText("Premier point de réserve.\n\nSecond point distinct.");
    expect(s).toHaveLength(2);
  });

  it("texte vide → aucun point", () => {
    expect(decomposeReserveText("")).toHaveLength(0);
  });

  it("categorizeReserve par mots-clés", () => {
    expect(categorizeReserve("étude de bioéquivalence")).toBe("CLINIQUE");
    expect(categorizeReserve("texte neutre sans mot-clé")).toBe("AUTRE");
  });
});

/**
 * STRUCTURE RÉELLE d'une lettre d'ÉVALUATION SCIENTIFIQUE ANPP — reproduit la forme exacte de la
 * lettre reçue sur la trithérapie (Abacavir/Lamivudine/Dolutégravir, 92 réserves) : sujets en
 * capitales, en-têtes de section CTD (avec les espaces que l'OCR insère), points en tirets.
 */
const REAL_LETTER = [
  "Madame, Monsieur,",
  "Suite à l'évaluation du dossier soumis à l'enregistrement du produit cité en objet certaines",
  "réserves ont été émises, nous vous prions de les lever dans les plus brefs délais :",
  "Module 3 :",
  "3.2.S :",
  "ABACAVIR SULFATE",
  "3.2. S.3.Caracterisation :",
  "- Veuillez fournir la partie 3.2.S.3 du DMF.",
  "3.2.S.7.3. Données sur la stabilité :",
  "- Veuillez compléter les données de stabilité a long terme.",
  "LAMIVUDINE",
  "3.2.S.4.3.Validation des Procédures analytiques :",
  "- Veuillez fournir la validation de la méthode de dosage des solvants résiduels (méthode I) avec",
  "tous les paramètres nécessaires. (il n'y a que l'exactitude qui est fourni).",
  "DOLUTEGRAVIR",
  "3.2.S.3.2 Impuretés :",
  "- Veuillez fournir le rapport de génotoxicité et de recherches des nitrosamines.",
  "- Veuillez fournir l'analyse du polymorphisme.",
  "Produit fini :",
  "3.2.P.1. Composition :",
  "- Veuillez justifier les différences de composition",
].join("\n");

describe("décomposition d'une lettre RÉELLE d'évaluation scientifique (structure CTD)", () => {
  const points = decomposeReserveText(REAL_LETTER);
  const byText = (frag: string) => points.find((p) => p.verbatim.includes(frag))!;

  it("chaque point porte la SECTION CTD de son en-tête (normalisée malgré l'OCR)", () => {
    expect(byText("partie 3.2.S.3 du DMF").sectionCode).toBe("3.2.S.3"); // « 3.2. S.3 » recollé
    expect(byText("stabilité a long terme").sectionCode).toBe("3.2.S.7.3");
    expect(byText("solvants résiduels").sectionCode).toBe("3.2.S.4.3");
    expect(byText("polymorphisme").sectionCode).toBe("3.2.S.3.2");
    expect(byText("différences de composition").sectionCode).toBe("3.2.P.1");
  });

  it("chaque point porte le SUJET englobant — sans lui, « compléter la stabilité » ne dit pas de quelle substance il s'agit", () => {
    expect(byText("partie 3.2.S.3 du DMF").subject).toBe("ABACAVIR SULFATE");
    expect(byText("solvants résiduels").subject).toBe("LAMIVUDINE");
    expect(byText("nitrosamines").subject).toBe("DOLUTEGRAVIR");
    expect(byText("différences de composition").subject).toBe("Produit fini");
  });

  it("les en-têtes de section ne deviennent JAMAIS des points (ils commencent pourtant par un chiffre)", () => {
    expect(points.some((p) => /Caracterisation\s*:$/.test(p.verbatim.trim()))).toBe(false);
    expect(points.some((p) => p.verbatim.trim() === "3.2.S :")).toBe(false);
  });

  it("un point qui COMMENCE par un code de section reste un point (phrase, pas en-tête)", () => {
    const s = decomposeReserveText("3.2.1 est absent du dossier soumis, veuillez le fournir dans les plus brefs délais.");
    expect(s).toHaveLength(1);
    expect(s[0].verbatim).toContain("est absent du dossier");
  });

  it("la ligne de continuation reste attachée à son point (paramètres de validation)", () => {
    expect(byText("solvants résiduels").verbatim).toContain("que l'exactitude qui est fourni");
  });
});

describe("classifyReserveType — les trois types de réserves ANPP", () => {
  it("une lettre structurée 3.2.S/3.2.P → ÉVALUATION SCIENTIFIQUE", () => {
    expect(classifyReserveType(REAL_LETTER)).toBe("EVALUATION_SCIENTIFIQUE");
  });

  it("une lettre module 1 (certificats, légalisation, RCP) → TECHNICO-RÉGLEMENTAIRE", () => {
    const letter = [
      "Module 1 — pièces administratives :",
      "1. Le certificat de produit pharmaceutique (CPP) fourni n'est pas légalisé.",
      "2. Veuillez fournir le certificat GMP en cours de validité du site de fabrication.",
      "3. Le RCP et la notice doivent être soumis en français et en arabe.",
    ].join("\n");
    expect(classifyReserveType(letter)).toBe("TECHNICO_REGLEMENTAIRE");
  });

  it("une lettre de contrôle des lots sur place → QC", () => {
    const letter = [
      "Suite au prélèvement des échantillons du lot 24A17 :",
      "1. Le laboratoire de contrôle a relevé une non-conformité du lot soumis à l'analyse.",
      "2. Veuillez soumettre de nouveaux échantillons pour contre-analyse.",
    ].join("\n");
    expect(classifyReserveType(letter)).toBe("QC");
  });

  it("texte trop court ou sans signal → indéterminé (jamais un type affirmé à tort)", () => {
    expect(classifyReserveType("Accusé de réception.")).toBeNull();
    expect(classifyReserveType("")).toBeNull();
  });
});
