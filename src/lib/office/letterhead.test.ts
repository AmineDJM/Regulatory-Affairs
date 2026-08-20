import { describe, it, expect } from "vitest";
import {
  canManageLetterheads, validateLetterheadFile, letterheadsFor, documentName,
  KIND_EXTENSION, KIND_LABEL,
} from "./letterhead";

describe("canManageLetterheads — qui tient la papeterie de la société", () => {
  it("l'assistante de direction et le Super Admin", () => {
    for (const role of ["SUPER_ADMIN", "DIRECTION_ASSISTANT"]) {
      expect(canManageLetterheads({ role }), role).toBe(true);
    }
  });

  // Ils SIGNENT les courriers, ils ne tiennent pas la papeterie. Leur laisser le bloc, c'était
  // afficher un panneau de gestion — bouton « Téléverser », modèles retirés — à des gens qui
  // n'ont jamais à y toucher.
  it("ni la Direction ni le Directeur Général", () => {
    expect(canManageLetterheads({ role: "DIRECTION" })).toBe(false);
    expect(canManageLetterheads({ role: "GENERAL_MANAGER" })).toBe(false);
  });

  // Un en-tête erroné part sur tous les courriers de la société avant qu'on le remarque :
  // ce n'est pas un droit de module, c'est une responsabilité.
  it("personne d'autre, même avec un rôle métier élevé", () => {
    for (const role of ["HEAD_OF_REGULATORY", "NATIONAL_SALES", "PRODUCT_MANAGER", "MEDICAL_DELEGATE"]) {
      expect(canManageLetterheads({ role }), role).toBe(false);
    }
  });

  it("le rôle secondaire compte", () => {
    expect(canManageLetterheads({ role: "MEDICAL_DELEGATE", secondaryRole: "DIRECTION_ASSISTANT" })).toBe(true);
  });
});

describe("validateLetterheadFile — refuser à la porte, avec le motif", () => {
  it("accepte l'extension attendue, quelle que soit la casse", () => {
    expect(validateLetterheadFile("word", "entete.docx")).toBeNull();
    expect(validateLetterheadFile("cell", "ENTETE.XLSX")).toBeNull();
    expect(validateLetterheadFile("slide", "Entete.PptX")).toBeNull();
  });

  it("refuse un fichier d'un autre type, en le disant", () => {
    const err = validateLetterheadFile("cell", "entete.docx");
    expect(err).toContain(".xlsx");
    expect(err).toContain("entete.docx");
  });

  it("refuse un PDF ou une image — un en-tête est un document, pas une illustration", () => {
    expect(validateLetterheadFile("word", "entete.pdf")).not.toBeNull();
    expect(validateLetterheadFile("word", "logo.png")).not.toBeNull();
  });
});

describe("letterheadsFor — le bon papier en premier", () => {
  const all = [
    { id: "a", kind: "word", companyId: "pha", isActive: true },
    { id: "b", kind: "word", companyId: null, isActive: true },
    { id: "c", kind: "word", companyId: "adv", isActive: true },
    { id: "d", kind: "cell", companyId: "adv", isActive: true },
    { id: "e", kind: "word", companyId: "adv", isActive: false },
  ];

  it("celui de SON entité d'abord, puis les communs, puis les autres", () => {
    expect(letterheadsFor(all, "word", "adv").map((l) => l.id)).toEqual(["c", "b", "a"]);
  });

  it("ne mélange pas les types — un en-tête Word ne s'ouvre pas dans un tableur", () => {
    expect(letterheadsFor(all, "cell", "adv").map((l) => l.id)).toEqual(["d"]);
  });

  it("écarte les en-têtes désactivés", () => {
    expect(letterheadsFor(all, "word", "adv").map((l) => l.id)).not.toContain("e");
  });

  it("sans entité, les communs passent devant", () => {
    expect(letterheadsFor(all, "word", null).map((l) => l.id)[0]).toBe("b");
  });
});

describe("documentName — on garde le nom saisi, jamais celui du modèle", () => {
  it("ajoute l'extension du type", () => {
    expect(documentName("Courrier ANPP", "word")).toBe("Courrier ANPP.docx");
    expect(documentName("Budget", "cell")).toBe("Budget.xlsx");
  });

  it("ne double pas une extension déjà saisie", () => {
    expect(documentName("Note.docx", "word")).toBe("Note.docx");
  });

  it("retombe sur « Document » plutôt que de créer un fichier sans nom", () => {
    expect(documentName("   ", "slide")).toBe("Document.pptx");
  });
});

describe("tables de correspondance", () => {
  it("couvrent les trois types, sans trou", () => {
    expect(Object.keys(KIND_EXTENSION).sort()).toEqual(["cell", "slide", "word"]);
    expect(Object.keys(KIND_LABEL).sort()).toEqual(["cell", "slide", "word"]);
  });
});
