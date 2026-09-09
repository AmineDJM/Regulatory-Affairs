import { describe, it, expect } from "vitest";
import { designationDePersonne, direCeQuiEstArrive, collectifDesigne, CONSEIL_COLLECTIF } from "@/lib/personnes/designation";

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * UN COLLECTIF N'EST PAS UNE PERSONNE (§118.68)
 *
 * MESURÉ LIVE, deux missions, trois fois : `recipientName: "Équipe Regulatory"`. Le refus
 * disait « précisez le bon collègue » — une phrase écrite pour un humain devant un écran. Le
 * planificateur l'a suivie et a posé la question au DIRIGEANT ; la mission s'est arrêtée là,
 * en attente d'une réponse que personne n'avait à donner, alors que l'annuaire connaît ces
 * personnes.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
describe("collectifDesigne", () => {
  it("LE CAS MESURÉ, et ses voisins de la même famille", () => {
    expect(collectifDesigne("Équipe Regulatory")).toBe("equipe");
    expect(collectifDesigne("l'équipe Regulatory")).toBe("equipe");
    expect(collectifDesigne("Service Financier")).toBe("service");
    expect(collectifDesigne("Département Qualité")).toBe("departement");
    expect(collectifDesigne("Direction Commerciale")).toBe("direction");
    expect(collectifDesigne("Pôle Achats")).toBe("pole");
    expect(collectifDesigne("Comité de direction")).toBe("comite");
  });

  it("lit aussi l'objet que `resolve_person` rend, comme le reste du module", () => {
    expect(collectifDesigne({ nom: "Équipe Regulatory" })).toBe("equipe");
  });

  /**
   * CE QUI FERAIT TOMBER CETTE GARDE : élargir le vocabulaire ou lâcher la position de tête.
   * Un refus à tort ici empêche un envoi parfaitement légitime — pire que le défaut corrigé
   * (§118.27).
   */
  it("une PERSONNE n'est jamais prise pour un groupe", () => {
    for (const nom of [
      "Amel Haddad", "Khaled Mansouri", "Sofiane Kaci",
      "Amel Haddad <amel@adventum.dz>", "Jean-Pierre Équipe", "Yacine Direction",
    ]) {
      expect(collectifDesigne(nom), nom).toBeNull();
    }
  });

  it("un mot collectif SEUL ne désigne rien — ni personne, ni groupe nommé : on se tait", () => {
    // Le refus générique est déjà juste ; ajouter un conseil sur un vide serait du bruit (§118.32).
    expect(collectifDesigne("Équipe")).toBeNull();
    expect(collectifDesigne("la direction")).toBeNull();
    expect(collectifDesigne("")).toBeNull();
    expect(collectifDesigne(null)).toBeNull();
  });

  it("« Regulatory » seul n'est pas un collectif — ce peut être un identifiant de compte", () => {
    expect(collectifDesigne("Regulatory")).toBeNull();
    expect(collectifDesigne("regulatory@adventum.dz")).toBeNull();
  });

  it("le conseil nomme les DEUX gestes : lire l'annuaire, PUIS déployer en éventail", () => {
    // Sans le second, le plan corrigé écrirait un seul envoi à N personnes — §118.3.
    expect(CONSEIL_COLLECTIF).toMatch(/search_people|directory_list|resolve_person/);
    expect(CONSEIL_COLLECTIF).toContain("ÉVENTAIL");
    expect(CONSEIL_COLLECTIF).toContain("Ne demande pas ce nom au demandeur");
  });
});
