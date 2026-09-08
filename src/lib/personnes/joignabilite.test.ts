import { describe, it, expect } from "vitest";
import { lireAdressesDeContact, joignabiliteDe, estUneAdresse } from "@/lib/personnes/joignabilite";

describe("lireAdressesDeContact — la déclaration de la personne", () => {
  it("LE CAS DEMANDÉ : deux adresses, l'une perso, l'autre professionnelle", () => {
    expect(lireAdressesDeContact("email:amine.djouamaii@gmail.com, amine.djouamai@pharmagenedz.com"))
      .toEqual(["amine.djouamaii@gmail.com", "amine.djouamai@pharmagenedz.com"]);
  });

  it("l'ordre déclaré est l'ordre rendu — la première est la principale", () => {
    const j = joignabiliteDe("email:pro@x.dz, perso@y.dz");
    expect(j.principale).toBe("pro@x.dz");
    expect(j.copies).toEqual(["perso@y.dz"]);
  });

  it("les formes d'écriture usuelles se lisent toutes", () => {
    for (const forme of [
      "e-mail: a@x.dz",
      "courriel:a@x.dz",
      "a@x.dz",
      " A@X.DZ ",
      "<a@x.dz>",
      ["a@x.dz"],
      { destinataire: "a@x.dz" },
      { canal: "email", destinataire: "a@x.dz" },
      { emails: ["a@x.dz"] },
    ]) {
      expect(lireAdressesDeContact(forme), JSON.stringify(forme)).toEqual(["a@x.dz"]);
    }
  });

  it("les doublons fusionnent, quelle que soit la casse", () => {
    expect(lireAdressesDeContact("A@x.dz, a@X.dz, b@x.dz")).toEqual(["a@x.dz", "b@x.dz"]);
  });
});

describe("lireAdressesDeContact — ce qu'il REFUSE de deviner", () => {
  it("rien de lisible rend une liste VIDE — jamais une adresse inventée", () => {
    for (const v of ["", "   ", "email:", "slack:#direction", "préviens-moi", 42, null, undefined, {}, []]) {
      expect(lireAdressesDeContact(v), JSON.stringify(v)).toEqual([]);
    }
    expect(joignabiliteDe(null)).toEqual({ principale: null, copies: [] });
  });

  it("un fragment qui RESSEMBLE à une adresse sans en être une est écarté", () => {
    expect(lireAdressesDeContact("a@x")).toEqual([]);          // pas de point dans le domaine
    expect(lireAdressesDeContact("a@@x.dz")).toEqual([]);       // deux arobases
    expect(lireAdressesDeContact("@x.dz")).toEqual([]);         // pas de partie locale
    expect(lireAdressesDeContact("a@x.d")).toEqual([]);         // extension d'un seul caractère
  });

  it("le mélange valide / invalide ne garde QUE le valide", () => {
    expect(lireAdressesDeContact("préviens-moi sur bon@x.dz et pas sur cassé@")).toEqual(["bon@x.dz"]);
  });

  it("une imbrication profonde ne fait pas boucler la lecture", () => {
    let v: unknown = "a@x.dz";
    for (let i = 0; i < 10; i += 1) v = { destinataire: v };
    expect(() => lireAdressesDeContact(v)).not.toThrow();
  });
});

describe("estUneAdresse", () => {
  it("tranche sans ambiguïté", () => {
    expect(estUneAdresse("a@x.dz")).toBe(true);
    expect(estUneAdresse("a@x")).toBe(false);
    expect(estUneAdresse(42)).toBe(false);
  });
});
