"use server";

import { revalidatePath } from "next/cache";
import type { Priority, SponsoringStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, hasRole, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { createMedicalInfoDeclaration } from "@/lib/medical-info";
import { involveThirdParty } from "@/lib/third-party";
import { reopenInstance } from "@/lib/workflow/engine";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const PATH = "/sponsoring";

function isDirection(user: SessionUser): boolean {
  return hasGlobalView(user) || userCan(user, "SPONSORING", "VALIDATE");
}
/** Approbation préliminaire Ad & Pro : **réservée au National Sales** (la demande
 *  émane d'un délégué). Il approuve/refuse et désigne le chef de produit — la
 *  décision définitive reste à la Direction. Ni la Direction ni la Direction
 *  Marketing n'interviennent à l'étape préliminaire. */
function isDirectionMarketing(user: SessionUser): boolean {
  return hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN";
}

function revalidate(id: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

// ───────────────────────────── Création (→ pré-validation Direction) ─────────────────────────────

export async function createSponsoring(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "SPONSORING", "CREATE")) return { ok: false, error: "Non autorisé." };

  const institution = fdStr(formData, "institution");
  if (!institution) return { ok: false, error: "L'institution est obligatoire." };

  const year = new Date().getFullYear();
  const count = await prisma.sponsoringRequest.count({ where: { reference: { startsWith: `SPO-${year}-` } } });
  const reference = `SPO-${year}-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.sponsoringRequest.create({
    data: {
      reference,
      institution,
      doctor: fdStr(formData, "doctor"),
      specialty: fdStr(formData, "specialty"),
      city: fdStr(formData, "city"),
      type: fdStr(formData, "type") ?? "Sponsoring",
      description: fdStr(formData, "description"),
      comments: fdStr(formData, "comments"),
      amountRequested: fdNum(formData, "amountRequested"),
      amountProposed: fdNum(formData, "amountProposed"),
      product: fdStr(formData, "product"),
      strategicImportance: (fdStr(formData, "strategicImportance") as Priority) ?? "MEDIUM",
      status: "AWAITING_PRELIMINARY",
      requesterId: user.id,
      createdById: user.id,
    },
  });

  await recordAudit({ actorId: user.id, action: "CREATE", module: "Sponsoring", entityType: "SPONSORING", entityId: created.id, summary: `Demande ${reference} — ${institution}` });
  await notifyRoles(["NATIONAL_SALES", "SUPER_ADMIN"], {
    type: "SPONSORING_VALIDATION",
    title: "Sponsoring — à attribuer (National Sales)",
    body: `${reference} — ${institution}`,
    link: `${PATH}/${created.id}`,
  });

  revalidatePath(PATH);
  return { ok: true, id: created.id };
}

// ─────────────────── Attribution d'un chef de produit (Direction Marketing) ───────────────────

export async function sponsoringPreliminary(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isDirectionMarketing(user)) return { ok: false, error: "Attribution réservée à la Direction Marketing." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | REJECT
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };

  const req = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.status !== "AWAITING_PRELIMINARY") return { ok: false, error: "Cette demande n'est pas en attente de validation préliminaire." };

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await prisma.sponsoringRequest.update({
      where: { id },
      data: { status: "REFUSED", finalDecision: reason, preliminaryById: user.id, preliminaryAt: new Date(), validatedBy: user.name, validationDate: new Date(), updatedById: user.id },
    });
    if (req.requesterId) await notifyUser({ userId: req.requesterId, type: "SPONSORING_VALIDATION", title: "Sponsoring refusé", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Refus préliminaire — ${req.reference}` });
  } else {
    const productManagerId = fdStr(formData, "productManagerId");
    if (!productManagerId) return { ok: false, error: "Sélectionnez le chef de produit qui fera l'analyse." };
    await prisma.sponsoringRequest.update({
      where: { id },
      data: { status: "PRELIMINARY_APPROVED", productManagerId, preliminaryById: user.id, preliminaryAt: new Date(), preliminaryNote: fdStr(formData, "note"), updatedById: user.id },
    });
    await notifyUser({ userId: productManagerId, type: "ASSIGNMENT", title: "Sponsoring à analyser", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
    if (req.requesterId) await notifyUser({ userId: req.requesterId, type: "SPONSORING_VALIDATION", title: "Sponsoring validé (préliminaire)", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
    await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Validation préliminaire — ${req.reference}` });
  }
  revalidate(id);
  return { ok: true };
}

// ─────────────────── Implication d'une tierce personne (via son espace) ───────────────────

/**
 * Implique une tierce personne (ex. l'assistante de direction) dans le circuit
 * SANS lui donner accès au module : on crée une **demande de validation directe**
 * (cf. module « Demandes de validations ») qu'elle traite depuis SON espace.
 */
export async function requestThirdPartyInput(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const personId = fdStr(formData, "personId");
  if (!id || !personId) return { ok: false, error: "Indiquez la personne à impliquer." };
  const req = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const isActor = hasGlobalView(user) || isDirectionMarketing(user) || req.productManagerId === user.id || req.requesterId === user.id;
  if (!isActor) return { ok: false, error: "Non autorisé." };

  // Espace de la personne : demande de validation + dossier de suivi indiquant
  // l'événement (SANS budget). Elle traite sans accès au module Ad & Pro.
  const res = await involveThirdParty({
    actorId: user.id,
    personId,
    eventLabel: `Sponsoring ${req.reference} — ${req.institution}`,
    moduleLabel: "Ad & Pro",
    note: fdStr(formData, "note"),
  });
  if (!res.ok) return { ok: false, error: res.error };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Tierce personne impliquée — ${req.reference}` });
  revalidate(id);
  return { ok: true };
}

// ─────────────────── Analyse chef de produit (avis + budget proposé) — confidentiel ───────────────────

export async function sponsoringAnalysis(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const req = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.productManagerId !== user.id && !hasGlobalView(user)) return { ok: false, error: "Réservé au chef de produit assigné." };

  const isAppeal = req.status === "APPEAL_PENDING";
  if (req.status !== "PRELIMINARY_APPROVED" && !isAppeal) return { ok: false, error: "Cette demande n'est pas en phase d'analyse." };

  const notes = fdStr(formData, "productManagerNotes");
  if (!notes) return { ok: false, error: "Votre avis est obligatoire." };

  // En appel, l'avis est rendu SANS budget (la Direction tranchera).
  const budget = isAppeal ? null : fdNum(formData, "productManagerBudget");
  if (!isAppeal && budget === null) return { ok: false, error: "Le budget proposé est obligatoire." };

  await prisma.sponsoringRequest.update({
    where: { id },
    data: {
      status: isAppeal ? "AWAITING_FINAL_APPEAL" : "AWAITING_FINAL",
      productManagerNotes: notes,
      ...(isAppeal ? {} : { productManagerBudget: budget }),
      updatedById: user.id,
    },
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: isAppeal ? "Sponsoring — décision après appel" : "Sponsoring — validation définitive",
    body: `${req.reference} — analyse chef de produit ${isAppeal ? "(appel) " : ""}terminée`,
    link: `${PATH}/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Analyse chef de produit${isAppeal ? " (appel)" : ""} — ${req.reference}` });
  revalidate(id);
  return { ok: true };
}

// ─────────────────── Décision définitive (Direction : budget final + commentaire) ───────────────────

export async function sponsoringFinal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isDirection(user)) return { ok: false, error: "Validation réservée à la Direction." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | REJECT
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };

  const req = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.status !== "AWAITING_FINAL" && req.status !== "AWAITING_FINAL_APPEAL") {
    return { ok: false, error: "Cette demande n'est pas en attente de décision définitive." };
  }

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await prisma.sponsoringRequest.update({
      where: { id },
      data: { status: "REFUSED", finalDecision: reason, amountGranted: 0, finalById: user.id, finalAt: new Date(), validatedBy: user.name, validationDate: new Date(), updatedById: user.id },
    });
    if (req.requesterId) await notifyUser({ userId: req.requesterId, type: "SPONSORING_VALIDATION", title: "Sponsoring refusé (définitif)", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Refus définitif — ${req.reference}` });
    revalidate(id);
    return { ok: true };
  }

  const amountGranted = fdNum(formData, "amountGranted");
  if (amountGranted === null || amountGranted < 0) return { ok: false, error: "Le budget final accordé est obligatoire." };

  // (Sous-)catégorie budgétaire choisie par la Direction : la dépense sera imputée
  // à cette (sous-)catégorie au règlement (au lieu de l'attribution automatique).
  // Facultatif côté serveur, requis dans l'UI dès qu'il existe des (sous-)catégories.
  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  if (budgetCategoryId) {
    const okCat = await prisma.budgetCategoryLine.count({ where: { id: budgetCategoryId } });
    if (okCat === 0) return { ok: false, error: "La (sous-)catégorie budgétaire choisie est introuvable." };
  }

  // Validation définitive → étape « information médicale » (déclaration aux autorités
  // par le pharmacien responsable) AVANT l'émission de l'ordre de dépense au comptable.
  const decl = await createMedicalInfoDeclaration({
    sourceType: "SPONSORING",
    sourceId: id,
    label: `Sponsoring ${req.reference} — ${req.institution}`,
    beneficiary: req.institution,
    amount: amountGranted,
    requesterId: req.requesterId ?? user.id,
    budgetCategoryId,
  });

  await prisma.sponsoringRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      amountGranted,
      finalDecision: fdStr(formData, "note"),
      finalById: user.id, finalAt: new Date(),
      validatedBy: user.name, validationDate: new Date(),
      updatedById: user.id,
    },
  });
  if (req.requesterId) await notifyUser({ userId: req.requesterId, type: "SPONSORING_VALIDATION", title: "Sponsoring accordé", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Validation définitive — ${req.reference} (déclaration ${decl.reference})` });
  revalidate(id);
  revalidatePath("/information-medicale");
  return { ok: true };
}

// ───────────────────────────── Appel du délégué (→ nouvel avis chef de produit) ─────────────────────────────

export async function sponsoringAppeal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const req = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  // L'appel est ouvert au demandeur (délégué) une fois la décision rendue.
  if (req.requesterId !== user.id && !hasGlobalView(user)) return { ok: false, error: "Seul le demandeur peut faire appel." };
  if (req.status !== "APPROVED" && req.status !== "REFUSED") return { ok: false, error: "L'appel n'est possible qu'après la décision de la Direction." };

  const reason = fdStr(formData, "reason");
  if (!reason) return { ok: false, error: "Précisez le motif de votre appel." };

  await prisma.sponsoringRequest.update({
    where: { id },
    data: { status: "APPEAL_PENDING", appealById: user.id, appealAt: new Date(), appealReason: reason, appealCount: { increment: 1 }, updatedById: user.id },
  });
  // Ré-ouvre le circuit (moteur) à l'étape d'analyse pour rester cohérent avec le statut.
  await reopenInstance("SPONSORING", id);
  // Repart au chef de produit pour un nouvel avis (sans budget) ; la Direction est informée.
  if (req.productManagerId) await notifyUser({ userId: req.productManagerId, type: "ASSIGNMENT", title: "Sponsoring — appel à réexaminer", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "SPONSORING_VALIDATION", title: "Sponsoring — appel du délégué", body: `${req.reference} — ${req.institution}`, link: `${PATH}/${id}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Sponsoring", entityType: "SPONSORING", entityId: id, summary: `Appel du délégué — ${req.reference}` });
  revalidate(id);
  return { ok: true };
}
