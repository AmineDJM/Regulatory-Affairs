import { describe, it, expect } from "vitest";
import { extOf, isImportableExt, titleFromFilename, codeFromTitle, CORPUS_IMPORT_EXTS } from "./import-formats";

describe("extOf", () => {
  it("rend l'extension en minuscules, sans le point", () => {
    expect(extOf("Arrete.PDF")).toBe("pdf");
    expect(extOf("guide.docx")).toBe("docx");
  });

  it("rend une chaîne vide plutôt que de deviner", () => {
    expect(extOf("document-sans-extension")).toBe("");
    expect(extOf("  ")).toBe("");
  });

  it("ne se laisse pas tromper par un point dans le nom", () => {
    expect(extOf("ICH Q1A(R2) rev.2 final.pdf")).toBe("pdf");
  });
});

describe("isImportableExt", () => {
  it("accepte les formats dont on tire un texte fiable", () => {
    for (const e of CORPUS_IMPORT_EXTS) expect(isImportableExt(e)).toBe(true);
    expect(isImportableExt("PDF")).toBe(true);
  });

  it("refuse une image — le corpus attend un texte sélectionnable, pas un scan", () => {
    expect(isImportableExt("png")).toBe(false);
    expect(isImportableExt("jpg")).toBe(false);
    expect(isImportableExt("doc")).toBe(false); // binaire hérité : pas d'extraction fiable
  });
});

describe("titleFromFilename", () => {
  it("retire l'extension et remplace les soulignés", () => {
    expect(titleFromFilename("Arrete_du_10_05_2021.pdf")).toBe("Arrete du 10 05 2021");
  });

  it("retire l'horodatage que les téléchargements collent devant", () => {
    // Sans cela, un corpus réglementaire finit en liste de « 2026-08-07_… ».
    expect(titleFromFilename("2026-08-07_ICH Q1A.pdf")).toBe("ICH Q1A");
    expect(titleFromFilename("20260807 Guideline.pdf")).toBe("Guideline");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(titleFromFilename(".pdf")).toBe("Document sans nom");
    expect(titleFromFilename("")).toBe("Document sans nom");
  });
});

describe("codeFromTitle", () => {
  it("rend un code stable, sans accents ni ponctuation", () => {
    expect(codeFromTitle("Arrêté du 10/05/2021 — dossier CTD")).toBe("ARRETE-DU-10-05-2021-DOSSIER-CTD");
  });

  it("donne le MÊME code au même texte réimporté — sinon l'historique se disperse", () => {
    // C'est ce qui permet à la détection de doublon de fonctionner d'un import à l'autre.
    expect(codeFromTitle("ICH Q1A(R2)")).toBe(codeFromTitle("ICH  Q1A(R2)"));
  });

  it("ne rend jamais un code vide ni bordé de tirets", () => {
    expect(codeFromTitle("///")).toBe("DOC");
    expect(codeFromTitle("— Guide —")).toBe("GUIDE");
  });

  it("borne la longueur", () => {
    expect(codeFromTitle("A".repeat(200)).length).toBe(60);
  });
});
