import type { EntityType, Prisma, UserRole, WorkflowInstance, WorkflowStep } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { anyRoleFilter, hasGlobalView, hasRole } from "@/lib/rbac";
import { createMedicalInfoDeclaration } from "@/lib/medical-info";
import { createExpenseOrder } from "@/lib/expense-orders";
import { toNumber } from "@/lib/utils";
import { defaultDefinition } from "./defaults";
import {
  CATEGORY_LABELS,
  entityToCategory,
  type ActorScope,
  type StepInput,
  type WorkflowCategory,
} from "./types";

/**
 * Moteur de workflow configurable (Ad & Pro). Une **définition** (par catégorie)
 * décrit une suite d'**étapes** ; chaque étape déclare qui agit et ses pouvoirs.
 * Une **instance** suit une demande précise à travers ces étapes. Le moteur assure
 * le gating, la progression et les effets (désignation, émission d'ordre de dépense
 * / déclaration d'information médicale), tout en **projetant** le statut « legacy »
 * de l'entité source pour ne rien casser des frises/badges/queries existants.
 */

type Viewer = { id: string; role: UserRole; secondaryRole?: UserRole | null; name?: string | null };
export type LoadedStep = WorkflowStep;
export type LoadedInstance = WorkflowInstance;
export type LoadedDefinition = Prisma.WorkflowDefinitionGetPayload<{ include: { steps: true } }>;

// ───────────────────────────── Définition (lazy-seed) ─────────────────────────────

function stepCreate(s: StepInput, i: number): Prisma.WorkflowStepCreateWithoutDefinitionInput {
  return {
    position: i,
    slug: s.slug,
    title: s.title,
    description: s.description ?? null,
    actorRoles: s.actorRoles,
    actorScope: s.actorScope,
    powers: s.powers,
    assignRole: s.assignRole ?? null,
    requireAmount: s.requireAmount ?? false,
    requireCategory: s.requireCategory ?? false,
    requireNote: s.requireNote ?? false,
    emitDeclaration: s.emitDeclaration ?? false,
    emitExpenseOrder: s.emitExpenseOrder ?? false,
    notifyRoles: s.notifyRoles ?? [],
    optional: s.optional ?? false,
    confidential: s.confidential ?? false,
    legacyStatus: s.legacyStatus ?? null,
  };
}

/** Charge la définition d'une catégorie ; la sème (défaut) si elle n'existe pas encore. */
export async function getDefinition(category: WorkflowCategory): Promise<LoadedDefinition> {
  const existing = await prisma.workflowDefinition.findUnique({
    where: { category },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (existing) return existing;
  const d = defaultDefinition(category);
  try {
    return await prisma.workflowDefinition.create({
      data: { category, name: d.name, description: d.description, steps: { create: d.steps.map(stepCreate) } },
      include: { steps: { orderBy: { position: "asc" } } },
    });
  } catch {
    // Course : une autre requête l'a semée en parallèle → relire.
    const again = await prisma.workflowDefinition.findUnique({
      where: { category },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (again) return again;
    throw new Error(`Impossible d'initialiser le workflow ${CATEGORY_LABELS[category]}.`);
  }
}

export function orderedSteps(def: LoadedDefinition): LoadedStep[] {
  return [...def.steps].sort((a, b) => a.position - b.position);
}

export function stepBySlug(def: LoadedDefinition, slug: string | null): LoadedStep | null {
  if (!slug) return null;
  return def.steps.find((s) => s.slug === slug) ?? null;
}

export function nextStepAfter(def: LoadedDefinition, step: LoadedStep): LoadedStep | null {
  return orderedSteps(def).find((s) => s.position > step.position) ?? null;
}

// ───────────────────────────── Statut « legacy » de l'entité ─────────────────────────────

const LEGACY_FIELD: Record<string, "status" | "requestStatus"> = {
  SPONSORING: "status",
  CONGRESS_INTERNATIONAL: "requestStatus",
  CONGRESS_NATIONAL: "requestStatus",
  EVENT: "requestStatus",
};

function updateEntity(entityType: EntityType, entityId: string, data: Record<string, unknown>) {
  switch (entityType) {
    case "SPONSORING":
      return prisma.sponsoringRequest.update({ where: { id: entityId }, data: data as Prisma.SponsoringRequestUpdateInput });
    case "CONGRESS_INTERNATIONAL":
      return prisma.congressInternational.update({ where: { id: entityId }, data: data as Prisma.CongressInternationalUpdateInput });
    case "CONGRESS_NATIONAL":
      return prisma.congressNational.update({ where: { id: entityId }, data: data as Prisma.CongressNationalUpdateInput });
    case "EVENT": {
      // Le modèle Event n'a pas de champ updatedById (contrairement aux congrès).
      const { updatedById: _omit, ...rest } = data;
      return prisma.event.update({ where: { id: entityId }, data: rest as Prisma.EventUpdateInput });
    }
    default:
      return Promise.resolve(null);
  }
}

interface EntitySummary {
  name: string;
  requesterId: string | null;
  beneficiary: string | null;
  label: string;
  legacyStatus: string | null;
}

async function loadEntity(entityType: EntityType, entityId: string): Promise<EntitySummary | null> {
  if (entityType === "SPONSORING") {
    const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { reference: true, institution: true, requesterId: true, status: true } });
    if (!r) return null;
    return { name: r.institution, requesterId: r.requesterId, beneficiary: r.institution, label: `Sponsoring ${r.reference} — ${r.institution}`, legacyStatus: r.status };
  }
  if (entityType === "CONGRESS_INTERNATIONAL") {
    const c = await prisma.congressInternational.findUnique({ where: { id: entityId }, select: { name: true, requesterId: true, requestStatus: true } });
    if (!c) return null;
    return { name: c.name, requesterId: c.requesterId, beneficiary: c.name, label: `Congrès — ${c.name}`, legacyStatus: c.requestStatus };
  }
  if (entityType === "CONGRESS_NATIONAL") {
    const c = await prisma.congressNational.findUnique({ where: { id: entityId }, select: { name: true, requesterId: true, requestStatus: true } });
    if (!c) return null;
    return { name: c.name, requesterId: c.requesterId, beneficiary: c.name, label: `Congrès — ${c.name}`, legacyStatus: c.requestStatus };
  }
  if (entityType === "EVENT") {
    const e = await prisma.event.findUnique({ where: { id: entityId }, select: { name: true, requesterId: true, requestStatus: true } });
    if (!e) return null;
    return { name: e.name, requesterId: e.requesterId, beneficiary: e.name, label: `Événement — ${e.name}`, legacyStatus: e.requestStatus };
  }
  return null;
}

// ───────────────────────────── Instance (création paresseuse) ─────────────────────────────

/** Positionne une instance nouvellement créée sur l'étape correspondant au statut legacy. */
function positionFromLegacy(steps: LoadedStep[], legacy: string | null): { currentSlug: string | null; status: string } {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  if (!legacy) return { currentSlug: ordered[0]?.slug ?? null, status: "IN_PROGRESS" };
  if (["APPROVED", "VALIDATED", "PAID", "CLOSED", "COMPLETED", "ACCEPTED"].includes(legacy)) return { currentSlug: null, status: "APPROVED" };
  if (["REJECTED", "REFUSED", "CANCELLED"].includes(legacy)) return { currentSlug: null, status: "REJECTED" };
  const match = ordered.find((s) => s.legacyStatus === legacy);
  if (match) return { currentSlug: match.slug, status: "IN_PROGRESS" };
  // Statuts « legacy » élargis (appels, en analyse…) → rapprochement raisonnable.
  if (["PRELIMINARY_APPROVED"].includes(legacy)) return { currentSlug: ordered[1]?.slug ?? ordered[0]?.slug ?? null, status: "IN_PROGRESS" };
  if (["AWAITING_FINAL", "AWAITING_FINAL_APPEAL", "APPEAL_PENDING", "AWAITING_DIRECTION"].includes(legacy)) {
    const money = ordered.find((s) => s.emitDeclaration || s.emitExpenseOrder);
    return { currentSlug: (money ?? ordered[ordered.length - 1])?.slug ?? null, status: "IN_PROGRESS" };
  }
  return { currentSlug: ordered[0]?.slug ?? null, status: "IN_PROGRESS" };
}

/** Crée l'instance si absente (idempotent), positionnée d'après le statut legacy courant. */
export async function ensureInstance(entityType: EntityType, entityId: string): Promise<LoadedInstance | null> {
  const category = entityToCategory(entityType);
  if (!category) return null;
  const existing = await prisma.workflowInstance.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  if (existing) return existing;
  const def = await getDefinition(category);
  const summary = await loadEntity(entityType, entityId);
  const { currentSlug, status } = positionFromLegacy(orderedSteps(def), summary?.legacyStatus ?? null);
  try {
    return await prisma.workflowInstance.create({
      data: { definitionId: def.id, entityType, entityId, category, currentSlug, status },
    });
  } catch {
    return prisma.workflowInstance.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  }
}

// ───────────────────────────── Gating ─────────────────────────────

export function canActOnStep(viewer: Viewer, step: LoadedStep, instance: LoadedInstance, ctx: { requesterId?: string | null }): boolean {
  if (viewer.role === "SUPER_ADMIN") return true; // le Super Admin passe partout
  switch (step.actorScope as ActorScope) {
    case "GLOBAL_VIEW":
      return hasGlobalView(viewer) || step.actorRoles.some((r) => hasRole(viewer, r as UserRole));
    case "ASSIGNEE":
      return instance.assigneeId === viewer.id || hasGlobalView(viewer);
    case "REQUESTER":
      return (ctx.requesterId ?? null) === viewer.id;
    case "ROLE":
    default:
      return step.actorRoles.some((r) => hasRole(viewer, r as UserRole));
  }
}

// ───────────────────────────── Progression ─────────────────────────────

export interface AdvanceInput {
  viewer: Viewer;
  entityType: EntityType;
  entityId: string;
  action: "APPROVE" | "REJECT" | "COMMENT";
  note?: string | null;
  amount?: number | null;
  budgetCategoryId?: string | null;
  assigneeId?: string | null;
}

type AdvanceResult = { ok: true; category: WorkflowCategory } | { ok: false; error: string };

export async function advanceWorkflowInstance(input: AdvanceInput): Promise<AdvanceResult> {
  const { viewer, entityType, entityId, action } = input;
  const category = entityToCategory(entityType);
  if (!category) return { ok: false, error: "Catégorie de workflow inconnue." };

  const instance = await ensureInstance(entityType, entityId);
  if (!instance) return { ok: false, error: "Impossible d'initialiser le circuit." };
  if (instance.status !== "IN_PROGRESS") return { ok: false, error: "Ce circuit est déjà clôturé." };

  const def = await prisma.workflowDefinition.findUnique({ where: { id: instance.definitionId }, include: { steps: { orderBy: { position: "asc" } } } });
  if (!def) return { ok: false, error: "Définition de workflow introuvable." };
  const step = stepBySlug(def, instance.currentSlug);
  if (!step) return { ok: false, error: "Étape courante introuvable." };

  const summary = await loadEntity(entityType, entityId);
  if (!summary) return { ok: false, error: "Demande introuvable." };

  if (!canActOnStep(viewer, step, instance, { requesterId: summary.requesterId })) {
    return { ok: false, error: "Vous n'êtes pas habilité à agir à cette étape." };
  }

  const note = input.note?.trim() || null;

  // COMMENT : simple trace + commentaire sur l'entité, sans avancer.
  if (action === "COMMENT") {
    if (!step.powers.includes("COMMENT")) return { ok: false, error: "Le commentaire n'est pas autorisé à cette étape." };
    if (!note) return { ok: false, error: "Commentaire vide." };
    await prisma.comment.create({ data: { entityType, entityId, body: note, authorId: viewer.id } });
    await recordEvent(instance.id, step, "COMMENT", viewer, note, null);
    return { ok: true, category };
  }

  if (action === "REJECT") {
    if (!step.powers.includes("REJECT")) return { ok: false, error: "Le refus n'est pas autorisé à cette étape." };
    if (!note) return { ok: false, error: "Le motif du refus est obligatoire." };
    const next = nextStepAfter(def, step);

    if (next) {
      // Étape INTERMÉDIAIRE (National Sales, chef de produit…) : le refus n'est PAS
      // éliminatoire — c'est un AVIS DÉFAVORABLE. Il est consigné et le circuit
      // continue vers l'étape suivante (la décision finale reste à la Direction).
      const assigneeId = input.assigneeId?.trim() || null;
      if (step.powers.includes("ASSIGN")) {
        if (!assigneeId) return { ok: false, error: "Même en cas d'avis défavorable, désignez la personne en charge de l'étape suivante." };
        const okUser = await prisma.user.count({ where: { id: assigneeId, isActive: true } });
        if (okUser === 0) return { ok: false, error: "La personne désignée est introuvable ou inactive." };
        await prisma.workflowInstance.update({ where: { id: instance.id }, data: { assigneeId } });
      }
      await projectApprove(entityType, entityId, step, next, {
        viewer, note, amount: null, assigneeId, emitResult: null,
        nextLegacyStatus: next.legacyStatus ?? null, emitStep: false,
      });
      await prisma.workflowInstance.update({ where: { id: instance.id }, data: { currentSlug: next.slug, status: "IN_PROGRESS" } });
      await recordEvent(instance.id, step, "OPINION_AGAINST", viewer, note, null);
      if (assigneeId && next.actorScope === "ASSIGNEE") {
        await notifyUser({ userId: assigneeId, type: "ASSIGNMENT", title: `${CATEGORY_LABELS[category]} — ${next.title} (avis défavorable en amont)`, body: summary.name, link: entityPath(entityType, entityId) });
      }
      const roles = (next.notifyRoles as UserRole[]).filter(Boolean);
      if (roles.length) await notifyRoles(roles, { type: "VALIDATION_REQUIRED", title: `${CATEGORY_LABELS[category]} — ${next.title}`, body: `${summary.name} — avis défavorable en amont`, link: entityPath(entityType, entityId) });
      await recordAudit({ actorId: viewer.id, action: "UPDATE", module: auditModule(entityType), entityType, entityId, summary: `Avis défavorable (${step.title}) — ${summary.name}` });
      return { ok: true, category };
    }

    // DERNIÈRE étape (décision de la Direction) : le refus est définitif.
    await prisma.workflowInstance.update({ where: { id: instance.id }, data: { status: "REJECTED", currentSlug: null } });
    await projectReject(entityType, entityId, viewer, note);
    await recordEvent(instance.id, step, "REJECT", viewer, note, null);
    if (summary.requesterId) {
      await notifyUser({ userId: summary.requesterId, type: "GENERIC", title: `${CATEGORY_LABELS[category]} — demande refusée`, body: summary.name, link: `${entityPath(entityType, entityId)}` });
    }
    await recordAudit({ actorId: viewer.id, action: "REFUSE", module: auditModule(entityType), entityType, entityId, summary: `Refus définitif (${step.title}) — ${summary.name}` });
    return { ok: true, category };
  }

  // action === APPROVE
  if (!step.powers.includes("APPROVE")) return { ok: false, error: "Cette étape ne permet pas d'approuver." };

  const emitStep = step.emitDeclaration || step.emitExpenseOrder;
  const amount = input.amount ?? null;
  const budgetCategoryId = input.budgetCategoryId?.trim() || null;
  const assigneeId = input.assigneeId?.trim() || null;

  // Contrôles des champs requis par l'étape.
  if (step.powers.includes("ASSIGN") && !assigneeId) return { ok: false, error: "Désignez la personne en charge de l'étape suivante." };
  if (step.requireAmount && !(amount != null && amount > 0)) return { ok: false, error: "Le montant est obligatoire à cette étape." };
  if (step.requireNote && !note) return { ok: false, error: "Un commentaire est obligatoire à cette étape." };
  if (step.requireCategory && !budgetCategoryId) return { ok: false, error: "La (sous-)catégorie budgétaire est obligatoire à cette étape." };
  if (budgetCategoryId) {
    const okCat = await prisma.budgetCategoryLine.count({ where: { id: budgetCategoryId } });
    if (okCat === 0) return { ok: false, error: "La (sous-)catégorie budgétaire choisie est introuvable." };
  }
  if (assigneeId) {
    const okUser = await prisma.user.count({ where: { id: assigneeId, isActive: true } });
    if (okUser === 0) return { ok: false, error: "La personne désignée est introuvable ou inactive." };
  }

  // Effets sur l'instance : désignation, montant « accordé » (uniquement à l'étape
  // d'émission — sinon le montant est une PROPOSITION portée par la projection),
  // (sous-)catégorie budgétaire.
  const instData: Prisma.WorkflowInstanceUpdateInput = {};
  if (assigneeId) instData.assigneeId = assigneeId;
  if (budgetCategoryId) instData.budgetCategoryId = budgetCategoryId;
  if (emitStep && amount != null) instData.amount = amount;
  if (Object.keys(instData).length) await prisma.workflowInstance.update({ where: { id: instance.id }, data: instData });

  const refreshed = await prisma.workflowInstance.findUnique({ where: { id: instance.id } });
  const liveInstance = refreshed ?? instance;

  // Émission financière (à l'étape marquée) : information médicale (PRIM) ou, à défaut
  // de pharmacien, ordre de dépense direct → Finances.
  let emitResult: { declarationId: string | null; orderId: string | null } | null = null;
  if (emitStep) emitResult = await emitFinancials(entityType, entityId, step, liveInstance, summary, viewer);

  // Projection « legacy » : écrit les champs de l'entité source attendus par l'UI.
  const next = nextStepAfter(def, step);
  await projectApprove(entityType, entityId, step, next, {
    viewer, note, amount, assigneeId, emitResult,
    nextLegacyStatus: next?.legacyStatus ?? null,
    emitStep,
  });

  // Avance l'instance (ou clôture).
  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: { currentSlug: next ? next.slug : null, status: next ? "IN_PROGRESS" : "APPROVED" },
  });

  await recordEvent(instance.id, step, "APPROVE", viewer, note, emitStep ? amount : amount);

  // Notifications d'entrée de l'étape suivante (+ personne désignée).
  if (next) {
    if (assigneeId && next.actorScope === "ASSIGNEE") {
      await notifyUser({ userId: assigneeId, type: "ASSIGNMENT", title: `${CATEGORY_LABELS[category]} — ${next.title}`, body: summary.name, link: entityPath(entityType, entityId) });
    }
    const roles = (next.notifyRoles as UserRole[]).filter(Boolean);
    if (roles.length) await notifyRoles(roles, { type: "VALIDATION_REQUIRED", title: `${CATEGORY_LABELS[category]} — ${next.title}`, body: summary.name, link: entityPath(entityType, entityId) });
  } else if (summary.requesterId) {
    await notifyUser({ userId: summary.requesterId, type: "GENERIC", title: `${CATEGORY_LABELS[category]} — pris en charge`, body: summary.name, link: entityPath(entityType, entityId) });
  }

  await recordAudit({ actorId: viewer.id, action: next ? "UPDATE" : "VALIDATE", module: auditModule(entityType), entityType, entityId, summary: `${step.title} — ${summary.name}${emitResult?.orderId ? " (ordre de dépense émis)" : emitResult?.declarationId ? " (déclaration info médicale)" : ""}` });
  return { ok: true, category };
}

// ───────────────────────────── Effets & projection ─────────────────────────────

async function emitFinancials(
  entityType: EntityType,
  entityId: string,
  step: LoadedStep,
  instance: LoadedInstance,
  summary: EntitySummary,
  viewer: Viewer,
): Promise<{ declarationId: string | null; orderId: string | null } | null> {
  const amount = toNumber(instance.amount);
  if (!(amount > 0)) return null;
  const budgetCategoryId = instance.budgetCategoryId ?? null;
  const requestedById = summary.requesterId ?? viewer.id;

  const pharmacist = await prisma.user.findFirst({ where: { ...anyRoleFilter(["MEDICAL_INFO_PHARMACIST"]), isActive: true }, select: { id: true } });
  if (pharmacist && step.emitDeclaration) {
    const decl = await createMedicalInfoDeclaration({
      sourceType: entityType, sourceId: entityId, label: summary.label,
      beneficiary: summary.beneficiary, amount, requesterId: requestedById, budgetCategoryId,
    });
    return { declarationId: decl.id, orderId: null };
  }
  if (step.emitExpenseOrder) {
    const order = await createExpenseOrder({
      label: summary.label, amount, category: "EVENEMENT", beneficiary: summary.beneficiary,
      sourceType: entityType, sourceId: entityId, requestedById, budgetCategoryId,
    });
    return { declarationId: null, orderId: order.id };
  }
  return null;
}

interface ProjectApproveCtx {
  viewer: Viewer;
  note: string | null;
  amount: number | null;
  assigneeId: string | null;
  emitResult: { declarationId: string | null; orderId: string | null } | null;
  nextLegacyStatus: string | null;
  emitStep: boolean;
}

/** Écrit les champs « legacy » de l'entité source attendus par les frises/vues détail. */
async function projectApprove(entityType: EntityType, entityId: string, step: LoadedStep, next: LoadedStep | null, ctx: ProjectApproveCtx) {
  const now = new Date();
  const data: Record<string, unknown> = { updatedById: ctx.viewer.id };
  const statusField = LEGACY_FIELD[entityType] ?? "status";

  // Désignation (pouvoir ASSIGN) → chef de produit + méta préliminaire.
  if (ctx.assigneeId) {
    data.productManagerId = ctx.assigneeId;
    data.preliminaryById = ctx.viewer.id;
    data.preliminaryAt = now;
    data.preliminaryNote = ctx.note;
  }
  // Montant proposé (SET_AMOUNT hors étape d'émission) → budget chef de produit.
  if (!ctx.emitStep && step.powers.includes("SET_AMOUNT") && ctx.amount != null) {
    data.productManagerBudget = ctx.amount;
    data.productManagerNotes = ctx.note;
  }

  if (next) {
    // Étape intermédiaire : projeter le statut de l'étape suivante (si mappé).
    if (ctx.nextLegacyStatus) data[statusField] = ctx.nextLegacyStatus;
  } else {
    // Étape terminale : approbation définitive.
    if (entityType === "SPONSORING") {
      data.status = "APPROVED";
      data.amountGranted = ctx.amount ?? undefined;
      data.finalDecision = ctx.note;
      data.finalById = ctx.viewer.id;
      data.finalAt = now;
      data.validatedBy = ctx.viewer.name ?? null;
      data.validationDate = now;
      if (ctx.emitResult?.orderId) data.expenseOrderId = ctx.emitResult.orderId;
    } else {
      data.requestStatus = "APPROVED";
      data.status = "VALIDATED";
      data.finalById = ctx.viewer.id;
      data.finalAt = now;
      data.finalNote = ctx.note;
      if (ctx.amount != null) data.finalAmount = ctx.amount;
      if (ctx.emitResult?.orderId) data.expenseOrderId = ctx.emitResult.orderId;
    }
  }
  // Étape d'émission NON terminale : consigner tout de même le montant accordé.
  if (ctx.emitStep && next) {
    if (entityType === "SPONSORING") data.amountGranted = ctx.amount ?? undefined;
    else if (ctx.amount != null) data.finalAmount = ctx.amount;
  }

  await updateEntity(entityType, entityId, data);
}

async function projectReject(entityType: EntityType, entityId: string, viewer: Viewer, reason: string) {
  const now = new Date();
  if (entityType === "SPONSORING") {
    await updateEntity(entityType, entityId, { status: "REFUSED", finalDecision: reason, finalById: viewer.id, finalAt: now, validatedBy: viewer.name ?? null, validationDate: now, updatedById: viewer.id });
  } else {
    await updateEntity(entityType, entityId, { requestStatus: "REJECTED", rejectionReason: reason, finalById: viewer.id, finalAt: now, updatedById: viewer.id });
  }
}

// ───────────────────────────── Divers ─────────────────────────────

async function recordEvent(instanceId: string, step: LoadedStep, action: string, viewer: Viewer, note: string | null, amount: number | null) {
  await prisma.workflowStepEvent.create({
    data: { instanceId, stepSlug: step.slug, stepTitle: step.title, action, actorId: viewer.id, actorName: viewer.name ?? null, note, amount: amount ?? null },
  });
}

function entityPath(entityType: EntityType, entityId: string): string {
  const base =
    entityType === "SPONSORING" ? "/sponsoring"
      : entityType === "CONGRESS_INTERNATIONAL" ? "/congress-international"
        : entityType === "CONGRESS_NATIONAL" ? "/congress-national"
          : "/events";
  return `${base}/${entityId}`;
}

function auditModule(entityType: EntityType): string {
  return entityType === "SPONSORING" ? "Sponsoring" : entityType === "EVENT" ? "Events" : "Congrès";
}

/**
 * Ré-ouvre une instance clôturée (ex. **appel** du délégué en sponsoring) à l'étape
 * d'analyse (première étape à portée « ASSIGNEE »), sinon la 2ᵉ étape. Sans effet si
 * l'instance n'existe pas. Garde le moteur cohérent avec le statut legacy `APPEAL_PENDING`.
 */
export async function reopenInstance(entityType: EntityType, entityId: string): Promise<void> {
  const instance = await prisma.workflowInstance.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  if (!instance) return;
  const def = await prisma.workflowDefinition.findUnique({ where: { id: instance.definitionId }, include: { steps: { orderBy: { position: "asc" } } } });
  if (!def) return;
  const steps = orderedSteps(def);
  const target = steps.find((s) => (s.actorScope as ActorScope) === "ASSIGNEE") ?? steps[1] ?? steps[0];
  if (!target) return;
  await prisma.workflowInstance.update({ where: { id: instance.id }, data: { currentSlug: target.slug, status: "IN_PROGRESS" } });
}
