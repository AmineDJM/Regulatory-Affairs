import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  userCan,
  scopeRegulatory,
  scopeMedicalDoctors,
  scopeMedicalVisits,
  scopeSales,
  scopeBusinessDevelopment,
  scopeBdProject,
  scopeSupport,
  scopeDossiers,
  type Action,
  type Module,
  type SessionUser,
} from "@/lib/rbac";

/** Maps a polymorphic entity type to its owning module. */
export const ENTITY_MODULE: Record<EntityType, Module> = {
  REGULATORY_PRODUCT: "REGULATORY",
  REGULATORY_STEP: "REGULATORY",
  SPONSORING: "SPONSORING",
  BUDGET: "BUDGETS",
  CONGRESS_INTERNATIONAL: "CONGRESS_INTERNATIONAL",
  CONGRESS_NATIONAL: "CONGRESS_NATIONAL",
  SALE: "SALES",
  LOGISTICS: "LOGISTICS",
  DOCTOR: "MEDICAL",
  VISIT: "MEDICAL",
  DELEGATE_PLAN: "MEDICAL",
  BD_OPPORTUNITY: "BUSINESS_DEVELOPMENT",
  BD_PROJECT: "BUSINESS_DEVELOPMENT",
  FINANCE_TRANSACTION: "FINANCES",
  EMPLOYEE: "RH",
  PAYROLL: "FINANCES",
  LEAVE_REQUEST: "RH",
  TASK: "WORKSPACE",
  SALARY_ADVANCE: "RH",
  EXPENSE_ORDER: "FINANCES",
  DRIVE_NODE: "DRIVE",
  ADMIN_REQUEST: "ADMIN_REQUESTS",
  DRIVER_MISSION: "ADMIN_REQUESTS",
  FEEDBACK: "WORKSPACE",
  VALIDATION_REQUEST: "VALIDATIONS",
  SUPPLIER: "REGULATORY",
  MEDICAL_INFO_DECLARATION: "MEDICAL_INFO",
  DIRECTIVE: "DIRECTIVES",
  SUPPORT_REQUEST: "SUPPORT",
  DOSSIER: "DOSSIERS",
  PROMO_MATERIAL: "PROMO_MATERIAL",
};

/**
 * Authoritative server-side access check for a single entity row. Enforces both
 * module permission and row-level scope, so a user can never read/modify a row
 * outside their assignment even if they guess the id.
 */
/** Le demandeur d'une demande de sponsoring/congrès en est-il le requester ? */
async function isRequestOwner(user: SessionUser, entityType: EntityType, entityId: string): Promise<boolean> {
  if (entityType === "SPONSORING") {
    const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  if (entityType === "CONGRESS_INTERNATIONAL") {
    const r = await prisma.congressInternational.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  if (entityType === "CONGRESS_NATIONAL") {
    const r = await prisma.congressNational.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  return false;
}

export async function canAccessEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
  action: Action = "VIEW",
): Promise<boolean> {
  const module = ENTITY_MODULE[entityType];

  // Le DEMANDEUR d'une demande de sponsoring/congrès peut toujours consulter et
  // joindre des pièces à SA propre demande (devis, programme…), même si son rôle
  // n'a pas le droit UPLOAD du module.
  if (
    (action === "VIEW" || action === "UPLOAD") &&
    (entityType === "SPONSORING" || entityType === "CONGRESS_INTERNATIONAL" || entityType === "CONGRESS_NATIONAL") &&
    (await isRequestOwner(user, entityType, entityId))
  ) {
    return true;
  }

  if (!userCan(user, module, action)) return false;

  switch (entityType) {
    case "REGULATORY_PRODUCT": {
      const found = await prisma.regulatoryProduct.findFirst({
        where: { id: entityId, ...scopeRegulatory(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "DOCTOR": {
      const found = await prisma.medicalDoctor.findFirst({
        where: { id: entityId, ...scopeMedicalDoctors(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "VISIT": {
      const found = await prisma.medicalVisit.findFirst({
        where: { id: entityId, ...scopeMedicalVisits(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "SALE": {
      const found = await prisma.sale.findFirst({
        where: { id: entityId, ...scopeSales(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "BD_OPPORTUNITY": {
      const found = await prisma.businessDevelopmentOpportunity.findFirst({
        where: { id: entityId, ...scopeBusinessDevelopment(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "BD_PROJECT": {
      const found = await prisma.bdProject.findFirst({
        where: { id: entityId, ...scopeBdProject(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "SUPPORT_REQUEST": {
      const found = await prisma.supportRequest.findFirst({
        where: { id: entityId, ...scopeSupport(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "DOSSIER": {
      const found = await prisma.dossier.findFirst({
        where: { id: entityId, ...scopeDossiers(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    default:
      // Modules without row-level scoping: module permission is sufficient.
      return true;
  }
}

/**
 * Peut-on **modérer** le contenu (commentaires, pièces jointes, messages) d'un objet ?
 * Règle unifiée : quiconque peut **éditer** l'objet parent — c'est-à-dire l'administrateur
 * (vue globale, périmètre ALL) ou son responsable/contributeur — peut nettoyer ce qui y a
 * été envoyé. L'auteur d'un élément garde toujours la main sur le sien (vérifié à part).
 */
export async function canModerateEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
): Promise<boolean> {
  return canAccessEntity(user, entityType, entityId, "UPDATE");
}
