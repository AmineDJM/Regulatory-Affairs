"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Priority, UserRole, ValidationMode, ValidationStatus, ValidationStepState } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { createValidationFromRules, createDirectValidation, notifyValidator } from "@/lib/validation";
import { createExpenseOrder } from "@/lib/expense-orders";
import { actsForUser } from "@/lib/hr/stand-in-resolve";
import { toNumber } from "@/lib/utils";
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

  // Pièces jointes facultatives : versées à la demande de validation (visibles du
  // demandeur et des validateurs via les documents de l'entité).
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const maxMb = (await getAppSettings()).maxUploadMb;
    for (const file of files) {
      const invalid = validateUpload(file.name, file.size, maxMb);
      if (invalid) return { ok: false, error: invalid };
      const key = `VALIDATION_REQUEST/${res.requestId}/${randomUUID()}__${file.name}`;
      try {
        await saveFile(key, Buffer.from(await file.arrayBuffer()));
      } catch (err) {
        console.error("[validations] storage write failed, recording metadata only", err);
      }
      await prisma.document.create({
        data: {
          name: file.name, category: "OTHER", entityType: "VALIDATION_REQUEST", entityId: res.requestId!,
          fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
        },
      });
    }
  }

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
  // L'INTÉRIMAIRE D'UN CONGÉ décide à la place de l'absent. C'est tout l'objet de l'intérim :
  // sans cela, les validations s'empilent trois semaines et l'on découvre au retour qu'une
  // demande attendait depuis quinze jours. La délégation est validée par les RH et s'éteint
  // seule à la fin du congé — voir `lib/hr/stand-in.ts`.
  const asStandIn = step.validatorId !== user.id && !isSuper
    ? await actsForUser(user.id, step.validatorId)
    : false;
  if (step.validatorId !== user.id && !isSuper && !asStandIn) {
    return { ok: false, error: "Vous n'êtes pas le validateur de cette étape." };
  }
  if (step.status !== "PENDING") return { ok: false, error: "Étape déjà traitée." };

  const req = step.request;
  if (req.status !== "PENDING") return { ok: false, error: "Demande déjà clôturée." };
  if (req.mode === "SEQUENTIAL" && step.order !== req.currentOrder) return { ok: false, error: "Ce n'est pas encore votre tour." };
  // Commentaire OPTIONNEL, quelle que soit la décision (approuver / refuser / demander une modif).

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
    // UNE DÉCISION SUR UNE PIÈCE N'EST PAS UNE DÉCISION SUR LA DEMANDE. « Validation acceptée »
    // sur la facture d'une demande qui en compte quatre laissait croire que tout était tranché.
    // On nomme donc l'objet de la décision, et on dit ce qu'il reste à attendre.
    const onPiece = Boolean(req.documentId);
    const pieceName = onPiece
      ? (await prisma.document.findUnique({ where: { id: req.documentId! }, select: { name: true } }))?.name ?? "Pièce jointe"
      : null;
    const stillPending = onPiece && req.entityType && req.entityId
      ? await prisma.validationRequest.count({
          where: { entityType: req.entityType, entityId: req.entityId, status: "PENDING", id: { not: req.id } },
        })
      : 0;
    const label = newStatus === "APPROVED" ? "acceptée" : newStatus === "REJECTED" ? "refusée" : "à modifier";
    await notifyUser({
      userId: req.requesterId,
      type: "GENERIC",
      title: onPiece ? `Pièce ${label} — ${pieceName}` : `Validation ${label}`,
      body: onPiece
        ? `${req.reference} · cette décision porte sur cette pièce seule.${stillPending > 0 ? ` ${stillPending} autre${stillPending > 1 ? "s" : ""} pièce${stillPending > 1 ? "s" : ""} de la même demande attend${stillPending > 1 ? "ent" : ""} encore.` : " Toutes les pièces de la demande sont désormais tranchées."}`
        : `${req.reference} — ${req.title}`,
      link: "/validations",
    });
  }
  await recordAudit({
    actorId: user.id, action: decision === "REJECTED" ? "REFUSE" : "VALIDATE", module: "Validations",
    entityType: "VALIDATION_REQUEST", entityId: req.id, field: "decision", newValue: decision,
    // Le journal DIT que la décision a été prise au titre d'un intérim. Sans cette mention, on
    // relirait « Untel a validé » sans comprendre pourquoi ce n'est pas le validateur désigné.
    summary: `${req.reference} → ${decision}${asStandIn ? " (par l'intérimaire du validateur, congé en cours)" : ""}`,
  });

  // PIÈCE JOINTE APPROUVÉE + MONTANT SAISI À LA SOUMISSION → la suite est FINANCIÈRE : un ordre
  // de dépense part automatiquement aux Finances (notifiées), catégorisé (catégorie choisie à la
  // soumission, sinon « Autre ») et rattaché à la demande d'origine — au règlement, la dépense
  // rejoint le budget par le circuit habituel des ordres. Sans montant, rien n'est payable :
  // l'approbation reste un simple avis sur la pièce.
  if (newStatus === "APPROVED" && req.documentId && req.entityType === "ADMIN_REQUEST" && req.entityId) {
    const amt = req.amount === null ? 0 : toNumber(req.amount);
    if (amt > 0) {
      try {
        await createExpenseOrder({
          label: req.title,
          amount: amt,
          category: (req.category as Parameters<typeof createExpenseOrder>[0]["category"]) ?? "AUTRE",
          sourceType: "ADMIN_REQUEST",
          sourceId: req.entityId,
          requestedById: req.requesterId,
          notes: `Pièce validée (${req.reference})${req.description ? ` — ${req.description}` : ""}`,
        });
        revalidatePath("/finances/paiements-a-faire");
      } catch (err) {
        // L'ordre raté ne doit pas annuler la décision déjà enregistrée — on trace et on continue.
        console.error("[validations] ordre de dépense post-approbation échoué :", err);
      }
    }
  }

  // Reflet sur la demande administrative liée : une fois la validation finalisée,
  // la demande repasse « en cours » pour que l'assistante poursuive (ou retravaille
  // en cas de refus / modification demandée — le va-et-vient du flux achat).
  // Une validation de PIÈCE JOINTE (documentId) est un avis sur cette pièce : elle ne fait pas
  // repartir le flux de la demande — sinon valider une facture ressusciterait une demande close.
  if (finalized && req.entityType === "ADMIN_REQUEST" && req.entityId && !req.documentId) {
    await prisma.administrativeRequest.updateMany({ where: { id: req.entityId, deletedAt: null }, data: { status: "IN_PROGRESS" } });
    revalidatePath("/demandes");
    revalidatePath("/demandes/assistant");
  }
  if (finalized && req.entityType === "ADMIN_REQUEST" && req.entityId) {
    revalidatePath(`/demandes/${req.entityId}`);
  }

  revalidatePath("/validations");
  revalidatePath("/admin/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}

const ITEM_DECISIONS: ValidationStepState[] = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"];

/**
 * Décision GRANULAIRE d'un validateur sur UN élément de la demande : le « message »
 * (itemKey = "MESSAGE") ou une pièce jointe précise (itemKey = id du Document).
 * Approuver / Refuser / Demander une révision, avec commentaire OPTIONNEL. Vient EN
 * PLUS de la décision globale (qui fait avancer le circuit) : c'est un retour détaillé,
 * pièce par pièce, pour le demandeur. Idempotent — réenregistrer met à jour le verdict.
 */
export async function reviewValidationItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const stepId = fdStr(formData, "stepId");
  const itemKey = fdStr(formData, "itemKey");
  const decision = fdStr(formData, "decision") as ValidationStepState | null;
  const comment = fdStr(formData, "comment");
  if (!stepId || !itemKey || !decision || !ITEM_DECISIONS.includes(decision)) {
    return { ok: false, error: "Décision invalide." };
  }
  const step = await prisma.validationStep.findUnique({
    where: { id: stepId },
    include: { request: { select: { status: true, mode: true, currentOrder: true } } },
  });
  if (!step) return { ok: false, error: "Étape introuvable." };
  const isSuper = user.role === "SUPER_ADMIN";
  if (step.validatorId !== user.id && !isSuper) return { ok: false, error: "Vous n'êtes pas le validateur de cette étape." };
  if (step.status !== "PENDING") return { ok: false, error: "Étape déjà traitée." };
  if (step.request.status !== "PENDING") return { ok: false, error: "Demande déjà clôturée." };
  if (step.request.mode === "SEQUENTIAL" && step.order !== step.request.currentOrder && !isSuper) {
    return { ok: false, error: "Ce n'est pas encore votre tour." };
  }
  // L'itemKey doit désigner soit le message, soit une pièce RÉELLEMENT jointe à la demande.
  if (itemKey !== "MESSAGE") {
    const doc = await prisma.document.findFirst({
      where: { id: itemKey, entityType: "VALIDATION_REQUEST", entityId: step.requestId },
      select: { id: true },
    });
    if (!doc) return { ok: false, error: "Pièce introuvable." };
  }
  await prisma.validationItemDecision.upsert({
    where: { stepId_itemKey: { stepId, itemKey } },
    create: { stepId, itemKey, decision, comment: comment || null },
    update: { decision, comment: comment || null },
  });
  revalidatePath("/validations");
  return { ok: true };
}

/** Retire le verdict d'un élément (le validateur revient à « non évalué »). */
export async function clearValidationItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const stepId = fdStr(formData, "stepId");
  const itemKey = fdStr(formData, "itemKey");
  if (!stepId || !itemKey) return { ok: false, error: "Paramètres manquants." };
  const step = await prisma.validationStep.findUnique({ where: { id: stepId }, select: { validatorId: true, status: true } });
  if (!step) return { ok: false, error: "Étape introuvable." };
  if (step.validatorId !== user.id && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  if (step.status !== "PENDING") return { ok: false, error: "Étape déjà traitée." };
  await prisma.validationItemDecision.deleteMany({ where: { stepId, itemKey } });
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * RELANCER LE VALIDATEUR QUI BLOQUE — l'action qui manquait à la supervision.
 *
 * La Direction voyait la liste des demandes en attente sans rien pouvoir en faire : constater
 * qu'une validation dort depuis trois semaines et devoir sortir de l'outil pour envoyer un
 * message, c'est une supervision qui ne supervise rien. Le rappel part à la personne dont on
 * attend la décision, et il est TRACÉ (audit) : une relance qu'on ne peut pas prouver se
 * répète indéfiniment.
 *
 * Réservé à la vue globale : c'est une pression hiérarchique, pas un bouton de confort.
 */
/**
 * RETIRER SA PROPRE DEMANDE DE VALIDATION.
 *
 * Une demande partie par erreur — mauvais validateur, mauvaise pièce, objet abandonné — occupait
 * jusqu'ici la file de quelqu'un d'autre pour toujours : seul le Super Admin pouvait l'effacer,
 * et on ne le dérange pas pour ça. Le demandeur reprend donc la sienne.
 *
 * DEUX BORNES, et elles ne se négocient pas :
 *   • seul LE DEMANDEUR (ou le Super Admin) retire — un validateur qui supprimerait ce qu'on lui
 *     soumet ferait disparaître la demande au lieu de la refuser, sans motif et sans trace ;
 *   • une demande DÉJÀ TRANCHÉE ne se retire pas. L'accord ou le refus d'un tiers est un fait :
 *     l'effacer réécrirait ce que quelqu'un a signé. On ne retire que ce qui attend encore.
 */
export async function deleteMyValidationRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.validationRequest.findUnique({
    where: { id },
    select: { id: true, reference: true, title: true, requesterId: true, status: true, steps: { select: { status: true } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.requesterId !== user.id && user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le demandeur retire sa demande. Un validateur refuse — avec un motif, qui reste." };
  }
  if (req.status !== "PENDING") {
    return { ok: false, error: "Cette demande a été tranchée : l'accord ou le refus d'un tiers ne s'efface pas." };
  }
  const decidee = req.steps.some((e) => e.status !== "PENDING");
  if (decidee) {
    return { ok: false, error: "Un validateur s'est déjà prononcé sur une étape : la demande ne peut plus être retirée." };
  }

  await prisma.validationRequest.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Validations",
    entityType: "VALIDATION_REQUEST", entityId: id,
    summary: `Demande de validation retirée par son demandeur — ${req.reference} : ${req.title}`,
  });
  revalidatePath("/validations");
  revalidatePath("/mon-espace");
  return { ok: true };
}

export async function remindValidator(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasGlobalView(user)) return { ok: false, error: "Réservé à la Direction." };
  const stepId = fdStr(formData, "stepId");
  if (!stepId) return { ok: false, error: "Étape non précisée." };

  const step = await prisma.validationStep.findUnique({
    where: { id: stepId },
    include: { request: { select: { id: true, reference: true, title: true, link: true } } },
  });
  if (!step) return { ok: false, error: "Étape introuvable." };
  if (step.status !== "PENDING") return { ok: false, error: "Cette étape est déjà tranchée." };
  if (!step.validatorId) return { ok: false, error: "Aucun validateur n'est assigné à cette étape." };

  const note = fdStr(formData, "note");
  await notifyUser({
    userId: step.validatorId,
    type: "VALIDATION_REQUIRED",
    title: "Relance — validation en attente",
    body: `${step.request.reference} — ${step.request.title}${note ? ` · ${note}` : ""}`,
    link: "/validations",
    push: { tag: `validation-${step.request.id}`, requireInteraction: true },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Validations",
    entityType: "VALIDATION_REQUEST", entityId: step.request.id,
    summary: `Relance du validateur — ${step.request.reference}`,
  });
  revalidatePath("/validations");
  return { ok: true };
}
