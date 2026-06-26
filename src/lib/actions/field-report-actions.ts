"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { analyzeFieldReport } from "@/lib/ai";
import type { CurrentUser } from "@/lib/session";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

/** Un manager / la Direction voit tous les rapports ; un délégué les siens. */
function managesReports(user: CurrentUser): boolean {
  return hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER" || user.role === "PRODUCT_MANAGER";
}

async function canEdit(user: CurrentUser, reportId: string): Promise<boolean> {
  if (managesReports(user)) return userCan(user, "MEDICAL", "VIEW");
  const r = await prisma.fieldReport.findUnique({ where: { id: reportId }, select: { delegateId: true } });
  return Boolean(r && r.delegateId === user.id);
}

export async function createFieldReport(): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const created = await prisma.fieldReport.create({ data: { delegateId: user.id, status: "DRAFT" }, select: { id: true } });
  revalidatePath("/field-reports");
  return { ok: true, id: created.id };
}

export async function updateFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };

  await prisma.fieldReport.update({
    where: { id },
    data: {
      visitDate: fdDate(formData, "visitDate") ?? undefined,
      transcript: fdStr(formData, "transcript"),
      doctorId: fdStr(formData, "doctorId"),
      doctorName: fdStr(formData, "doctorName"),
      institution: fdStr(formData, "institution"),
      specialty: fdStr(formData, "specialty"),
      products: fdStr(formData, "products"),
      interest: fdStr(formData, "interest"),
      objection: fdStr(formData, "objection"),
      medicalQuestion: fdStr(formData, "medicalQuestion"),
      documentRequest: fdStr(formData, "documentRequest"),
      sponsoringRequest: fdStr(formData, "sponsoringRequest"),
      careRequest: fdStr(formData, "careRequest"),
      competitorInfo: fdStr(formData, "competitorInfo"),
      opportunity: fdStr(formData, "opportunity"),
      qualitySignal: fdStr(formData, "qualitySignal"),
      nextAction: fdStr(formData, "nextAction"),
      summary: fdStr(formData, "summary"),
    },
  });
  revalidatePath(`/field-reports/${id}`);
  return { ok: true };
}

/** Analyse la transcription en champs structurés (Claude). Ne valide jamais.
 *  Persiste les champs ET les renvoie pour mise à jour immédiate de l'éditeur. */
export async function analyzeFieldReportAction(
  formData: FormData,
): Promise<{ ok: boolean; configured: boolean; error?: string; data?: Record<string, string> }> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, configured: true, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, configured: true, error: "Non autorisé." };
  // Transcription depuis le formulaire (la plus à jour) ou, à défaut, la base.
  let transcript = fdStr(formData, "transcript");
  if (!transcript) {
    const report = await prisma.fieldReport.findUnique({ where: { id }, select: { transcript: true } });
    transcript = report?.transcript?.trim() ?? null;
  } else {
    await prisma.fieldReport.update({ where: { id }, data: { transcript } });
  }
  if (!transcript) return { ok: false, configured: true, error: "Aucune transcription à analyser." };

  const r = await analyzeFieldReport(transcript);
  if (!r.ok || !r.data) return { ok: false, configured: r.configured, error: r.error };

  const d = r.data;
  // Tente de rattacher le médecin par son nom (dans le périmètre, sans inventer).
  let doctorId: string | undefined;
  if (d.doctorName) {
    const match = await prisma.medicalDoctor.findFirst({
      where: { name: { contains: d.doctorName.replace(/^(pr\.?|dr\.?|professeur|docteur)\s+/i, "").trim(), mode: "insensitive" } },
      select: { id: true },
    });
    doctorId = match?.id ?? undefined;
  }

  await prisma.fieldReport.update({
    where: { id },
    data: {
      doctorId,
      doctorName: d.doctorName || null,
      institution: d.institution || null,
      specialty: d.specialty || null,
      products: d.products || null,
      interest: d.interest || null,
      objection: d.objection || null,
      medicalQuestion: d.medicalQuestion || null,
      documentRequest: d.documentRequest || null,
      sponsoringRequest: d.sponsoringRequest || null,
      careRequest: d.careRequest || null,
      competitorInfo: d.competitorInfo || null,
      opportunity: d.opportunity || null,
      qualitySignal: d.qualitySignal || null,
      nextAction: d.nextAction || null,
      summary: d.summary || null,
      aiNotes: d.aiNotes || null,
    },
  });
  revalidatePath(`/field-reports/${id}`);
  return {
    ok: true,
    configured: true,
    data: {
      doctorName: d.doctorName ?? "", institution: d.institution ?? "", specialty: d.specialty ?? "",
      products: d.products ?? "", interest: d.interest ?? "", objection: d.objection ?? "",
      medicalQuestion: d.medicalQuestion ?? "", documentRequest: d.documentRequest ?? "",
      sponsoringRequest: d.sponsoringRequest ?? "", careRequest: d.careRequest ?? "",
      competitorInfo: d.competitorInfo ?? "", opportunity: d.opportunity ?? "", qualitySignal: d.qualitySignal ?? "",
      nextAction: d.nextAction ?? "", summary: d.summary ?? "", aiNotes: d.aiNotes ?? "",
    },
  };
}

export async function validateFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReport.update({ where: { id }, data: { status: "VALIDATED", validatedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Rapports terrain", summary: "Rapport de visite validé" });
  revalidatePath(`/field-reports/${id}`);
  revalidatePath("/field-reports");
  return { ok: true };
}

export async function reopenFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReport.update({ where: { id }, data: { status: "DRAFT", validatedAt: null } });
  revalidatePath(`/field-reports/${id}`);
  return { ok: true };
}

export async function deleteFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  const atts = await prisma.fieldReportAttachment.findMany({ where: { reportId: id }, select: { blobId: true } });
  const report = await prisma.fieldReport.findUnique({ where: { id }, select: { audioBlobId: true } });
  await prisma.fieldReport.delete({ where: { id } });
  for (const a of atts) await releaseBlob(a.blobId);
  if (report?.audioBlobId) await releaseBlob(report.audioBlobId);
  revalidatePath("/field-reports");
  return { ok: true };
}

export async function deleteFieldReportAttachment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Pièce jointe introuvable." };
  const att = await prisma.fieldReportAttachment.findUnique({ where: { id }, select: { blobId: true, reportId: true } });
  if (!att) return { ok: false, error: "Pièce jointe introuvable." };
  if (!(await canEdit(user, att.reportId))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReportAttachment.delete({ where: { id } });
  await releaseBlob(att.blobId);
  revalidatePath(`/field-reports/${att.reportId}`);
  return { ok: true };
}
