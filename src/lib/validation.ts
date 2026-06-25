import type { EntityType, Priority, UserRole, ValidationRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

/**
 * Moteur de validation transversal. Le Super Admin définit des règles
 * (ValidationRule) ; à chaque demande on cherche la règle active la plus
 * spécifique qui correspond au contexte, puis on crée la demande de validation
 * et ses étapes (1 ou 2 validateurs, en séquentiel ou parallèle).
 */

export interface ValidationContext {
  module: string;
  objectType?: string | null;
  amount?: number | null;
  department?: string | null;
  requesterRole?: UserRole | null;
  priority?: Priority | null;
  category?: string | null;
}

/** Nombre de conditions non nulles → mesure de spécificité d'une règle. */
function specificity(r: ValidationRule): number {
  return [r.module, r.objectType, r.requesterRole, r.priority, r.category, r.department, r.minAmount, r.maxAmount]
    .filter((x) => x !== null && x !== undefined).length;
}

export async function findMatchingRule(ctx: ValidationContext): Promise<ValidationRule | null> {
  const rules = await prisma.validationRule.findMany({ where: { active: true } });
  const amt = ctx.amount ?? null;
  const matches = rules.filter((r) => {
    if (r.module && r.module !== ctx.module) return false;
    if (r.objectType && r.objectType !== (ctx.objectType ?? null)) return false;
    if (r.requesterRole && r.requesterRole !== (ctx.requesterRole ?? null)) return false;
    if (r.priority && r.priority !== (ctx.priority ?? null)) return false;
    if (r.category && r.category !== (ctx.category ?? null)) return false;
    if (r.department && r.department !== (ctx.department ?? null)) return false;
    if (r.minAmount !== null && (amt === null || amt < Number(r.minAmount))) return false;
    if (r.maxAmount !== null && (amt === null || amt > Number(r.maxAmount))) return false;
    return true;
  });
  matches.sort((a, b) => specificity(b) - specificity(a) || a.sortOrder - b.sortOrder);
  return matches[0] ?? null;
}

export interface CreateValidationInput {
  module: string;
  objectType?: string | null;
  title: string;
  description?: string | null;
  amount?: number | null;
  department?: string | null;
  priority?: Priority;
  category?: string | null;
  link?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  requesterId: string;
  requesterRole?: UserRole | null;
  deadline?: Date | null;
}

export interface CreateValidationResult {
  ok: boolean;
  matched: boolean;
  requestId?: string;
  reference?: string;
  error?: string;
}

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.validationRequest.count();
  return `VAL-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function notifyValidator(userId: string, req: { reference: string; title: string }) {
  await notifyUser({
    userId,
    type: "VALIDATION_REQUIRED",
    title: "Validation demandée",
    body: `${req.reference} — ${req.title}`,
    link: "/validations",
  });
}

/**
 * Crée une demande de validation à partir des règles. Si aucune règle ne
 * correspond, renvoie `{ matched: false }` — l'appelant décide du repli.
 */
export async function createValidationFromRules(input: CreateValidationInput): Promise<CreateValidationResult> {
  const rule = await findMatchingRule({
    module: input.module,
    objectType: input.objectType,
    amount: input.amount,
    department: input.department,
    requesterRole: input.requesterRole,
    priority: input.priority,
    category: input.category,
  });
  if (!rule) return { ok: false, matched: false, error: "Aucune règle de validation ne correspond à cette demande." };

  const validators = [rule.validator1Id, rule.validator2Id].filter((v): v is string => Boolean(v));
  if (validators.length === 0) return { ok: false, matched: true, error: "La règle correspondante n'a aucun validateur configuré." };

  const reference = await nextReference();
  const req = await prisma.validationRequest.create({
    data: {
      reference,
      ruleId: rule.id,
      module: input.module,
      objectType: input.objectType ?? null,
      title: input.title,
      description: input.description ?? null,
      amount: input.amount ?? null,
      department: input.department ?? null,
      priority: input.priority ?? "MEDIUM",
      category: input.category ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      requesterId: input.requesterId,
      mode: rule.mode,
      status: "PENDING",
      currentOrder: 1,
      deadline: input.deadline ?? null,
      steps: { create: validators.map((vid, i) => ({ order: i + 1, validatorId: vid, status: "PENDING" })) },
    },
    include: { steps: true },
  });

  const toNotify = rule.mode === "PARALLEL" ? req.steps : req.steps.filter((s) => s.order === 1);
  for (const s of toNotify) await notifyValidator(s.validatorId, req);

  return { ok: true, matched: true, requestId: req.id, reference };
}
