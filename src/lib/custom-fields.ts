import type { EntityType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Entity types that support admin-defined custom fields. */
export const CUSTOM_ENTITY_TYPES: EntityType[] = [
  "REGULATORY_PRODUCT", "SPONSORING", "BUDGET", "CONGRESS_INTERNATIONAL",
  "CONGRESS_NATIONAL", "SALE", "LOGISTICS", "DOCTOR", "VISIT", "BD_OPPORTUNITY",
  "FINANCE_TRANSACTION", "EMPLOYEE",
];

export type CustomValues = Record<string, unknown>;

export function getFieldDefs(entityType: EntityType) {
  return prisma.customFieldDef.findMany({
    where: { entityType, active: true },
    orderBy: { order: "asc" },
  });
}

/** Read the `custom` JSON blob for a record. */
export async function readCustomValues(entityType: EntityType, id: string): Promise<CustomValues> {
  const select = { custom: true } as const;
  let row: { custom: Prisma.JsonValue } | null = null;
  switch (entityType) {
    case "REGULATORY_PRODUCT": row = await prisma.regulatoryProduct.findUnique({ where: { id }, select }); break;
    case "SPONSORING": row = await prisma.sponsoringRequest.findUnique({ where: { id }, select }); break;
    case "BUDGET": row = await prisma.budgetLine.findUnique({ where: { id }, select }); break;
    case "CONGRESS_INTERNATIONAL": row = await prisma.congressInternational.findUnique({ where: { id }, select }); break;
    case "CONGRESS_NATIONAL": row = await prisma.congressNational.findUnique({ where: { id }, select }); break;
    case "SALE": row = await prisma.sale.findUnique({ where: { id }, select }); break;
    case "LOGISTICS": row = await prisma.logisticsOrder.findUnique({ where: { id }, select }); break;
    case "DOCTOR": row = await prisma.medicalDoctor.findUnique({ where: { id }, select }); break;
    case "VISIT": row = await prisma.medicalVisit.findUnique({ where: { id }, select }); break;
    case "BD_OPPORTUNITY": row = await prisma.businessDevelopmentOpportunity.findUnique({ where: { id }, select }); break;
    case "FINANCE_TRANSACTION": row = await prisma.financeTransaction.findUnique({ where: { id }, select }); break;
    case "EMPLOYEE": row = await prisma.employee.findUnique({ where: { id }, select }); break;
    default: return {};
  }
  return (row?.custom as CustomValues) ?? {};
}

/** Persist the `custom` JSON blob for a record. */
export async function writeCustomValues(entityType: EntityType, id: string, custom: CustomValues): Promise<void> {
  const data = { custom: custom as Prisma.InputJsonValue };
  switch (entityType) {
    case "REGULATORY_PRODUCT": await prisma.regulatoryProduct.update({ where: { id }, data }); break;
    case "SPONSORING": await prisma.sponsoringRequest.update({ where: { id }, data }); break;
    case "BUDGET": await prisma.budgetLine.update({ where: { id }, data }); break;
    case "CONGRESS_INTERNATIONAL": await prisma.congressInternational.update({ where: { id }, data }); break;
    case "CONGRESS_NATIONAL": await prisma.congressNational.update({ where: { id }, data }); break;
    case "SALE": await prisma.sale.update({ where: { id }, data }); break;
    case "LOGISTICS": await prisma.logisticsOrder.update({ where: { id }, data }); break;
    case "DOCTOR": await prisma.medicalDoctor.update({ where: { id }, data }); break;
    case "VISIT": await prisma.medicalVisit.update({ where: { id }, data }); break;
    case "BD_OPPORTUNITY": await prisma.businessDevelopmentOpportunity.update({ where: { id }, data }); break;
    case "FINANCE_TRANSACTION": await prisma.financeTransaction.update({ where: { id }, data }); break;
    case "EMPLOYEE": await prisma.employee.update({ where: { id }, data }); break;
  }
}

/** Render a stored value for display. */
export function formatCustomValue(type: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "BOOLEAN") return value ? "Oui" : "Non";
  if (type === "DATE") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
  }
  return String(value);
}
