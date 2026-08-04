"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Priority, ProductChannel, ProductType, RegulatoryCategory, RegulatoryStatus, StepStatus, ManufacturingStatus, VariationStatus, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, isRegulatorySupervisor } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { REGULATORY_STEP_ORDER, LOCAL_MANUFACTURING_VARIATIONS, VARIATION_TARGETS } from "@/lib/labels";
import {
  isRegStepKey, isRegStepState, isRegChecklistKey, isRegPresubOutcome,
  REG_STEPS, REG_CHECKLIST, REG_PRESUB_OUTCOME, PRESUB_ANSWER_STEP,
  type RegWorkflowState, type RegChecklistState,
} from "@/lib/regulatory-workflow";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return v ? String(v) : null;
}

/** Canal produit (Ville / Hôpital / les deux). undefined si absent → laisse la valeur en place. */
function parseProductChannel(v: string | null): ProductChannel | undefined {
  return v === "RETAIL" || v === "HOSPITAL" || v === "BOTH" ? v : undefined;
}

/** Uniformise la casse des DCI : MAJUSCULES, espaces normalisés autour des « + ». */
function normalizeDci(value: string): string {
  return value.trim().toUpperCase().replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ");
}
const upperMolecules = (list: string[]): string[] => list.map((m) => m.trim().toUpperCase()).filter(Boolean);

/** Rôles superviseurs Regulatory = Super Admin (toujours) + rôles configurés en Administration. */
async function regSupervisorRoles(): Promise<UserRole[]> {
  const settings = await getAppSettings();
  return Array.from(new Set(["SUPER_ADMIN", ...settings.regulatorySupervisorRoles])) as UserRole[];
}

/** L'utilisateur courant est-il superviseur Regulatory (fixe priorité/dates, demande des MàJ) ? */
async function ensureRegSupervisor(user: Awaited<ReturnType<typeof requireUser>>): Promise<boolean> {
  const settings = await getAppSettings();
  return isRegulatorySupervisor(user, settings.regulatorySupervisorRoles);
}

/**
 * Création d'un fournisseur depuis le module Regulatory (par les Responsables
 * réglementaires). Le fournisseur alimente le menu déroulant des dossiers. Aucun
 * compte de portail n'est créé ici — l'accès externe reste piloté à part.
 */
export async function createRegulatorySupplier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "CREATE")) return { ok: false, error: "Création non autorisée." };
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Le nom du fournisseur est obligatoire." };
  const created = await prisma.supplier.create({
    data: {
      name,
      country: str(formData, "country"),
      contactEmail: str(formData, "contactEmail"),
      notes: str(formData, "notes"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "SUPPLIER", entityId: created.id, summary: `Fournisseur « ${name} »` });
  revalidatePath("/regulatory");
  return { ok: true, id: created.id };
}

export async function createRegulatoryProduct(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "CREATE")) {
    return { ok: false, error: "Création non autorisée." };
  }

  // DCI : molécule unique OU association (double/triple…). Le formulaire envoie une
  // ou plusieurs entrées « molecule » ; la DCI canonique est leur concaténation.
  // Casse uniformisée en MAJUSCULES pour tout le référentiel.
  const molecules = upperMolecules(formData.getAll("molecule").map((m) => String(m)));
  const rawDci = molecules.length ? molecules.join(" + ") : str(formData, "dci");
  if (!rawDci) return { ok: false, error: "La DCI est obligatoire." };
  const dci = normalizeDci(rawDci);

  const year = new Date().getFullYear();
  const refs = await prisma.regulatoryProduct.findMany({
    where: { reference: { startsWith: `REG-${year}-` } },
    select: { reference: true },
  });
  const reference = buildRef("REG", year, refs.map((r) => r.reference));

  const responsibleId = str(formData, "responsibleId");
  const assistantId = str(formData, "assistantId");
  const targetDateRaw = str(formData, "targetDate");
  const targetSubmissionDateRaw = str(formData, "targetSubmissionDate");

  // Variation d'enregistrement : une fabrication locale exige le fabricant.
  const manufacturingVariation = str(formData, "manufacturingVariation");
  const manufacturer = str(formData, "manufacturer");
  if (manufacturingVariation && LOCAL_MANUFACTURING_VARIATIONS.includes(manufacturingVariation) && !manufacturer) {
    return { ok: false, error: "Le Fabricant est obligatoire pour une fabrication locale (packaging secondaire, primaire ou full process)." };
  }
  const variationDateRaw = str(formData, "variationDate");

  // Connect responsible + assistant as assigned users so row-level scope works.
  const assignIds = Array.from(new Set([responsibleId, assistantId].filter(Boolean))) as string[];

  const product = await prisma.regulatoryProduct.create({
    data: {
      reference,
      dci,
      molecules: molecules.length > 1 ? (molecules as unknown as Prisma.InputJsonValue) : undefined,
      brandName: str(formData, "brandName"),
      dosage: str(formData, "dosage"),
      dosageUnit: str(formData, "dosageUnit"),
      pharmaceuticalForm: str(formData, "pharmaceuticalForm"),
      therapeuticClass: str(formData, "therapeuticClass"),
      partnerLab: str(formData, "partnerLab"),
      supplierId: str(formData, "supplierId"),
      countryOfOrigin: str(formData, "countryOfOrigin"),
      category: (str(formData, "category") as RegulatoryCategory) ?? "MEDICINE",
      channel: parseProductChannel(str(formData, "channel")) ?? "BOTH",
      productType: (str(formData, "productType") as ProductType) ?? "IMPORTED",
      manufacturingStatus: (str(formData, "manufacturingStatus") as ManufacturingStatus) ?? "IMPORTATION",
      status: (str(formData, "status") as RegulatoryStatus) ?? "PRE_SUBMISSION",
      priority: (str(formData, "priority") as Priority) ?? "MEDIUM",
      companyId: str(formData, "companyId") || null,
      targetSubmissionDate: targetSubmissionDateRaw ? new Date(targetSubmissionDateRaw) : null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      comments: str(formData, "comments"),
      deHolder: str(formData, "deHolder"),
      manufacturingVariation: manufacturingVariation === "NONE" ? null : manufacturingVariation,
      manufacturer,
      variationDate: variationDateRaw ? new Date(variationDateRaw) : null,
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

  // Supervision : prévenir les superviseurs Regulatory (Super Admin + rôles configurés)
  // qu'un nouveau dossier attend une priorité et une date cible de dépôt.
  await notifyRoles(await regSupervisorRoles(), {
    type: "GENERIC",
    title: "Nouveau dossier Regulatory à prioriser",
    body: `${reference} — ${dci} · définir la priorité et la date cible de dépôt.`,
    link: `/regulatory/${product.id}`,
  });

  revalidatePath("/regulatory");
  return { ok: true, id: product.id };
}

/**
 * Modifie les informations descriptives d'un dossier réglementaire (DCI, marque,
 * dosage, classe, laboratoire, pays, type, responsables…). La casse des DCI est
 * uniformisée en MAJUSCULES. Le statut/priorité ont leur propre action dédiée mais
 * sont aussi acceptés ici pour une édition complète depuis la fiche.
 */
export async function updateRegulatoryProduct(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({ where: { id }, include: { assignedUsers: { select: { id: true } } } });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  // DCI : recompose depuis les molécules saisies, sinon depuis le champ libre.
  const molecules = upperMolecules(formData.getAll("molecule").map((m) => String(m)));
  const rawDci = molecules.length ? molecules.join(" + ") : str(formData, "dci");
  if (!rawDci) return { ok: false, error: "La DCI est obligatoire." };
  const dci = normalizeDci(rawDci);

  const responsibleId = str(formData, "responsibleId");
  const assistantId = str(formData, "assistantId");
  const targetDateRaw = str(formData, "targetDate");
  const targetSubmissionDateRaw = str(formData, "targetSubmissionDate");
  // Préserve les participants déjà rattachés (collaboration) + garantit l'accès du
  // responsable et de l'assistant. La modification d'un dossier ne doit JAMAIS retirer
  // les collaborateurs ajoutés via le panneau « Participants ».
  const assignIds = Array.from(new Set([...before.assignedUsers.map((u) => u.id), responsibleId, assistantId].filter(Boolean))) as string[];

  // Fabricant courant (les variations de fabrication ont leur propre cycle de vie).
  const manufacturer = str(formData, "manufacturer");

  await prisma.regulatoryProduct.update({
    where: { id },
    data: {
      dci,
      molecules: molecules.length > 1 ? (molecules as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      brandName: str(formData, "brandName"),
      dosage: str(formData, "dosage"),
      dosageUnit: str(formData, "dosageUnit"),
      pharmaceuticalForm: str(formData, "pharmaceuticalForm"),
      therapeuticClass: str(formData, "therapeuticClass"),
      partnerLab: str(formData, "partnerLab"),
      supplierId: str(formData, "supplierId"),
      countryOfOrigin: str(formData, "countryOfOrigin"),
      category: (str(formData, "category") as RegulatoryCategory) ?? before.category,
      channel: parseProductChannel(str(formData, "channel")) ?? before.channel,
      productType: (str(formData, "productType") as ProductType) ?? before.productType,
      manufacturingStatus: (str(formData, "manufacturingStatus") as ManufacturingStatus) ?? before.manufacturingStatus,
      status: (str(formData, "status") as RegulatoryStatus) ?? before.status,
      priority: (str(formData, "priority") as Priority) ?? before.priority,
      targetSubmissionDate: targetSubmissionDateRaw ? new Date(targetSubmissionDateRaw) : null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      comments: str(formData, "comments"),
      deHolder: str(formData, "deHolder"),
      manufacturer,
      responsibleId,
      assistantId,
      updatedById: user.id,
      assignedUsers: assignIds.length ? { set: assignIds.map((aid) => ({ id: aid })) } : { set: [] },
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: id,
    summary: `Dossier ${before.reference} modifié — ${dci}`,
  });

  if (assistantId && assistantId !== user.id && assistantId !== before.assistantId) {
    await notifyUser({
      userId: assistantId,
      type: "ASSIGNMENT",
      title: "Dossier réglementaire assigné",
      body: `${before.reference} — ${dci}`,
      link: `/regulatory/${id}`,
    });
  }

  revalidatePath(`/regulatory/${id}`);
  revalidatePath("/regulatory");
  return { ok: true, id };
}

/**
 * Participants du dossier : collaborateurs qui peuvent VOIR et travailler le dossier
 * (accès ligne via `assignedUsers`, cf. scopeRegulatory). Le responsable et l'assistant
 * y sont toujours inclus. Ouvre la collaboration à plusieurs, dossiers actuels ET nouveaux.
 */
export async function setRegulatoryParticipants(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const product = await prisma.regulatoryProduct.findUnique({ where: { id }, select: { responsibleId: true, assistantId: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };
  const participantIds = formData.getAll("participantIds").map(String).filter(Boolean);
  const ids = Array.from(new Set([product.responsibleId, product.assistantId, ...participantIds].filter(Boolean))) as string[];
  await prisma.regulatoryProduct.update({ where: { id }, data: { assignedUsers: { set: ids.map((uid) => ({ id: uid })) } } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: `Participants du dossier — ${ids.length} collaborateur(s)` });
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/** Modifier la priorité d'un dossier (Direction / équipe Regulatory) depuis le tableau. */
/** La priorité est fixée par la SUPERVISION (Super Admin + rôles configurés en Administration). */
export async function setRegulatoryPriority(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  const priority = str(formData, "priority");
  if (!id || !priority) return { ok: false, error: "Paramètres manquants." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  await prisma.regulatoryProduct.update({ where: { id }, data: { priority: priority as Priority } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, field: "priority", newValue: priority, summary: "Priorité du dossier modifiée" });
  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/** Dates cibles (dépôt + enregistrement) — fixées par la supervision Regulatory. */
export async function setRegulatoryTargetDates(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  const subRaw = str(formData, "targetSubmissionDate");
  const regRaw = str(formData, "targetDate");
  await prisma.regulatoryProduct.update({
    where: { id },
    data: {
      targetSubmissionDate: subRaw ? new Date(subRaw) : null,
      targetDate: regRaw ? new Date(regRaw) : null,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: "Dates cibles (dépôt / enregistrement) mises à jour" });
  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/**
 * La supervision (Super Admin / rôle configuré) DEMANDE une mise à jour de statut sur
 * l'enregistrement d'un produit : notifie le responsable, l'assistant et les participants
 * du dossier. N'écrit pas le statut — c'est une relance traçable.
 */
export async function requestRegulatoryStatusUpdate(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  const product = await prisma.regulatoryProduct.findUnique({
    where: { id },
    select: { reference: true, dci: true, responsibleId: true, assistantId: true, assignedUsers: { select: { id: true } } },
  });
  if (!product) return { ok: false, error: "Dossier introuvable." };
  const note = str(formData, "note");
  const targets = Array.from(new Set([
    product.responsibleId, product.assistantId, ...product.assignedUsers.map((u) => u.id),
  ].filter((x): x is string => Boolean(x) && x !== user.id)));
  await Promise.all(targets.map((userId) => notifyUser({
    userId,
    type: "GENERIC",
    title: "Mise à jour de statut demandée",
    body: `${product.reference} — ${product.dci}${note ? ` · ${note}` : ""}`,
    link: `/regulatory/${id}`,
  })));
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: `Demande de mise à jour de statut (${targets.length} destinataire(s))` });
  return { ok: true };
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

  // Dépôt effectué : prévenir la supervision de fixer la date cible d'enregistrement.
  if (status === "SUBMITTED" && before.status !== "SUBMITTED") {
    await notifyRoles(await regSupervisorRoles(), {
      type: "GENERIC",
      title: "Dossier déposé — fixer la date cible d'enregistrement",
      body: `${before.reference} — ${before.dci} vient d'être déposé à l'ANPP.`,
      link: `/regulatory/${id}`,
    });
  }

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

// ───────────────────────── Processus officiel ANPP (workflow + checklist) ─────────────────────────

/** Met à jour l'état d'une étape du processus ANPP (statut + date + note) sur un produit. */
export async function setRegulatoryStepState(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const stepKey = str(formData, "stepKey");
  const status = str(formData, "status");
  if (!productId || !stepKey || !status) return { ok: false, error: "Paramètres manquants." };
  if (!isRegStepKey(stepKey) || !isRegStepState(status)) return { ok: false, error: "Étape ou statut invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  const date = str(formData, "date");
  const note = str(formData, "note");
  wf[stepKey] = {
    status,
    date: date && date.trim() ? date.trim() : (status === "DONE" ? new Date().toISOString().slice(0, 10) : wf[stepKey]?.date),
    note: note !== null ? (note.trim() || undefined) : wf[stepKey]?.note,
  };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  const stepLabel = REG_STEPS.find((s) => s.key === stepKey)?.label ?? stepKey;
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "workflow", newValue: status, summary: `Étape ANPP « ${stepLabel} » → ${status}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/**
 * AVIS de la réponse de présoumission (étape « presub_ans ») : Favorable → le processus
 * CONTINUE (étape « Fait ») ; Défavorable → étape « Bloqué » (à corriger et redemander) ;
 * En attente → étape « En cours ». Le statut d'étape est dérivé de l'avis (source unique).
 */
export async function setRegulatoryPresubOutcome(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const outcome = str(formData, "outcome");
  if (!productId || !outcome) return { ok: false, error: "Paramètres manquants." };
  if (!isRegPresubOutcome(outcome)) return { ok: false, error: "Avis invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  const mapped = REG_PRESUB_OUTCOME[outcome];
  const note = str(formData, "note");
  wf[PRESUB_ANSWER_STEP] = {
    status: mapped.status,
    outcome,
    date: mapped.status === "DONE" ? new Date().toISOString().slice(0, 10) : wf[PRESUB_ANSWER_STEP]?.date,
    note: note !== null ? (note.trim() || undefined) : wf[PRESUB_ANSWER_STEP]?.note,
  };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "workflow", newValue: outcome, summary: `Présoumission → ${mapped.label}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/** Enregistre uniquement le commentaire d'une étape ANPP (sans changer son statut). */
export async function setRegulatoryStepNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const stepKey = str(formData, "stepKey");
  if (!productId || !stepKey) return { ok: false, error: "Paramètres manquants." };
  if (!isRegStepKey(stepKey)) return { ok: false, error: "Étape invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const note = str(formData, "note");
  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  wf[stepKey] = { ...(wf[stepKey] ?? {}), status: wf[stepKey]?.status ?? "TODO", note: note && note.trim() ? note.trim() : undefined };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/**
 * « Demande de BV » : émet un ordre de dépense (envoyé à l'espace comptable) avec
 * montant + échéance, et joint éventuellement un justificatif (proforma BV). Le
 * comptable le voit dans les ordres de dépense / Finances.
 */
export async function requestBV(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { reference: true, dci: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const bvType = str(formData, "bvType") || "BV";
  const amount = Number(str(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };
  const dueRaw = str(formData, "dueDate");
  const note = str(formData, "note");

  const order = await createExpenseOrder({
    label: `${bvType} — ${product.reference} ${product.dci}`,
    amount,
    category: "IMPOT",
    beneficiary: "ANPP",
    sourceType: "REGULATORY_PRODUCT",
    sourceId: productId,
    requestedById: user.id,
    notes: note,
    dueDate: dueRaw ? new Date(dueRaw) : null,
  });

  // Justificatif facultatif : rattaché à l'ordre de dépense (visible côté comptable).
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const err = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
    if (err) return { ok: false, error: err };
    const key = `EXPENSE_ORDER/${order.id}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      console.error("[requestBV] storage write failed", e);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "PROFORMA", entityType: "EXPENSE_ORDER", entityId: order.id,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId,
    summary: `Demande de ${bvType} (${amount.toLocaleString("fr-FR")} DZD) → ordre ${order.reference}`,
  });
  revalidatePath(`/regulatory/${productId}`);
  revalidatePath("/finances");
  return { ok: true };
}

/** Coche / décoche un document de la checklist de présoumission (avec note facultative). */
export async function setRegulatoryChecklistItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const itemKey = str(formData, "itemKey");
  if (!productId || !itemKey) return { ok: false, error: "Paramètres manquants." };
  if (!isRegChecklistKey(itemKey)) return { ok: false, error: "Document invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { checklist: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const checked = str(formData, "checked") === "true";
  const note = str(formData, "note");
  const cl = { ...((product.checklist as RegChecklistState | null) ?? {}) };
  cl[itemKey] = { checked, note: note !== null ? (note.trim() || undefined) : cl[itemKey]?.note };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { checklist: cl as unknown as Prisma.InputJsonValue } });
  const itemLabel = REG_CHECKLIST.flatMap((g) => g.items).find((i) => i.key === itemKey)?.label ?? itemKey;
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "checklist", newValue: checked ? "coché" : "décoché", summary: `Document présoumission « ${itemLabel} » ${checked ? "fourni" : "retiré"}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

// ─────────────────────────── Variations de fabrication ───────────────────────────
// Après la DE d'un produit, on peut demander une variation vers un packaging local
// (secondaire / primaire / full process). Chaîne possible dans le temps ; à l'obtention,
// le statut de fabrication du produit est mis à jour.

/** Ouvre une variation (dépôt) vers un statut de fabrication supérieur. */
export async function createVariation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const toStatus = str(formData, "toStatus");
  if (!toStatus || !VARIATION_TARGETS.includes(toStatus)) {
    return { ok: false, error: "Statut de fabrication de variation invalide." };
  }
  const depotRaw = str(formData, "depotDate");
  await prisma.regulatoryVariation.create({
    data: {
      productId,
      toStatus: toStatus as ManufacturingStatus,
      status: "EN_ATTENTE",
      depotDate: depotRaw ? new Date(depotRaw) : null,
      manufacturer: str(formData, "manufacturer"),
      note: str(formData, "note"),
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, summary: `Variation déposée → ${toStatus}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/** Met à jour le statut d'une variation ; si « DE obtenue », promeut le statut de fabrication du produit. */
export async function setVariationStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status || !["EN_ATTENTE", "OBTENUE", "ANNULE"].includes(status)) {
    return { ok: false, error: "Paramètres invalides." };
  }
  const variation = await prisma.regulatoryVariation.findUnique({ where: { id }, select: { id: true, productId: true, toStatus: true, manufacturer: true } });
  if (!variation) return { ok: false, error: "Variation introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", variation.productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const decisionRaw = str(formData, "decisionDate");
  const decisionDate = decisionRaw ? new Date(decisionRaw) : status === "OBTENUE" ? new Date() : null;
  await prisma.regulatoryVariation.update({
    where: { id },
    data: { status: status as VariationStatus, decisionDate },
  });

  // À l'obtention, le statut de fabrication du produit devient la cible de la variation.
  if (status === "OBTENUE") {
    await prisma.regulatoryProduct.update({
      where: { id: variation.productId },
      data: {
        manufacturingStatus: variation.toStatus,
        ...(variation.manufacturer ? { manufacturer: variation.manufacturer } : {}),
        variationDate: decisionDate,
        updatedById: user.id,
      },
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: variation.productId, summary: `Variation → ${variation.toStatus} : ${status}` });
  revalidatePath(`/regulatory/${variation.productId}`);
  return { ok: true };
}

/** Supprime une variation (responsable / privilégié). */
export async function deleteVariation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Variation introuvable." };
  const variation = await prisma.regulatoryVariation.findUnique({ where: { id }, select: { productId: true } });
  if (!variation) return { ok: false, error: "Variation introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", variation.productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  await prisma.regulatoryVariation.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: variation.productId, summary: "Variation supprimée" });
  revalidatePath(`/regulatory/${variation.productId}`);
  return { ok: true };
}
