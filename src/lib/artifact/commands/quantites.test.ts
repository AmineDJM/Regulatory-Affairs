import { describe, it, expect } from "vitest";
import { lireDistanceCm, lirePoints, sansMesures, lireInterligne, porteUneMesure } from "@/lib/artifact/commands/quantites";

describe("lireDistanceCm — la phrase porte la mesure, on l'obéit au millimètre", () => {
  it("LES CAS DEMANDÉS", () => {
    expect(lireDistanceCm("décale ce titre de 1,2 cm à droite")).toBe(1.2);
    expect(lireDistanceCm("remonte cette image de 4 mm")).toBe(0.4);
  });

  it("les écritures usuelles de la même mesure", () => {
    for (const p of ["1,2 cm", "1.2 cm", "1,2cm", "1,2 centimètres", "12 mm", "1,2 CM"]) {
      expect(lireDistanceCm(p), p).toBeCloseTo(1.2, 3);
    }
  });

  it("mm, m, pouce et point se convertissent", () => {
    expect(lireDistanceCm("4 mm")).toBeCloseTo(0.4, 3);
    expect(lireDistanceCm("1 pouce")).toBeCloseTo(2.54, 2);
    expect(lireDistanceCm("72 pt")).toBeCloseTo(2.54, 2);
  });

  it("la PREMIÈRE mesure est rendue — découper deux gestes n'est pas le travail de ce module", () => {
    expect(lireDistanceCm("décale de 1 cm puis remonte de 5 cm")).toBe(1);
  });
});

describe("lireDistanceCm — SANS UNITÉ, PAS DE MESURE : la règle qui protège le rang", () => {
  it("un rang n'est jamais lu comme une distance", () => {
    for (const p of ["le troisième paragraphe", "paragraphe 3", "page 12", "décale un peu", "3"]) {
      expect(lireDistanceCm(p), p).toBeNull();
    }
    expect(porteUneMesure("décale un peu")).toBe(false);
  });

  it("une mesure nulle ou négative n'est pas une mesure", () => {
    expect(lireDistanceCm("0 cm")).toBeNull();
  });
});

describe("sansMesures — LE DÉFAUT SILENCIEUX : le rang lisait le chiffre de la distance", () => {
  it("« le paragraphe 3 de 1,2 cm » : le rang est 3, pas 1", () => {
    const nu = sansMesures("décale le paragraphe 3 de 1,2 cm à droite");
    expect(/\b(\d{1,4})\b/.exec(nu)?.[1]).toBe("3");
  });

  it("sans mesure, la phrase est intacte pour la lecture du rang", () => {
    expect(/\b(\d{1,4})\b/.exec(sansMesures("le paragraphe 7"))?.[1]).toBe("7");
  });

  it("plusieurs mesures disparaissent toutes", () => {
    expect(sansMesures("de 1,2 cm et 4 mm et 12 pt")).not.toMatch(/\d/);
  });
});

describe("lirePoints et lireInterligne", () => {
  it("une taille de police en points", () => {
    expect(lirePoints("mets-le en 14 pt")).toBe(14);
    expect(lirePoints("en Arial 10")).toBeNull(); // pas d'unité : ce n'est pas à ce module de trancher
  });

  it("l'interligne, en multiples de la ligne", () => {
    expect(lireInterligne("augmente l'interligne à 1,5")).toBe(1.5);
    expect(lireInterligne("double interligne")).toBe(2);
    expect(lireInterligne("interligne simple")).toBe(1);
    expect(lireInterligne("mets ça en gras")).toBeNull();
  });

  it("un interligne aberrant n'est pas retenu", () => {
    expect(lireInterligne("interligne 40")).toBeNull();
  });
});
