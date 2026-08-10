import { describe, it, expect } from "vitest";
import {
  canSetDepartmentBudget, settableKinds, normalizeAmount, normalizeYear,
  budgetHealth, consumedPercent, totals, mergeGrants, canEditDepartmentBudget,
  canViewDepartmentBudget, editableKindsOn, canManageDepartmentBudgetAccess, EMPTY_GRANT,
  type BudgetSetter, type DeptBudgetRow, type DeptBudgetGrant, type GrantSubject,
} from "./department-budget";

const setter = (over: Partial<BudgetSetter> = {}): BudgetSetter => ({
  role: "MEDICAL_DELEGATE", canManageBudgets: false, canManageHr: false, ...over,
});

/**
 * Le point de ce module : le budget des EMPLOYÉS n'est pas réglé par la même personne que le
 * reste. Une erreur ici laisse l'administratif fixer la masse salariale, ou les RH arbitrer
 * les achats d'un département.
 */
describe("canSetDepartmentBudget", () => {
  it("l'administrateur règle le fonctionnement, pas les employés", () => {
    const admin = setter({ role: "DIRECTION", canManageBudgets: true });
    expect(canSetDepartmentBudget(admin, "OPERATING")).toBe(true);
    expect(canSetDepartmentBudget(admin, "HR")).toBe(false);
  });

  it("les RH règlent les employés, pas le fonctionnement", () => {
    const rh = setter({ role: "DIRECTION_ASSISTANT", canManageHr: true });
    expect(canSetDepartmentBudget(rh, "HR")).toBe(true);
    expect(canSetDepartmentBudget(rh, "OPERATING")).toBe(false);
  });

  it("le Super Admin arbitre les deux", () => {
    const sa = setter({ role: "SUPER_ADMIN" });
    expect(settableKinds(sa)).toEqual(["OPERATING", "HR", "ACTIVITY"]);
  });

  it("quelqu'un qui cumule les deux fonctions règle les deux", () => {
    expect(settableKinds(setter({ canManageBudgets: true, canManageHr: true }))).toEqual(["OPERATING", "HR", "ACTIVITY"]);
  });

  it("sans droit, aucune case n'est modifiable", () => {
    expect(settableKinds(setter())).toEqual([]);
  });
});

describe("normalizeAmount", () => {
  it("accepte les écritures françaises (espaces, virgule)", () => {
    expect(normalizeAmount("1 200,50")).toBe(1200.5);
    expect(normalizeAmount(4000)).toBe(4000);
  });

  it("traite le vide comme zéro, pas comme une erreur", () => {
    expect(normalizeAmount("")).toBe(0);
    expect(normalizeAmount(null)).toBe(0);
  });

  it("refuse un négatif et un non-nombre", () => {
    expect(normalizeAmount("-5")).toEqual({ error: "Un budget ne peut pas être négatif." });
    expect(normalizeAmount("abc")).toEqual({ error: "Le montant n'est pas un nombre." });
  });
});

describe("normalizeYear", () => {
  it("garde une année d'exercice plausible", () => {
    expect(normalizeYear(2027, 2026)).toBe(2027);
  });

  it("retombe sur l'année courante pour une saisie aberrante", () => {
    // 20260 est une faute de frappe, pas une prévision.
    expect(normalizeYear(20260, 2026)).toBe(2026);
    expect(normalizeYear(1998, 2026)).toBe(2026);
    expect(normalizeYear("x", 2026)).toBe(2026);
  });
});

describe("budgetHealth", () => {
  it("distingue « pas de budget » de « rien consommé »", () => {
    // Un département sans budget réglé n'est pas à 0 % de consommation : il n'a pas de budget.
    expect(budgetHealth(0, 0)).toBe("UNSET");
    expect(budgetHealth(1000, 0)).toBe("ON_TRACK");
  });

  it("alerte à 80 % et signale le dépassement", () => {
    expect(budgetHealth(1000, 799)).toBe("ON_TRACK");
    expect(budgetHealth(1000, 800)).toBe("AT_RISK");
    expect(budgetHealth(1000, 1000)).toBe("OVER_BUDGET");
    expect(budgetHealth(1000, 1500)).toBe("OVER_BUDGET");
  });
});

describe("consumedPercent", () => {
  it("borne l'affichage à 100 % sans masquer le dépassement (dit par la couleur)", () => {
    expect(consumedPercent(1000, 500)).toBe(50);
    expect(consumedPercent(1000, 2500)).toBe(100);
    expect(consumedPercent(0, 500)).toBe(0);
  });
});

describe("totals", () => {
  it("additionne les colonnes du tableau", () => {
    const rows: DeptBudgetRow[] = [
      { departmentId: "a", departmentName: "A", path: "A", companyName: null, members: 3, operating: 100, hr: 900, activity: 200, hrConsumed: 500, operatingConsumed: 60, activityConsumed: 10 },
      { departmentId: "b", departmentName: "B", path: "B", companyName: null, members: 2, operating: 50, hr: 400, activity: 25, hrConsumed: 410, operatingConsumed: 15, activityConsumed: 5 },
    ];
    expect(totals(rows)).toEqual({
      operating: 150, hr: 1300, activity: 225,
      hrConsumed: 910, operatingConsumed: 75, activityConsumed: 15, members: 5,
    });
  });

  it("rend des zéros sur un tableau vide plutôt que NaN", () => {
    expect(totals([])).toEqual({
      operating: 0, hr: 0, activity: 0, hrConsumed: 0, operatingConsumed: 0, activityConsumed: 0, members: 0,
    });
  });
});

// ───────────────── Autorisations réglées par le Super Admin ─────────────────

const grant = (over: Partial<DeptBudgetGrant> = {}): DeptBudgetGrant => ({ ...EMPTY_GRANT, ...over });
const subj = (over: Partial<GrantSubject> = {}): GrantSubject => ({ id: "u1", role: "MEDICAL_DELEGATE", ...over });

describe("mergeGrants", () => {
  it("cumule la règle générale et celle du département (union, jamais intersection)", () => {
    // Intersecter ferait d'une règle de département une RESTRICTION de la règle générale,
    // en contradiction avec « les autorisations s'ajoutent ».
    const merged = mergeGrants(
      grant({ accessRoles: ["DIRECTION"], hrUserIds: ["a"] }),
      grant({ accessRoles: ["PRODUCT_MANAGER"], operatingUserIds: ["b"] }),
    );
    expect(merged.accessRoles.sort()).toEqual(["DIRECTION", "PRODUCT_MANAGER"]);
    expect(merged.hrUserIds).toEqual(["a"]);
    expect(merged.operatingUserIds).toEqual(["b"]);
  });

  it("ne double pas une entrée présente des deux côtés", () => {
    const merged = mergeGrants(grant({ accessUserIds: ["a"] }), grant({ accessUserIds: ["a"] }));
    expect(merged.accessUserIds).toEqual(["a"]);
  });

  it("tolère l'absence de l'une ou l'autre règle", () => {
    expect(mergeGrants(null, null)).toEqual(EMPTY_GRANT);
    expect(mergeGrants(grant({ hrRoles: ["DIRECTION_ASSISTANT"] }), null).hrRoles).toEqual(["DIRECTION_ASSISTANT"]);
  });
});

describe("canEditDepartmentBudget", () => {
  const nobody = setter();

  it("une autorisation nominative ouvre l'édition d'UNE nature", () => {
    const g = grant({ operatingUserIds: ["u1"] });
    expect(canEditDepartmentBudget(subj(), nobody, "OPERATING", g)).toBe(true);
    // …et d'elle seule : ouvrir le fonctionnement n'ouvre pas la masse salariale.
    expect(canEditDepartmentBudget(subj(), nobody, "HR", g)).toBe(false);
  });

  it("une autorisation par rôle vaut pour le rôle principal ET le rôle secondaire", () => {
    const g = grant({ hrRoles: ["DIRECTION_ASSISTANT"] });
    expect(canEditDepartmentBudget(subj({ role: "DIRECTION_ASSISTANT" }), nobody, "HR", g)).toBe(true);
    expect(canEditDepartmentBudget(subj({ secondaryRole: "DIRECTION_ASSISTANT" }), nobody, "HR", g)).toBe(true);
    expect(canEditDepartmentBudget(subj(), nobody, "HR", g)).toBe(false);
  });

  it("N'ENLÈVE JAMAIS le socle par rôle", () => {
    // C'est la garantie de l'option retenue : poser une autorisation ne doit pas retirer aux
    // RH le budget des employés par effet de bord.
    const rh = setter({ canManageHr: true });
    const g = grant({ operatingUserIds: ["quelquun-dautre"] });
    expect(canEditDepartmentBudget(subj({ id: "rh" }), rh, "HR", g)).toBe(true);
  });

  it("sans socle ni autorisation, rien n'est éditable", () => {
    expect(editableKindsOn(subj(), nobody, EMPTY_GRANT)).toEqual([]);
  });

  it("editableKindsOn cumule socle et autorisations", () => {
    const admin = setter({ canManageBudgets: true });
    expect(editableKindsOn(subj(), admin, grant({ hrUserIds: ["u1"] }))).toEqual(["OPERATING", "HR", "ACTIVITY"]);
  });
});

describe("canViewDepartmentBudget", () => {
  const nobody = setter();

  it("qui peut éditer peut lire — l'inverse serait absurde", () => {
    expect(canViewDepartmentBudget(subj(), nobody, grant({ hrUserIds: ["u1"] }), false)).toBe(true);
  });

  it("une autorisation de consultation ne donne PAS l'édition", () => {
    const g = grant({ accessUserIds: ["u1"] });
    expect(canViewDepartmentBudget(subj(), nobody, g, false)).toBe(true);
    expect(editableKindsOn(subj(), nobody, g)).toEqual([]);
  });

  it("le droit de consulter le module Budgets suffit à lire", () => {
    expect(canViewDepartmentBudget(subj(), nobody, EMPTY_GRANT, true)).toBe(true);
  });

  it("sans droit de module ni autorisation, on ne voit rien", () => {
    expect(canViewDepartmentBudget(subj(), nobody, EMPTY_GRANT, false)).toBe(false);
  });
});

describe("canManageDepartmentBudgetAccess", () => {
  it("régler les autorisations est réservé au Super Admin", () => {
    expect(canManageDepartmentBudgetAccess(setter({ role: "SUPER_ADMIN" }))).toBe(true);
    // Même quelqu'un qui règle les DEUX budgets ne règle pas QUI y a accès.
    expect(canManageDepartmentBudgetAccess(setter({ canManageBudgets: true, canManageHr: true }))).toBe(false);
  });
});
