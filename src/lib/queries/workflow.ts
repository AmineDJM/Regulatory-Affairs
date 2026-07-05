import type { EntityType } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { anyRoleFilter, hasGlobalView, hasRole, type SessionUser } from "@/lib/rbac";
import { getBudgetCategoryOptions, type BudgetCategoryOption } from "@/lib/queries/budget";
import { ensureInstance, getDefinition, orderedSteps, canActOnStep, stepBySlug } from "@/lib/workflow/engine";
import {
  entityToCategory, WORKFLOW_CATEGORIES, CATEGORY_LABELS,
  type ActorScope, type WorkflowCategory, type WorkflowPower,
} from "@/lib/workflow/types";

export interface WorkflowStepView {
  slug: string;
  title: string;
  description: string | null;
  actorRoles: string[];
  actorScope: ActorScope;
  powers: WorkflowPower[];
  assignRole: string | null;
  requireAmount: boolean;
  requireCategory: boolean;
  requireNote: boolean;
  optional: boolean;
  confidential: boolean;
  emitDeclaration: boolean;
  emitExpenseOrder: boolean;
  notifyRoles: string[];
  legacyStatus: string | null;
  state: "done" | "current" | "todo" | "rejected";
}

export interface WorkflowEventView {
  stepTitle: string;
  action: string;
  actorName: string | null;
  note: string | null;
  amount: number | null;
  createdAt: string;
}

export interface WorkflowActionView {
  slug: string;
  title: string;
  description: string | null;
  powers: WorkflowPower[];
  requireAmount: boolean;
  requireCategory: boolean;
  requireNote: boolean;
  assignRole: string | null;
  assigneeCandidates: { id: string; name: string }[];
  suggestedAmount: number | null;
}

export interface WorkflowOutcome {
  grantedAmount: number | null;
  expenseOrder: { reference: string; status: string; amount: number } | null;
}

export interface WorkflowView {
  category: WorkflowCategory;
  definitionName: string;
  status: string; // IN_PROGRESS | APPROVED | REJECTED | CANCELLED
  currentSlug: string | null;
  steps: WorkflowStepView[];
  events: WorkflowEventView[];
  assigneeName: string | null;
  action: WorkflowActionView | null; // ce que le spectateur peut faire MAINTENANT
  budgetCategories: BudgetCategoryOption[];
  outcome: WorkflowOutcome | null;
  /** Les détails techniques du circuit (rôles/portées/pouvoirs, historique) ne sont
   *  montrés qu'au Super Admin. */
  isSuperAdmin: boolean;
}

/** Une dépense Ad & Pro accordée peut être imputée à n'importe quelle enveloppe
 *  couvrant la famille Ad & Pro — pas seulement le module exact de la demande. */
const AD_PRO_BUDGET_MODULES = ["SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENTS", "PROMO_MATERIAL"];

async function loadOutcome(entityType: EntityType, entityId: string): Promise<WorkflowOutcome> {
  let grantedAmount: number | null = null;
  let orderId: string | null = null;
  if (entityType === "SPONSORING") {
    const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { amountGranted: true, expenseOrderId: true } });
    grantedAmount = r?.amountGranted != null ? toNumber(r.amountGranted) : null;
    orderId = r?.expenseOrderId ?? null;
  } else {
    const sel = { finalAmount: true, expenseOrderId: true } as const;
    const r =
      entityType === "CONGRESS_INTERNATIONAL" ? await prisma.congressInternational.findUnique({ where: { id: entityId }, select: sel })
        : entityType === "CONGRESS_NATIONAL" ? await prisma.congressNational.findUnique({ where: { id: entityId }, select: sel })
          : await prisma.event.findUnique({ where: { id: entityId }, select: sel });
    grantedAmount = r?.finalAmount != null ? toNumber(r.finalAmount) : null;
    orderId = r?.expenseOrderId ?? null;
  }
  const order = orderId ? await prisma.expenseOrder.findUnique({ where: { id: orderId }, select: { reference: true, status: true, amount: true } }) : null;
  return { grantedAmount, expenseOrder: order ? { reference: order.reference, status: order.status, amount: toNumber(order.amount) } : null };
}

/**
 * Vue « workflow » d'une demande pour un spectateur : frise dynamique dérivée de la
 * définition + historique + l'action éventuellement disponible (selon les pouvoirs de
 * l'étape courante et le rôle du spectateur). Crée l'instance à la volée si besoin
 * (couvre aussi les demandes créées avant l'activation du moteur).
 */
export async function getWorkflowForEntity(viewer: SessionUser, entityType: EntityType, entityId: string, requesterId: string | null): Promise<WorkflowView | null> {
  const category = entityToCategory(entityType);
  if (!category) return null;
  const instance = await ensureInstance(entityType, entityId);
  if (!instance) return null;
  const def = await getDefinition(category);
  const steps = orderedSteps(def);

  // Confidentialité : l'avis et le montant des étapes marquées « confidentielles »
  // (ex. analyse chef de produit) ne sont PAS visibles du demandeur (délégué).
  const privileged = hasGlobalView(viewer) || viewer.role === "SUPER_ADMIN" || instance.assigneeId === viewer.id || hasRole(viewer, "NATIONAL_SALES");
  const confidentialSlugs = new Set(steps.filter((s) => s.confidential).map((s) => s.slug));

  const events = await prisma.workflowStepEvent.findMany({ where: { instanceId: instance.id }, orderBy: { createdAt: "asc" } });
  const approved = new Set(events.filter((e) => e.action === "APPROVE").map((e) => e.stepSlug));
  const rejectedSlug = [...events].reverse().find((e) => e.action === "REJECT")?.stepSlug ?? null;
  const currentPos = instance.currentSlug ? steps.find((s) => s.slug === instance.currentSlug)?.position ?? -1 : Infinity;

  const stepViews: WorkflowStepView[] = steps.map((s) => {
    let state: WorkflowStepView["state"];
    if (instance.status === "REJECTED" && s.slug === rejectedSlug) state = "rejected";
    else if (instance.status === "APPROVED") state = "done";
    else if (instance.status === "IN_PROGRESS" && s.slug === instance.currentSlug) state = "current";
    else if (approved.has(s.slug) || s.position < currentPos) state = "done";
    else state = "todo";
    return {
      slug: s.slug, title: s.title, description: s.description, actorRoles: s.actorRoles, actorScope: s.actorScope as ActorScope,
      powers: s.powers as WorkflowPower[], assignRole: s.assignRole, requireAmount: s.requireAmount, requireCategory: s.requireCategory,
      requireNote: s.requireNote, optional: s.optional, confidential: s.confidential, emitDeclaration: s.emitDeclaration, emitExpenseOrder: s.emitExpenseOrder,
      notifyRoles: s.notifyRoles, legacyStatus: s.legacyStatus, state,
    };
  });

  const assignee = instance.assigneeId ? await prisma.user.findUnique({ where: { id: instance.assigneeId }, select: { name: true } }) : null;

  // Action disponible pour ce spectateur à l'étape courante ?
  let action: WorkflowActionView | null = null;
  const current = stepBySlug(def, instance.currentSlug);
  if (instance.status === "IN_PROGRESS" && current && canActOnStep(viewer, current, instance, { requesterId })) {
    const candidates = current.assignRole
      ? await prisma.user.findMany({ where: { ...anyRoleFilter([current.assignRole as UserRole]), isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [];
    // Montant suggéré : dernier montant proposé (analyse), sinon montant déjà accordé.
    const lastAmount = [...events].reverse().find((e) => e.amount != null)?.amount ?? instance.amount ?? null;
    action = {
      slug: current.slug, title: current.title, description: current.description,
      powers: current.powers as WorkflowPower[], requireAmount: current.requireAmount, requireCategory: current.requireCategory,
      requireNote: current.requireNote, assignRole: current.assignRole, assigneeCandidates: candidates,
      suggestedAmount: lastAmount != null ? toNumber(lastAmount) : null,
    };
  }

  const needsCategory = stepViews.some((s) => s.requireCategory || s.powers.includes("SET_CATEGORY"));
  const budgetCategories = needsCategory && action ? await getBudgetCategoryOptions(AD_PRO_BUDGET_MODULES) : [];
  const outcome = instance.status !== "IN_PROGRESS" || instance.assigneeId ? await loadOutcome(entityType, entityId) : null;

  return {
    category, definitionName: def.name, status: instance.status, currentSlug: instance.currentSlug,
    isSuperAdmin: viewer.role === "SUPER_ADMIN",
    steps: stepViews, assigneeName: assignee?.name ?? null,
    events: events.map((e) => {
      const hide = !privileged && confidentialSlugs.has(e.stepSlug);
      return {
        stepTitle: e.stepTitle, action: e.action, actorName: e.actorName,
        note: hide ? (e.note ? "— confidentiel —" : null) : e.note,
        amount: hide ? null : e.amount != null ? toNumber(e.amount) : null,
        createdAt: e.createdAt.toISOString(),
      };
    }),
    action, budgetCategories, outcome,
  };
}

// ───────────────────────────── Builder (Administration) ─────────────────────────────

export interface DefinitionAdminView {
  id: string;
  category: WorkflowCategory;
  categoryLabel: string;
  name: string;
  description: string | null;
  isActive: boolean;
  instanceCount: number;
  steps: WorkflowStepView[];
}

/** Toutes les définitions (semées si absentes) pour l'éditeur no-code du Super Admin. */
export async function getWorkflowDefinitions(): Promise<DefinitionAdminView[]> {
  const out: DefinitionAdminView[] = [];
  for (const category of WORKFLOW_CATEGORIES) {
    const def = await getDefinition(category);
    const instanceCount = await prisma.workflowInstance.count({ where: { definitionId: def.id } });
    out.push({
      id: def.id, category, categoryLabel: CATEGORY_LABELS[category], name: def.name, description: def.description, isActive: def.isActive, instanceCount,
      steps: orderedSteps(def).map((s) => ({
        slug: s.slug, title: s.title, description: s.description, actorRoles: s.actorRoles, actorScope: s.actorScope as ActorScope,
        powers: s.powers as WorkflowPower[], assignRole: s.assignRole, requireAmount: s.requireAmount, requireCategory: s.requireCategory,
        requireNote: s.requireNote, optional: s.optional, confidential: s.confidential, emitDeclaration: s.emitDeclaration, emitExpenseOrder: s.emitExpenseOrder,
        notifyRoles: s.notifyRoles, legacyStatus: s.legacyStatus, state: "todo" as const,
      })),
    });
  }
  return out;
}
