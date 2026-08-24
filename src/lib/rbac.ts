import { cache } from "react";
import type { AccessScope, EntityType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { activeStandInsFor } from "./hr/stand-in-resolve";
import { getAppSettings } from "./settings"; // settings n'importe que prisma → aucun cycle
import { pipelineAccessFor } from "./regulatory/pipeline-access";
import { carrierAccess } from "./regulatory/assignment";
import { NAVIGATION, NAV_LEGACY_LABELS } from "./labels"; // labels n'importe de rbac QUE le type `Module` → aucun cycle runtime

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
  "BUSINESS_DEVELOPMENT", "PCH", "STOCKS", "MEDICAL_INFO", "PROMO_MATERIAL", "CONSULTING", "AD_PRO_OTHER", "GENERAL_MEANS", "VALIDATIONS", "DIRECTIVES", "SUPPORT", "DOSSIERS", "DOCUMENTS", "DRIVE", "ADMIN_REQUESTS", "NOTIFICATIONS",
  // LEGAL : les engagements de la société (contrats, bons de commande, assurances).
  // MAIL_REGISTER : le carnet de courriers entrants/sortants de l'assistante de direction —
  // module à part, dont le Super Admin ouvre l'accès à qui il veut.
  // RECRUITMENT : les demandes de recrutement, de la demande d'un directeur à l'intégration.
  // Module À PART de RH, et pas un écran de plus dedans : le DEMANDEUR est un directeur
  // opérationnel qui n'a rien à faire dans la paie ni dans les dossiers du personnel.
  "LEGAL", "MAIL_REGISTER", "RECRUITMENT",
  // PAYMENT_CENTRE : le centre d'autorisation des paiements — un module À PART, hors Finances.
  // Il n'appartient qu'au PDG et au Super Admin : celui qui autorise l'argent ne doit pas être
  // dans le même écran que celui qui le décaisse, sinon la séparation des rôles n'est qu'un onglet.
  "PAYMENT_CENTRE",
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
// Moyens généraux : celui qui ACHÈTE au quotidien saisit ses dépenses et leurs pièces, tient
// sa caisse d'avance et consulte son budget — il ne l'ALLOUE pas (c'est `BUDGETS`, ailleurs).
const GENERAL_MEANS_USER: Action[] = ["VIEW", "CREATE", "UPDATE", "UPLOAD", "EXPORT"];

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
    MEDICAL_INFO: MANAGE, PROMO_MATERIAL: MANAGE, CONSULTING: MANAGE, AD_PRO_OTHER: MANAGE, DOCUMENTS: MANAGE, ADMIN_REQUESTS: MANAGE,
    GENERAL_MEANS: MANAGE, LEGAL: MANAGE, MAIL_REGISTER: MANAGE, RECRUITMENT: MANAGE,
    // Le CENTRE DE PAIEMENT : le PDG y siège avec le Super Admin — et personne d'autre,
    // pas même le Directeur Général (règle sitsOnPaymentCentre, lib/payments/authorization.ts).
    PAYMENT_CENTRE: MANAGE,
    VALIDATIONS: [...VALIDATION_USER, "VALIDATE"], DIRECTIVES: MANAGE, SUPPORT: MANAGE, DOSSIERS: MANAGE,
    NOTIFICATIONS: ["VIEW"],
    // NB : Administration et Adventum Brain (+ Process Intelligence) sont réservés au
    // Super Admin. La Direction n'y a plus accès.
  },
  // DIRECTEUR GÉNÉRAL — tous les pouvoirs MÉTIER, sans la souveraineté du Super Admin.
  //
  // Il gère et décide sur tous les pôles (y compris les circuits Ad & Pro, dont il est le
  // signataire), mais il est délibérément ABSENT de `GLOBAL_VIEW_ROLES`. Deux conséquences
  // voulues, et c'est toute la différence avec la Direction :
  //  - il ne SUPERVISE PAS les demandes de validation de tout le monde (le tableau de
  //    supervision est réservé à la vue globale) : il voit et tranche ce qu'on lui adresse ;
  //  - les modules PERSONNELS (Drive, directives, dossiers, support) restent cloisonnés —
  //    un directeur général n'a pas à lire le Drive privé de chacun.
  // Administration, Adventum Brain et Process Intelligence restent au seul Super Admin.
  GENERAL_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, DRIVE: DRIVE_USER,
    REGULATORY: MANAGE, SPONSORING: MANAGE, BUDGETS: READ, FINANCES: MANAGE, RH: MANAGE,
    CONGRESS_INTERNATIONAL: MANAGE, CONGRESS_NATIONAL: MANAGE, EVENTS: MANAGE, SALES: MANAGE,
    LOGISTICS: MANAGE, PCH: MANAGE, STOCKS: MANAGE, MEDICAL: MANAGE, FIELD_REPORTS: MANAGE,
    SALES_PLANNING: MANAGE, BUSINESS_DEVELOPMENT: MANAGE, MEDICAL_INFO: MANAGE,
    PROMO_MATERIAL: MANAGE, CONSULTING: MANAGE, AD_PRO_OTHER: MANAGE, DOCUMENTS: MANAGE,
    ADMIN_REQUESTS: MANAGE, GENERAL_MEANS: MANAGE, LEGAL: MANAGE, MAIL_REGISTER: MANAGE,
    // Le DG est le SOMMET de la chaîne de validation d'un recrutement, et celui qui tranche
    // entre les candidats : le module lui est acquis, quelle que soit sa place dans l'organigramme.
    RECRUITMENT: MANAGE,
    // Pas de VALIDATE global : il valide ce dont il est nommément validateur, comme tout le monde.
    VALIDATIONS: VALIDATION_USER, DIRECTIVES: MANAGE, SUPPORT: MANAGE, DOSSIERS: MANAGE,
    NOTIFICATIONS: ["VIEW"],
  },
  // DIRECTEUR DES OPÉRATIONS — rôle À PART, pas une Direction au rabais.
  //
  // Son métier, c'est ce qui FAIT TOURNER la maison : la chaîne d'approvisionnement
  // (logistique, marchés PCH, stocks), les ventes, les moyens généraux et le secrétariat.
  // Il LIT ce dont il dépend sans le piloter — le réglementaire qui conditionne ce qu'on peut
  // vendre, les budgets et les finances qui bornent ses achats — parce qu'un directeur des
  // opérations qui ne voit pas la date d'une décision d'enregistrement planifie à l'aveugle.
  OPERATIONS_DIRECTOR: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, DRIVE: DRIVE_USER,
    VALIDATIONS: VALIDATION_USER,
    LOGISTICS: MANAGE, PCH: MANAGE, STOCKS: MANAGE, SALES: MANAGE,
    GENERAL_MEANS: MANAGE, ADMIN_REQUESTS: MANAGE, LEGAL: CONTRIBUTE, MAIL_REGISTER: READ,
    REGULATORY: READ, BUDGETS: READ, FINANCES: READ, RH: READ, MEDICAL: READ, FIELD_REPORTS: READ,
    SALES_PLANNING: READ, DOCUMENTS: CONTRIBUTE,
    DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
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
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: MANAGE, FIELD_REPORTS: MANAGE, SALES_PLANNING: MANAGE, EVENTS: MANAGE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, PROMO_MATERIAL: CONTRIBUTE, CONSULTING: CONTRIBUTE, AD_PRO_OTHER: CONTRIBUTE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
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
  NATIONAL_SALES: { DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, MEDICAL: CONTRIBUTE, FIELD_REPORTS: CONTRIBUTE, SALES_PLANNING: READ, EVENTS: CONTRIBUTE, CONGRESS_NATIONAL: CONTRIBUTE, CONGRESS_INTERNATIONAL: CONTRIBUTE, SPONSORING: CONTRIBUTE, CONSULTING: CONTRIBUTE, AD_PRO_OTHER: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"] },
  PRODUCT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, CONGRESS_INTERNATIONAL: MANAGE, CONGRESS_NATIONAL: MANAGE, EVENTS: MANAGE, MEDICAL: READ, FIELD_REPORTS: READ, BUDGETS: READ, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  BUSINESS_DEVELOPMENT_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUSINESS_DEVELOPMENT: MANAGE, DOCUMENTS: CONTRIBUTE, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
  },
  FINANCE_BUDGET_MANAGER: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER, ADMIN_REQUESTS: REQUEST_USER, BUDGETS: MANAGE, FINANCES: MANAGE, GENERAL_MEANS: MANAGE, RH: READ, SPONSORING: READ, SALES: READ, LOGISTICS: READ, PCH: READ, STOCKS: READ,
    DOCUMENTS: READ, MEDICAL_INFO: ["VIEW", "UPLOAD"], PROMO_MATERIAL: ["VIEW", "UPLOAD", "EXPORT"], CONSULTING: READ, AD_PRO_OTHER: READ, DIRECTIVES: DIRECTIVES_USER, SUPPORT: SUPPORT_USER, DOSSIERS: DOSSIERS_USER, NOTIFICATIONS: ["VIEW"],
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
  // L'assistante de direction ACHÈTE au quotidien : les Moyens généraux sont SON module —
  // son budget, ses dépenses, sa caisse d'avance. Elle n'a pas (et n'a pas besoin d')
  // « Budgets », qui est l'écran de ceux qui ALLOUENT.
  DIRECTION_ASSISTANT: {
    DASHBOARD: READ, WORKSPACE: WORKSPACE_USER, MESSAGING: MESSAGING_USER, VALIDATIONS: VALIDATION_USER, DRIVE: DRIVE_USER,
    ADMIN_REQUESTS: MANAGE, GENERAL_MEANS: GENERAL_MEANS_USER, MAIL_REGISTER: MANAGE, LEGAL: MANAGE,
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

/**
 * LE SOMMET DE LA MAISON — celui qui tranche en dernier ressort.
 *
 * Plus large que `hasGlobalView` d'un cran : le Directeur Général en fait partie. Il est
 * délibérément hors de la vue globale (il ne supervise pas les validations de tout le monde, il
 * ne lit pas les Drive privés), mais sur les décisions d'ENTREPRISE — arbitrer un recrutement,
 * choisir entre deux candidats — il est précisément la personne qu'on appelle « le PDG ».
 *
 * Sert d'OUTREPASSE, jamais de raccourci : la chaîne de validation d'un recrutement est
 * calculée sur l'organigramme réel, et son dernier échelon est le vrai sommet, quel que soit son
 * rôle applicatif. Ce prédicat ne fait que permettre de trancher quand un maillon est absent —
 * exactement la période où les demandes s'accumulent.
 */
export function isTopManagement(u: UserRole | RoleBearer): boolean {
  const tops: UserRole[] = ["SUPER_ADMIN", "DIRECTION", "GENERAL_MANAGER"];
  if (typeof u === "string") return tops.includes(u);
  return tops.includes(u.role) || (u.secondaryRole != null && tops.includes(u.secondaryRole));
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
/**
 * Les rôles dont la matrice donne au moins la VUE sur un module.
 *
 * Sert à dresser « les personnes concernées par X » sans deviner : c'est la même matrice qui
 * gouverne l'accès à l'écran, on ne réinvente pas une liste en parallèle qui divergerait au
 * premier réglage.
 */
export function rolesWithModule(module: Module, action: Action = "VIEW"): UserRole[] {
  return (Object.keys(PERMISSIONS) as UserRole[]).filter((r) => (PERMISSIONS[r][module] ?? []).includes(action));
}

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
/** Role-default check (baseline, ignores per-user overrides). */
export function can(role: UserRole, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

/**
 * QUI VOIT TOUT LE BUREAU DU SECRÉTARIAT, au-delà de ses propres demandes.
 *
 * Ceux qui PAIENT et ceux qui CONTRÔLENT : une mission chauffeur, un achat de fournitures, une
 * prestation, un visa d'invité finissent tous en décaissement ou au dossier du personnel. Ne
 * montrer au DRH et aux Finances que « leurs » demandes revenait à leur faire valider des
 * dépenses dont ils ne voyaient ni l'origine, ni les pièces, ni le circuit.
 *
 * Il faut TENIR le module, pas seulement le lire : une lecture des RH accordée à quelqu'un pour
 * consulter un organigramme n'ouvre pas le courrier de toute l'entreprise.
 *
 * Portée de LECTURE uniquement — le bureau reste tenu par l'assistante de direction. Voir n'est
 * pas instruire.
 */
/**
 * L'ACCÈS AU MODULE RECRUTEMENT — dicté par l'ORGANIGRAMME, pas par une liste de rôles.
 *
 * « Chaque directeur de département a le droit de demander un recrutement » : la condition est
 * FACTUELLE (diriger un département), pas nominale. Un « Responsable Logistique » qui ne dirige
 * rien n'a pas à demander de poste ; quelqu'un dont le rôle ne dit rien de particulier mais qui
 * tient un service en a besoin. Écrire une liste de rôles serait donc faux dans les deux sens, et
 * fausse dès la première réorganisation.
 *
 * L'ADJOINT compte comme le responsable : c'est lui qui tient le service quand l'autre est
 * absent, et un recrutement ne s'arrête pas pendant les congés du directeur.
 *
 * Les RH obtiennent le module ENTIER : ce sont eux qui instruisent, publient et intègrent.
 *
 * Fonction PURE — les faits (dirige-t-il un département ? tient-il les RH ?) sont établis par
 * l'appelant ; la règle, elle, est ici et se teste.
 */
export function recruitmentAccessFor(caps: {
  headsDepartment: boolean;
  rhCanUpdate: boolean;
}): { actions: Action[]; scope: AccessScope } | null {
  if (caps.rhCanUpdate) return { actions: [...MANAGE], scope: "ALL" };
  // Le demandeur voit SES demandes — pas celles des autres départements. Ce qu'un directeur
  // recrute ailleurs ne le regarde pas, et une fourchette de rémunération est une information
  // sensible qui n'a aucune raison de circuler entre pairs.
  if (caps.headsDepartment) return { actions: ["VIEW", "CREATE", "UPDATE", "UPLOAD", "EXPORT"], scope: "ASSIGNED" };
  return null;
}

export function seesWholeSecretariat(caps: { rhCanUpdate: boolean; financeCanUpdate: boolean }): boolean {
  return caps.rhCanUpdate || caps.financeCanUpdate;
}

/** Default row scope for a role on a module (ALL vs only assigned rows). */
export function defaultScope(role: UserRole, module: Module): AccessScope {
  if (hasGlobalView(role)) return "ALL";
  // Drive defaults to per-user scope: one only sees one's own and shared files.
  if (module === "DRIVE") return "ASSIGNED";
  // Admin requests : ceux qui PILOTENT le secrétariat les voient toutes (ALL) — l'Assistante
  // de Direction, et les deux directions qui gèrent le module. Les autres ne voient que les
  // leurs (l'admin peut élargir via un override).
  if (module === "ADMIN_REQUESTS") {
    return (["DIRECTION_ASSISTANT", "GENERAL_MANAGER", "OPERATIONS_DIRECTOR"] as UserRole[]).includes(role) ? "ALL" : "ASSIGNED";
  }
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
/**
 * Toutes les destinations connues : entrées de menu ET leurs ONGLETS. Depuis que plusieurs
 * modules se présentent en onglets sous une entrée unique (Ventes & Marchés = Ventes ·
 * Logistique · PCH, Ad & Pro, Budgets, RH…), l'onglet est le seul endroit où vit le lien entre
 * une route et son module. Ignorer les onglets ferait perdre l'accès temporaire d'un validateur
 * sur tout module fusionné.
 */
const NAV_TARGETS: { href: string; module: Module; label: string }[] = NAVIGATION.flatMap((n) => [
  { href: n.href, module: n.module, label: n.label },
  ...(n.tabs ?? []).map((t) => ({ href: t.href, module: t.module, label: t.label })),
]);

function moduleFromLink(link: string): Module | null {
  const path = link.split(/[?#]/)[0];
  const byHref = [...NAV_TARGETS]
    .filter((n) => n.href !== "/")
    .sort((a, b) => b.href.length - a.href.length) // route la plus spécifique d'abord
    .find((n) => path === n.href || path.startsWith(`${n.href}/`));
  return byHref?.module ?? null;
}

function moduleFromValidation(moduleLabel: string | null, link: string | null): Module | null {
  let fromLabel: Module | null = null;
  if (moduleLabel) {
    const byLabel = NAV_TARGETS.find((n) => n.label === moduleLabel);
    if (byLabel) fromLabel = byLabel.module;
    // Libellé d'AVANT un renommage de menu : une demande créée sous l'ancien nom doit continuer
    // d'ouvrir le même module à son validateur.
    else if (NAV_LEGACY_LABELS[moduleLabel]) fromLabel = NAV_LEGACY_LABELS[moduleLabel];
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
  /** PIPELINE — voit-il les dossiers VERROUILLÉS ? Réglé en Administration, résolu ici une
   *  fois par requête parce que le verrou est consulté par des fonctions SYNCHRONES
   *  (`scopeRegulatory`, `regulatoryLockWhere`) qui ne peuvent pas lire la base.
   *  Optionnel : les fabriques de test construisent un accès minimal. */
  pipelineView?: boolean;
  /** PIPELINE — tient-il le CADENAS (ouvrir un dossier = le publier à toute l'entreprise) ? */
  pipelineManage?: boolean;
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
    const [overrides, grants, userRow, pendingValidations, departmentsLed, standIns, appSettings] = await Promise.all([
      prisma.userAccess.findMany({ where: { userId } }),
      prisma.rowGrant.findMany({ where: { userId }, select: { entityType: true, entityId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, secondaryRole: true } }),
      // Accès TEMPORAIRE de validation : étapes EN ATTENTE dont je suis le validateur.
      prisma.validationStep.findMany({
        where: { validatorId: userId, status: "PENDING", request: { status: "PENDING" } },
        select: { request: { select: { module: true, link: true, entityType: true, entityId: true } } },
      }),
      // Dirige-t-il un département ? C'est ce FAIT — et non son rôle — qui ouvre le module
      // Recrutement. L'adjoint compte : il tient le service quand le responsable est absent.
      prisma.department.count({ where: { OR: [{ head: { userId } }, { deputy: { userId } }] } }),
      // Remplace-t-il quelqu'un en congé aujourd'hui ? La délégation est bornée par les droits
      // de l'absent et s'éteint d'elle-même à la fin du congé — voir `lib/hr/stand-in.ts`.
      activeStandInsFor(userId).catch(() => []),
      // Les accès au PIPELINE (dossiers verrouillés) sont un réglage d'instance, pas un rôle :
      // le Super Admin décide qui voit le portefeuille à l'étude et qui tient le cadenas.
      // `getAppSettings` est lui-même mis en cache par requête et retombe sur ses valeurs par
      // défaut en cas de souci — le doute referme le verrou, il ne l'ouvre pas.
      getAppSettings(),
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
    // Modules explicitement BLOQUÉS par l'administrateur. On les retient pour que les accès
    // IMPLICITES posés plus bas (porter un dossier, se voir partager une catégorie…) ne défassent
    // pas une décision prise à la main — un blocage qui se lèverait tout seul serait pire
    // qu'inutile : il serait imprévisible.
    const blockedModules = new Set<Module>();

    for (const module of MODULES) {
      const ov = overrideMap.get(module);
      // Override « BLOQUÉ » (ligne présente, canView=false) : **absolu**. Il retire le
      // module quoi qu'il arrive — y compris par-dessus un défaut de rôle PRINCIPAL **ou
      // SECONDAIRE**. C'est ce qui rend l'action de l'admin (« bloquer X à Untel »)
      // réellement effective en temps réel, même si son « autre rôle » l'accorde.
      const blocked = !!ov && !ov.canView;
      if (blocked) blockedModules.add(module);
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

    // ── LES RH SONT LE MANAGER des Moyens généraux ──
    // Le module n'est pas dans leur matrice par rôle (« RH » est un droit de module, pas un
    // rôle nommé) : quiconque tient les ressources humaines pilote donc les moyens généraux de
    // TOUS les départements — c'est lui qui dote, arbitre les rallonges et contrôle les
    // dépenses. L'assistante de direction, elle, en est l'utilisatrice quotidienne.
    if (!modules.has("GENERAL_MEANS") && (modules.get("RH")?.actions.has("UPDATE") ?? false)) {
      modules.set("GENERAL_MEANS", {
        actions: new Set<Action>(["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"]),
        scope: "ALL",
      });
    }

    // ── LE DRH ET LES FINANCES VOIENT TOUT LE BUREAU DU SECRÉTARIAT ──
    //
    // Ce sont eux qui PAIENT et qui CONTRÔLENT ce que le secrétariat engage : une mission
    // chauffeur, un achat de fournitures, une prestation, un visa d'invité finissent tous en
    // décaissement ou en dossier du personnel. Ne leur montrer que « leurs » demandes — celles
    // qu'ils ont eux-mêmes émises — revenait à leur demander de valider des dépenses dont ils
    // ne voyaient ni l'origine, ni les pièces, ni le circuit.
    //
    // On accorde la portée ALL en LECTURE, jamais le pilotage : le bureau reste tenu par
    // l'assistante de direction. Voir n'est pas instruire.
    if (seesWholeSecretariat({
      rhCanUpdate: modules.get("RH")?.actions.has("UPDATE") ?? false,
      financeCanUpdate: modules.get("FINANCES")?.actions.has("UPDATE") ?? false,
    })) {
      const cur = modules.get("ADMIN_REQUESTS");
      if (cur) cur.scope = "ALL";
      else modules.set("ADMIN_REQUESTS", { actions: new Set<Action>(["VIEW", "EXPORT"]), scope: "ALL" });
    }

    // ── LE RECRUTEMENT SUIT L'ORGANIGRAMME ──
    // Qui dirige un département peut demander un poste ; qui tient les RH instruit tout. La
    // règle est dans `recruitmentAccessFor` — ici on ne fait que la poser, en ÉLARGISSANT :
    // un rôle qui accorde déjà davantage (Direction, DG) ne doit pas s'en trouver rétréci.
    const recruitment = recruitmentAccessFor({
      headsDepartment: departmentsLed > 0,
      rhCanUpdate: modules.get("RH")?.actions.has("UPDATE") ?? false,
    });
    if (recruitment) {
      const cur = modules.get("RECRUITMENT");
      if (cur) {
        for (const a of recruitment.actions) cur.actions.add(a);
        if (recruitment.scope === "ALL") cur.scope = "ALL";
      } else {
        modules.set("RECRUITMENT", { actions: new Set<Action>(recruitment.actions), scope: recruitment.scope });
      }
    }

    // ── INTÉRIM D'UN CONGÉ ──
    //
    // Quelqu'un est absent, quelqu'un d'autre tient sa place : l'intérimaire reçoit, LE TEMPS DU
    // CONGÉ, les modules que l'absent a délégués — jamais plus que ce que l'absent avait
    // lui-même, jamais la suppression, et jamais ses espaces personnels (Drive, messagerie).
    //
    // La délégation s'ÉTEINT SEULE : elle n'est calculée que si le congé couvre aujourd'hui.
    // Personne n'a rien à révoquer au retour, et c'est précisément ce qui la rend sûre — un
    // accès ouvert « pour cette fois » par un administrateur, lui, ne se referme jamais.
    for (const intérim of standIns) {
      for (const d of intérim.delegations) {
        const cur = modules.get(d.module);
        if (cur) for (const a of d.actions) cur.actions.add(a);
        else modules.set(d.module, { actions: new Set<Action>(d.actions), scope: "ASSIGNED" });
      }
    }

    // ── PORTER UN DOSSIER RÉGLEMENTAIRE OUVRE LE MODULE ─────────────────────────
    //
    // On confie un dossier à quelqu'un depuis le tableau Regulatory, et cette personne recevait
    // la notification « Vous êtes chargé(e) de ce dossier »… dont le lien menait à une
    // redirection : son rôle n'ouvrait pas le module, donc `requireModule` la renvoyait à
    // l'accueil et `scopeRegulatory` ne lui montrait aucune ligne. On lui confiait un dossier
    // qu'elle ne pouvait ni voir ni ouvrir.
    //
    // La portée reste ASSIGNED : `scopeRegulatory` ne retient que les dossiers où elle est
    // NOMMÉE (responsable, assistante, participante, créatrice). Porter trois dossiers n'ouvre
    // pas le portefeuille de la société — et le VERROU du pipeline continue de passer avant tout.
    if (!modules.has("REGULATORY")) {
      const carried = await prisma.regulatoryProduct
        .findFirst({
          where: {
            OR: [
              { responsibleId: userId },
              { assistantId: userId },
              { assignedUsers: { some: { id: userId } } },
            ],
          },
          select: { id: true },
        })
        .catch(() => null);
      const grant = carrierAccess({
        carries: Boolean(carried),
        blocked: blockedModules.has("REGULATORY"),
        hasModule: modules.has("REGULATORY"),
      });
      if (grant) modules.set("REGULATORY", { actions: new Set<Action>(grant.actions), scope: grant.scope });
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

    // ── Accès IMPLICITE au module Drive quand quelque chose est PARTAGÉ avec ce compte ──
    // Être membre d'une CATÉGORIE (par personne OU par rôle, consultation ou gestion), ou tenir
    // un partage NOMINATIF sur un fichier/dossier, doit suffire à OUVRIR le module Drive — même
    // si le rôle n'accorde aucun accès Drive par défaut. Sans cela, recevoir un document du Drive
    // dans la messagerie donnait un lien qui menait à un refus : l'accès existait en base, et la
    // porte du module le rendait inutile.
    // On n'accorde qu'une LECTURE du module ; le filtrage fin (quels nœuds, quels droits) reste
    // assuré par canViewDriveSpace / resolveDriveAccess / driveVisibilityWhere dans les requêtes.
    if (!modules.has("DRIVE")) {
      const roles = [role, secondaryRole].filter(Boolean) as string[];
      const [space, share] = await Promise.all([
        prisma.driveSpace
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
          .catch(() => null),
        prisma.driveShare.findFirst({ where: { userId }, select: { id: true } }).catch(() => null),
      ]);
      if (space || share) modules.set("DRIVE", { actions: new Set<Action>(["VIEW"]), scope: "ASSIGNED" });
    }

    // ── LE PIPELINE (dossiers VERROUILLÉS) ──────────────────────────────────────
    // Résolu ICI et non au moment de la lecture : `scopeRegulatory` et `regulatoryLockWhere`
    // sont synchrones et servent partout (tableau, recherche, sélecteurs de produits,
    // assistant). Un droit qui exigerait une requête à chaque appel ne pourrait pas y vivre.
    const pipeline = pipelineAccessFor({ id: userId, role, secondaryRole }, appSettings);

    return { modules, rowGrants, secondaryRole, role, pipelineView: pipeline.view, pipelineManage: pipeline.manage };
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

/**
 * QUI VOIT LES DOSSIERS VERROUILLÉS — le Super Admin, et ceux à qui il a ouvert le pipeline.
 *
 * Le Super Admin est en dur : c'est lui qui distribue ces accès depuis la console, et un réglage
 * malheureux ne doit pas pouvoir l'enfermer dehors. Les autres viennent du réglage d'instance,
 * résolu par `getAccess` (voir `lib/regulatory/pipeline-access.ts`).
 */
export function seesLockedRegulatory(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.access.pipelineView === true;
}

/** Qui tient le CADENAS : ouvrir un dossier, c'est le publier à toute l'entreprise. */
export function holdsRegulatoryLock(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.access.pipelineManage === true;
}

/**
 * Le VERROU d'un dossier réglementaire passe AVANT tout le reste : ni la portée « toutes les
 * lignes », ni le fait d'en être responsable, ni une autorisation nominative ne l'ouvrent. Il ne
 * s'ouvre QUE par l'accès au pipeline, accordé nommément ou par rôle en Administration.
 *
 * Cette règle vit ici, dans la portée, et non dans l'écran Regulatory : un dossier caché du
 * tableau mais visible depuis la recherche, le sélecteur de produits des stocks ou l'assistant
 * ne serait pas caché du tout.
 */
function lockGate(user: SessionUser): Prisma.RegulatoryProductWhereInput | null {
  return seesLockedRegulatory(user) ? null : { isLocked: false };
}

export function scopeRegulatory(user: SessionUser): Prisma.RegulatoryProductWhereInput {
  const m = user.access.modules.get("REGULATORY");
  if (!m) return { id: "__none__" };
  const gate = lockGate(user);
  if (m.scope === "ALL") return gate ?? {};
  const ors: Prisma.RegulatoryProductWhereInput[] = [
    { createdById: user.id }, // le créateur voit toujours son propre dossier (sinon 404 après création)
    { responsibleId: user.id },
    { assistantId: user.id },
    { assignedUsers: { some: { id: user.id } } },
  ];
  const ids = grantsFor(user, "REGULATORY_PRODUCT");
  if (ids.length) ors.push({ id: { in: ids } });
  return gate ? { AND: [{ OR: ors }, gate] } : { OR: ors };
}

/**
 * Le même verrou pour les lectures qui ne passent PAS par `scopeRegulatory` : sélecteur de
 * produits des stocks, rapprochement « notre produit » d'un appel d'offres PCH, compteurs du
 * tableau de bord. Elles n'ont pas de portée par ligne, mais elles nomment des produits — et
 * un nom qui apparaît suffit à révéler le portefeuille.
 */
export function regulatoryLockWhere(user: SessionUser | null): Prisma.RegulatoryProductWhereInput {
  return user && seesLockedRegulatory(user) ? {} : { isLocked: false };
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

/** Prises en charge Internationales : scope ALL voit tout ; sinon le demandeur + le chef
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
