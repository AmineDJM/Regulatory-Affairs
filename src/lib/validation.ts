import type { EntityType, Priority, UserRole, ValidationRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";

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
  // Dérivée du maximum réel (robuste aux suppressions) — voir src/lib/refs.ts.
  const refs = await prisma.validationRequest.findMany({ where: { reference: { startsWith: `VAL-${year}-` } }, select: { reference: true } });
  return buildRef("VAL", year, refs.map((r) => r.reference));
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

  // Référence recalculée à chaque tentative (robuste aux collisions concurrentes).
  const req = await createWithRetry(async () => {
    const reference = await nextReference();
    return prisma.validationRequest.create({
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
  });

  const toNotify = rule.mode === "PARALLEL" ? req.steps : req.steps.filter((s) => s.order === 1);
  for (const s of toNotify) await notifyValidator(s.validatorId, req);

  return { ok: true, matched: true, requestId: req.id, reference: req.reference };
}

/**
 * Demande de validation **directe** : le demandeur choisit lui-même un ou deux
 * validateurs (sans règle préconfigurée). Permet à n'importe quel collaborateur
 * autorisé de demander une validation professionnelle (ex. l'assistante de
 * direction avant l'envoi d'un courrier). Circuit séquentiel par défaut.
 */
export async function createDirectValidation(input: {
  requesterId: string;
  title: string;
  description?: string | null;
  link?: string | null;
  module?: string | null;
  priority?: Priority;
  deadline?: Date | null;
  validatorIds: string[];
  entityType?: EntityType | null;
  entityId?: string | null;
  /** Pièce jointe précise visée (une validation de pièce ne pilote pas l'objet parent). */
  documentId?: string | null;
  /** PARALLEL : tous les validateurs sont saisis (et notifiés) EN MÊME TEMPS. Défaut : séquentiel. */
  mode?: "SEQUENTIAL" | "PARALLEL";
  /** Montant en jeu (DZD) — affiché aux validateurs ; sert à l'ordre de dépense post-approbation. */
  amount?: number | null;
  /** Catégorie de finance pressentie (FinanceCategory) — reprise par l'ordre de dépense. */
  category?: string | null;
  /**
   * Autorise le demandeur à être SON PROPRE validateur. Par défaut on l'écarte (un circuit
   * d'approbation classique ne s'auto-valide pas), mais la validation de PIÈCE JOINTE est un
   * avis qu'on peut vouloir se réserver — sans ce drapeau, se choisir soi-même vidait la liste
   * et l'écran répondait « indiquez au moins un validateur », incompréhensible.
   */
  allowSelf?: boolean;
}): Promise<CreateValidationResult> {
  const validators = [...new Set(input.validatorIds.filter(Boolean))].filter((v) => input.allowSelf || v !== input.requesterId);
  if (validators.length === 0) return { ok: false, matched: false, error: "Indiquez au moins un validateur." };

  const req = await createWithRetry(async () => {
    const reference = await nextReference();
    return prisma.validationRequest.create({
      data: {
        reference,
        module: input.module || "Demandes de validations",
        title: input.title,
        description: input.description ?? null,
        link: input.link ?? null,
        priority: input.priority ?? "MEDIUM",
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        requesterId: input.requesterId,
        documentId: input.documentId ?? null,
        amount: input.amount ?? null,
        category: input.category ?? null,
        mode: input.mode ?? "SEQUENTIAL",
        status: "PENDING",
        currentOrder: 1,
        deadline: input.deadline ?? null,
        // En parallèle, l'ordre ne commande rien : tout le monde est à l'étape 1.
        steps: { create: validators.map((vid, i) => ({ order: input.mode === "PARALLEL" ? 1 : i + 1, validatorId: vid, status: "PENDING" })) },
      },
      include: { steps: true },
    });
  });

  if ((input.mode ?? "SEQUENTIAL") === "PARALLEL") {
    for (const s of req.steps) await notifyValidator(s.validatorId, req);
  } else {
    const first = req.steps.find((s) => s.order === 1);
    if (first) await notifyValidator(first.validatorId, req);
  }
  return { ok: true, matched: true, requestId: req.id, reference: req.reference };
}
