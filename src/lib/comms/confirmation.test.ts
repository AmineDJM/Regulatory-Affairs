import { describe, it, expect } from "vitest";
import { classifyReply, isSendConfirmation } from "./confirmation";

/**
 * CE QUI COMPTE COMME UN OUI.
 *
 * Les cas ci-dessous sont écrits depuis la seule question qui vaille : « si je me trompe ici,
 * qu'est-ce qui part ? » Un faux NON coûte une question de plus. Un faux OUI expédie un message
 * que personne n'a validé. Les deux colonnes ne sont donc pas symétriques, et les tests non plus :
 * la liste des refus est plus longue que celle des accords, exprès.
 */

describe("un accord sans réserve — et rien d'autre", () => {
  it.each([
    "Je confirme.",
    "je confirme",
    "Oui",
    "oui !",
    "OK",
    "ok, envoie",
    "d'accord",
    "D'accord, vas-y",
    "vas-y",
    "Vas-y Adam",
    "envoie",
    "envoie-le",
    "Envoie le mail",
    "envoie le message maintenant",
    "c'est bon",
    "j'approuve",
    "Je valide",
    "parfait, envoie",
    "go",
    "Confirmé",
    "oui stp",
    "ok merci",
  ])("« %s » vaut approbation", (phrase) => {
    expect(classifyReply(phrase), phrase).toBe("CONFIRM");
  });
});

describe("ce qui n'est PAS un accord — la moitié qui protège", () => {
  it.each([
    ["Non", "REJECT"],
    ["non, annule", "REJECT"],
    ["annule", "REJECT"],
    ["attends", "REJECT"],
    ["Oui mais attends", "REJECT"],
    ["ok mais change l'objet", "REJECT"],
    ["oui, modifie le corps d'abord", "REJECT"],
    ["surtout pas", "REJECT"],
    ["n'envoie pas", "REJECT"],
  ])("« %s » ne fait rien partir (%s)", (phrase, verdict) => {
    expect(classifyReply(phrase), phrase).toBe(verdict);
  });

  it("une QUESTION ne confirme rien, même faite de mots d'accord", () => {
    expect(classifyReply("je confirme ?")).toBe("OTHER");
    expect(classifyReply("tu confirmes l'envoi ?")).toBe("OTHER");
    expect(classifyReply("c'est bon ?")).toBe("OTHER");
  });

  it("UNE NOUVELLE DEMANDE n'est pas un accord — l'article fait la différence", () => {
    // « envoie LE mail » désigne ce qui est déjà sur la table ; « envoie UN mail à quelqu'un »
    // ouvre un sujet neuf. Confondre les deux ferait partir le mauvais message.
    expect(classifyReply("envoie un mail à Deepak")).toBe("OTHER");
    expect(classifyReply("envoie le rapport à nesrine@adventum.dz")).toBe("OTHER");
    expect(classifyReply("oui envoie ça à Deepak plutôt")).toBe("OTHER");
  });

  it("une phrase QUI RACONTE quelque chose repart au modèle, jamais au raccourci", () => {
    expect(classifyReply(
      "oui c'est bon pour moi mais rajoute que je serai disponible la semaine prochaine",
    )).toBe("OTHER");
  });

  it("le vide, les mots-outils seuls et le silence ne confirment rien", () => {
    expect(classifyReply("")).toBe("OTHER");
    expect(classifyReply("   ")).toBe("OTHER");
    expect(classifyReply("le mail")).toBe("OTHER");
    expect(classifyReply("adam")).toBe("OTHER");
  });

  it("une question de boîte de réception n'est pas un accord", () => {
    // Le cas exact du transcript : elle ne doit jamais tomber dans le raccourci de confirmation.
    expect(classifyReply("Tu as reçu des e-mails ou pas ?")).toBe("OTHER");
    expect(classifyReply("j'ai reçu quelque chose")).toBe("OTHER");
  });
});

describe("isSendConfirmation — le raccourci de lecture", () => {
  it("dit oui exactement quand classifyReply dit CONFIRM", () => {
    expect(isSendConfirmation("Je confirme.")).toBe(true);
    expect(isSendConfirmation("non")).toBe(false);
    expect(isSendConfirmation("Tu as reçu des e-mails ou pas ?")).toBe(false);
  });
});
