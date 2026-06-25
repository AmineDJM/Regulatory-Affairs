import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  userCan,
  scopeRegulatory,
  scopeMedicalDoctors,
  scopeMedicalVisits,
  scopeSales,
  scopeBusinessDevelopment,
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
  FINANCE_TRANSACTION: "FINANCES",
  EMPLOYEE: "RH",
  PAYROLL: "FINANCES",
  LEAVE_REQUEST: "RH",
  TASK: "WORKSPACE",
};

/**
 * Authoritative server-side access check for a single entity row. Enforces both
 * module permission and row-level scope, so a user can never read/modify a row
 * outside their assignment even if they guess the id.
 */
export async function canAccessEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
  action: Action = "VIEW",
): Promise<boolean> {
  const module = ENTITY_MODULE[entityType];
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
    default:
      // Modules without row-level scoping: module permission is sufficient.
      return true;
  }
}
