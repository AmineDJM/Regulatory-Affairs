"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { regAudit } from "../audit";
import { draftSupplierEmail } from "./draft";

/**
 * Boucle fournisseur (G8). L'IA ne crée qu'un BROUILLON ; l'envoi et l'approbation sont
 * HUMAINS. regulatory.workspace.manage (ou dossier.upload). Org-scopé.
 */

interface Result { ok: boolean; error?: string }
const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

async function guard(): Promise<{ ok: true; userId: string; companyId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.workspace.manage") && !regCan(user, "regulatory.dossier.upload") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé." };
  return { ok: true, userId: user.id, companyId };
}

async function ownsDossier(companyId: string, dossierId: string): Promise<boolean> {
  return !!(await prisma.regulatoryDossier.findFirst({ where: { id: dossierId, companyId }, select: { id: true } }));
}
async function requestDossierId(companyId: string, requestId: string): Promise<string | null> {
  const r = await prisma.regulatorySupplierRequest.findFirst({ where: { id: requestId, dossier: { companyId } }, select: { dossierId: true } });
  return r?.dossierId ?? null;
}
const revalidate = (dossierId: string) => revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);

export async function createSupplierRequest(formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const dossierId = str(formData, "dossierId");
  const subject = str(formData, "subject");
  if (!dossierId || !subject) return { ok: false, error: "Objet manquant." };
  if (!(await ownsDossier(g.companyId, dossierId))) return { ok: false, error: "Dossier introuvable." };

  const supplierName = str(formData, "supplierName");
  const supplierEmail = str(formData, "supplierEmail");
  const deadlineStr = str(formData, "deadline");
  const deadline = deadlineStr ? new Date(deadlineStr) : null;
  const questions = (str(formData, "questions") ?? "").split("\n").map((q) => q.trim()).filter(Boolean);

  const dossier = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { reference: true, title: true } });
  const { draft, aiUsed } = await draftSupplierEmail({
    productName: dossier?.title ?? null, dossierRef: dossier?.reference ?? dossierId, supplierName, questions, deadline: deadline && !isNaN(deadline.getTime()) ? deadline : null,
  });

  const req = await prisma.regulatorySupplierRequest.create({
    data: {
      dossierId, subject, supplierName, supplierEmail, emailDraft: draft, deadline: deadline && !isNaN(deadline.getTime()) ? deadline : null,
      createdById: g.userId, questions: { createMany: { data: questions.map((q, i) => ({ ordinal: i + 1, question: q })) } },
    },
    select: { id: true },
  });
  await regAudit({ companyId: g.companyId, actorId: g.userId, dossierId, action: "SUPPLIER_REQUEST_CREATED", detail: `Demande fournisseur « ${subject} » (${questions.length} question·s, brouillon ${aiUsed ? "IA" : "modèle"}).` });
  revalidate(dossierId);
  void req;
  return { ok: true };
}

export async function regenerateSupplierDraft(formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const requestId = str(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande manquante." };
  const dossierId = await requestDossierId(g.companyId, requestId);
  if (!dossierId) return { ok: false, error: "Demande introuvable." };

  const req = await prisma.regulatorySupplierRequest.findUnique({
    where: { id: requestId }, select: { supplierName: true, deadline: true, dossier: { select: { reference: true, title: true } }, questions: { orderBy: { ordinal: "asc" }, select: { question: true } } },
  });
  const { draft } = await draftSupplierEmail({ productName: req!.dossier.title, dossierRef: req!.dossier.reference, supplierName: req!.supplierName, deadline: req!.deadline, questions: req!.questions.map((q) => q.question) });
  await prisma.regulatorySupplierRequest.update({ where: { id: requestId }, data: { emailDraft: draft } });
  revalidate(dossierId);
  return { ok: true };
}

export async function setSupplierStatus(formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const requestId = str(formData, "requestId");
  const status = str(formData, "status"); // SENT | RESPONDED | CLOSED
  if (!requestId || !status || !["SENT", "RESPONDED", "CLOSED"].includes(status)) return { ok: false, error: "Paramètres invalides." };
  const dossierId = await requestDossierId(g.companyId, requestId);
  if (!dossierId) return { ok: false, error: "Demande introuvable." };

  const now = new Date();
  await prisma.regulatorySupplierRequest.update({
    where: { id: requestId },
    data: {
      status: status as "SENT" | "RESPONDED" | "CLOSED",
      sentAt: status === "SENT" ? now : undefined,
      respondedAt: status === "RESPONDED" ? now : undefined,
      responseNote: status === "RESPONDED" ? (str(formData, "responseNote") ?? undefined) : undefined,
    },
  });
  await regAudit({ companyId: g.companyId, actorId: g.userId, dossierId, action: `SUPPLIER_${status}`, detail: `Demande fournisseur → ${status}${status === "SENT" ? " (envoi humain)" : ""}.` });
  revalidate(dossierId);
  return { ok: true };
}

export async function remindSupplier(formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const requestId = str(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande manquante." };
  const dossierId = await requestDossierId(g.companyId, requestId);
  if (!dossierId) return { ok: false, error: "Demande introuvable." };
  await prisma.regulatorySupplierRequest.update({ where: { id: requestId }, data: { remindedAt: new Date() } });
  await regAudit({ companyId: g.companyId, actorId: g.userId, dossierId, action: "SUPPLIER_REMINDED", detail: "Relance fournisseur enregistrée." });
  revalidate(dossierId);
  return { ok: true };
}

export async function deleteSupplierRequest(formData: FormData): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const requestId = str(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande manquante." };
  const dossierId = await requestDossierId(g.companyId, requestId);
  if (!dossierId) return { ok: false, error: "Demande introuvable." };
  await prisma.regulatorySupplierRequest.delete({ where: { id: requestId } });
  revalidate(dossierId);
  return { ok: true };
}
