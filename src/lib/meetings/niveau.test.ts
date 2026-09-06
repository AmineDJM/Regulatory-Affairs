import { describe, expect, it } from "vitest";
import { auMoins, niveauDepuisRegles, niveauDepuisTexte, niveauParDefaut, parleDuBriefDeReunion } from "./niveau";

describe("niveau d'intelligence de réunion — appris, jamais deviné", () => {
  it("lit le niveau dans une phrase, et rend null quand elle n'en nomme aucun", () => {
    expect(niveauDepuisTexte("Pour mes réunions, je veux toujours un briefing complet de chef de cabinet.")).toBe("CHIEF_OF_STAFF");
    expect(niveauDepuisTexte("un brief léger avant chaque point")).toBe("LIGHT");
    expect(niveauDepuisTexte("briefing standard")).toBe("STANDARD");
    expect(niveauDepuisTexte("prépare la réunion de demain")).toBeNull();
  });
  it("une règle par sa clé passe avant une règle par sa phrase ; une valeur brute est normalisée", () => {
    const parPhrase = { params: null, statement: "Pour mes réunions, briefing léger.", id: "b" };
    const parCle = { params: { cle: "niveauReunion", valeur: "chef de cabinet" }, statement: "x", id: "a" };
    expect(niveauDepuisRegles([parPhrase, parCle])).toMatchObject({ niveau: "CHIEF_OF_STAFF", id: "a" });
    expect(niveauDepuisRegles([parPhrase])).toMatchObject({ niveau: "LIGHT", id: "b" });
    expect(niveauDepuisRegles([{ params: { cle: "niveauReunion", valeur: "standard" }, statement: "" }])?.niveau).toBe("STANDARD");
    expect(niveauDepuisRegles([{ params: { cle: "validiteDevis", valeur: 45 }, statement: "nos devis sont valables 45 jours" }])).toBeNull();
    // Une règle qui parle de réunion sans niveau ne décide rien.
    expect(niveauDepuisRegles([{ params: null, statement: "Prépare mes réunions la veille." }])).toBeNull();
  });
  it("le défaut suit le rôle, et l'ordre des niveaux est stable", () => {
    expect(niveauParDefaut("DIRECTION")).toBe("STANDARD");
    expect(niveauParDefaut("SALES_USER")).toBe("LIGHT");
    expect(auMoins("CHIEF_OF_STAFF", "STANDARD")).toBe(true);
    expect(auMoins("LIGHT", "STANDARD")).toBe(false);
    expect(parleDuBriefDeReunion("Pour la préparation de mes réunions, sois exhaustif")).toBe(true);
    expect(parleDuBriefDeReunion("nos devis sont valables 45 jours")).toBe(false);
  });
});
