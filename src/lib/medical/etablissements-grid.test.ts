import { describe, it, expect } from "vitest";
import { ETABLISSEMENT_COLUMNS, isEtablissementField } from "./etablissements-grid";

describe("La feuille des établissements — colonnes nommées une fois", () => {
  it("la wilaya est la seule colonne géographique : ni ville, ni région", () => {
    const headers = ETABLISSEMENT_COLUMNS.map((c) => c.header);
    expect(headers).toContain("Wilaya");
    expect(headers).not.toContain("Ville");
    expect(isEtablissementField("wilaya")).toBe(true);
    expect(isEtablissementField("city")).toBe(false);
    expect(isEtablissementField("id")).toBe(false);
    expect(isEtablissementField(undefined)).toBe(false);
  });

  it("les colonnes calculées sont nommées comme telles — elles se colorent, ne s'éditent pas", () => {
    const calculees = ETABLISSEMENT_COLUMNS.filter((c) => c.calculee).map((c) => c.field);
    expect(calculees).toEqual(["doctorCount", "sectorCount"]);
  });
});
