"use server";

import { revalidatePath } from "next/cache";
import type { BDStatus, BDType, Priority } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

export async function createBD(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user.role, "BUSINESS_DEVELOPMENT", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'opportunité est obligatoire." };

  const created = await prisma.businessDevelopmentOpportunity.create({
    data: {
      name,
      dci: fdStr(formData, "dci"),
      therapeuticClass: fdStr(formData, "therapeuticClass"),
      type: (fdStr(formData, "type") as BDType) ?? "GENERIC",
      targetMarket: fdStr(formData, "targetMarket"),
      estimatedMarketSize: fdNum(formData, "estimatedMarketSize"),
      estimatedPrice: fdNum(formData, "estimatedPrice"),
      competitors: fdStr(formData, "competitors"),
      potentialSupplier: fdStr(formData, "potentialSupplier"),
      supplierCountry: fdStr(formData, "supplierCountry"),
      supplierContact: fdStr(formData, "supplierContact"),
      status: (fdStr(formData, "status") as BDStatus) ?? "IDEA",
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      score: fdNum(formData, "score"),
      nextAction: fdStr(formData, "nextAction"),
      nextActionDate: fdDate(formData, "nextActionDate"),
      ownerId: user.id,
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Business Development",
    entityType: "BD_OPPORTUNITY", entityId: created.id, summary: `Opportunité « ${name} »`,
  });
  revalidatePath("/business-development");
  return { ok: true, id: created.id };
}

/** Move an opportunity to a new pipeline stage (used by the Kanban board). */
export async function updateBDStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as BDStatus;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  if (!(await canAccessEntity(user, "BD_OPPORTUNITY", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const before = await prisma.businessDevelopmentOpportunity.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Introuvable." };

  await prisma.businessDevelopmentOpportunity.update({
    where: { id },
    data: { status, updatedById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Business Development",
    entityType: "BD_OPPORTUNITY", entityId: id, field: "status",
    oldValue: before.status, newValue: status, summary: `Pipeline: ${before.name} → ${status}`,
  });
  revalidatePath("/business-development");
  return { ok: true };
}
