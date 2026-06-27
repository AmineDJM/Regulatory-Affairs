import { cache } from "react";
import type { AccessScope, EntityType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "./prisma";

// `cache` is a React Server Components API; fall back to identity outside an
// RSC render (e.g. unit tests) so the module loads everywhere.
const perRequest: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof cache === "function" ? (cache as never) : (fn) => fn;

/**
 * Access control for AMD Internal OS — two layers, both enforced server-side:
 *
 *  1. Role defaults (PERMISSIONS) provide a baseline.
 *  2. Per-user overrides (UserAccess) + per-row grants (RowGrant), fully managed
 *     by an admin, take precedence. `getAccess` resolves the *effective* access
 *     for a user (cached per request); `userCan` and the `scope*` helpers read
 *     that resolved access so the UI and the database queries always reflect
 *     exactly what the admin granted.
 */

export const MODULES = [
  "DASHBOARD", "WORKSPACE", "MESSAGING", "REGULATORY", "SPONSORING", "BUDGETS", "FINANCES", "RH",
  "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENTS", "SALES", "LOGISTICS", "MEDICAL",
  "BUSINESS_DEVELOPMENT", "PCH", "STOCKS", "MEDICAL_INFO", "VALIDATIONS", "DOCUMENTS", "DRIVE", "ADMIN_REQUESTS", "NOTIFICATIONS",
  "PROCESS_INTELLIGENCE", "ADMIN",
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = [
  "VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD",
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL: Action[] = [...ACTIONS];
const READ: Action[] = ["VIEW", "EXPORT"];
const READ_VALIDATE: Action[] = ["VIEW", "EXPORT", "VALIDATE"];
const CONTRIBUTE: Action[] = ["VIEW", "CREATE", "UPDATE", "UPLOAD", "EXPORT"];
const MANAGE: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"];
// Personal workspace ("Mon espace"): every user manages their own tasks &
// self-service leave requests, so this baseline is granted to all roles.
const WORKSPACE_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "EXPORT"];
// Drive d'entreprise : chacun gère ses fichiers / dossiers (upload, versions, partage).
const DRIVE_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "UPLOAD"];
// Demandes administratives : chacun peut soumettre une demande et y joindre des pièces.
const REQUEST_USER: Action[] = ["VIEW", "CREATE", "UPLOAD", "EXPORT"];
// Validations transversales : chacun voit « Mes validations » et peut demander une validation.
const VALIDATION_USER: Action[] = ["VIEW", "CREATE"];
// Messagerie interne : socle de communication de tout employé (écrire, modifier/supprimer
// ses propres messages, joindre des fichiers). L'accès à une conversation reste gouverné
// par l'appartenance ; un admin peut retirer la messagerie à un compte via un override.
const MESSAGING_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "UPLOAD"];

type RoleMatrix = Partial<Record<Module, Action[]>>;

/** Role defaults. A missing module entry means no baseline access. */
export const PERMISSIONS: Record<UserRole, RoleMatrix> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL])) as RoleMatrix,
  // La Direction peut TOUT valider : l'action VALIDATE est portée par chaque pôle
  // (et par le Validation Center), en plus de la vue d'ensemble (hasGlobalView).
  DIRECTION: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER,
    VALIDATIONS: [...VALIDATION_USER, "VALIDATE"], REGULATORY: READ_VALIDATE, SPONSORING: READ_VALIDATE,
    BUDGETS: MANAGE, FINANCES: READ_VALIDATE, RH: MANAGE, CONGRESS_INTERNATIONAL: READ_VALIDATE,
    CONGRESS_NATIONAL: READ_VALIDATE, EVENTS: READ_VALIDATE, SALES: READ_VALIDATE, LOGISTICS: READ_VALIDATE, PCH: READ_VALIDATE,
    STOCKS: READ_VALIDATE, MEDICAL: READ_VALIDATE, BUSINESS_DEVELOPMENT: READ_VALIDATE, DOCUMENTS: READ,
    MEDICAL_INFO: READ_VALIDATE, NOTIFICATIONS: ["VIEW"], ADMIN: ["VIEW", "EXPORT"],
  },
  HEAD_OF_REGULATORY: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, REGULATORY: MANAGE, DOCUMENTS: CONTRIBUTE, BUDGETS: READ, NOTIFICATIONS: ["VIEW"],
  },
  REGULATORY_ASSISTANT: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, REGULATORY: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  HEAD_OF_SALES: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, SALES: MANAGE, LOGISTICS: READ, PCH: MANAGE, STOCKS: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  SALES_USER: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, SALES: CONTRIBUTE, PCH: CONTRIBUTE, STOCKS: READ, NOTIFICATIONS: ["VIEW"] },
  LOGISTICS_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, LOGISTICS: MANAGE, PCH: MANAGE, STOCKS: MANAGE, DOCUMENTS: CONTRIBUTE, SALES: READ, NOTIFICATIONS: ["VIEW"],
  },
  MEDICAL_PROMOTION_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: MANAGE, EVENTS: MANAGE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  MEDICAL_DELEGATE: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: CONTRIBUTE, EVENTS: CONTRIBUTE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, NOTIFICATIONS: ["VIEW"] },
  PRODUCT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, CONGRESS_INTERNATIONAL: MANAGE, CONGRESS_NATIONAL: MANAGE, EVENTS: MANAGE, MEDICAL: READ, BUDGETS: READ, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  BUSINESS_DEVELOPMENT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUSINESS_DEVELOPMENT: MANAGE, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  FINANCE_BUDGET_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUDGETS: MANAGE, FINANCES: MANAGE, RH: READ, SPONSORING: READ, SALES: READ, LOGISTICS: READ, PCH: READ, STOCKS: READ,
    DOCUMENTS: READ, MEDICAL_INFO: ["VIEW", "UPLOAD"], NOTIFICATIONS: ["VIEW"],
  },
  // Pharmacien responsable de l'information médicale : déclare aux autorités les
  // événements validés définitivement, exige des pièces, puis valide (→ ordre de
  // dépense). Lecture des pôles événementiels pour instruire ses déclarations.
  MEDICAL_INFO_PHARMACIST: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER,
    MEDICAL_INFO: MANAGE, SPONSORING: READ, CONGRESS_INTERNATIONAL: READ, CONGRESS_NATIONAL: READ, EVENTS: READ, MEDICAL: READ, DOCUMENTS: CONTRIBUTE, NOTIFICATIONS: ["VIEW"],
  },
  VIEWER: { DASHBOARD: ["VIEW"], WORKSPACE: ["VIEW", "CREATE", "UPDATE"], MESSAGING: MESSAGING_USER, DRIVE: ["VIEW", "EXPORT"], ADMIN_REQUESTS: ["VIEW", "CREATE", "UPLOAD"], DOCUMENTS: ["VIEW"], NOTIFICATIONS: ["VIEW"] },
};

const GLOBAL_VIEW_ROLES: UserRole[] = ["SUPER_ADMIN", "DIRECTION"];
export function hasGlobalView(role: UserRole): boolean {
  return GLOBAL_VIEW_ROLES.includes(role);
}

/** Role-default check (baseline, ignores per-user overrides). */
export function can(role: UserRole, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

/** Default row scope for a role on a module (ALL vs only assigned rows). */
export function defaultScope(role: UserRole, module: Module): AccessScope {
  if (hasGlobalView(role)) return "ALL";
  // Drive defaults to per-user scope: one only sees one's own and shared files.
  if (module === "DRIVE") return "ASSIGNED";
  // Admin requests: a requester sees only their own; the assistant gets scope ALL via admin grant.
  if (module === "ADMIN_REQUESTS") return "ASSIGNED";
  // Information médicale : le pharmacien responsable voit tout ; les autres (Direction
  // exceptée via hasGlobalView) ne voient que les déclarations où une pièce leur est demandée.
  if (module === "MEDICAL_INFO") return role === "MEDICAL_INFO_PHARMACIST" ? "ALL" : "ASSIGNED";
  const assigned: Partial<Record<Module, UserRole[]>> = {
    REGULATORY: ["REGULATORY_ASSISTANT"],
    SALES: ["SALES_USER"],
    MEDICAL: ["MEDICAL_DELEGATE"],
    CONGRESS_INTERNATIONAL: ["MEDICAL_DELEGATE"],
    CONGRESS_NATIONAL: ["MEDICAL_DELEGATE"],
  };
  return assigned[module]?.includes(role) ? "ASSIGNED" : "ALL";
}

// ───────────────────────── Effective (resolved) access ─────────────────────────

export interface EffectiveModuleAccess {
  actions: Set<Action>;
  scope: AccessScope;
}
export interface EffectiveAccess {
  modules: Map<Module, EffectiveModuleAccess>;
  rowGrants: Map<EntityType, Set<string>>;
}
export interface SessionUser {
  id: string;
  role: UserRole;
  access: EffectiveAccess;
}

/**
 * Resolve a user's effective access: per-user UserAccess overrides win over the
 * role default for a module; row grants are loaded for assigned-scope checks.
 * Cached per request so repeated `scope*`/`userCan` calls hit the DB once.
 */
export const getAccess = perRequest(
  async (userId: string, role: UserRole): Promise<EffectiveAccess> => {
    const [overrides, grants] = await Promise.all([
      prisma.userAccess.findMany({ where: { userId } }),
      prisma.rowGrant.findMany({ where: { userId }, select: { entityType: true, entityId: true } }),
    ]);

    const overrideMap = new Map(overrides.map((o) => [o.module as Module, o]));
    const modules = new Map<Module, EffectiveModuleAccess>();

    for (const module of MODULES) {
      const ov = overrideMap.get(module);
      if (ov) {
        if (!ov.canView) continue; // explicitly no access to this tab
        const actions = new Set<Action>(["VIEW"]);
        if (ov.canCreate) actions.add("CREATE");
        if (ov.canUpdate) actions.add("UPDATE");
        if (ov.canDelete) actions.add("DELETE");
        if (ov.canValidate) actions.add("VALIDATE");
        if (ov.canExport) actions.add("EXPORT");
        if (ov.canUpload) actions.add("UPLOAD");
        modules.set(module, { actions, scope: ov.scope });
      } else {
        const def = PERMISSIONS[role]?.[module];
        if (def?.includes("VIEW")) {
          modules.set(module, { actions: new Set(def), scope: defaultScope(role, module) });
        }
      }
    }

    const rowGrants = new Map<EntityType, Set<string>>();
    for (const g of grants) {
      if (!rowGrants.has(g.entityType)) rowGrants.set(g.entityType, new Set());
      rowGrants.get(g.entityType)!.add(g.entityId);
    }

    return { modules, rowGrants };
  },
);

/** Does the user's effective access permit this action on this module? */
export function userCan(user: SessionUser, module: Module, action: Action): boolean {
  return user.access.modules.get(module)?.actions.has(action) ?? false;
}

/** Modules the user can at least view — drives the sidebar. */
export function accessibleModules(user: SessionUser): Module[] {
  return MODULES.filter((m) => user.access.modules.has(m));
}

export function moduleScope(user: SessionUser, module: Module): AccessScope | null {
  return user.access.modules.get(module)?.scope ?? null;
}

// ─────────────────────── Row-level scoping (Prisma where) ───────────────────────

function grantsFor(user: SessionUser, entityType: EntityType): string[] {
  return [...(user.access.rowGrants.get(entityType) ?? [])];
}

export function scopeRegulatory(user: SessionUser): Prisma.RegulatoryProductWhereInput {
  const m = user.access.modules.get("REGULATORY");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.RegulatoryProductWhereInput[] = [
    { responsibleId: user.id },
    { assistantId: user.id },
    { assignedUsers: { some: { id: user.id } } },
  ];
  const ids = grantsFor(user, "REGULATORY_PRODUCT");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

export function scopeMedicalDoctors(user: SessionUser): Prisma.MedicalDoctorWhereInput {
  const m = user.access.modules.get("MEDICAL");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.MedicalDoctorWhereInput[] = [{ delegateId: user.id }];
  const ids = grantsFor(user, "DOCTOR");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

export function scopeMedicalVisits(user: SessionUser): Prisma.MedicalVisitWhereInput {
  const m = user.access.modules.get("MEDICAL");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.MedicalVisitWhereInput[] = [{ delegateId: user.id }];
  const ids = grantsFor(user, "VISIT");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

export function scopeSales(user: SessionUser): Prisma.SaleWhereInput {
  const m = user.access.modules.get("SALES");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.SaleWhereInput[] = [{ salesUserId: user.id }];
  const ids = grantsFor(user, "SALE");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

export function scopeBusinessDevelopment(user: SessionUser): Prisma.BusinessDevelopmentOpportunityWhereInput {
  const m = user.access.modules.get("BUSINESS_DEVELOPMENT");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.BusinessDevelopmentOpportunityWhereInput[] = [{ ownerId: user.id }];
  const ids = grantsFor(user, "BD_OPPORTUNITY");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

/** Congrès internationaux : scope ALL voit tout ; sinon le demandeur + le chef
 *  de produit assigné (un délégué ne voit que ses propres demandes). */
export function scopeCongressIntl(user: SessionUser): Prisma.CongressInternationalWhereInput {
  const m = user.access.modules.get("CONGRESS_INTERNATIONAL");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ requesterId: user.id }, { productManagerId: user.id }] };
}

/** Congrès / événements nationaux : même logique. */
export function scopeCongressNational(user: SessionUser): Prisma.CongressNationalWhereInput {
  const m = user.access.modules.get("CONGRESS_NATIONAL");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ requesterId: user.id }, { productManagerId: user.id }] };
}

/** Projets BD (Projet → Gamme → Produit) : scope ALL voit tout ; sinon le
 *  propriétaire du projet + les projets explicitement accordés (RowGrant). */
export function scopeBdProject(user: SessionUser): Prisma.BdProjectWhereInput {
  const m = user.access.modules.get("BUSINESS_DEVELOPMENT");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  const ors: Prisma.BdProjectWhereInput[] = [{ ownerId: user.id }];
  const ids = grantsFor(user, "BD_PROJECT");
  if (ids.length) ors.push({ id: { in: ids } });
  return { OR: ors };
}

/** Information médicale : le pharmacien (scope ALL) voit toutes les déclarations ;
 *  un autre utilisateur ne voit que celles où une pièce lui est demandée. */
export function scopeMedicalInfo(user: SessionUser): Prisma.MedicalInfoDeclarationWhereInput {
  const m = user.access.modules.get("MEDICAL_INFO");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ pharmacistId: user.id }, { requests: { some: { targetUserId: user.id } } }] };
}

/** Admin requests scope: a manager (scope ALL) sees all; others see the ones they
 *  requested, are concerned by, are assigned to, or must validate. */
export function scopeAdminRequests(user: SessionUser): Prisma.AdministrativeRequestWhereInput {
  const m = user.access.modules.get("ADMIN_REQUESTS");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ requesterId: user.id }, { concernedUserId: user.id }, { assignedToId: user.id }, { validatorId: user.id }] };
}
