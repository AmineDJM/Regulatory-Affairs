import { describe, it, expect } from "vitest";
import {
  foldText, wilayaFromPostalCode, wilayaFromCode, wilayaInText, resolveWilaya,
  unresolvedHint, acceptAiWilaya,
} from "./wilaya";
import { ALGERIA_WILAYAS } from "@/lib/labels";

describe("foldText — « Béjaïa » et « BEJAIA » doivent être le même mot", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(foldText("Béjaïa")).toBe("bejaia");
    expect(foldText("M'Sila")).toBe("m sila");
    expect(foldText("  Aïn  Témouchent ")).toBe("ain temouchent");
  });
});

describe("wilayaFromPostalCode — les deux premiers chiffres SONT le numéro de wilaya", () => {
  it("reconnaît un code postal algérien", () => {
    expect(wilayaFromPostalCode("16000")).toBe("Alger");
    expect(wilayaFromPostalCode("31000")).toBe("Oran");
    expect(wilayaFromPostalCode("25000")).toBe("Constantine");
  });

  it("tolère un code écrit avec des espaces", () => {
    expect(wilayaFromPostalCode("16 000")).toBe("Alger");
  });

  it("refuse ce qui n'est pas un code postal", () => {
    expect(wilayaFromPostalCode("16")).toBeNull();
    expect(wilayaFromPostalCode("")).toBeNull();
    expect(wilayaFromPostalCode("99000")).toBeNull();
  });
});

describe("wilayaFromCode — le numéro administratif seul", () => {
  it("accepte 1 → 58, avec ou sans zéro initial", () => {
    expect(wilayaFromCode("16")).toBe("Alger");
    expect(wilayaFromCode("06")).toBe("Béjaïa");
    expect(wilayaFromCode("58")).toBe(ALGERIA_WILAYAS[57]);
  });

  it("refuse au-delà de la liste", () => {
    expect(wilayaFromCode("59")).toBeNull();
    expect(wilayaFromCode("0")).toBeNull();
  });
});

describe("wilayaInText — la wilaya écrite quelque part dans une adresse", () => {
  it("la trouve au milieu d'une adresse", () => {
    expect(wilayaInText("12 rue Didouche Mourad, Alger")).toBe("Alger");
    expect(wilayaInText("CHU de Tizi Ouzou")).toBe("Tizi Ouzou");
  });

  // Sans le tri par longueur, une wilaya au nom plus court contenue dans un nom composé
  // l'emporterait, et l'on rangerait systématiquement ces fiches au mauvais endroit.
  it("préfère la correspondance la PLUS LONGUE", () => {
    expect(wilayaInText("Hôpital de Bordj Bou Arréridj")).toBe("Bordj Bou Arréridj");
    expect(wilayaInText("Sidi Bel Abbès")).toBe("Sidi Bel Abbès");
  });

  it("accepte les écritures courantes sans accent", () => {
    expect(wilayaInText("clinique bejaia")).toBe("Béjaïa");
    expect(wilayaInText("EPSP Setif")).toBe("Sétif");
  });

  it("ne confond pas un mot qui CONTIENT un nom de wilaya", () => {
    expect(wilayaInText("Algerie Telecom")).toBeNull();
  });

  it("rend null sur un texte vide ou sans wilaya", () => {
    expect(wilayaInText("")).toBeNull();
    expect(wilayaInText("Rue des Frères Bouadou")).toBeNull();
  });
});

describe("resolveWilaya — l'ordre des signaux compte", () => {
  it("une colonne Wilaya explicite prime sur tout", () => {
    expect(resolveWilaya({ wilaya: "Oran", postalCode: "16000", city: "Alger" })).toBe("Oran");
  });

  it("accepte un numéro dans la colonne Wilaya", () => {
    expect(resolveWilaya({ wilaya: "16" })).toBe("Alger");
  });

  // Une rue « Alger » peut se trouver à Oran ; un code postal, lui, ne ment pas.
  it("le code postal prime sur un nom de ville", () => {
    expect(resolveWilaya({ postalCode: "31000", city: "Rue d'Alger" })).toBe("Oran");
  });

  it("retombe sur la ville, puis l'adresse, puis l'établissement", () => {
    expect(resolveWilaya({ city: "Annaba" })).toBe("Annaba");
    expect(resolveWilaya({ address: "Cité 1000 logements, Blida" })).toBe("Blida");
    expect(resolveWilaya({ institution: "CHU Mustapha, Alger" })).toBe("Alger");
  });

  it("trouve le code postal caché DANS l'adresse", () => {
    expect(resolveWilaya({ address: "Lot 5, 09000 Blida" })).toBe("Blida");
  });

  // Une wilaya fausse est pire qu'une wilaya vide : elle entre dans les comptages sans que
  // personne ne la revérifie.
  it("rend null plutôt que de deviner", () => {
    expect(resolveWilaya({})).toBeNull();
    expect(resolveWilaya({ city: "Ville inconnue", address: "sans repère" })).toBeNull();
  });

  it("une wilaya écrite n'importe comment reste reconnue", () => {
    expect(resolveWilaya({ wilaya: "BEJAIA" })).toBe("Béjaïa");
    expect(resolveWilaya({ wilaya: "wilaya d alger" })).toBe("Alger");
  });
});

describe("acceptAiWilaya — une réponse d'IA n'est acceptée que si elle nomme une wilaya réelle", () => {
  it("accepte un nom officiel, même mal accentué", () => {
    expect(acceptAiWilaya("Bejaia")).toBe("Béjaïa");
    expect(acceptAiWilaya("  ALGER  ")).toBe("Alger");
  });

  // Sans ce filtre, une hallucination du modèle entrerait dans un champ à liste fermée et
  // casserait le comptage par territoire — ce que la liste fermée existe précisément pour éviter.
  it("refuse tout ce qui n'est pas dans les 58", () => {
    expect(acceptAiWilaya("Casablanca")).toBeNull();
    expect(acceptAiWilaya("je ne sais pas")).toBeNull();
    expect(acceptAiWilaya("")).toBeNull();
  });
});

describe("unresolvedHint — ce qu'on soumet à l'IA", () => {
  it("assemble les indices disponibles, sans vide", () => {
    expect(unresolvedHint({ city: "Rouiba", address: "", institution: "EPH Rouiba" }))
      .toBe("Rouiba · EPH Rouiba");
  });

  it("rend une chaîne vide quand il n'y a aucun indice", () => {
    expect(unresolvedHint({})).toBe("");
  });
});
