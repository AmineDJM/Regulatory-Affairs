import { describe, expect, it } from "vitest";
import { classerLimite, complementDeLimite, gardeImpossibilite, paraitImpossibilite, RAPPEL_DECOUVERTE } from "./limites";

/**
 * LES LIMITES DITES JUSTE — la découverte avant l'impossible (une fois), l'acceptation après, et
 * la nature d'une limite classée par le code : permission, ressource, donnée, capacité.
 */
const OUTILS = ["search_products", "run_analysis", "run_code", "launch_mission", "executive_alerts"];

describe("paraître impossible", () => {
  it("reconnaît les refus de capacité, ignore les limites déjà nommées et les réponses ordinaires", () => {
    expect(paraitImpossibilite("Je ne peux pas calculer la médiane des montants : je n'ai pas d'outil pour cela.")).toBe(true);
    expect(paraitImpossibilite("Ce n'est pas prévu dans mes fonctions.")).toBe(true);
    expect(paraitImpossibilite("Hors de mon périmètre, désolé.")).toBe(true);
    expect(paraitImpossibilite("Ce module ne vous est pas ouvert : je ne peux pas consulter cette information.")).toBe(false);
    expect(paraitImpossibilite("Python est indisponible sur ce serveur ; je ne peux pas exécuter ce script, mais je peux le réécrire en JavaScript.")).toBe(false);
    expect(paraitImpossibilite("Aucun enregistrement ne porte cette référence.")).toBe(false);
    expect(paraitImpossibilite("La médiane des 14 bons de commande de 2026 est 1 250 000 DZD.")).toBe(false);
  });
});

describe("la garde d'impossibilité", () => {
  const base = { question: "Calcule la médiane des montants des BC de 2026.", outilsDisponibles: OUTILS };
  it("« impossible » sans aucun outil appelé → REDÉCOUVRIR, une fois ; après la carte, le refus est ACCEPTÉ", () => {
    const reponse = "Je ne peux pas calculer cela, je n'ai pas d'outil de calcul.";
    expect(gardeImpossibilite({ ...base, reponse, outilsUtilises: [], dejaRedecouvert: false })).toBe("REDECOUVRIR");
    expect(gardeImpossibilite({ ...base, reponse, outilsUtilises: [], dejaRedecouvert: true })).toBe("ACCEPTER");
  });
  it("un outil a tourné, ou aucune capacité n'est ouverte, ou la limite est nommée → RAS", () => {
    const reponse = "Je ne peux pas calculer cela.";
    expect(gardeImpossibilite({ ...base, reponse, outilsUtilises: ["run_analysis"], dejaRedecouvert: false })).toBe("RAS");
    expect(gardeImpossibilite({ ...base, reponse, outilsUtilises: [], outilsDisponibles: [], dejaRedecouvert: false })).toBe("RAS");
    expect(gardeImpossibilite({ ...base, reponse: "Ce module ne vous est pas ouvert.", outilsUtilises: [], dejaRedecouvert: false })).toBe("RAS");
    expect(gardeImpossibilite({ ...base, reponse: "La médiane est 1 250 000 DZD.", outilsUtilises: [], dejaRedecouvert: false })).toBe("RAS");
  });
  it("le rappel exige un nouvel essai avec la carte, puis la NATURE de la limite — jamais « pas prévu »", () => {
    expect(RAPPEL_DECOUVERTE).toMatch(/carte complète/);
    expect(RAPPEL_DECOUVERTE).toMatch(/run_analysis|run_code/);
    expect(RAPPEL_DECOUVERTE).toMatch(/jamais « ce n'est pas prévu »/);
  });
});

describe("classer une limite", () => {
  it("permission, ressource, donnée, capacité — et la précision", () => {
    expect(classerLimite("Le module FINANCES ne vous est pas ouvert.")).toMatchObject({ nature: "PERMISSION", precise: true });
    expect(classerLimite("Python est indisponible sur ce serveur (python3 absent).")).toMatchObject({ nature: "RESSOURCE", precise: true });
    expect(classerLimite("Aucune réunion ne porte ce titre parmi les vôtres.")).toMatchObject({ nature: "DONNEE", precise: true });
    expect(classerLimite("Ce n'est pas prévu dans mes fonctions.")).toMatchObject({ nature: "CAPACITE", precise: false });
    expect(classerLimite("Aucun outil ne permet de piloter la climatisation du bâtiment : c'est une capacité qui n'existe pas dans l'ERP.")).toMatchObject({ nature: "CAPACITE", precise: true });
    expect(classerLimite("Voici le tableau demandé.")).toBeNull();
  });
  it("le complément du serveur ne s'ajoute qu'à un refus de capacité imprécis", () => {
    expect(complementDeLimite("Ce n'est pas prévu dans mes fonctions.", 42)).toMatch(/42 capacités ouvertes/);
    expect(complementDeLimite("Le module FINANCES ne vous est pas ouvert.", 42)).toBeNull();
    expect(complementDeLimite("Voici le tableau demandé.", 42)).toBeNull();
  });
});
