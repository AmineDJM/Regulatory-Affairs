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
  const validationError = validateUpload(file.name, file.size);
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

// ───────────── Validation finale (pharmacien) → ordre de dépense au comptable ─────────────

export async function validateDeclaration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Validation réservée au pharmacien responsable." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };

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
  if (decl.requesterId) await notifyUser({ userId: decl.requesterId, type: "GENERIC", title: "Information médicale — événement déclaré et validé", body: `${decl.reference} — ${decl.label}`, link: `${PATH}/${id}` });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: `Validation pharmacien — ${decl.reference}${order ? ` (ordre ${order.reference})` : ""}` });
  revalidate(id);
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/comptabilite");
  return { ok: true };
}
