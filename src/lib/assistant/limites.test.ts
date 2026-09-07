import { describe, expect, it } from "vitest";
import { classerLimite, complementDeLimite, gardeAbsence, gardeImpossibilite, paraitImpossibilite, RAPPEL_DECOUVERTE, RAPPEL_ELARGISSEMENT } from "./limites";

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

/**
 * NOT_FOUND ≠ VERIFIED_ABSENT. Le cas fondateur : une question sur ce qui existe autour d'une
 * personne, UNE recherche, zéro résultat, et « je n'ai rien trouvé » remis comme une réponse.
 * La donnée était là, sous un autre libellé.
 *
 * Le deuxième test est celui qui compte autant : une CONCLUSION tirée de données bien lues
 * (« aucun dossier n'est en retard ») n'est pas une absence de résultat. Faire réélargir là
 * ferait payer un tour de plus pour rien, à chaque bilan.
 */
describe("une absence ne s'affirme qu'après élargissement", () => {
  it("« je n'ai rien trouvé » après une seule façon de chercher rouvre la recherche", () => {
    expect(gardeAbsence({ reponse: "Je n'ai rien trouvé concernant Radia sur les réseaux sociaux.", outilsUtilises: ["find_documents"], dejaElargi: false })).toBe("ELARGIR");
    expect(gardeAbsence({ reponse: "Aucun contrat ne correspond à ce nom.", outilsUtilises: ["search_legal"], dejaElargi: false })).toBe("ELARGIR");
    expect(gardeAbsence({ reponse: "Ce document est introuvable.", outilsUtilises: ["find_documents", "read_document"], dejaElargi: false })).toBe("ELARGIR");
  });

  it("une CONCLUSION n'est pas une absence de résultat — et n'est jamais rouverte", () => {
    for (const r of [
      "Aucun dossier n'est en retard : les 69 sont dans les délais.",
      "Aucune anomalie sur le budget du T3.",
      "Aucun paiement ne dépasse l'enveloppe validée.",
      "Voici les quatre contrats qui arrivent à échéance.",
    ]) {
      expect(gardeAbsence({ reponse: r, outilsUtilises: ["read_budget"], dejaElargi: false }), r).toBe("RAS");
    }
  });

  it("elle se tait quand la recherche a déjà été élargie, ou quand aucun outil n'a tourné", () => {
    const abs = "Je n'ai rien trouvé.";
    expect(gardeAbsence({ reponse: abs, outilsUtilises: ["a", "b", "c"], dejaElargi: false })).toBe("RAS");
    expect(gardeAbsence({ reponse: abs, outilsUtilises: ["a"], dejaElargi: true })).toBe("RAS");
    // Zéro outil appartient à `gardeImpossibilite` : deux gardes sur le même cas se contrediraient.
    expect(gardeAbsence({ reponse: abs, outilsUtilises: [], dejaElargi: false })).toBe("RAS");
  });

  it("l'échelle rendue au modèle nomme des MANIÈRES de chercher, pas des outils", () => {
    for (const barreau of [/EXACT/, /APPROCHÉ/, /ALIAS/, /PAR LA PERSONNE/, /PAR L'HISTOIRE/, /ENTITÉS LIÉES/, /AUTRES GRENIERS/]) {
      expect(RAPPEL_ELARGISSEMENT).toMatch(barreau);
    }
    expect(RAPPEL_ELARGISSEMENT).toMatch(/Une absence se prouve, elle ne se constate pas/);
  });
});
