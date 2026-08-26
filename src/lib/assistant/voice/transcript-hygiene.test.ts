import { describe, it, expect } from "vitest";
import {
  decideDisplay, isInternalPlaceholder, looksLikeToolPayload, isStaleProgressUpdate,
  INTERNAL_PLACEHOLDERS,
} from "./transcript-hygiene";

/**
 * LE BANC DE L'HYGIÈNE DE CONVERSATION, écrit à partir de deux transcriptions RÉELLES.
 *
 * Les cas ci-dessous ne sont pas imaginés : ils sont copiés de ce que le PDG a vu à l'écran. Le
 * plus grave — un JSON de vingt-sept résultats contenant six lignes de salaires, rendu en
 * réponse à « Bonsoir, ça va ? » — est le premier test du fichier.
 */

describe("les marqueurs internes ne s'affichent jamais", () => {
  it.each(INTERNAL_PLACEHOLDERS)("« %s » est un bouche-trou, pas un message", (marker) => {
    expect(isInternalPlaceholder(marker)).toBe(true);
    expect(decideDisplay(marker).show).toBe(false);
  });

  it("la casse et les apostrophes typographiques ne les font pas passer", () => {
    expect(isInternalPlaceholder("(Analyse Terminée Après L'appel)")).toBe(true);
    expect(isInternalPlaceholder("(intervention vocale)")).toBe(true);
    expect(isInternalPlaceholder("(intervention vocale)  ")).toBe(true);
  });

  it("mais une VRAIE phrase entre parenthèses reste affichée", () => {
    // On liste les bouche-trous un par un plutôt que de masquer toute parenthèse : escamoter un
    // vrai message serait pire que d'en montrer un faux.
    const d = decideDisplay("(je te rappelle dans dix minutes)");
    expect(d.show).toBe(true);
    expect(d.text).toBe("(je te rappelle dans dix minutes)");
  });
});

describe("la sortie brute d'un outil ne s'affiche jamais", () => {
  it("LE CAS RÉEL : « Bonsoir, ça va ? » ne doit pas rendre 27 résultats et six salaires", () => {
    const dump = JSON.stringify({
      total: 27,
      parFamille: { Finances: 6, RH: 1, Annuaire: 4 },
      resultats: [
        { famille: "Finances", titre: "Salaire 2026-01 — Amine Djouamai (coût employeur, corrigé)", detail: "FIN-2026-003", lien: "/finances" },
        { famille: "RH", titre: "Amine Djouamai", detail: "Business Development Manager", lien: "/rh/cmr7wzhpm0094phk0hyusd21d" },
      ],
    });
    expect(looksLikeToolPayload(dump)).toBe(true);
    const d = decideDisplay(dump);
    expect(d.show).toBe(false);
    expect(d.reason).toBe("tool-payload");
    // Et surtout : rien du contenu ne ressort.
    expect(d.text).not.toMatch(/Salaire|coût employeur/);
  });

  it("une charge utile TRONQUÉE compte aussi — c'est le cas d'un tour coupé en plein flux", () => {
    const partiel = '{"total":27,"parFamille":{"Finances":6,"RH":1},"resultats":[{"famille":"Finances","titre":"Sal';
    expect(looksLikeToolPayload(partiel)).toBe(true);
    expect(decideDisplay(partiel).show).toBe(false);
  });

  it("un tableau JSON aussi", () => {
    expect(looksLikeToolPayload('[{"id":"a"},{"id":"b"}]')).toBe(true);
  });

  it("mais une phrase qui CITE du JSON reste affichée", () => {
    const phrase = 'Le fichier renvoie {"total": 0} — donc rien de ce côté-là.';
    expect(looksLikeToolPayload(phrase)).toBe(false);
    expect(decideDisplay(phrase).show).toBe(true);
  });

  it("et une accolade isolée n'est pas une charge utile", () => {
    expect(looksLikeToolPayload("{")).toBe(false);
    expect(looksLikeToolPayload("{}")).toBe(true);
  });
});

describe("les noms d'outils et les identifiants nus sont retirés", () => {
  it("un nom d'outil ne se dit pas à voix haute", () => {
    const d = decideDisplay("J'ai appelé search_everything et je n'ai rien trouvé.");
    expect(d.show).toBe(true);
    expect(d.text).not.toContain("search_everything");
    expect(d.text).toContain("je n'ai rien trouvé");
  });

  it("un identifiant interne non plus", () => {
    const d = decideDisplay("La fiche cmr7wzhpm0094phk0hyusd21d est à jour.");
    expect(d.text).not.toMatch(/cmr7wzhpm/);
    expect(d.text).toContain("est à jour");
  });

  it("mais on ne réécrit pas la phrase — seulement ce qui est technique", () => {
    // Un assistant dont on réécrit les mots finit par dire autre chose que ce qu'il a fait.
    const phrase = "Deepak a envoyé les trois documents, mais il manque le certificat d'analyse.";
    expect(decideDisplay(phrase).text).toBe(phrase);
  });
});

describe("un tour périmé ne contredit pas un tour conclusif", () => {
  it("LE CAS RÉEL : « je cherche encore » après « je n'ai rien trouvé »", () => {
    // Aucun humain ne dit « je n'ai rien trouvé » puis « je cherche encore ». Le PDG en conclut,
    // à raison, qu'Adam ne sait pas où il en est.
    const dejaDit = ["Aucun fichier ni dossier ne contient « Regulatory export » dans le Drive visible."];
    const enRetard = "La recherche du fichier Drive est toujours en cours. Pour l'instant, je n'ai pas encore le résultat à te lire.";
    expect(isStaleProgressUpdate(enRetard, dejaDit)).toBe(true);
  });

  it("mais un « je cherche » AVANT toute conclusion est légitime", () => {
    expect(isStaleProgressUpdate("La recherche est toujours en cours.", [])).toBe(false);
    expect(isStaleProgressUpdate("La recherche est toujours en cours.", ["Je regarde ça."])).toBe(false);
  });

  it("et une conclusion ancienne ne périme pas une recherche relancée", () => {
    const vieux = ["Aucun résultat.", "D'accord.", "Je regarde.", "Très bien."];
    expect(isStaleProgressUpdate("La recherche est toujours en cours.", vieux)).toBe(false);
  });

  it("un message qui n'annonce aucun travail en cours n'est jamais périmé", () => {
    expect(isStaleProgressUpdate("Envoyé.", ["Aucun résultat."])).toBe(false);
  });
});

describe("les cas dégénérés", () => {
  it("vide, nul, espaces", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(decideDisplay(v).show).toBe(false);
    }
  });

  it("un message normal passe intact", () => {
    const d = decideDisplay("Oui, trois : Deepak, Raihana et Khaled.");
    expect(d.show).toBe(true);
    expect(d.text).toBe("Oui, trois : Deepak, Raihana et Khaled.");
    expect(d.reason).toBeUndefined();
  });
});
