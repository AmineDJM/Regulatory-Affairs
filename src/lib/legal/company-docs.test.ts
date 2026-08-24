import { describe, it, expect } from "vitest";
import { COMPANY_DOC_CATEGORIES, isCompanyDocCategory, suggestDocumentName } from "./company-docs";

describe("Les natures proposées sur la carte d'identité d'une entité", () => {
  it("n'expose AUCUNE nature réglementaire — c'est tout l'objet de cette liste", () => {
    // « CTD complet » ou « Module 3 » sur les statuts d'une société : trente-cinq entrées hors
    // sujet à écarter du regard avant de trouver la bonne, et l'on finit par tout mettre en « Autre ».
    for (const noise of ["CTD_FULL", "MODULE_1", "MODULE_3", "GMP_CERTIFICATE", "CPP", "QUERY_RECEIVED", "BV_RECEIPT"]) {
      expect(isCompanyDocCategory(noise), noise).toBe(false);
    }
  });

  it("garde les natures qui existent vraiment dans un dossier de société", () => {
    expect(isCompanyDocCategory("CONVENTION")).toBe(true);
    expect(isCompanyDocCategory("SUPPORTING_DOC")).toBe(true);
    expect(isCompanyDocCategory("OTHER")).toBe(true);
  });

  it("reste courte — une liste longue est une liste qu'on ne lit pas", () => {
    expect(COMPANY_DOC_CATEGORIES.length).toBeLessThanOrEqual(8);
  });

  it("ne se laisse pas duper par une valeur vide ou absente", () => {
    expect(isCompanyDocCategory("")).toBe(false);
    expect(isCompanyDocCategory(null)).toBe(false);
    expect(isCompanyDocCategory(undefined)).toBe(false);
  });
});

describe("Le nom proposé pour une pièce", () => {
  it("retire l'extension — c'est le nom qu'on lit, pas le fichier", () => {
    expect(suggestDocumentName("statuts-2019-signes.pdf")).toBe("statuts-2019-signes");
    expect(suggestDocumentName("RIB.PNG")).toBe("RIB");
  });

  it("garde un nom qui contient des points sans extension finale", () => {
    expect(suggestDocumentName("Attestation 12.03.2026")).toBe("Attestation 12.03");
  });

  it("ne rend jamais un nom vide — une ligne anonyme ne se retrouve pas", () => {
    expect(suggestDocumentName("")).toBe("Document");
    expect(suggestDocumentName(".pdf")).toBe("Document");
  });
});
