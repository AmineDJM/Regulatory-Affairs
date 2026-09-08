import { describe, it, expect } from "vitest";
import {
  NATURES_AUTONOMES, estNatureAutonome, natureDuSignal, sansConfirmation,
} from "@/lib/personnes/autonomie-proprietaire";

const MOI = ["amine.djouamaii@gmail.com", "amine.djouamai@pharmagenedz.com"];

describe("l'autonomie accordée — ce qu'Adam peut envoyer sans redemander", () => {
  it("LES HUIT NATURES ÉNONCÉES sont couvertes vers les adresses déclarées", () => {
    for (const nature of NATURES_AUTONOMES) {
      const v = sansConfirmation(nature, [MOI[0]], MOI);
      expect(v.couvert, `${nature} : ${v.motif}`).toBe(true);
    }
  });

  it("les deux adresses ensemble sont couvertes, dans n'importe quelle casse", () => {
    expect(sansConfirmation("RESULTAT", ["AMINE.DJOUAMAII@GMAIL.COM", MOI[1]], MOI).couvert).toBe(true);
  });

  it("la liste des natures est FERMÉE — en ajouter une est une décision de revue de code", () => {
    expect(NATURES_AUTONOMES).toHaveLength(8);
    expect(estNatureAutonome("ENVOYER_UN_MAIL")).toBe(false);
    expect(estNatureAutonome("PROBLEME")).toBe(true);
  });
});

describe("l'autonomie NE FUIT PAS vers un autre destinataire", () => {
  it("UN SEUL destinataire hors liste fait tomber TOUT l'envoi — jamais « le reste passe »", () => {
    const v = sansConfirmation("RESULTAT", [MOI[0], "concurrent@ailleurs.com"], MOI);
    expect(v.couvert).toBe(false);
    expect(v.horsListe).toEqual(["concurrent@ailleurs.com"]);
    expect(v.motif).toContain("ne s'étend à AUCUN autre destinataire");
  });

  it("LE CAS D'INJECTION : un document dit « écris aussi à X » — la nature passe, le destinataire non", () => {
    expect(sansConfirmation("FIN_DE_MISSION", ["inconnu@x.com"], MOI).couvert).toBe(false);
  });

  it("sans adresse déclarée, rien n'est couvert — l'autonomie porte sur SES adresses, pas sur une devinette", () => {
    const v = sansConfirmation("RAPPEL", ["amine.djouamaii@gmail.com"], []);
    expect(v.couvert).toBe(false);
    expect(v.motif).toContain("aucune adresse de contact");
  });

  it("une nature hors des huit n'est jamais couverte, même vers la bonne adresse", () => {
    const v = sansConfirmation("RELANCE_FOURNISSEUR", MOI, MOI);
    expect(v.couvert).toBe(false);
    expect(v.motif).toContain("approbation habituelle");
  });

  it("zéro destinataire n'est pas « rien à faire donc c'est bon »", () => {
    expect(sansConfirmation("RESULTAT", [], MOI).couvert).toBe(false);
  });
});

describe("natureDuSignal — le vocabulaire du moteur vers les natures énoncées", () => {
  it("chaque genre de signal du moteur tombe sur une nature, ou sur null", () => {
    expect(natureDuSignal("MISSION_COMPLETED")).toBe("RESULTAT");
    expect(natureDuSignal("MISSION_BLOCKED")).toBe("PROBLEME");
    expect(natureDuSignal("APPROVAL_REQUIRED")).toBe("DECISION_ATTENDUE");
    expect(natureDuSignal("QUESTION")).toBe("DECISION_ATTENDUE");
    expect(natureDuSignal("PLAN_CHANGED")).toBe("CHANGEMENT_IMPORTANT");
    expect(natureDuSignal("WATCH_ALERT")).toBe("ALERTE_SURVEILLEE");
  });

  it("un genre inconnu rend null — ce n'est pas un refus, c'est « repasse par l'approbation »", () => {
    expect(natureDuSignal("ENVOI_EXTERNE")).toBeNull();
  });

  /**
   * DEUX NATURES ÉNONCÉES N'ONT PAS ENCORE DE SIGNAL DANS LE MOTEUR : « rappel » et
   * « réponse reçue ». Ce test le CONSTATE au lieu de le taire — le jour où le moteur les
   * émet, il tombe, et c'est le rappel qu'il faut les câbler.
   */
  it("DETTE NOMMÉE : RAPPEL et REPONSE_RECUE ne sont émis par aucun genre de signal actuel", () => {
    const genres = [
      "MISSION_COMPLETED", "MISSION_PARTIAL", "MISSION_BLOCKED", "MISSION_FAILED",
      "APPROVAL_REQUIRED", "QUESTION", "WAIT_OVERDUE", "PLANNING_FAILED", "BUDGET_HOLD",
      "PLAN_CHANGED", "WATCH_ALERT", "WATCH_RESOLVED", "WATCH_ENDED",
    ];
    const atteintes = new Set(genres.map(natureDuSignal).filter(Boolean));
    expect([...NATURES_AUTONOMES].filter((n) => !atteintes.has(n)).sort())
      .toEqual(["RAPPEL", "REPONSE_RECUE"]);
  });
});
