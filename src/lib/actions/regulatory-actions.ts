"use server";

import { revalidatePath } from "next/cache";
import type { Priority, ProductType, RegulatoryCategory, RegulatoryStatus, StepStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { REGULATORY_STEP_ORDER } from "@/lib/labels";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createRegulatoryProduct(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "CREATE")) {
    return { ok: false, error: "Création non autorisée." };
  }

  const dci = str(formData, "dci");
  if (!dci) return { ok: false, error: "La DCI est obligatoire." };

  const year = new Date().getFullYear();
  const countThisYear = await prisma.regulatoryProduct.count({
    where: { reference: { startsWith: `REG-${year}-` } },
  });
  const reference = `REG-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  const responsibleId = str(formData, "responsibleId");
  const assistantId = str(formData, "assistantId");
  const targetDateRaw = str(formData, "targetDate");

  // Connect responsible + assistant as assigned users so row-level scope works.
  const assignIds = Array.from(new Set([responsibleId, assistantId].filter(Boolean))) as string[];

  const product = await prisma.regulatoryProduct.create({
    data: {
      reference,
      dci,
      brandName: str(formData, "brandName"),
      dosage: str(formData, "dosage"),
      pharmaceuticalForm: str(formData, "pharmaceuticalForm"),
      therapeuticClass: str(formData, "therapeuticClass"),
      partnerLab: str(formData, "partnerLab"),
      countryOfOrigin: str(formData, "countryOfOrigin"),
      category: (str(formData, "category") as RegulatoryCategory) ?? "MEDICINE",
      productType: (str(formData, "productType") as ProductType) ?? "IMPORTED",
      status: (str(formData, "status") as RegulatoryStatus) ?? "PRE_SUBMISSION",
      priority: (str(formData, "priority") as Priority) ?? "MEDIUM",
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      comments: str(formData, "comments"),
      responsibleId,
      assistantId,
      createdById: user.id,
      updatedById: user.id,
      assignedUsers: assignIds.length ? { connect: assignIds.map((id) => ({ id })) } : undefined,
      // Seed the configurable 17-step regulatory workflow.
      steps: {
        create: REGULATORY_STEP_ORDER.map((type, idx) => ({
          type: type as never,
          order: idx + 1,
          status: "NOT_STARTED" as StepStatus,
        })),
      },
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: product.id,
    summary: `Nouveau dossier ${reference} — ${dci}`,
  });

  if (assistantId && assistantId !== user.id) {
    await notifyUser({
      userId: assistantId,
      type: "ASSIGNMENT",
      title: "Nouveau dossier assigné",
      body: `${reference} — ${dci}`,
      link: `/regulatory/${product.id}`,
    });
  }

  revalidatePath("/regulatory");
  return { ok: true, id: product.id };
}

export async function updateRegulatoryStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const stepId = str(formData, "stepId");
  if (!stepId) return { ok: false, error: "Étape introuvable." };

  const step = await prisma.regulatoryStep.findUnique({
    where: { id: stepId },
    include: { product: { select: { id: true, reference: true } } },
  });
  if (!step) return { ok: false, error: "Étape introuvable." };

  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", step.productId, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }

  const status = (str(formData, "status") as StepStatus) ?? step.status;
  const plannedDate = str(formData, "plannedDate");
  const actualDate = str(formData, "actualDate");
  const comment = str(formData, "comment");
  const missingDocs = str(formData, "missingDocs");

  await prisma.regulatoryStep.update({
    where: { id: stepId },
    data: {
      status,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      actualDate: actualDate ? new Date(actualDate) : null,
      comment,
      missingDocs,
      responsible: str(formData, "responsible"),
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_STEP",
    entityId: stepId,
    field: "status",
    oldValue: step.status,
    newValue: status,
    summary: `Étape mise à jour sur ${step.product.reference}`,
  });

  revalidatePath(`/regulatory/${step.productId}`);
  return { ok: true };
}

export async function updateRegulatoryStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  const status = (str(formData, "status") as RegulatoryStatus) ?? before.status;
  const priority = (str(formData, "priority") as Priority) ?? before.priority;

  await prisma.regulatoryProduct.update({
    where: { id },
    data: { status, priority, updatedById: user.id },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: id,
    field: "status",
    oldValue: before.status,
    newValue: status,
    summary: `Statut du dossier ${before.reference} → ${status}`,
  });

  revalidatePath(`/regulatory/${id}`);
  revalidatePath("/regulatory");
  return { ok: true };
}

export async function addRegulatoryComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const body = str(formData, "body");
  if (!productId || !body) return { ok: false, error: "Commentaire vide." };

  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "VIEW"))) {
    return { ok: false, error: "Action non autorisée." };
  }

  await prisma.comment.create({
    data: { entityType: "REGULATORY_PRODUCT", entityId: productId, body, authorId: user.id },
  });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}
