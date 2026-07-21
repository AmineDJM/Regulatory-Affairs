import { cache } from "react";
import type { AccessScope, EntityType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { NAVIGATION } from "./labels"; // labels n'importe de rbac QUE le type `Module` → aucun cycle runtime

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
  "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENTS", "SALES", "LOGISTICS", "MEDICAL", "FIELD_REPORTS", "SALES_PLANNING",
  "BUSINESS_DEVELOPMENT", "PCH", "STOCKS", "MEDICAL_INFO", "PROMO_MATERIAL", "VALIDATIONS", "DIRECTIVES", "SUPPORT", "DOSSIERS", "DOCUMENTS", "DRIVE", "ADMIN_REQUESTS", "NOTIFICATIONS",
  "PROCESS_INTELLIGENCE", "ADVENTUM_BRAIN", "ADMIN",
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
// Directives : tout employé voit celles qui le concernent et peut accuser réception,
// faire évoluer le statut et répondre dans le fil (UPDATE). Seule la Direction en crée.
const DIRECTIVES_USER: Action[] = ["VIEW", "UPDATE"];
// Demandes de support : tout employé peut en soumettre, suivre les siennes et répondre/
// joindre des pièces (directeur médical / chef de produit pour ce qui les vise). Le scope
// restreint la visibilité aux demandes émises / reçues / prises en charge.
const SUPPORT_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "UPLOAD"];
// Dossiers de suivi : tout employé peut créer un dossier (déléguer/suivre un sujet),
// le mettre à jour, échanger dans le fil et y joindre des pièces. Le scope limite la
// visibilité aux dossiers créés / dont on est responsable / où l'on participe.
const DOSSIERS_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "UPLOAD"];

type RoleMatrix = Partial<Record<Module, Action[]>>;

/** Role defaults. A missing module entry means no baseline access. */
export const PERMISSIONS: Record<UserRole, RoleMatrix> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL])) as RoleMatrix,
  // La Direction est un **pair quasi-administrateur** : accès complet (gérer + valider)
  // à TOUS les pôles opérationnels + la vue d'ensemble (hasGlobalView, scope ALL).
  // Le **Super Admin reste souverain et SEUL** sur Administration et Adventum Brain
  // (+ Process Intelligence) : gestion des comptes/permissions, impersonation, IA,
  // Knowledge Graph et réglages d'adoption lui sont exclusivement réservés.
  DIRECTION: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, DRIVE: DRIVE_USER,
    REGULATORY: MANAGE, SPONSORING: MANAGE, BUDGETS: READ, FINANCES: MANAGE, RH: MANAGE,
    CONGRESS_INTERNATIONAL: MANAGE, CONGRESS_NATIONAL: MANAGE, EVENTS: MANAGE, SALES: MANAGE,
    LOGISTICS: MANAGE, PCH: MANAGE, STOCKS: MANAGE, MEDICAL: MANAGE, FIELD_REPORTS: MANAGE, SALES_PLANNING: MANAGE, BUSINESS_DEVELOPMENT: MANAGE,
    MEDICAL_INFO: MANAGE, PROMO_MATERIAL: MANAGE, DOCUMENTS: MANAGE, ADMIN_REQUESTS: MANAGE,
    VALIDATIONS: [...VALIDATION_USER, "VALIDATE"], DIRECTIVES: MANAGE, SUPPORT: MANAGE, DOSSIERS: MANAGE,
    NOTIFICATIONS: ["VIEW"],
    // NB : Administration et Adventum Brain (+ Process Intelligence) sont réservés au
    // Super Admin. La Direction n'y a plus accès.
  },
  HEAD_OF_REGULATORY: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, REGULATORY: MANAGE, DOCUMENTS: CONTRIBUTE, BUDGETS: READ, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  REGULATORY_ASSISTANT: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, REGULATORY: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  HEAD_OF_SALES: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, SALES: MANAGE, LOGISTICS: READ, PCH: MANAGE, STOCKS: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  SALES_USER: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, SALES: CONTRIBUTE, PCH: CONTRIBUTE, STOCKS: READ, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"] },
  LOGISTICS_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, LOGISTICS: MANAGE, PCH: MANAGE, STOCKS: MANAGE, DOCUMENTS: CONTRIBUTE, SALES: READ, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  MEDICAL_PROMOTION_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: MANAGE, FIELD_REPORTS: MANAGE, SALES_PLANNING: MANAGE, EVENTS: MANAGE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, PROMO_MATERIAL: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  // KAM / délégué médical : accède à SON tableau de bord de force de vente (Pilotage — lecture,
  // portée limitée à lui-même par la couche métier ; il édite ses propres affectations via `canEditRep`).
  MEDICAL_DELEGATE: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: CONTRIBUTE, FIELD_REPORTS: CONTRIBUTE, SALES_PLANNING: READ, EVENTS: CONTRIBUTE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"] },
  // National Sales : **toutes les capacités du délégué médical** (créer des demandes
  // de sponsoring / congrès / événements, terrain, annuaire) PLUS l'**approbation
  // préliminaire** de ces demandes avec choix du chef de produit. Volontairement
  // ABSENT de la carte `assigned` (cf. defaultScope) → portée ALL : il voit TOUTES
  // les demandes à instruire. CONTRIBUTE (sans VALIDATE) : la décision définitive
  // reste à la Direction ; l'étape préliminaire est ouverte par contrôle de rôle.
  // National Sales = superviseur national : voit TOUS les rapports terrain des délégués
  // (FIELD_REPORTS en portée ALL — absent de la carte `assigned` de defaultScope).
  // National Sales = **superviseur national** : pilote la force de vente de ses équipes
  // (Pilotage + affectations de SES KAM via `canEditRep`). SALES_PLANNING en lecture ;
  // l'édition des affectations de son équipe est autorisée par la couche métier.
  NATIONAL_SALES: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: CONTRIBUTE, FIELD_REPORTS: CONTRIBUTE, SALES_PLANNING: READ, EVENTS: CONTRIBUTE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, SPONSORING: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"] },
  PRODUCT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, CONGRESS_INTERNATIONAL: MANAGE, CONGRESS_NATIONAL: MANAGE, EVENTS: MANAGE, MEDICAL: READ, FIELD_REPORTS: READ, BUDGETS: READ, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  BUSINESS_DEVELOPMENT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUSINESS_DEVELOPMENT: MANAGE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  FINANCE_BUDGET_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUDGETS: MANAGE, FINANCES: MANAGE, RH: READ, SPONSORING: READ, SALES: READ, LOGISTICS: READ, PCH: READ, STOCKS: READ,
    DOCUMENTS: READ, MEDICAL_INFO: ["VIEW", "UPLOAD"], PROMO_MATERIAL: ["VIEW", "UPLOAD", "EXPORT"], DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  // Pharmacien responsable de l'information médicale : déclare aux autorités les
  // événements validés définitivement, exige des pièces, puis valide (→ ordre de
  // dépense). Lecture des pôles événementiels pour instruire ses déclarations.
  MEDICAL_INFO_PHARMACIST: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER,
    MEDICAL_INFO: MANAGE, SPONSORING: READ, CONGRESS_INTERNATIONAL: READ, CONGRESS_NATIONAL: READ, EVENTS: READ, MEDICAL: READ, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  // Assistante de Direction : **tout passe par les Demandes administratives**
  // (gestion complète, portée ALL). Elle pilote AUSSI le circuit Matériel
  // promotionnel mais SANS accès au module dédié : ses étapes (devis, bon de
  // commande, transmission à l'agence, facture) sont surfacées directement dans
  // la demande administrative liée (cf. entity-access : accès aux pièces du
  // dossier promo lié). Pas d'accès à Administration ni à Adventum Brain.
  DIRECTION_ASSISTANT: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER,
    ADMIN_REQUESTS: MANAGE,
    DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  // Coordination / coursier-acheteur : **espace restreint** — pas de congrès,
  // événements, sponsoring, regulatory, finances, etc. Accès à son espace perso
  // (tâches/courses + dossier RH), à la messagerie, au Drive, à ses demandes et
  // validations, aux directives reçues et aux dossiers où il participe.
  COORDINATOR: {
    WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER,
    VALIDATIONS: VALIDATION_USER, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  VIEWER: { DASHBOARD: ["VIEW"], WORKSPACE: ["VIEW", "CREATE", "UPDATE"], MESSAGING: MESSAGING_USER, DRIVE: ["VIEW", "EXPORT"], ADMIN_REQUESTS: ["VIEW", "CREATE", "UPLOAD"], DOCUMENTS: ["VIEW"], DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"] },
};

const GLOBAL_VIEW_ROLES: UserRole[] = ["SUPER_ADMIN", "DIRECTION"];

/** Type minimal « porteur de rôles » : rôle principal + éventuel rôle secondaire. */
type RoleBearer = { role: UserRole; secondaryRole?: UserRole | null };

/**
 * Vue globale (voit tout / valide comme la Direction). Accepte un **rôle brut**
 * (rétrocompatible) OU un **utilisateur** — auquel cas le **rôle secondaire** est
 * aussi pris en compte (ex. un compte dont l'« autre rôle » est Direction).
 */
export function hasGlobalView(u: UserRole | RoleBearer): boolean {
  if (typeof u === "string") return GLOBAL_VIEW_ROLES.includes(u);
  return GLOBAL_VIEW_ROLES.includes(u.role) || (u.secondaryRole != null && GLOBAL_VIEW_ROLES.includes(u.secondaryRole));
}

/** L'utilisateur porte-t-il ce rôle, en **principal OU en secondaire** ? */
export function hasRole(u: RoleBearer, role: UserRole): boolean {
  return u.role === role || u.secondaryRole === role;
}

/**
 * Superviseur Regulatory : le **Super Admin** (toujours) OU un rôle **configuré en
 * Administration** (`AppSetting.regulatorySupervisorRoles`), porté en principal OU
 * secondaire. Il fixe la **priorité** et les **dates cibles** des dossiers, reçoit les
 * notifications (nouveau dossier à prioriser / dossier déposé) et peut **demander des
 * mises à jour de statut**. Les rôles sont passés depuis les réglages (pas en dur).
 */
export function isRegulatorySupervisor(u: RoleBearer, supervisorRoles: string[]): boolean {
  if (u.role === "SUPER_ADMIN") return true;
  return supervisorRoles.includes(u.role) || (u.secondaryRole != null && supervisorRoles.includes(u.secondaryRole));
}

/** Filtre Prisma « porte l'un de ces rôles » — principal **OU secondaire**. À utiliser
 *  pour TOUTE sélection d'utilisateurs par rôle (notifications, candidats désignables,
 *  pharmacien PRIM, annuaires…), sinon un rôle attribué en secondaire est ignoré. */
export function anyRoleFilter(roles: UserRole[]): Prisma.UserWhereInput {
  return { OR: [{ role: { in: roles } }, { secondaryRole: { in: roles } }] };
}

/**
 * GOUVERNANCE GLOBALE des **enveloppes budgétaires** (créer / supprimer une enveloppe,
 * régler le budget total et surtout DÉCIDER QUI voit ou gère chaque enveloppe) :
 * **strictement le Super Admin**.
 *
 * On NE dérive PLUS ce pouvoir d'un droit de module. Auparavant `BUDGETS:DELETE`
 * suffisait — or `DELETE` fait partie du bundle `MANAGE` (porté par le rôle
 * Finance/Budget, et cochable dans la matrice d'accès quand l'admin ouvre le module) :
 * quiconque « gérait » le module devenait de facto gouverneur et voyait / gérait
 * TOUTES les enveloppes, court-circuitant les listes d'accès par enveloppe (fuite).
 *
 * La délégation se fait désormais **par enveloppe**, granulaire et stricte, via ses
 * listes `managerRoles`/`managerUserIds` (gestion du contenu) et
 * `accessRoles`/`accessUserIds` (consultation). Une personne non listée sur une
 * enveloppe — quel que soit son droit sur le module Budget — ne la voit pas.
 */
export function canManageEnvelopes(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN";
}

/** Listes d'accès d'une enveloppe (visualisation + gestion déléguée). Toutes optionnelles. */
export interface EnvelopeAccessBearer {
  accessRoles?: string[];
  accessUserIds?: string[];
  managerRoles?: string[];
  managerUserIds?: string[];
}

/**
 * GESTION du CONTENU d'une enveloppe précise (catégories, allocations, dépenses budgétaires) :
 * un gestionnaire global OU une personne/rôle que l'admin a explicitement désigné(e) sur CETTE
 * enveloppe. Ne confère PAS le droit de modifier l'enveloppe elle-même (montant, période, accès) —
 * cela reste réservé à `canManageEnvelopes`.
 */
export function canManageEnvelope(user: SessionUser, env: EnvelopeAccessBearer): boolean {
  return canManageEnvelopes(user) || (env.managerRoles ?? []).includes(user.role) || (env.managerUserIds ?? []).includes(user.id);
}

/**
 * VISUALISATION d'une enveloppe : quiconque peut la gérer (global ou délégué) OU à qui l'admin
 * a ouvert la consultation (par rôle ou nommément). Défaut = invisible (encadrement strict).
 */
export function canViewEnvelope(user: SessionUser, env: EnvelopeAccessBearer): boolean {
  return canManageEnvelope(user, env) || (env.accessRoles ?? []).includes(user.role) || (env.accessUserIds ?? []).includes(user.id);
}

// ─────────── Catégories (espaces partagés) du Drive ───────────
/**
 * Une « catégorie » de Drive (ex. « Promotion Médicale ») est un espace partagé présenté en
 * onglet à côté de « Drive » et « Documents ». Son accès est encadré EXACTEMENT comme une
 * enveloppe budgétaire : rôles/personnes en CONSULTATION (accès) et rôles/personnes
 * GESTIONNAIRES (déposer, organiser, supprimer, régler les accès).
 */
export interface DriveSpaceAccessBearer {
  accessRoles?: string[];
  accessUserIds?: string[];
  managerRoles?: string[];
  managerUserIds?: string[];
}

/**
 * Peut CRÉER une catégorie de Drive : le Super Admin, ou un rôle que le Super Admin a
 * explicitement autorisé (réglage `driveSpaceCreatorRoles`, configuré en Administration).
 */
export function canCreateDriveSpace(user: SessionUser, creatorRoles: string[]): boolean {
  return user.role === "SUPER_ADMIN" || creatorRoles.includes(user.role);
}

/**
 * GESTION d'une catégorie (déposer/organiser/supprimer des fichiers, régler ses accès,
 * la renommer) : Super Admin, ou un rôle/personne « gestionnaire » désigné sur CETTE
 * catégorie. Le créateur y est ajouté d'office (managerUserIds).
 */
export function canManageDriveSpace(user: SessionUser, space: DriveSpaceAccessBearer): boolean {
  return user.role === "SUPER_ADMIN" || (space.managerRoles ?? []).includes(user.role) || (space.managerUserIds ?? []).includes(user.id);
}

/**
 * VISUALISATION d'une catégorie : quiconque peut la gérer OU à qui la consultation est
 * ouverte (par rôle ou nommément). Défaut = invisible (encadrement strict, comme les enveloppes).
 */
export function canViewDriveSpace(user: SessionUser, space: DriveSpaceAccessBearer): boolean {
  return canManageDriveSpace(user, space) || (space.accessRoles ?? []).includes(user.role) || (space.accessUserIds ?? []).includes(user.id);
}

// ─────────── Demandes à Regulatory (émission → prise en charge) ───────────
/**
 * Peut ÉMETTRE une demande à Regulatory : **strictement** le PRIM (information médicale,
 * toujours autorisé), le **Super Admin**, ou un rôle **configuré en Administration**
 * (`AppSetting.regRequestCreatorRoles`), porté en principal OU secondaire. L'équipe
 * Regulatory **répond** aux demandes mais n'en **crée pas** (sauf si l'admin l'ajoute
 * explicitement à cette liste). Les rôles sont passés depuis les réglages (pas en dur).
 */
export function canCreateRegRequest(user: SessionUser, creatorRoles: string[] = []): boolean {
  if (user.role === "SUPER_ADMIN" || user.role === "MEDICAL_INFO_PHARMACIST") return true;
  return creatorRoles.includes(user.role) || (user.secondaryRole != null && creatorRoles.includes(user.secondaryRole));
}

/** Peut PRENDRE EN CHARGE / RÉPONDRE : l'équipe Regulatory (droit REGULATORY:UPDATE) ou la vue globale. */
export function canAnswerRegRequests(user: SessionUser): boolean {
  return userCan(user, "REGULATORY", "UPDATE") || hasGlobalView(user.role);
}

/** Peut accéder à l'espace des demandes (émetteur autorisé OU répondant Regulatory). */
export function canSeeRegRequests(user: SessionUser, creatorRoles: string[] = []): boolean {
  return canCreateRegRequest(user, creatorRoles) || canAnswerRegRequests(user);
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
  // Admin requests: l'Assistante de Direction pilote toutes les demandes (ALL) ; les
  // autres ne voient que les leurs (l'admin peut élargir via un override).
  if (module === "ADMIN_REQUESTS") return role === "DIRECTION_ASSISTANT" ? "ALL" : "ASSIGNED";
  // Information médicale : le pharmacien responsable voit tout ; les autres (Direction
  // exceptée via hasGlobalView) ne voient que les déclarations où une pièce leur est demandée.
  if (module === "MEDICAL_INFO") return role === "MEDICAL_INFO_PHARMACIST" ? "ALL" : "ASSIGNED";
  // Directives : chacun ne voit que celles qui le concernent (la Direction voit tout via ALL).
  if (module === "DIRECTIVES") return "ASSIGNED";
  // Demandes de support : chacun ne voit que ce qu'il a émis / reçu (rôle visé) / pris en charge.
  if (module === "SUPPORT") return "ASSIGNED";
  // Dossiers de suivi : chacun ne voit que les dossiers créés / dont il est responsable / où il participe.
  if (module === "DOSSIERS") return "ASSIGNED";
  const assigned: Partial<Record<Module, UserRole[]>> = {
    REGULATORY: ["REGULATORY_ASSISTANT"],
    SALES: ["SALES_USER"],
    MEDICAL: ["MEDICAL_DELEGATE"],
    // Rapports terrain : le délégué ne voit QUE les siens ; le National Sales (superviseur
    // national) est volontairement absent → portée ALL, il voit tous les rapports des délégués.
    FIELD_REPORTS: ["MEDICAL_DELEGATE"],
    CONGRESS_INTERNATIONAL: ["MEDICAL_DELEGATE"],
    CONGRESS_NATIONAL: ["MEDICAL_DELEGATE"],
  };
  return assigned[module]?.includes(role) ? "ASSIGNED" : "ALL";
}

/**
 * Résout le MODULE d'une demande de validation — pour l'accès TEMPORAIRE accordé au
 * validateur. D'abord via le libellé stocké (l'option de navigation choisie à la
 * création, ex. « PCH — Marchés »), sinon via l'URL de l'objet lié (préfixe de route
 * le plus spécifique, ex. `/pch/123` → PCH). Renvoie null si rien de fiable.
 */
function moduleFromLink(link: string): Module | null {
  const path = link.split(/[?#]/)[0];
  const byHref = [...NAVIGATION]
    .filter((n) => n.href !== "/")
    .sort((a, b) => b.href.length - a.href.length) // route la plus spécifique d'abord
    .find((n) => path === n.href || path.startsWith(`${n.href}/`));
  return byHref?.module ?? null;
}

function moduleFromValidation(moduleLabel: string | null, link: string | null): Module | null {
  let fromLabel: Module | null = null;
  if (moduleLabel) {
    const byLabel = NAVIGATION.find((n) => n.label === moduleLabel);
    if (byLabel) fromLabel = byLabel.module;
    else {
      const up = moduleLabel.trim().toUpperCase();
      if ((MODULES as readonly string[]).includes(up)) fromLabel = up as Module;
    }
  }
  // Le libellé générique « Demandes de validations » (→ VALIDATIONS) n'est jamais la
  // cible réelle : dans ce cas l'URL de l'objet lié est le signal fiable.
  if (fromLabel && fromLabel !== "VALIDATIONS") return fromLabel;
  return (link ? moduleFromLink(link) : null) ?? fromLabel;
}

// ───────────────────────── Effective (resolved) access ─────────────────────────

export interface EffectiveModuleAccess {
  actions: Set<Action>;
  scope: AccessScope;
}
export interface EffectiveAccess {
  modules: Map<Module, EffectiveModuleAccess>;
  rowGrants: Map<EntityType, Set<string>>;
  /** Rôle secondaire résolu (toujours renseigné par `getAccess` ; optionnel pour les
   *  fabriques de test qui construisent un accès minimal). */
  secondaryRole?: UserRole | null;
  /** Rôle principal résolu EN DIRECT depuis la base (le JWT fige le rôle au login →
   *  il peut être périmé après un changement de rôle). Utilisé par la session comme
   *  rôle faisant autorité. Optionnel : les fabriques de test peuvent l'omettre. */
  role?: UserRole;
}
export interface SessionUser {
  id: string;
  role: UserRole;
  /** « Autre rôle » : fonction secondaire cumulée (réglée par le Super Admin). */
  secondaryRole?: UserRole | null;
  access: EffectiveAccess;
}

/**
 * Resolve a user's effective access: per-user UserAccess overrides win over the
 * role default for a module; row grants are loaded for assigned-scope checks.
 * Cached per request so repeated `scope*`/`userCan` calls hit the DB once.
 */
export const getAccess = perRequest(
  async (userId: string, roleHint: UserRole): Promise<EffectiveAccess> => {
    const [overrides, grants, userRow, pendingValidations] = await Promise.all([
      prisma.userAccess.findMany({ where: { userId } }),
      prisma.rowGrant.findMany({ where: { userId }, select: { entityType: true, entityId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, secondaryRole: true } }),
      // Accès TEMPORAIRE de validation : étapes EN ATTENTE dont je suis le validateur.
      prisma.validationStep.findMany({
        where: { validatorId: userId, status: "PENDING", request: { status: "PENDING" } },
        select: { request: { select: { module: true, link: true, entityType: true, entityId: true } } },
      }),
    ]);

    // Rôle principal résolu EN DIRECT depuis la base : le JWT fige le rôle au login, donc
    // un compte promu (ex. Délégué Médical → National Sales) garderait un accès et un
    // libellé périmés jusqu'à sa reconnexion. On prend le rôle réel de la base (repli sur
    // l'indice du JWT si l'utilisateur est introuvable — cas des fabriques de test).
    const role = (userRow?.role ?? roleHint) as UserRole;
    // « Autre rôle » : l'utilisateur CUMULE son rôle principal ET son rôle secondaire.
    const secondaryRole = userRow?.secondaryRole ?? null;

    const overrideMap = new Map(overrides.map((o) => [o.module as Module, o]));
    const modules = new Map<Module, EffectiveModuleAccess>();

    for (const module of MODULES) {
      const ov = overrideMap.get(module);
      // Override « BLOQUÉ » (ligne présente, canView=false) : **absolu**. Il retire le
      // module quoi qu'il arrive — y compris par-dessus un défaut de rôle PRINCIPAL **ou
      // SECONDAIRE**. C'est ce qui rend l'action de l'admin (« bloquer X à Untel »)
      // réellement effective en temps réel, même si son « autre rôle » l'accorde.
      const blocked = !!ov && !ov.canView;
      const actions = new Set<Action>();
      let scope: AccessScope = "ASSIGNED";
      let hasView = false;

      const addRoleDefaults = (r: UserRole) => {
        const def = PERMISSIONS[r]?.[module];
        if (def?.includes("VIEW")) {
          hasView = true;
          for (const a of def) actions.add(a);
          if (defaultScope(r, module) === "ALL") scope = "ALL";
        }
      };

      // Rôle principal : l'override par utilisateur (s'il existe) REMPLACE ses défauts.
      if (ov) {
        if (ov.canView) {
          hasView = true;
          actions.add("VIEW");
          if (ov.canCreate) actions.add("CREATE");
          if (ov.canUpdate) actions.add("UPDATE");
          if (ov.canDelete) actions.add("DELETE");
          if (ov.canValidate) actions.add("VALIDATE");
          if (ov.canExport) actions.add("EXPORT");
          if (ov.canUpload) actions.add("UPLOAD");
          if (ov.scope === "ALL") scope = "ALL";
        }
      } else {
        addRoleDefaults(role);
      }

      // Un « accès personnalisé » (override) ne doit pas RÉTRÉCIR SILENCIEUSEMENT la
      // portée qu'un rôle possède NATIVEMENT : si le rôle voit tout le module par défaut
      // (ex. National Sales voit TOUTES les demandes de congrès à pré-valider), on conserve
      // la portée ALL même quand l'admin a coché « accès personnalisé » sans (re)choisir
      // « tout » dans le sélecteur de portée (qui retombe sinon sur ASSIGNED). Symétrique
      // de la règle du rôle secondaire ci-dessous.
      if (ov?.canView && defaultScope(role, module) === "ALL") scope = "ALL";

      // Rôle SECONDAIRE : ses capacités se cumulent (union des actions, portée la plus
      // large) — SAUF si l'admin a explicitement **BLOQUÉ** ce module pour ce compte :
      // un blocage prime sur l'« autre rôle » (sinon on ne pourrait jamais retirer un
      // module à quelqu'un qui le détient via son rôle secondaire). Hors blocage, un
      // ancien réglage « accès personnalisé » ne doit pas neutraliser silencieusement
      // l'« autre rôle » attribué ensuite (ex. un National Sales en secondaire doit voir
      // TOUTES les demandes de congrès à pré-valider).
      if (!blocked && secondaryRole && secondaryRole !== role) addRoleDefaults(secondaryRole);

      if (hasView && !blocked) modules.set(module, { actions, scope });
    }

    // ── Confidentialité STRICTE du Drive et des Projets (Dossiers) ──────────────
    // Ces deux modules sont « privés par conception » : on ne voit que SES fichiers /
    // SES projets + ceux qu'on nous a explicitement PARTAGÉS ou CONFIÉS (portée
    // ASSIGNED). Seule la **vue globale** (Super Admin / Direction) voit tout. On
    // NEUTRALISE donc toute portée « ALL » pour un rôle ordinaire — qu'elle vienne
    // d'un override de la matrice, d'un réglage hérité ou d'un rôle secondaire — afin
    // qu'un compte comme l'Assistante de Direction n'ait JAMAIS accès à l'ensemble
    // des drives / projets de la société. (La visibilité fine reste assurée par
    // `scopeDossiers` / `getDriveListing` / `resolveDriveAccess`.)
    if (!hasGlobalView({ role, secondaryRole })) {
      for (const mod of ["DRIVE", "DOSSIERS"] as const) {
        const m = modules.get(mod);
        if (m && m.scope === "ALL") m.scope = "ASSIGNED";
      }
    }

    const rowGrants = new Map<EntityType, Set<string>>();
    for (const g of grants) {
      if (!rowGrants.has(g.entityType)) rowGrants.set(g.entityType, new Set());
      rowGrants.get(g.entityType)!.add(g.entityId);
    }

    // ── Accès TEMPORAIRE de validation ──────────────────────────────────────────
    // Un validateur dont une étape est EN ATTENTE obtient, LE TEMPS de décider, une
    // LECTURE (VIEW/EXPORT) du module concerné + l'accès à la LIGNE liée — de sorte
    // qu'il puisse RÉELLEMENT ouvrir le document / la demande d'origine à valider.
    // Dès que l'étape est traitée (approuvée/refusée), elle n'est plus renvoyée par
    // la requête → l'accès disparaît de lui-même. Toujours en LECTURE SEULE.
    for (const s of pendingValidations) {
      const mod = moduleFromValidation(s.request.module, s.request.link);
      if (mod) {
        const cur = modules.get(mod);
        if (cur) { cur.actions.add("VIEW"); cur.actions.add("EXPORT"); }
        else modules.set(mod, { actions: new Set<Action>(["VIEW", "EXPORT"]), scope: "ASSIGNED" });
      }
      if (s.request.entityType && s.request.entityId) {
        if (!rowGrants.has(s.request.entityType)) rowGrants.set(s.request.entityType, new Set());
        rowGrants.get(s.request.entityType)!.add(s.request.entityId);
      }
    }
    // Un validateur qui a une étape EN ATTENTE doit TOUJOURS pouvoir ouvrir la page
    // « Demandes de validations » pour décider — même si son rôle n'accorde pas ce
    // module par défaut (ex. un VIEWER, ou un compte dont l'accès a été personnalisé
    // sans VALIDATIONS). Sinon `requireModule("VALIDATIONS")` le redirige et la demande
    // qui l'attend reste invisible. On garantit donc au moins la LECTURE de la page.
    if (pendingValidations.length > 0) {
      const cur = modules.get("VALIDATIONS");
      if (cur) cur.actions.add("VIEW");
      else modules.set("VALIDATIONS", { actions: new Set<Action>(["VIEW"]), scope: "ASSIGNED" });
    }

    // ── Accès IMPLICITE au module Budget quand une enveloppe est PARTAGÉE avec ce compte ──
    // Partager une enveloppe (par personne OU par rôle, en visualisation ou en gestion) doit
    // suffire à ce que le destinataire puisse OUVRIR le module Budget et l'y voir — même si son
    // rôle n'a AUCUN accès Budget par défaut (sinon la porte `requireModule("BUDGETS")` le
    // redirige et l'enveloppe partagée reste invisible). On n'accorde qu'une LECTURE ; le
    // filtrage fin (quelles enveloppes) reste assuré par `canViewEnvelope` dans les requêtes.
    if (!modules.has("BUDGETS")) {
      const roles = [role, secondaryRole].filter(Boolean) as string[];
      const shared = await prisma.budgetEnvelope
        .findFirst({
          where: {
            OR: [
              { accessUserIds: { has: userId } },
              { managerUserIds: { has: userId } },
              ...(roles.length ? [{ accessRoles: { hasSome: roles } }, { managerRoles: { hasSome: roles } }] : []),
            ],
          },
          select: { id: true },
        })
        .catch(() => null);
      if (shared) modules.set("BUDGETS", { actions: new Set<Action>(["VIEW", "EXPORT"]), scope: "ASSIGNED" });
    }

    // ── Accès IMPLICITE au module Drive quand une CATÉGORIE est PARTAGÉE avec ce compte ──
    // Être membre d'une catégorie (par personne OU par rôle, consultation ou gestion) doit
    // suffire à OUVRIR le module Drive et à y voir l'onglet de la catégorie — même si le rôle
    // n'accorde aucun accès Drive par défaut. On n'accorde qu'une LECTURE du module ; le
    // filtrage fin (quelles catégories, quels droits) reste assuré par canViewDriveSpace /
    // canManageDriveSpace dans les requêtes.
    if (!modules.has("DRIVE")) {
      const roles = [role, secondaryRole].filter(Boolean) as string[];
      const shared = await prisma.driveSpace
        .findFirst({
          where: {
            isArchived: false,
            OR: [
              { accessUserIds: { has: userId } },
              { managerUserIds: { has: userId } },
              ...(roles.length ? [{ accessRoles: { hasSome: roles } }, { managerRoles: { hasSome: roles } }] : []),
            ],
          },
          select: { id: true },
        })
        .catch(() => null);
      if (shared) modules.set("DRIVE", { actions: new Set<Action>(["VIEW"]), scope: "ASSIGNED" });
    }

    return { modules, rowGrants, secondaryRole, role };
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
    { createdById: user.id }, // le créateur voit toujours son propre dossier (sinon 404 après création)
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

/** Demandes de support : ALL voit tout ; sinon le demandeur, le destinataire (nommé ou
 *  par rôle visé) et le répondant assigné. */
export function scopeSupport(user: SessionUser): Prisma.SupportRequestWhereInput {
  const m = user.access.modules.get("SUPPORT");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ requesterId: user.id }, { targetUserId: user.id }, { targetRole: user.role }, { assignedToId: user.id }] };
}

/** Dossiers de suivi : la Direction (scope ALL) voit tout ; sinon on ne voit que
 *  les dossiers créés, dont on est responsable, ou où l'on participe. */
export function scopeDossiers(user: SessionUser): Prisma.DossierWhereInput {
  const m = user.access.modules.get("DOSSIERS");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ createdById: user.id }, { assignedToId: user.id }, { participantIds: { has: user.id } }] };
}

/** Directives : la Direction (scope ALL) voit tout ; un employé ne voit que les
 *  directives qui le ciblent nommément ou qui visent son rôle. */
export function scopeDirectives(user: SessionUser): Prisma.DirectiveWhereInput {
  const m = user.access.modules.get("DIRECTIVES");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ targetUserId: user.id }, { targetRole: user.role }] };
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
  // Les demandes supprimées (soft delete traçable) sont masquées des vues normales.
  if (m.scope === "ALL") return { deletedAt: null };
  return { deletedAt: null, OR: [{ requesterId: user.id }, { concernedUserId: user.id }, { assignedToId: user.id }, { validatorId: user.id }] };
}

/** Matériel promotionnel : scope ALL voit tout ; sinon l'initiateur Marketing et
 *  l'assistante de direction en charge. */
export function scopePromoMaterial(user: SessionUser): Prisma.PromoMaterialWhereInput {
  const m = user.access.modules.get("PROMO_MATERIAL");
  if (!m) return { id: "__none__" };
  if (m.scope === "ALL") return {};
  return { OR: [{ requesterId: user.id }, { assistantId: user.id }] };
}
