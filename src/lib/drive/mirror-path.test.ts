import { describe, it, expect } from "vitest";
import { shouldMirrorToDrive, safeFolderName, importFolderPath, IMPORT_DRIVE_ROOT } from "./mirror-path";

describe("Ce qui entre dans l'ERP entre aussi dans le Drive", () => {
  it("un import depuis n'importe quel module part au Drive", () => {
    expect(shouldMirrorToDrive("SPONSORING")).toBe(true);
    expect(shouldMirrorToDrive("PCH_TENDER")).toBe(true);
    expect(shouldMirrorToDrive("HR_REQUEST")).toBe(true);
    expect(shouldMirrorToDrive("UN_TYPE_AJOUTE_DEMAIN")).toBe(true);
  });

  it("sauf ce qui a déjà son miroir — on ne veut pas deux copies du même fichier", () => {
    // Regulatory range par produit et partage avec les parties prenantes : le refaire ici
    // fabriquerait un doublon, et c'est ce qui fait perdre confiance dans un drive.
    expect(shouldMirrorToDrive("REGULATORY_PRODUCT")).toBe(false);
    // Un fichier déposé DANS le Drive n'a pas à être recopié dans le Drive.
    expect(shouldMirrorToDrive("DRIVE_NODE")).toBe(false);
  });

  it("sans type d'objet, on ne range nulle part", () => {
    expect(shouldMirrorToDrive("")).toBe(false);
  });
});

describe("Un nom de dossier qui ne casse pas l'arborescence", () => {
  it("une barre oblique ne fabrique pas un sous-dossier fantôme", () => {
    expect(safeFolderName("Devis 2026/2027")).toBe("Devis 2026-2027");
    expect(safeFolderName("Chemin\\Windows")).toBe("Chemin-Windows");
  });

  it("les caractères de contrôle et les espaces multiples disparaissent", () => {
    expect(safeFolderName("A\u0000B\u001FC")).toBe("A B C");
    expect(safeFolderName("  Trop   d'espaces  ")).toBe("Trop d'espaces");
  });

  it("un nom vide retombe sur le repli, jamais sur un dossier sans nom", () => {
    expect(safeFolderName("   ")).toBe("Sans nom");
    expect(safeFolderName("///", "Autres")).toBe("Autres");
  });

  it("un nom interminable est coupé — une liste reste lisible", () => {
    expect(safeFolderName("x".repeat(400)).length).toBe(120);
  });
});

describe("Où l'on retrouvera le fichier", () => {
  it("range par module puis par objet, sous une seule boîte", () => {
    expect(importFolderPath("SPONSORING", "SPO-2026-014", "ck1234567890")).toEqual([
      IMPORT_DRIVE_ROOT, "Sponsoring", "SPO-2026-014",
    ]);
  });

  it("le module est écrit dans les mots de l'ERP, pas en majuscules techniques", () => {
    expect(importFolderPath("PCH_TENDER", "AO-12", "id")[1]).toBe("Appel d'offres");
    expect(importFolderPath("HR_REQUEST", null, "id")[1]).toBe("Demande RH");
  });

  it("un type inconnu ne casse rien : il porte son propre nom", () => {
    expect(importFolderPath("TYPE_INCONNU", "REF-1", "id")[1]).toBe("TYPE_INCONNU");
  });

  it("sans référence, deux objets différents ne se mélangent pas", () => {
    const a = importFolderPath("EVENT", null, "aaaaaaaa1111");
    const b = importFolderPath("EVENT", "", "bbbbbbbb2222");
    expect(a[2]).not.toBe(b[2]);
    expect(a[2]).toBe("Dossier aaaaaaaa");
  });

  it("toujours trois niveaux — la boîte, le module, l'objet", () => {
    expect(importFolderPath("EVENT", "EVT-1", "id")).toHaveLength(3);
    expect(importFolderPath("EVENT", "EVT-1", "id")[0]).toBe(IMPORT_DRIVE_ROOT);
  });
});
