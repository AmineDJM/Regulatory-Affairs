import { describe, it, expect } from "vitest";
import {
  canSetDepartmentBudget, settableKinds, normalizeAmount, normalizeYear,
  budgetHealth, consumedPercent, totals, type BudgetSetter, type DeptBudgetRow,
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
    const rh = setter({ role: "HR_MANAGER", canManageHr: true });
    expect(canSetDepartmentBudget(rh, "HR")).toBe(true);
    expect(canSetDepartmentBudget(rh, "OPERATING")).toBe(false);
  });

  it("le Super Admin arbitre les deux", () => {
    const sa = setter({ role: "SUPER_ADMIN" });
    expect(settableKinds(sa)).toEqual(["OPERATING", "HR"]);
  });

  it("quelqu'un qui cumule les deux fonctions règle les deux", () => {
    expect(settableKinds(setter({ canManageBudgets: true, canManageHr: true }))).toEqual(["OPERATING", "HR"]);
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
      { departmentId: "a", departmentName: "A", path: "A", companyName: null, members: 3, operating: 100, hr: 900, hrConsumed: 500 },
      { departmentId: "b", departmentName: "B", path: "B", companyName: null, members: 2, operating: 50, hr: 400, hrConsumed: 410 },
    ];
    expect(totals(rows)).toEqual({ operating: 150, hr: 1300, hrConsumed: 910, members: 5 });
  });

  it("rend des zéros sur un tableau vide plutôt que NaN", () => {
    expect(totals([])).toEqual({ operating: 0, hr: 0, hrConsumed: 0, members: 0 });
  });
});
