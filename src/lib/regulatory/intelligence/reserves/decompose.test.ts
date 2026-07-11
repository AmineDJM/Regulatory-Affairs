import { describe, it, expect } from "vitest";
import { decomposeReserveText, categorizeReserve } from "./decompose";

describe("decomposeReserveText — décomposition des réserves (G9)", () => {
  it("découpe par numérotation et catégorise", () => {
    const letter = [
      "1. Fournir les données de stabilité en zone climatique IVb.",
      "2. Préciser la méthode de dosage validée (HPLC).",
      "3. Compléter le certificat GMP du fabricant.",
    ].join("\n");
    const points = decomposeReserveText(letter);
    expect(points).toHaveLength(3);
    expect(points[0].category).toBe("STABILITÉ");
    expect(points[1].category).toBe("ANALYTIQUE");
    expect(points[2].category).toBe("ADMINISTRATIF");
    expect(points[0].verbatim).toContain("zone climatique IVb"); // verbatim exact
  });

  it("reconnaît « Réserve N » et « Point N »", () => {
    const s = decomposeReserveText("Réserve 1 : Impuretés non spécifiées.\nRéserve 2 : Notice à corriger.");
    expect(s).toHaveLength(2);
    expect(s[0].category).toBe("QUALITÉ");
    expect(s[1].category).toBe("ÉTIQUETAGE");
  });

  it("sans numérotation : découpe par paragraphes", () => {
    const s = decomposeReserveText("Premier point de réserve.\n\nSecond point distinct.");
    expect(s).toHaveLength(2);
  });

  it("texte vide → aucun point", () => {
    expect(decomposeReserveText("")).toHaveLength(0);
  });

  it("categorizeReserve par mots-clés", () => {
    expect(categorizeReserve("étude de bioéquivalence")).toBe("CLINIQUE");
    expect(categorizeReserve("texte neutre sans mot-clé")).toBe("AUTRE");
  });
});
