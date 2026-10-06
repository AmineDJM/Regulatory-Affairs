import { describe, it, expect } from "vitest";
import { annuairesParSpecialite, clauseSpecialite, SANS_SPECIALITE } from "./par-specialite";

const referentiel = [
  { id: "s1", name: "Néphrologie" },
  { id: "s2", name: "Cardiologie" },
  { id: "s3", name: "Oncologie" },
];

describe("un annuaire par spécialité", () => {
  it("une entrée par spécialité qui compte des médecins, triée par nom", () => {
    const r = annuairesParSpecialite(
      [{ specialtyId: "s1", count: 4 }, { specialtyId: "s2", count: 9 }, { specialtyId: "s3", count: 0 }],
      referentiel,
    );
    expect(r.specialites).toEqual([
      { id: "s2", name: "Cardiologie", count: 9 },
      { id: "s1", name: "Néphrologie", count: 4 },
    ]);
    expect(r.sansSpecialite).toBe(0);
  });

  it("les fiches sans spécialité — ou rattachées à une spécialité disparue — vont dans « Sans spécialité »", () => {
    const r = annuairesParSpecialite(
      [{ specialtyId: null, count: 3 }, { specialtyId: "disparue", count: 2 }, { specialtyId: "s1", count: 1 }],
      referentiel,
    );
    expect(r.sansSpecialite).toBe(5);
    expect(r.specialites.map((s) => s.id)).toEqual(["s1"]);
  });

  it("pour qui gère le référentiel, les spécialités sans médecin apparaissent aussi (à renommer, supprimer…)", () => {
    const r = annuairesParSpecialite([{ specialtyId: "s1", count: 2 }], referentiel, true);
    expect(r.specialites.map((s) => [s.name, s.count])).toEqual([["Cardiologie", 0], ["Néphrologie", 2], ["Oncologie", 0]]);
  });

  it("la clause : rien = tous, un identifiant = cette spécialité, « sans » = non rattachés", () => {
    expect(clauseSpecialite(null)).toEqual({});
    expect(clauseSpecialite("s1")).toEqual({ specialtyId: "s1" });
    expect(clauseSpecialite(SANS_SPECIALITE)).toEqual({ specialtyId: null });
  });
});
