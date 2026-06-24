import type { UserRole } from "@prisma/client";

/**
 * RBAC for AMD Internal OS.
 *
 * Two layers, both enforced server-side:
 *  1. Module/action permissions — `can(role, module, action)` driven by a
 *     static, type-safe matrix (PERMISSIONS).
 *  2. Row-level scoping — `scope*` helpers return Prisma `where` fragments so a
 *     user only ever receives rows they are allowed to see. Unauthorised rows
 *     are *never sent to the client*, they are filtered in the database query.
 */

export const MODULES = [
  "DASHBOARD",
  "REGULATORY",
  "SPONSORING",
  "BUDGETS",
  "CONGRESS_INTERNATIONAL",
  "CONGRESS_NATIONAL",
  "SALES",
  "LOGISTICS",
  "MEDICAL",
  "BUSINESS_DEVELOPMENT",
  "DOCUMENTS",
  "NOTIFICATIONS",
  "ADMIN",
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "VALIDATE",
  "EXPORT",
  "UPLOAD",
] as const;

export type Action = (typeof ACTIONS)[number];

/** Convenience action bundles. */
const ALL: Action[] = [...ACTIONS];
const READ: Action[] = ["VIEW", "EXPORT"];
const CONTRIBUTE: Action[] = ["VIEW", "CREATE", "UPDATE", "UPLOAD", "EXPORT"];
const MANAGE: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"];

type RoleMatrix = Partial<Record<Module, Action[]>>;

/**
 * The permission matrix. A missing module entry means *no access at all* —
 * the module is hidden from navigation and its data is unreachable.
 */
export const PERMISSIONS: Record<UserRole, RoleMatrix> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL])) as RoleMatrix,

  DIRECTION: {
    DASHBOARD: READ,
    REGULATORY: [...READ, "VALIDATE"],
    SPONSORING: [...READ, "VALIDATE"],
    BUDGETS: [...READ, "VALIDATE"],
    CONGRESS_INTERNATIONAL: [...READ, "VALIDATE"],
    CONGRESS_NATIONAL: [...READ, "VALIDATE"],
    SALES: READ,
    LOGISTICS: READ,
    MEDICAL: READ,
    BUSINESS_DEVELOPMENT: [...READ, "VALIDATE"],
    DOCUMENTS: READ,
    NOTIFICATIONS: ["VIEW"],
    ADMIN: ["VIEW", "EXPORT"], // can audit, cannot edit users
  },

  HEAD_OF_REGULATORY: {
    DASHBOARD: READ,
    REGULATORY: MANAGE,
    DOCUMENTS: CONTRIBUTE,
    BUDGETS: READ,
    NOTIFICATIONS: ["VIEW"],
  },

  REGULATORY_ASSISTANT: {
    DASHBOARD: READ,
    REGULATORY: CONTRIBUTE, // but row-level scoped to assigned DCI
    DOCUMENTS: CONTRIBUTE,
    NOTIFICATIONS: ["VIEW"],
  },

  HEAD_OF_SALES: {
    DASHBOARD: READ,
    SALES: MANAGE,
    LOGISTICS: READ,
    DOCUMENTS: CONTRIBUTE,
    NOTIFICATIONS: ["VIEW"],
  },

  SALES_USER: {
    DASHBOARD: READ,
    SALES: CONTRIBUTE, // row-level scoped to own sales
    NOTIFICATIONS: ["VIEW"],
  },

  LOGISTICS_MANAGER: {
    DASHBOARD: READ,
    LOGISTICS: MANAGE,
    DOCUMENTS: CONTRIBUTE,
    SALES: READ,
    NOTIFICATIONS: ["VIEW"],
  },

  MEDICAL_PROMOTION_MANAGER: {
    DASHBOARD: READ,
    MEDICAL: MANAGE,
    CONGRESS_NATIONAL: CONTRIBUTE,
    DOCUMENTS: CONTRIBUTE,
    NOTIFICATIONS: ["VIEW"],
  },

  MEDICAL_DELEGATE: {
    DASHBOARD: READ,
    MEDICAL: CONTRIBUTE, // row-level scoped to own doctors/visits
    NOTIFICATIONS: ["VIEW"],
  },

  BUSINESS_DEVELOPMENT_MANAGER: {
    DASHBOARD: READ,
    BUSINESS_DEVELOPMENT: MANAGE,
    DOCUMENTS: CONTRIBUTE,
    NOTIFICATIONS: ["VIEW"],
  },

  FINANCE_BUDGET_MANAGER: {
    DASHBOARD: READ,
    BUDGETS: MANAGE,
    SPONSORING: READ,
    SALES: READ,
    LOGISTICS: READ,
    DOCUMENTS: READ,
    NOTIFICATIONS: ["VIEW"],
  },

  VIEWER: {
    DASHBOARD: ["VIEW"],
    DOCUMENTS: ["VIEW"],
    NOTIFICATIONS: ["VIEW"],
  },
};

/** Does this role have the given action on the given module? */
export function can(role: UserRole, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

/** Modules a role can at least view — used to build the sidebar. */
export function accessibleModules(role: UserRole): Module[] {
  return MODULES.filter((m) => can(role, m, "VIEW"));
}

/** Roles that see every row in every module they can access. */
const GLOBAL_VIEW_ROLES: UserRole[] = ["SUPER_ADMIN", "DIRECTION"];

export function hasGlobalView(role: UserRole): boolean {
  return GLOBAL_VIEW_ROLES.includes(role);
}

// ─────────────────────── Row-level scoping (Prisma where) ───────────────────────

export interface SessionUser {
  id: string;
  role: UserRole;
}

/**
 * Regulatory scope.
 *  - Super Admin / Direction / Head of Regulatory → all lines.
 *  - Regulatory Assistant → only lines where they are responsible, assistant,
 *    or explicitly assigned. Everything else is *fully hidden*.
 */
export function scopeRegulatory(user: SessionUser) {
  if (hasGlobalView(user.role) || user.role === "HEAD_OF_REGULATORY") return {};
  if (user.role === "REGULATORY_ASSISTANT") {
    return {
      OR: [
        { responsibleId: user.id },
        { assistantId: user.id },
        { assignedUsers: { some: { id: user.id } } },
      ],
    };
  }
  // No regulatory access → match nothing.
  return { id: "__none__" };
}

/** Medical doctors: delegates only see their own; managers see all. */
export function scopeMedicalDoctors(user: SessionUser) {
  if (hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER") return {};
  if (user.role === "MEDICAL_DELEGATE") return { delegateId: user.id };
  return { id: "__none__" };
}

/** Medical visits: same logic as doctors. */
export function scopeMedicalVisits(user: SessionUser) {
  if (hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER") return {};
  if (user.role === "MEDICAL_DELEGATE") return { delegateId: user.id };
  return { id: "__none__" };
}

/** Sales: a sales user only sees their own sales lines. */
export function scopeSales(user: SessionUser) {
  if (
    hasGlobalView(user.role) ||
    user.role === "HEAD_OF_SALES" ||
    user.role === "LOGISTICS_MANAGER" ||
    user.role === "FINANCE_BUDGET_MANAGER"
  ) {
    return {};
  }
  if (user.role === "SALES_USER") return { salesUserId: user.id };
  return { id: "__none__" };
}

/** Business development: managers + direction see all; otherwise none. */
export function scopeBusinessDevelopment(user: SessionUser) {
  if (hasGlobalView(user.role) || user.role === "BUSINESS_DEVELOPMENT_MANAGER") return {};
  return { id: "__none__" };
}

/** True when a role may validate (approve/refuse) in a module. */
export function canValidate(role: UserRole, module: Module): boolean {
  return can(role, module, "VALIDATE");
}
