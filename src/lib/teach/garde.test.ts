import { describe, expect, it } from "vitest";
import { DEMENTI_ENSEIGNEMENT, RAPPEL_ENSEIGNEMENT, estEnonceEnseignement, gardeEnseignement, pretendAvoirRetenu } from "./garde";

describe("la garantie d'enseignement — « règle enregistrée » se prouve par un outil, pas par une phrase (§119)", () => {
  it("reconnaît un énoncé d'enseignement, et seulement lui", () => {
    for (const q of [
      "Retiens cette règle : quand je te demande l'état d'un dossier réglementaire, termine toujours par « Prochaine étape : … ».",
      "Désormais les devis sont valables 45 jours.",
      "Dorénavant, toute facture au-dessus de 500 000 DZD passe par moi.",
      "À partir de maintenant, réponds-moi en deux lignes maximum.",
      "Nouvelle règle pour Adventum : le préfixe des devis est ADV.",
      "Note bien cette consigne : jamais de mail au client sans mon accord.",
    ]) expect(estEnonceEnseignement(q), q).toBe(true);
    for (const q of [
      "Où en est le dossier Lenvatinib ?",
      "Quelles règles s'appliquent aux devis ?",
      "Liste mes règles.",
      "Rappelle-moi la règle des 45 jours.",
      "Quel est l'e-mail de Raihana ?",
      "Note à Khaled : réunion demain.",
      "",
    ]) expect(estEnonceEnseignement(q), q).toBe(false);
  });

  it("reconnaît une réponse qui PRÉTEND avoir retenu, mais pas une question de clarification", () => {
    for (const r of [
      "Règle enregistrée : chaque état de dossier réglementaire se terminera par « Prochaine étape : … ».",
      "C'est noté, je terminerai toujours par la prochaine étape.",
      "J'ai bien enregistré votre préférence.",
      "Désormais, je répondrai en deux lignes.",
      "Consigne retenue (v1, périmètre personnel).",
    ]) expect(pretendAvoirRetenu(r), r).toBe(true);
    for (const r of [
      "Cette règle vaut-elle pour vous seul, ou pour toute la société ?",
      "Je ne peux pas enseigner une règle de société sans votre demande explicite pour Adventum.",
      "Le dossier Lenvatinib est en pré-soumission depuis le 12 août.",
    ]) expect(pretendAvoirRetenu(r), r).toBe(false);
  });

  it("verdict : rien à garantir hors enseignement, ou quand un outil Teach a tourné, ou sans prétention", () => {
    const base = { question: "Désormais les devis sont valables 45 jours.", reponse: "Règle enregistrée.", outilsDisponibles: ["teach_adam", "list_rules"], dejaRappele: false };
    expect(gardeEnseignement({ ...base, question: "Où en est Lenvatinib ?", outilsUtilises: [] })).toBe("RAS");
    expect(gardeEnseignement({ ...base, outilsUtilises: ["teach_adam"] })).toBe("RAS");
    expect(gardeEnseignement({ ...base, outilsUtilises: ["update_rule"] })).toBe("RAS");
    expect(gardeEnseignement({ ...base, outilsUtilises: [], reponse: "Pour vous seul ou pour la société ?" })).toBe("RAS");
  });

  it("verdict : rappel UNE fois quand l'outil est disponible, démenti ensuite ou sans outil", () => {
    const base = { question: "Retiens cette règle : termine par « Prochaine étape : … ».", reponse: "Règle enregistrée : …", outilsUtilises: ["inspect_record"] };
    expect(gardeEnseignement({ ...base, outilsDisponibles: ["teach_adam"], dejaRappele: false })).toBe("RAPPELER");
    expect(gardeEnseignement({ ...base, outilsDisponibles: ["teach_adam"], dejaRappele: true })).toBe("DEMENTIR");
    expect(gardeEnseignement({ ...base, outilsDisponibles: ["inspect_record"], dejaRappele: false })).toBe("DEMENTIR");
  });

  it("le rappel exige l'outil, le démenti ne prétend rien", () => {
    expect(RAPPEL_ENSEIGNEMENT).toMatch(/teach_adam/);
    expect(RAPPEL_ENSEIGNEMENT).toMatch(/historique/i);
    expect(DEMENTI_ENSEIGNEMENT).toMatch(/PAS enregistré/);
    expect(pretendAvoirRetenu(DEMENTI_ENSEIGNEMENT)).toBe(false);
  });
});
