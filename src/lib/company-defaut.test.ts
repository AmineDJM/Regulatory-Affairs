import { describe, it, expect } from "vitest";
import { ADVENTUM_COMPANY_ID, entiteParDefaut, trouverAdventum } from "./company-defaut";

const adventum = { id: ADVENTUM_COMPANY_ID, name: "Adventum Pharma", shortName: "Adventum" };
const pharmagene = { id: "company_pharmagene", name: "Pharmagène", shortName: null };

describe("entité par défaut = Adventum", () => {
  it("sans demande, ouvre Adventum même s'il n'est pas le premier", () => {
    expect(entiteParDefaut([pharmagene, adventum], null)).toBe(ADVENTUM_COMPANY_ID);
  });

  it("respecte une entité demandée que la personne voit", () => {
    expect(entiteParDefaut([adventum, pharmagene], "company_pharmagene")).toBe("company_pharmagene");
  });

  it("ignore une entité demandée qu'elle ne voit pas", () => {
    expect(entiteParDefaut([adventum], "company_pharmagene")).toBe(ADVENTUM_COMPANY_ID);
  });

  it("sans Adventum visible, retombe sur la première société", () => {
    expect(entiteParDefaut([pharmagene], null)).toBe("company_pharmagene");
  });

  it("aucune société visible : null", () => {
    expect(entiteParDefaut([], null)).toBeNull();
  });

  it("retrouve Adventum par son nom si l'identifiant a changé", () => {
    expect(trouverAdventum([{ id: "x1", name: "Adventum Pharma" }])?.id).toBe("x1");
  });
});
