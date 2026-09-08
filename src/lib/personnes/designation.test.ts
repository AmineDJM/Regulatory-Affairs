import { describe, it, expect } from "vitest";
import { designationDePersonne, direCeQuiEstArrive } from "@/lib/personnes/designation";

describe("designationDePersonne — le cas MESURÉ qui a tué la chaîne", () => {
  it("LE CANDIDAT RENDU PAR resolve_person EST UN DESTINATAIRE, PAS UNE ÉNIGME", () => {
    // Exactement l'objet lu dans MissionStep.input de l'étape en échec.
    const candidat = {
      nom: "Amel Haddad",
      detail: "HEAD_OF_REGULATORY",
      source: "compte ERP",
      adresse: "amel.haddad@adventum-bench.dz",
    };
    expect(designationDePersonne(candidat)).toBe("Amel Haddad <amel.haddad@adventum-bench.dz>");
  });

  it("un éventail qui déploie une liste d'UN candidat désigne cette personne", () => {
    expect(designationDePersonne([{ nom: "Raihana Cherif", adresse: "raihana@x.dz" }]))
      .toBe("Raihana Cherif <raihana@x.dz>");
  });

  it("LA FONCTION N'EST PAS UN NOM — « HEAD_OF_REGULATORY » ne devient jamais un destinataire", () => {
    expect(designationDePersonne({ detail: "HEAD_OF_REGULATORY", role: "ADMIN", title: "DAF" })).toBeNull();
  });
});

describe("designationDePersonne — ce qu'il REFUSE de deviner", () => {
  it("PLUSIEURS candidats ne désignent PERSONNE — sinon le code choisit à la place d'un humain", () => {
    const deux = [{ nom: "Amel Haddad", adresse: "a@x.dz" }, { nom: "Amel Hadad", adresse: "b@x.dz" }];
    expect(designationDePersonne(deux)).toBeNull();
  });

  it("une liste VIDE ne désigne personne", () => {
    expect(designationDePersonne([])).toBeNull();
  });

  it("ni nom ni adresse : null", () => {
    expect(designationDePersonne({ source: "compte ERP" })).toBeNull();
    expect(designationDePersonne(42)).toBeNull();
    expect(designationDePersonne(null)).toBeNull();
    expect(designationDePersonne(undefined)).toBeNull();
    expect(designationDePersonne("   ")).toBeNull();
  });
});

describe("designationDePersonne — les formes partielles", () => {
  it("une chaîne reste elle-même, « Nom <adresse> » compris (resolvePerson sait déjà la lire)", () => {
    expect(designationDePersonne("Yacine Benali <yacine@x.dz>")).toBe("Yacine Benali <yacine@x.dz>");
    expect(designationDePersonne("  Khaled Mansouri ")).toBe("Khaled Mansouri");
  });

  it("un nom seul reste un nom ; une adresse seule reste une adresse", () => {
    expect(designationDePersonne({ nom: "Sofiane Kaci" })).toBe("Sofiane Kaci");
    expect(designationDePersonne({ email: "sofiane@x.dz" })).toBe("sofiane@x.dz");
  });

  it("une « adresse » qui n'en est pas une ne fabrique pas la forme à chevrons", () => {
    expect(designationDePersonne({ nom: "Amel", adresse: "à demander" })).toBe("Amel");
  });
});

describe("direCeQuiEstArrive — un refus montre ce qu'il a REÇU", () => {
  it("un objet ne s'affiche plus comme une chaîne vide", () => {
    const rendu = direCeQuiEstArrive({ source: "compte ERP" });
    expect(rendu).not.toBe("");
    expect(rendu).toContain("compte ERP");
  });

  it("rien reçu se dit « (rien) », et un pavé est borné", () => {
    expect(direCeQuiEstArrive(undefined)).toBe("(rien)");
    expect(direCeQuiEstArrive("x".repeat(500)).length).toBeLessThanOrEqual(160);
  });
});
