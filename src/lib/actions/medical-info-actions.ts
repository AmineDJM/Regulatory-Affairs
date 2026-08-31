"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { MedicalInfoStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { getDeclaration, canViewDeclaration } from "@/lib/queries/medical-info";
import { archiveProcessedRequest } from "@/lib/archive";
import { formatAlgiers } from "@/lib/calendar-tz";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const PATH = "/information-medicale";

/** Le pharmacien responsable (ou la Direction / un admin) pilote la déclaration. */
function canManage(user: SessionUser): boolean {
  return hasGlobalView(user.role) || userCan(user, "MEDICAL_INFO", "VALIDATE");
}

function revalidate(id: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

/** Recalcule le statut READY / DOCS_REQUESTED / AWAITING_REVIEW selon l'état des pièces. */
async function refreshStatus(declarationId: string) {
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id: declarationId }, include: { requests: true } });
  if (!decl || decl.status === "VALIDATED") return;
  const reqs = decl.requests;
  const next: MedicalInfoStatus =
    reqs.length > 0 && reqs.every((r) => r.status === "FULFILLED") ? "READY"
    : reqs.length > 0 ? "DOCS_REQUESTED"
    : "AWAITING_REVIEW";
  if (next !== decl.status) await prisma.medicalInfoDeclaration.update({ where: { id: declarationId }, data: { status: next } });
}

// ───────────── Demande de pièce (pharmacien → Direction / comptable / délégué…) ─────────────

export async function requestDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const declarationId = fdStr(formData, "declarationId");
  const label = fdStr(formData, "label");
  const targetUserId = fdStr(formData, "targetUserId");
  if (!declarationId || !label) return { ok: false, error: "Précisez la pièce demandée." };
  if (!targetUserId) return { ok: false, error: "Sélectionnez la personne à qui demander la pièce." };

  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id: declarationId } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };

  await prisma.medicalInfoDocRequest.create({ data: { declarationId, label, targetUserId, requestedById: user.id } });
  if (decl.status === "AWAITING_REVIEW") {
    await prisma.medicalInfoDeclaration.update({ where: { id: declarationId }, data: { status: "DOCS_REQUESTED" } });
  }
  await notifyUser({ userId: targetUserId, type: "ASSIGNMENT", title: "Information médicale — pièce demandée", body: `${decl.reference} — ${label}`, link: `${PATH}/${declarationId}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: declarationId, summary: `Pièce demandée — ${label}` });
  revalidate(declarationId);
  return { ok: true };
}

export async function cancelDocRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const r = await prisma.medicalInfoDocRequest.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  if (r.status === "FULFILLED") return { ok: false, error: "Pièce déjà déposée — suppression impossible." };
  await prisma.medicalInfoDocRequest.delete({ where: { id } });
  await refreshStatus(r.declarationId);
  revalidate(r.declarationId);
  return { ok: true };
}

// ───────────── Dépôt de la pièce (par la personne sollicitée) ─────────────

export async function fulfillDocRequest(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande manquante." };
  const r = await prisma.medicalInfoDocRequest.findUnique({ where: { id: requestId }, include: { declaration: true } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  // Seule la personne sollicitée (ou un gestionnaire) peut déposer la pièce.
  if (r.targetUserId !== user.id && !canManage(user)) return { ok: false, error: "Cette pièce ne vous a pas été demandée." };
  if (r.status === "FULFILLED") return { ok: false, error: "Pièce déjà déposée." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Aucun fichier sélectionné." };
  const validationError = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (validationError) return { ok: false, error: validationError };

  const key = `MEDICAL_INFO_DECLARATION/${r.declarationId}/${randomUUID()}__${file.name}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(key, buffer);
  } catch (err) {
    console.error("[medical-info] storage write failed, recording metadata only", err);
  }
  const doc = await prisma.document.create({
    data: {
      name: file.name, category: "OTHER", entityType: "MEDICAL_INFO_DECLARATION", entityId: r.declarationId,
      fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
    },
  });
  await prisma.medicalInfoDocRequest.update({
    where: { id: requestId },
    data: { status: "FULFILLED", documentId: doc.id, note: fdStr(formData, "note"), fulfilledAt: new Date() },
  });
  await refreshStatus(r.declarationId);
  if (r.declaration.pharmacistId) {
    await notifyUser({ userId: r.declaration.pharmacistId, type: "DOCUMENT_UPLOADED", title: "Information médicale — pièce reçue", body: `${r.declaration.reference} — ${r.label}`, link: `${PATH}/${r.declarationId}` });
  } else {
    await notifyRoles(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], { type: "DOCUMENT_UPLOADED", title: "Information médicale — pièce reçue", body: `${r.declaration.reference} — ${r.label}`, link: `${PATH}/${r.declarationId}` });
  }
  await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: r.declarationId, summary: `Pièce déposée — ${r.label} (« ${file.name} »)` });
  revalidate(r.declarationId);
  return { ok: true };
}

// ───────────── Enregistrement de la déclaration aux autorités ─────────────

export async function recordAuthorityDeclaration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { authorityRef: fdStr(formData, "authorityRef"), authorityNotes: fdStr(formData, "authorityNotes") },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: "Déclaration aux autorités enregistrée" });
  revalidate(id);
  return { ok: true };
}

// ───────────── Validation pharmacien (PRIM) → transmission à la Direction ─────────────

/**
 * Le pharmacien responsable valide son instruction : la déclaration ne part PAS
 * directement au comptable mais à la Direction, qui donnera la validation finale
 * (pour le comptable). L'ordre de dépense n'est émis qu'à l'étape Direction.
 */
export async function validateDeclaration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Validation réservée au pharmacien responsable." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };
  if (decl.status === "AWAITING_DIRECTION") return { ok: false, error: "Déjà transmise à la Direction pour validation finale." };

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { status: "AWAITING_DIRECTION", pharmacistValidatedAt: new Date(), pharmacistValidatedById: user.id },
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Information médicale — validation finale requise (Direction)",
    body: `${decl.reference} — ${decl.label}`,
    link: `${PATH}/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: `Validation pharmacien — transmise à la Direction (${decl.reference})` });

  // Instruction du PRIM terminée → archive dans SON Drive (« Dossier traité / Information médicale »).
  if (!decl.archivedNodeId) {
    const docs = await prisma.document.findMany({
      where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: id },
      select: { name: true, fileKey: true, mimeType: true },
    });
    const lines = [
      `Déclaration d'information médicale — ${decl.reference}`,
      `Libellé : ${decl.label}`,
      decl.beneficiary ? `Bénéficiaire : ${decl.beneficiary}` : null,
      decl.authorityRef ? `Référence autorités : ${decl.authorityRef}` : null,
      decl.authorityNotes ? `Notes de déclaration : ${decl.authorityNotes}` : null,
      `Créée le : ${formatAlgiers(decl.createdAt, { day: "2-digit", month: "long", year: "numeric" })}`,
      `Validée par le pharmacien le : ${formatAlgiers(new Date(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      `Transmise à la Direction pour validation finale.`,
    ].filter(Boolean).join("\n");
    const day = new Date().toISOString().slice(0, 10);
    const nodeId = await archiveProcessedRequest({
      bureau: "Information médicale",
      folderName: `${day} — ${decl.reference} — ${decl.label}`,
      summary: lines,
      attachments: docs.map((d) => ({ name: d.name, fileKey: d.fileKey, mimeType: d.mimeType })),
      ownerId: user.id,
    });
    if (nodeId) {
      await prisma.medicalInfoDeclaration.update({ where: { id }, data: { archivedNodeId: nodeId } });
      revalidatePath("/drive");
    }
  }
  revalidate(id);
  return { ok: true };
}

// ───────────── Validation finale (Direction) → ordre de dépense au comptable ─────────────

/**
 * La Direction donne la validation finale « pour le comptable », avec un commentaire
 * facultatif (versé dans l'espace de discussion). C'est ICI qu'est émis l'ordre de
 * dépense, qui part alors au comptable.
 */
export async function validateDeclarationByDirection(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasGlobalView(user.role)) return { ok: false, error: "Validation finale réservée à la Direction." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };
  if (decl.status !== "AWAITING_DIRECTION") return { ok: false, error: "La déclaration doit d'abord être validée par le pharmacien responsable." };

  // Commentaire de validation (facultatif) → espace de discussion.
  const comment = fdStr(formData, "comment");
  if (comment) {
    await prisma.comment.create({ data: { entityType: "MEDICAL_INFO_DECLARATION", entityId: id, body: comment, authorId: user.id } });
  }

  // Émission de l'ordre de dépense (si un budget a été accordé) → part au comptable.
  const amount = Number(decl.amount ?? 0);
  const order = amount > 0
    ? await createExpenseOrder({
        label: decl.label,
        amount,
        category: "EVENEMENT",
        beneficiary: decl.beneficiary,
        sourceType: decl.sourceType,
        sourceId: decl.sourceId,
        requestedById: decl.requesterId,
        budgetCategoryId: decl.budgetCategoryId,
      })
    : null;

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { status: "VALIDATED", validatedAt: new Date(), validatedById: user.id, expenseOrderId: order?.id ?? null },
  });
  // Reporte l'ordre de dépense sur l'événement source (tout reste interconnecté).
  if (order) {
    if (decl.sourceType === "SPONSORING") await prisma.sponsoringRequest.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
    else if (decl.sourceType === "CONGRESS_INTERNATIONAL") await prisma.congressInternational.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
    else if (decl.sourceType === "CONGRESS_NATIONAL") await prisma.congressNational.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
  }
  if (decl.requesterId) await notifyUser({ userId: decl.requesterId, type: "GENERIC", title: "Information médicale — événement validé par la Direction", body: `${decl.reference} — ${decl.label}`, link: `${PATH}/${id}` });
  if (decl.pharmacistId && decl.pharmacistId !== user.id) await notifyUser({ userId: decl.pharmacistId, type: "GENERIC", title: "Information médicale — validé par la Direction", body: `${decl.reference} — ${decl.label}`, link: `${PATH}/${id}` });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: `Validation Direction — ${decl.reference}${order ? ` (ordre ${order.reference})` : ""}` });
  revalidate(id);
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/comptabilite");
  return { ok: true };
}

// ───────────── Espace de discussion (parties prenantes) ─────────────

/** Ajoute un commentaire à la déclaration (toute personne pouvant la consulter). */
export async function addMedicalInfoComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const declarationId = fdStr(formData, "declarationId");
  const body = fdStr(formData, "body");
  if (!declarationId || !body) return { ok: false, error: "Commentaire vide." };
  const decl = await getDeclaration(declarationId);
  if (!decl || !canViewDeclaration(user, decl)) return { ok: false, error: "Action non autorisée." };
  await prisma.comment.create({ data: { entityType: "MEDICAL_INFO_DECLARATION", entityId: declarationId, body, authorId: user.id } });
  revalidate(declarationId);
  return { ok: true };
}
