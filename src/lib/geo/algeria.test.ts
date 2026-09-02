import { describe, it, expect } from "vitest";
import { WILAYAS, wilayaOptions, findWilaya, normalizeCity, isKnownWilaya } from "./algeria";

describe("le référentiel des wilayas", () => {
  it("EN COMPTE 58 — le découpage en vigueur depuis 2019", () => {
    expect(WILAYAS).toHaveLength(58);
    expect(WILAYAS[0]).toEqual({ code: "01", name: "Adrar" });
    expect(WILAYAS[57]).toEqual({ code: "58", name: "El Meniaa" });
  });

  it("des codes uniques, sur deux chiffres, dans l'ordre", () => {
    const codes = WILAYAS.map((w) => w.code);
    expect(new Set(codes).size).toBe(58);
    expect(codes.every((c) => /^\d{2}$/.test(c))).toBe(true);
    expect([...codes].sort()).toEqual(codes);
  });

  it("des noms uniques : deux entrées identiques rendraient le choix ambigu", () => {
    expect(new Set(WILAYAS.map((w) => w.name)).size).toBe(58);
  });

  it("LE NUMÉRO FAIT PARTIE DU LIBELLÉ — c'est ainsi qu'on les nomme, et ça aide à chercher", () => {
    const opts = wilayaOptions();
    expect(opts).toHaveLength(58);
    expect(opts.find((o) => o.value === "Alger")?.label).toBe("16 · Alger");
    // La VALEUR reste le nom : c'est lui qui s'écrit sur la demande et se lit partout ailleurs.
    expect(opts.every((o) => !/^\d/.test(o.value))).toBe(true);
  });
});

describe("reconnaître une saisie libre", () => {
  it("IGNORE LA CASSE ET LES ACCENTS", () => {
    expect(findWilaya("alger")?.name).toBe("Alger");
    expect(findWilaya("  ORAN ")?.name).toBe("Oran");
    expect(findWilaya("bejaia")?.name).toBe("Béjaïa");
    expect(findWilaya("SETIF")?.name).toBe("Sétif");
  });

  it("ignore les tirets et apostrophes — « M'Sila », « M Sila », « m-sila »", () => {
    for (const v of ["M'Sila", "M Sila", "m-sila", "M’SILA"]) {
      expect(findWilaya(v)?.code, v).toBe("28");
    }
  });

  it("reconnaît le CODE seul, avec ou sans zéro initial", () => {
    expect(findWilaya("16")?.name).toBe("Alger");
    expect(findWilaya("6")?.name).toBe("Béjaïa");
  });

  it("NE DEVINE PAS AU-DELÀ : « Alger centre » est une commune, pas la wilaya", () => {
    // Un rapprochement approximatif ferait entrer dans les statistiques des rattachements que
    // personne n'a validés.
    expect(findWilaya("Alger centre")).toBeNull();
    expect(findWilaya("Algiers")).toBeNull();
    expect(findWilaya("")).toBeNull();
    expect(findWilaya(null)).toBeNull();
  });
});

describe("ce qu'on affiche de l'existant", () => {
  it("remet une valeur reconnue dans sa forme officielle", () => {
    expect(normalizeCity("bordj bou arreridj")).toBe("Bordj Bou Arréridj");
  });

  it("RESPECTE CE QU'ELLE NE SAIT PAS RATTACHER — on ne perd pas une information vraie", () => {
    expect(normalizeCity("Alger centre")).toBe("Alger centre");
    expect(normalizeCity("  Hydra  ")).toBe("Hydra");
  });

  it("rend null sur du vide", () => {
    expect(normalizeCity("")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity("   ")).toBeNull();
  });

  it("sait dire si la valeur vient du référentiel — pour signaler une saisie ancienne", () => {
    expect(isKnownWilaya("Alger")).toBe(true);
    expect(isKnownWilaya("Alger centre")).toBe(false);
  });
});
