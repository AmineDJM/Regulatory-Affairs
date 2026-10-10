import { describe, it, expect } from "vitest";
import { controlerCoherence, superviseurPropose, kamsHorsLigne, totalIncoherences, type DepartementCoherence, type EmployeCoherence } from "./coherence";

/**
 * L'ORGANIGRAMME, SEULE SOURCE — le contrôle de cohérence dit exactement ce qui le contredit.
 *
 *   Commercial (resp. Brahim) ─┬─ BU Neuro (dep-neuro, resp. Sonia) ── KAM Ali
 *                              └─ KAM Karim (rattaché directement)
 *   RH (sans responsable)        Nadia (sans département)
 */
const departements: DepartementCoherence[] = [
  { id: "dep-com", name: "Direction commerciale", parentId: null, headId: "e-brahim", deputyId: null },
  { id: "dep-neuro", name: "BU Neurologie", parentId: "dep-com", headId: "e-sonia", deputyId: null },
  { id: "dep-rh", name: "Ressources humaines", parentId: null, headId: null, deputyId: null },
];
const e = (id: string, fullName: string, userId: string | null, departmentId: string | null, department: string | null, managerId: string | null = null): EmployeCoherence =>
  ({ id, fullName, userId, departmentId, department, managerId, isActive: true });
const employes: EmployeCoherence[] = [
  e("e-brahim", "Brahim", "u-brahim", "dep-com", "Direction commerciale"),
  e("e-sonia", "Sonia", "u-sonia", "dep-neuro", "BU Neurologie"),
  e("e-ali", "Ali", "u-ali", "dep-neuro", "Neuro (ancien nom)"),
  e("e-karim", "Karim", "u-karim", "dep-com", "Direction commerciale"),
  e("e-nadia", "Nadia", "u-nadia", null, null),
];
const comptes = [
  { id: "u-brahim", name: "Brahim", departmentId: "dep-com", isActive: true },
  { id: "u-sonia", name: "Sonia", departmentId: "dep-neuro", isActive: true },
  { id: "u-ali", name: "Ali", departmentId: "dep-com", isActive: true },
  { id: "u-karim", name: "Karim", departmentId: "dep-com", isActive: true },
  { id: "u-nadia", name: "Nadia", departmentId: null, isActive: true },
];

describe("le contrôle de cohérence", () => {
  const c = controlerCoherence({
    departements, employes, comptes,
    bus: [
      { id: "bu-neuro", name: "Neuro", departmentId: "dep-neuro", supervisorId: "u-karim", kamUserIds: ["u-ali"], isActive: true },
      { id: "bu-uro", name: "Uro", departmentId: null, supervisorId: null, kamUserIds: [], isActive: true },
      { id: "bu-old", name: "Ancienne", departmentId: null, supervisorId: null, kamUserIds: [], isActive: false },
    ],
  });

  it("le compte dont le département diffère de la fiche", () => {
    expect(c.comptesDivergents).toEqual([{ userId: "u-ali", nom: "Ali", employeeId: "e-ali", compte: "Direction commerciale", fiche: "BU Neurologie" }]);
  });
  it("le libellé texte périmé", () => {
    expect(c.libellesPerimes).toEqual([{ employeeId: "e-ali", nom: "Ali", libelle: "Neuro (ancien nom)", attendu: "BU Neurologie" }]);
  });
  it("les BU actives sans département", () => {
    expect(c.buSansDepartement).toEqual([{ buId: "bu-uro", nom: "Uro" }]);
  });
  it("les départements sans responsable", () => {
    expect(c.departementsSansResponsable).toEqual([{ departmentId: "dep-rh", nom: "Ressources humaines", membres: 0 }]);
  });
  it("le superviseur hors de la ligne de ses KAM, avec le superviseur que propose l'organigramme", () => {
    expect(c.superviseursHorsLigne).toEqual([{ buId: "bu-neuro", nom: "Neuro", superviseurId: "u-karim", kamsHorsLigne: ["Ali"], propose: "u-sonia" }]);
  });
  it("les employés sans département", () => {
    expect(c.employesSansDepartement).toEqual([{ employeeId: "e-nadia", nom: "Nadia" }]);
    expect(totalIncoherences(c)).toBe(6);
  });
});

describe("la ligne hiérarchique et le superviseur proposé", () => {
  it("le responsable du département (ou de son parent) est dans la ligne ; un pair ne l'est pas", () => {
    expect(kamsHorsLigne("u-sonia", ["u-ali"], employes, departements)).toEqual([]);
    expect(kamsHorsLigne("u-brahim", ["u-ali"], employes, departements)).toEqual([]);
    expect(kamsHorsLigne("u-karim", ["u-ali"], employes, departements)).toEqual(["u-ali"]);
  });
  it("un superviseur sans fiche ne se vérifie pas (on n'accuse pas)", () => {
    expect(kamsHorsLigne("u-inconnu", ["u-ali"], employes, departements)).toEqual([]);
  });
  it("le superviseur proposé : le responsable, à défaut l'adjoint ; rien sans département", () => {
    expect(superviseurPropose({ departmentId: "dep-neuro" }, departements, employes)).toBe("u-sonia");
    expect(superviseurPropose({ departmentId: "dep-rh" }, departements, employes)).toBeNull();
    expect(superviseurPropose({ departmentId: null }, departements, employes)).toBeNull();
    const avecAdjoint = departements.map((d) => (d.id === "dep-rh" ? { ...d, deputyId: "e-nadia" } : d));
    expect(superviseurPropose({ departmentId: "dep-rh" }, avecAdjoint, employes)).toBe("u-nadia");
  });
});
