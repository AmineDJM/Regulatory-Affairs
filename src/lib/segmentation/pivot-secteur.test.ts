import { describe, expect, it } from "vitest";
import { inOutDe, pivotDuSecteur } from "./in-out";

describe("wilaya pivot du secteur (Direction, 08/10)", () => {
  it("la wilaya choisie dans le menu l'emporte sur la ville pivot", () => {
    expect(pivotDuSecteur({ wilayaPivot: "Oran", city: "Alger" })).toBe("Oran");
    expect(inOutDe("Oran", [pivotDuSecteur({ wilayaPivot: "Oran", city: "Alger" })])).toBe("IN");
    expect(inOutDe("Alger", [pivotDuSecteur({ wilayaPivot: "Oran", city: "Alger" })])).toBe("OUT");
  });

  it("sans wilaya choisie, la ville pivot continue de la donner", () => {
    expect(pivotDuSecteur({ wilayaPivot: null, city: "Oran" })).toBe("Oran");
    expect(pivotDuSecteur({ city: "Bab Ezzouar, Alger" })).toBe("Alger");
  });

  it("une valeur hors liste n'est pas une wilaya : on retombe sur la ville, puis sur rien", () => {
    expect(pivotDuSecteur({ wilayaPivot: "Atlantide", city: "Tlemcen" })).toBe("Tlemcen");
    expect(pivotDuSecteur({ wilayaPivot: "", city: "" })).toBeNull();
    expect(pivotDuSecteur({})).toBeNull();
  });
});
