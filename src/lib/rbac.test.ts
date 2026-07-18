import { describe, expect, it } from "vitest";
import type { EntityType, UserRole } from "@prisma/client";
import {
  PERMISSIONS,
  accessibleModules,
  can,
  canAnswerRegRequests,
  canCreateRegRequest,
  canManageEnvelope,
  canSeeRegRequests,
  canViewEnvelope,
  defaultScope,
  hasGlobalView,
  scopeMedicalDoctors,
  scopeRegulatory,
  scopeSales,
  userCan,
  type Action,
  type EffectiveAccess,
  type Module,
  type SessionUser,
} from "./rbac";

/** Build an in-memory effective access (mirrors what getAccess resolves). */
function mkAccess(
  modules: Partial<Record<Module, { actions: Action[]; scope: "ALL" | "ASSIGNED" }>>,
  grants: Partial<Record<EntityType, string[]>> = {},
): EffectiveAccess {
  const m = new Map();
  for (const [k, v] of Object.entries(modules)) {
    m.set(k, { actions: new Set(v!.actions), scope: v!.scope });
  }
  const rg = new Map();
  for (const [k, v] of Object.entries(grants)) rg.set(k, new Set(v));
  return { modules: m, rowGrants: rg };
}

function mkUser(id: string, role: UserRole, access: EffectiveAccess): SessionUser {
  return { id, role, access };
}

/** Resolve role defaults the way getAccess would (for testing userCan/scope). */
function fromRole(role: UserRole): EffectiveAccess {
  const modules: Partial<Record<Module, { actions: Action[]; scope: "ALL" | "ASSIGNED" }>> = {};
  for (const [mod, actions] of Object.entries(PERMISSIONS[role])) {
    if (actions.includes("VIEW")) {
      modules[mod as Module] = { actions, scope: defaultScope(role, mod as Module) };
    }
  }
  return mkAccess(modules);
}

describe("role-default permissions (can)", () => {
  it("grants Super Admin everything", () => {
    expect(can("SUPER_ADMIN", "REGULATORY", "DELETE")).toBe(true);
    expect(can("SUPER_ADMIN", "ADMIN", "CREATE")).toBe(true);
  });
  it("restricts a Regulatory Assistant to contribute-level", () => {
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "UPDATE")).toBe(true);
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "DELETE")).toBe(false);
    expect(can("REGULATORY_ASSISTANT", "REGULATORY", "VALIDATE")).toBe(false);
  });
  it("prevents a Viewer from creating", () => {
    expect(can("VIEWER", "REGULATORY", "CREATE")).toBe(false);
    expect(can("VIEWER", "DASHBOARD", "VIEW")).toBe(true);
  });
  it("lets Direction validate every pôle (validate-everything)", () => {
    // Les BUDGETS (enveloppes) sont désormais une prérogative du Super Admin : la
    // Direction des opérations les consulte (selon les enveloppes ouvertes) mais ne
    // les gère/valide pas — voir #193 (gouvernance des enveloppes).
    const validatable: Module[] = [
      "REGULATORY", "SPONSORING", "FINANCES", "CONGRESS_INTERNATIONAL",
      "CONGRESS_NATIONAL", "SALES", "LOGISTICS", "PCH", "STOCKS", "MEDICAL",
      "BUSINESS_DEVELOPMENT", "VALIDATIONS", "MEDICAL_INFO",
    ];
    for (const m of validatable) {
      expect(can("DIRECTION", m, "VALIDATE")).toBe(true);
    }
    // Budgets : la Direction lit mais ne valide pas.
    expect(can("DIRECTION", "BUDGETS", "VIEW")).toBe(true);
    expect(can("DIRECTION", "BUDGETS", "VALIDATE")).toBe(false);
  });
  it("gives the medical-info pharmacist their module + read on event pôles", () => {
    expect(can("MEDICAL_INFO_PHARMACIST", "MEDICAL_INFO", "VALIDATE")).toBe(true);
    expect(can("MEDICAL_INFO_PHARMACIST", "MEDICAL_INFO", "CREATE")).toBe(true);
    expect(can("MEDICAL_INFO_PHARMACIST", "SPONSORING", "VIEW")).toBe(true);
    expect(can("MEDICAL_INFO_PHARMACIST", "SPONSORING", "VALIDATE")).toBe(false); // ne valide pas le sponsoring lui-même
    expect(can("MEDICAL_INFO_PHARMACIST", "CONGRESS_INTERNATIONAL", "VIEW")).toBe(true);
  });
  it("scopes MEDICAL_INFO to ALL for the pharmacist, ASSIGNED otherwise", () => {
    expect(defaultScope("MEDICAL_INFO_PHARMACIST", "MEDICAL_INFO")).toBe("ALL");
    expect(defaultScope("FINANCE_BUDGET_MANAGER", "MEDICAL_INFO")).toBe("ASSIGNED");
  });
  it("gives every role a baseline for Directives and Support (Direction manages)", () => {
    const roles: UserRole[] = ["DIRECTION", "MEDICAL_DELEGATE", "PRODUCT_MANAGER", "SALES_USER", "FINANCE_BUDGET_MANAGER", "VIEWER"];
    for (const r of roles) {
      expect(can(r, "DIRECTIVES", "VIEW")).toBe(true);
      expect(can(r, "SUPPORT", "VIEW")).toBe(true);
      expect(can(r, "SUPPORT", "CREATE")).toBe(true);
    }
    // Seule la Direction (et le Super Admin) émet une directive.
    expect(can("DIRECTION", "DIRECTIVES", "CREATE")).toBe(true);
    expect(can("MEDICAL_DELEGATE", "DIRECTIVES", "CREATE")).toBe(false);
    // Portées restreintes par défaut (chacun ne voit que ce qui le concerne).
    expect(defaultScope("MEDICAL_DELEGATE", "DIRECTIVES")).toBe("ASSIGNED");
    expect(defaultScope("PRODUCT_MANAGER", "SUPPORT")).toBe("ASSIGNED");
  });
  it("reserves Administration and Adventum Brain to the Super Admin only", () => {
    const others: UserRole[] = ["DIRECTION", "DIRECTION_ASSISTANT", "HEAD_OF_REGULATORY", "FINANCE_BUDGET_MANAGER", "MEDICAL_INFO_PHARMACIST", "MEDICAL_PROMOTION_MANAGER", "VIEWER"];
    for (const r of others) {
      expect(can(r, "ADMIN", "VIEW")).toBe(false);
      expect(can(r, "ADVENTUM_BRAIN", "VIEW")).toBe(false);
      expect(can(r, "PROCESS_INTELLIGENCE", "VIEW")).toBe(false);
    }
    expect(can("SUPER_ADMIN", "ADMIN", "VIEW")).toBe(true);
    expect(can("SUPER_ADMIN", "ADVENTUM_BRAIN", "VIEW")).toBe(true);
  });
  it("gives the Direction Assistant full admin-requests (ALL) but NO promo-material module access", () => {
    expect(can("DIRECTION_ASSISTANT", "ADMIN_REQUESTS", "VALIDATE")).toBe(true);
    expect(defaultScope("DIRECTION_ASSISTANT", "ADMIN_REQUESTS")).toBe("ALL");
    // Elle pilote le matériel promo depuis les Demandes administratives, sans accès au module.
    expect(can("DIRECTION_ASSISTANT", "PROMO_MATERIAL", "VIEW")).toBe(false);
    expect(can("DIRECTION_ASSISTANT", "ADMIN", "VIEW")).toBe(false);
  });
});

describe("effective access (userCan / accessibleModules)", () => {
  it("reflects role defaults when there is no override", () => {
    const u = mkUser("s1", "SALES_USER", fromRole("SALES_USER"));
    expect(userCan(u, "SALES", "VIEW")).toBe(true);
    expect(userCan(u, "REGULATORY", "VIEW")).toBe(false);
    const mods = accessibleModules(u);
    expect(mods).toContain("SALES");
    expect(mods).not.toContain("ADMIN");
  });

  it("honours an admin override that revokes an action", () => {
    // Admin grants VIEW only on REGULATORY (no UPDATE), scope ALL.
    const u = mkUser("a1", "REGULATORY_ASSISTANT", mkAccess({ REGULATORY: { actions: ["VIEW"], scope: "ALL" } }));
    expect(userCan(u, "REGULATORY", "VIEW")).toBe(true);
    expect(userCan(u, "REGULATORY", "UPDATE")).toBe(false);
  });

  it("honours an admin override that grants extra access beyond the role", () => {
    // A viewer explicitly granted SALES create.
    const u = mkUser("v1", "VIEWER", mkAccess({ SALES: { actions: ["VIEW", "CREATE"], scope: "ALL" } }));
    expect(userCan(u, "SALES", "CREATE")).toBe(true);
    expect(accessibleModules(u)).toContain("SALES");
  });
});

describe("row-level scoping", () => {
  it("returns an unrestricted scope for ALL", () => {
    const head = mkUser("h1", "HEAD_OF_REGULATORY", fromRole("HEAD_OF_REGULATORY"));
    expect(scopeRegulatory(head)).toEqual({});
    expect(hasGlobalView("DIRECTION")).toBe(true);
  });

  it("limits ASSIGNED scope to owned + granted rows", () => {
    const asst = mkUser(
      "u-asst",
      "REGULATORY_ASSISTANT",
      mkAccess({ REGULATORY: { actions: ["VIEW"], scope: "ASSIGNED" } }, { REGULATORY_PRODUCT: ["row-123"] }),
    );
    const scope = scopeRegulatory(asst) as { OR: unknown[] };
    expect(scope).toHaveProperty("OR");
    const json = JSON.stringify(scope.OR);
    expect(json).toContain("u-asst"); // owner/assignee conditions
    expect(json).toContain("row-123"); // explicit grant
  });

  it("returns match-nothing when the module is not accessible", () => {
    const u = mkUser("x1", "SALES_USER", fromRole("SALES_USER"));
    expect(scopeRegulatory(u)).toEqual({ id: "__none__" });
  });

  it("scopes sales and medical by ownership", () => {
    const su = mkUser("s1", "SALES_USER", fromRole("SALES_USER"));
    expect(scopeSales(su)).toEqual({ OR: [{ salesUserId: "s1" }] });
    const del = mkUser("d1", "MEDICAL_DELEGATE", fromRole("MEDICAL_DELEGATE"));
    expect(scopeMedicalDoctors(del)).toEqual({ OR: [{ delegateId: "d1" }] });
    const mgr = mkUser("m1", "MEDICAL_PROMOTION_MANAGER", fromRole("MEDICAL_PROMOTION_MANAGER"));
    expect(scopeMedicalDoctors(mgr)).toEqual({});
  });
});

describe("envelope access (canViewEnvelope / canManageEnvelope)", () => {
  const admin = mkUser("a1", "SUPER_ADMIN", fromRole("SUPER_ADMIN"));
  const del = mkUser("d1", "MEDICAL_DELEGATE", fromRole("MEDICAL_DELEGATE"));
  const empty = { accessRoles: [], accessUserIds: [], managerRoles: [], managerUserIds: [] };

  it("hides an envelope by default (encadrement strict)", () => {
    expect(canViewEnvelope(del, empty)).toBe(false);
    expect(canManageEnvelope(del, empty)).toBe(false);
  });

  it("un droit BUDGETS:DELETE (rôle Finance/Budget) ne rend PAS gouverneur global — strict par enveloppe", () => {
    // Régression fuite : DELETE fait partie du bundle MANAGE et suffisait à voir/gérer
    // TOUTES les enveloppes. Désormais seul le Super Admin gouverne globalement ; le
    // titulaire du module Budget ne voit une enveloppe que si l'admin la lui ouvre.
    const fin = mkUser("f1", "FINANCE_BUDGET_MANAGER", fromRole("FINANCE_BUDGET_MANAGER"));
    expect(userCan(fin, "BUDGETS", "DELETE")).toBe(true); // il a bien le droit module…
    expect(canViewEnvelope(fin, empty)).toBe(false); // …mais ne voit pas une enveloppe non partagée
    expect(canManageEnvelope(fin, empty)).toBe(false);
    expect(canViewEnvelope(fin, { ...empty, accessRoles: ["FINANCE_BUDGET_MANAGER"] })).toBe(true);
  });

  it("the global manager (Super Admin) always sees and manages", () => {
    expect(canViewEnvelope(admin, empty)).toBe(true);
    expect(canManageEnvelope(admin, empty)).toBe(true);
  });

  it("opening visualisation (role/person) grants VIEW but not MANAGE", () => {
    expect(canViewEnvelope(del, { ...empty, accessRoles: ["MEDICAL_DELEGATE"] })).toBe(true);
    expect(canManageEnvelope(del, { ...empty, accessRoles: ["MEDICAL_DELEGATE"] })).toBe(false);
    expect(canViewEnvelope(del, { ...empty, accessUserIds: ["d1"] })).toBe(true);
    expect(canManageEnvelope(del, { ...empty, accessUserIds: ["d1"] })).toBe(false);
  });

  it("delegating gestion (role/person) grants MANAGE and therefore VIEW", () => {
    expect(canManageEnvelope(del, { ...empty, managerUserIds: ["d1"] })).toBe(true);
    expect(canViewEnvelope(del, { ...empty, managerUserIds: ["d1"] })).toBe(true);
    expect(canManageEnvelope(del, { ...empty, managerRoles: ["MEDICAL_DELEGATE"] })).toBe(true);
  });

  it("another person's grant does not leak", () => {
    expect(canViewEnvelope(del, { ...empty, accessUserIds: ["someone-else"], managerUserIds: ["x"] })).toBe(false);
  });
});

describe("regulatory requests access (PRIM → Regulatory)", () => {
  const prim = mkUser("p1", "MEDICAL_INFO_PHARMACIST", fromRole("MEDICAL_INFO_PHARMACIST"));
  const head = mkUser("h1", "HEAD_OF_REGULATORY", fromRole("HEAD_OF_REGULATORY"));
  const sales = mkUser("s1", "SALES_USER", fromRole("SALES_USER"));

  it("le PRIM peut créer une demande mais ne répond pas", () => {
    expect(canCreateRegRequest(prim)).toBe(true);
    expect(canAnswerRegRequests(prim)).toBe(false);
    expect(canSeeRegRequests(prim)).toBe(true);
  });

  it("l'équipe Regulatory répond et voit tout", () => {
    expect(canAnswerRegRequests(head)).toBe(true);
    expect(canSeeRegRequests(head)).toBe(true);
  });

  it("un rôle sans lien ne voit rien", () => {
    expect(canCreateRegRequest(sales)).toBe(false);
    expect(canAnswerRegRequests(sales)).toBe(false);
    expect(canSeeRegRequests(sales)).toBe(false);
  });
});
