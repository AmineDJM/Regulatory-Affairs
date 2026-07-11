import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Couche d'ACCÈS du Regulatory Intelligence OS.
 *  - Feature flag PAR ORGANISATION (Company) : `RegulatoryFeatureAccess`.
 *  - Permissions fines `regulatory.*` mappées sur les rôles (rôle principal ET secondaire).
 *
 * Le module est masqué par défaut ; seul le Super Admin peut débloquer une organisation.
 * Ces vérifications sont volontairement défensives (ne jettent jamais) : en cas d'erreur,
 * on refuse l'accès.
 */

export const REG_PERMISSIONS = [
  "regulatory.module.unlock",
  "regulatory.workspace.view",
  "regulatory.workspace.manage",
  "regulatory.dossier.create",
  "regulatory.dossier.upload",
  "regulatory.dossier.analyse",
  "regulatory.dossier.compare",
  "regulatory.document.view",
  "regulatory.document.classify",
  "regulatory.document.approve",
  "regulatory.finding.view",
  "regulatory.finding.edit",
  "regulatory.finding.approve",
  "regulatory.rules.view",
  "regulatory.rules.manage",
  "regulatory.corpus.view",
  "regulatory.corpus.manage",
  "regulatory.reserve.manage",
  "regulatory.response.generate",
  "regulatory.response.approve",
  "regulatory.email.draft",
  "regulatory.document.generate",
  "regulatory.submission.prepare",
  "regulatory.submission.approve",
  "regulatory.audit.view",
  "regulatory.admin",
] as const;

export type RegPermission = (typeof REG_PERMISSIONS)[number];

type RoleBearer = { role: UserRole; secondaryRole?: UserRole | null };

// Permissions du Responsable Réglementaire (pharmacien) : opérationnel + approbations,
// SAUF le déblocage du module et l'administration (réservés au Super Admin).
const HEAD_PERMS: RegPermission[] = REG_PERMISSIONS.filter(
  (p) => p !== "regulatory.module.unlock" && p !== "regulatory.admin" && p !== "regulatory.rules.manage" && p !== "regulatory.corpus.manage",
);

// Assistante Réglementaire : prépare, ne valide/n'approuve pas.
const ASSISTANT_PERMS: RegPermission[] = [
  "regulatory.workspace.view", "regulatory.dossier.create", "regulatory.dossier.upload",
  "regulatory.dossier.analyse", "regulatory.dossier.compare", "regulatory.document.view",
  "regulatory.document.classify", "regulatory.finding.view", "regulatory.finding.edit",
  "regulatory.rules.view", "regulatory.corpus.view", "regulatory.reserve.manage",
  "regulatory.response.generate", "regulatory.email.draft", "regulatory.document.generate",
  "regulatory.submission.prepare", "regulatory.audit.view",
];

// Direction (vue globale) : consultation + approbations de validation.
const DIRECTION_PERMS: RegPermission[] = [
  "regulatory.workspace.view", "regulatory.document.view", "regulatory.finding.view",
  "regulatory.finding.approve", "regulatory.response.approve", "regulatory.submission.approve",
  "regulatory.audit.view",
];

const ROLE_REG_PERMS: Partial<Record<UserRole, RegPermission[]>> = {
  HEAD_OF_REGULATORY: HEAD_PERMS,
  REGULATORY_ASSISTANT: ASSISTANT_PERMS,
  DIRECTION: DIRECTION_PERMS,
};

/** Un rôle donné détient-il la permission ? */
function roleHas(role: UserRole | null | undefined, perm: RegPermission): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return (ROLE_REG_PERMS[role] ?? []).includes(perm);
}

/**
 * L'utilisateur détient-il la permission `regulatory.*` ? Évalue le rôle PRINCIPAL **et**
 * le rôle SECONDAIRE (régression historique de l'ERP à éviter).
 */
export function regCan(user: RoleBearer, perm: RegPermission): boolean {
  return roleHas(user.role, perm) || roleHas(user.secondaryRole, perm);
}

/** Ensemble des permissions effectives (pour l'UI/tests). */
export function regPermissions(user: RoleBearer): RegPermission[] {
  return REG_PERMISSIONS.filter((p) => regCan(user, p));
}

// ───────────────────────── Feature flag par organisation ─────────────────────────

/** Le module est-il débloqué pour CETTE organisation ? */
export async function regIntelligenceEnabledFor(companyId: string): Promise<boolean> {
  if (!companyId) return false;
  try {
    const row = await prisma.regulatoryFeatureAccess.findUnique({ where: { companyId }, select: { enabled: true } });
    return row?.enabled ?? false;
  } catch {
    return false;
  }
}

/** Au moins une organisation a-t-elle le module débloqué ? (affichage de l'entrée de nav) */
export async function anyRegIntelligenceEnabled(): Promise<boolean> {
  try {
    return (await prisma.regulatoryFeatureAccess.count({ where: { enabled: true } })) > 0;
  } catch {
    return false;
  }
}

/** Organisations débloquées (ids). */
export async function enabledRegCompanyIds(): Promise<string[]> {
  try {
    const rows = await prisma.regulatoryFeatureAccess.findMany({ where: { enabled: true }, select: { companyId: true } });
    return rows.map((r) => r.companyId);
  } catch {
    return [];
  }
}
