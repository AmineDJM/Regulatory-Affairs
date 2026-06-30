"use server";

import { revalidatePath } from "next/cache";
import type { Priority, UserRole, ValidationMode, ValidationStatus, ValidationStepState } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { createValidationFromRules, createDirectValidation, notifyValidator } from "@/lib/validation";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

const ROLES: UserRole[] = [
  "SUPER_ADMIN", "DIRECTION", "HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "HEAD_OF_SALES",
  "SALES_USER", "LOGISTICS_MANAGER", "MEDICAL_PROMOTION_MANAGER", "MEDICAL_DELEGATE", "NATIONAL_SALES",
  "PRODUCT_MANAGER", "BUSINESS_DEVELOPMENT_MANAGER", "FINANCE_BUDGET_MANAGER", "VIEWER",
];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const roleOrNull = (s: string | null): UserRole | null => (s && ROLES.includes(s as UserRole) ? (s as UserRole) : null);
const priorityOrNull = (s: string | null): Priority | null => (s && PRIORITIES.includes(s as Priority) ? (s as Priority) : null);
const SUPER_ONLY: ActionResult = { ok: false, error: "Réservé au Super Admin." };

// ───────────────────────────── Règles (Super Admin) ─────────────────────────────

function readRuleData(formData: FormData) {
  return {
    module: fdStr(formData, "module"),
    objectType: fdStr(formData, "objectType"),
    description: fdStr(formData, "description"),
    minAmount: fdNum(formData, "minAmount"),
    maxAmount: fdNum(formData, "maxAmount"),
    department: fdStr(formData, "department"),
    requesterRole: roleOrNull(fdStr(formData, "requesterRole")),
    priority: priorityOrNull(fdStr(formData, "priority")),
    category: fdStr(formData, "category"),
    validator1Id: fdStr(formData, "validator1Id"),
    validator2Id: fdStr(formData, "validator2Id"),
    mode: (fdStr(formData, "mode") === "PARALLEL" ? "PARALLEL" : "SEQUENTIAL") as ValidationMode,
  };
}

export async function createValidationRule(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return SUPER_ONLY;
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de la règle est obligatoire." };
  const data = readRuleData(formData);
  if (!data.validator1Id) return { ok: false, error: "Au moins un validateur est requis." };

  const created = await prisma.validationRule.create({
    data: { name, ...data, active: true, createdById: user.id },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Validations", entityType: "VALIDATION_REQUEST", entityId: created.id, summary: `Règle « ${name} »` });
  revalidatePath("/admin/validations");
  return { ok: true, id: created.id };
}

export async function updateValidationRule(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return SUPER_ONLY;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Nom requis." };
  const data = readRuleData(formData);
  if (!data.validator1Id) return { ok: false, error: "Au moins un validateur est requis." };

  await prisma.validationRule.update({ where: { id }, data: { name, ...data, active: fdBool(formData, "active") } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Validations", entityType: "VALIDATION_REQUEST", entityId: id, summary: `Règle « ${name} » modifiée` });
  revalidatePath("/admin/validations");
  return { ok: true, id };
}

export async function toggleValidationRule(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return SUPER_ONLY;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const rule = await prisma.validationRule.findUnique({ where: { id }, select: { active: true } });
  if (!rule) return { ok: false, error: "Règle introuvable." };
  await prisma.validationRule.update({ where: { id }, data: { active: !rule.active } });
  revalidatePath("/admin/validations");
  return { ok: true };
}

export async function deleteValidationRule(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return SUPER_ONLY;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.validationRule.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Validations", entityType: "VALIDATION_REQUEST", entityId: id, summary: "Règle de validation supprimée" });
  revalidatePath("/admin/validations");
  return { ok: true };
}

// ───────────────────────────── Demandes de validation ─────────────────────────────

export async function createValidationRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "VALIDATIONS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Indiquez l'objet à valider." };

  // Validateurs choisis directement par le demandeur (validation professionnelle
  // libre, ex. l'assistante de direction). Prioritaire sur le routage par règles.
  const directValidators = [fdStr(formData, "validator1Id"), fdStr(formData, "validator2Id")]
    .filter((v): v is string => Boolean(v));

  let res;
  if (directValidators.length > 0) {
    res = await createDirectValidation({
      requesterId: user.id,
      title,
      description: fdStr(formData, "description"),
      link: fdStr(formData, "link"),
      module: fdStr(formData, "module"),
      priority: priorityOrNull(fdStr(formData, "priority")) ?? "MEDIUM",
      deadline: fdDate(formData, "deadline"),
      validatorIds: directValidators,
    });
  } else {
    const module = fdStr(formData, "module");
    if (!module) return { ok: false, error: "Choisissez un validateur, ou renseignez le module pour un routage automatique." };
    res = await createValidationFromRules({
      module,
      objectType: fdStr(formData, "objectType"),
      title,
      description: fdStr(formData, "description"),
      amount: fdNum(formData, "amount"),
      department: fdStr(formData, "department"),
      priority: priorityOrNull(fdStr(formData, "priority")) ?? "MEDIUM",
      category: fdStr(formData, "category"),
      link: fdStr(formData, "link"),
      deadline: fdDate(formData, "deadline"),
      requesterId: user.id,
      requesterRole: user.role,
    });
  }
  if (!res.ok) return { ok: false, error: res.error };
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Validations", entityType: "VALIDATION_REQUEST", entityId: res.requestId!, summary: `${res.reference} — ${title}` });
  revalidatePath("/validations");
  revalidatePath("/mon-travail");
  return { ok: true, id: res.requestId };
}

export async function decideValidation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const stepId = fdStr(formData, "stepId");
  const decision = fdStr(formData, "decision") as ValidationStepState | null;
  const reason = fdStr(formData, "reason");
  if (!stepId || !decision || !["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(decision)) {
    return { ok: false, error: "Décision invalide." };
  }

  const step = await prisma.validationStep.findUnique({
    where: { id: stepId },
    include: { request: { include: { steps: true } } },
  });
  if (!step) return { ok: false, error: "Étape introuvable." };
  const isSuper = user.role === "SUPER_ADMIN";
  if (step.validatorId !== user.id && !isSuper) return { ok: false, error: "Vous n'êtes pas le validateur de cette étape." };
  if (step.status !== "PENDING") return { ok: false, error: "Étape déjà traitée." };

  const req = step.request;
  if (req.status !== "PENDING") return { ok: false, error: "Demande déjà clôturée." };
  if (req.mode === "SEQUENTIAL" && step.order !== req.currentOrder) return { ok: false, error: "Ce n'est pas encore votre tour." };
  if ((decision === "REJECTED" || decision === "CHANGES_REQUESTED") && !reason) {
    return { ok: false, error: "Le motif est obligatoire pour un refus ou une demande de modification." };
  }

  await prisma.validationStep.update({ where: { id: stepId }, data: { status: decision, reason, decidedAt: new Date() } });

  let newStatus: ValidationStatus = "PENDING";
  let advanceOrder = req.currentOrder;
  if (decision === "REJECTED") {
    newStatus = "REJECTED";
  } else if (decision === "CHANGES_REQUESTED") {
    newStatus = "CHANGES_REQUESTED";
  } else {
    if (req.mode === "PARALLEL") {
      const allApproved = req.steps.filter((s) => s.id !== stepId).every((s) => s.status === "APPROVED");
      newStatus = allApproved ? "APPROVED" : "PENDING";
    } else {
      const next = req.steps.find((s) => s.order === req.currentOrder + 1 && s.status === "PENDING");
      if (next) {
        advanceOrder = req.currentOrder + 1;
        await notifyValidator(next.validatorId, req);
      } else {
        newStatus = "APPROVED";
      }
    }
  }

  const finalized = newStatus !== "PENDING";
  await prisma.validationRequest.update({
    where: { id: req.id },
    data: { status: newStatus, currentOrder: advanceOrder, decidedAt: finalized ? new Date() : null },
  });

  if (finalized && req.requesterId !== user.id) {
    const label = newStatus === "APPROVED" ? "acceptée" : newStatus === "REJECTED" ? "refusée" : "à modifier";
    await notifyUser({
      userId: req.requesterId,
      type: "GENERIC",
      title: `Validation ${label}`,
      body: `${req.reference} — ${req.title}`,
      link: "/validations",
    });
  }
  await recordAudit({
    actorId: user.id, action: decision === "REJECTED" ? "REFUSE" : "VALIDATE", module: "Validations",
    entityType: "VALIDATION_REQUEST", entityId: req.id, field: "decision", newValue: decision, summary: `${req.reference} → ${decision}`,
  });

  // Reflet sur la demande administrative liée : une fois la validation finalisée,
  // la demande repasse « en cours » pour que l'assistante poursuive (ou retravaille
  // en cas de refus / modification demandée — le va-et-vient du flux achat).
  if (finalized && req.entityType === "ADMIN_REQUEST" && req.entityId) {
    await prisma.administrativeRequest.updateMany({ where: { id: req.entityId, deletedAt: null }, data: { status: "IN_PROGRESS" } });
    revalidatePath(`/demandes/${req.entityId}`);
    revalidatePath("/demandes");
    revalidatePath("/demandes/assistant");
  }

  revalidatePath("/validations");
  revalidatePath("/admin/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}
