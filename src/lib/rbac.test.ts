import { describe, expect, it } from "vitest";
import {
  can,
  accessibleModules,
  hasGlobalView,
  scopeRegulatory,
  scopeSales,
  scopeMedicalDoctors,
  canValidate,
} from "./rbac";

describe("module permissions (can)", () => {
  it("grants Super Admin every action on every module", () => {
    expect(can("SUPER_ADMIN", "REGULATORY", "DELETE")).toBe(true);
    expect(can("SUPER_ADMIN", "ADMIN", "CREATE")).toBe(true);
  });

  it("lets the Head of Regulatory manage Regulatory but not Sales", () => {
    expect(can("HEAD_OF_REGULATORY", "REGULATORY", "VALIDATE")).toBe(true);
    expect(can("HEAD_OF_REGULATORY", "SALES", "VIEW")).toBe(false);
  });

  it("restricts a Regulatory Assistant to contribute-level access", () => {
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "VIEW")).toBe(true);
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "UPDATE")).toBe(true);
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "DELETE")).toBe(false);
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "VALIDATE")).toBe(false);
  });

  it("prevents a Viewer from creating anything", () => {
    expect(can("VIEWER", "REGULATORY", "CREATE")).toBe(false);
    expect(can("VIEWER", "DASHBOARD", "VIEW")).toBe(true);
  });
});

describe("navigation (accessibleModules)", () => {
  it("hides modules a role cannot view", () => {
    const sales = accessibleModules("SALES_USER");
    expect(sales).toContain("SALES");
    expect(sales).toContain("DASHBOARD");
    expect(sales).not.toContain("ADMIN");
    expect(sales).not.toContain("REGULATORY");
  });

  it("exposes everything to Super Admin", () => {
    expect(accessibleModules("SUPER_ADMIN")).toHaveLength(13);
  });
});

describe("row-level scoping", () => {
  it("gives the Head of Regulatory an unrestricted scope", () => {
    expect(scopeRegulatory({ id: "u1", role: "HEAD_OF_REGULATORY" })).toEqual({});
    expect(hasGlobalView("DIRECTION")).toBe(true);
  });

  it("limits a Regulatory Assistant to their assigned lines only", () => {
    const scope = scopeRegulatory({ id: "u-assistant", role: "REGULATORY_ASSISTANT" });
    expect(scope).toHaveProperty("OR");
    const or = (scope as { OR: unknown[] }).OR;
    expect(JSON.stringify(or)).toContain("u-assistant");
  });

  it("returns a match-nothing scope for roles without regulatory access", () => {
    expect(scopeRegulatory({ id: "u2", role: "SALES_USER" })).toEqual({ id: "__none__" });
  });

  it("limits a sales user to their own sales", () => {
    expect(scopeSales({ id: "s1", role: "SALES_USER" })).toEqual({ salesUserId: "s1" });
    expect(scopeSales({ id: "h1", role: "HEAD_OF_SALES" })).toEqual({});
  });

  it("limits a medical delegate to their own doctors", () => {
    expect(scopeMedicalDoctors({ id: "d1", role: "MEDICAL_DELEGATE" })).toEqual({ delegateId: "d1" });
    expect(scopeMedicalDoctors({ id: "m1", role: "MEDICAL_PROMOTION_MANAGER" })).toEqual({});
  });
});

describe("validation rights", () => {
  it("allows Direction to validate sponsoring, not a sales user", () => {
    expect(canValidate("DIRECTION", "SPONSORING")).toBe(true);
    expect(canValidate("SALES_USER", "SPONSORING")).toBe(false);
  });
});
