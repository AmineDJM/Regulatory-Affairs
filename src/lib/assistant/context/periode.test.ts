import { describe, expect, it } from "vitest";
import { consignePeriode, consigneCalcul, consigneRepresentation } from "./router";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « RÉSUME-MOI LA SEMAINE » — la question qui rendait INCONNU.
 *
 * Mesuré en live avant la réparation : `list_emails` seul, puis « INCONNU — aucune boîte
 * Courrier n'est connectée ». La capacité était pourtant exposée (`what_changed` parmi 40
 * outils) ; ce qui manquait était la consigne qui dit QUAND s'en servir (§118.19 en miroir).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("CONSIGNE DE PÉRIODE — ce qui a bougé, pas ce qui existe", () => {
  const OUVRENT = [
    "Résume-moi la semaine",
    "résume la semaine",
    "Quoi de neuf ?",
    "Qu'est-ce qui a changé depuis lundi ?",
    "remets-moi à niveau",
    "Récapitulatif de la quinzaine",
    "Qu'est-ce qui a bougé pendant mon absence ?",
    "Fais-moi le mois",
    "Ces derniers jours, il s'est passé quoi ?",
    "depuis mon retour",
    "la semaine écoulée",
  ];

  it("LES FAÇONS NATURELLES DE DEMANDER UNE PÉRIODE ouvrent la consigne", () => {
    const muettes = OUVRENT.filter((p) => consignePeriode(p) === null);
    expect(muettes, "une phrase de période sans consigne retombe sur la boîte mail").toEqual([]);
  });

  it("LA CONSIGNE NOMME LA SOURCE CANONIQUE et le fait qu'elle répond SANS entité", () => {
    const c = consignePeriode("Résume-moi la semaine")!;
    expect(c).toContain("what_changed");
    expect(c).toMatch(/SANS référence/);
    // LE TOTAL : rendre un échantillon sans lui ferait lire les dernières minutes comme le
    // bilan de la semaine (§118.104).
    expect(c).toMatch(/TOTAL/);
  });

  it("UNE BOÎTE ABSENTE N'EST PAS UNE PÉRIODE ILLISIBLE — c'est LA phrase qui ferme le défaut", () => {
    // LE CAS QUI FERAIT TOMBER : retirer cette phrase. Le modèle retomberait sur « INCONNU —
    // aucune boîte connectée », c'est-à-dire présenterait une lacune de source comme la
    // réponse à la question posée (§118.63).
    const c = consignePeriode("Quoi de neuf ?")!;
    expect(c).toMatch(/BOÎTE MAIL N'EST PAS LA PÉRIODE/);
    expect(c).toMatch(/jamais « INCONNU »/);
  });

  it("CE QUI N'EST PAS UNE PÉRIODE reste muet — deux questions, deux détecteurs", () => {
    // « aujourd'hui » SEUL est une question d'ÉTAT et répondait DÉJÀ correctement par les
    // signaux : ouvrir dessus échangerait une bonne réponse contre une autre (§118.27).
    const MUETTES = [
      "Qu'est-ce que je dois savoir aujourd'hui ?",
      "Y'a quoi d'urgent ?",
      "Qu'est-ce qui bloque ?",
      "Où on en est ?",
      "Bonjour Adam",
      "Prépare-moi le point Regulatory pour demain",
      "Combien de dossiers Regulatory ouverts ?",
      "Résume-moi ce document",          // un DOCUMENT, pas une période
      "Résume la fiche Nivolex",
    ];
    const ouvertes = MUETTES.filter((p) => consignePeriode(p) !== null);
    expect(ouvertes, "la consigne de période s'est ouverte sur une question qui n'en est pas une").toEqual([]);
  });

  it("ELLE NE MARCHE PAS SUR LE TERRAIN DES AUTRES — pas de consigne de calcul injectée", () => {
    // `DATA_SECONDAIRE` gouverne aussi `consigneCalcul` : si « la semaine » y avait été versé,
    // une demande qui ne calcule rien recevrait une consigne de calcul (§118.105b).
    expect(consigneCalcul("Résume-moi la semaine")).toBeNull();
    expect(consigneRepresentation("Quoi de neuf ?")).toBeNull();
    // Et l'inverse : une vraie demande de calcul garde la sienne, et n'y gagne pas la période.
    expect(consigneCalcul("Évolution du CA par mois")).not.toBeNull();
    expect(consignePeriode("Évolution du CA par mois")).toBeNull();
  });
});
