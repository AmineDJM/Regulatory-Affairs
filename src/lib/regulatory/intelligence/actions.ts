"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type RegProcedureType, type RegFindingSeverity, type RegFindingStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "./access";
import { regAudit } from "./audit";
import { submissionReadiness } from "./lifecycle";
import { PROCEDURE_TYPE_LABELS } from "./labels";

const FINDING_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "WAIVED"] as const;
const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "INFO"] as const;
const revalidateDossier = (id: string) => revalidatePath(`/regulatory/enregistrement/analyse/${id}`);

/**
 * Actions serveur du Regulatory Intelligence OS. Toutes vérifient : rôle (regCan, rôle
 * principal ET secondaire), organisation activée (feature flag par entité), isolation
 * multi-locataire (companyId), et journalisent (audit). L'upload du ZIP passe par une
 * route en flux (voir /api/regulatory/intelligence/upload) — pas par une action.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return v ? String(v).trim() : null;
};

const isProcedureType = (v: string): v is RegProcedureType => v in PROCEDURE_TYPE_LABELS;

/** Résout l'organisation cible activée pour la portée courante (ou null → module verrouillé). */
async function targetCompanyId(): Promise<string | null> {
  return resolveRegCompanyId(getCompanyScope());
}

export async function createDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.create")) return { ok: false, error: "Création non autorisée." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Sélectionnez d'abord l'entité pour laquelle le module est activé." };

  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Le titre du dossier est obligatoire." };

  const procRaw = str(formData, "procedureType") ?? "INITIAL_REGISTRATION";
  const procedureType: RegProcedureType = isProcedureType(procRaw) ? procRaw : "INITIAL_REGISTRATION";

  const productId = str(formData, "productId");
  const reference =
    str(formData, "reference") || `REG-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const created = await prisma.regulatoryDossier.create({
      data: { companyId, reference, title, procedureType, productId: productId || null, createdById: user.id },
      select: { id: true },
    });
    await regAudit({
      companyId, actorId: user.id, dossierId: created.id, action: "DOSSIER_CREATED",
      detail: `Dossier « ${title} » (${reference}) créé — ${PROCEDURE_TYPE_LABELS[procedureType]}.`,
      meta: { reference, procedureType },
    });
    revalidatePath("/regulatory/enregistrement/analyse");
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Cette référence de dossier existe déjà — choisissez-en une autre." };
    }
    console.error("[reg-intelligence] createDossier", err);
    return { ok: false, error: "Échec de la création du dossier." };
  }
}

/**
 * Suppression d'un dossier (créateur, gestionnaire de workspace, admin réglementaire ou
 * Super Admin). La cascade FK purge versions → documents → jobs → audit ; on **libère les
 * blobs** AVANT (les blobs sont adressés par SHA-256, hors cascade) pour ne pas fuir de
 * stockage.
 */
export async function deleteDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const dossierId = str(formData, "dossierId");
  if (!dossierId) return { ok: false, error: "Dossier manquant." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };

  const dossier = await prisma.regulatoryDossier.findFirst({
    where: { id: dossierId, companyId },
    select: { id: true, reference: true, createdById: true },
  });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const allowed =
    user.role === "SUPER_ADMIN" ||
    regCan(user, "regulatory.admin") ||
    regCan(user, "regulatory.workspace.manage") ||
    dossier.createdById === user.id;
  if (!allowed) return { ok: false, error: "Suppression non autorisée." };

  // Collecte des blobs (archives originales + copies de travail) avant la cascade.
  const [versions, docs] = await Promise.all([
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId }, select: { originalZipBlobId: true } }),
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } }, select: { blobId: true } }),
  ]);
  const blobIds = new Set(
    [...versions.map((v) => v.originalZipBlobId), ...docs.map((d) => d.blobId)].filter((x): x is string => !!x),
  );

  await prisma.regulatoryDossier.delete({ where: { id: dossierId } }); // cascade
  for (const id of blobIds) await releaseBlob(id).catch(() => undefined);

  await regAudit({
    companyId, actorId: user.id, action: "DOSSIER_DELETED",
    detail: `Dossier « ${dossier.reference} » supprimé (${blobIds.size} blob(s) libéré(s)).`,
  });
  revalidatePath("/regulatory/enregistrement/analyse");
  return { ok: true };
}

/**
 * Déblocage / verrouillage du Regulatory Intelligence OS PAR ORGANISATION.
 * **Super Admin uniquement.** Masqué par défaut ; ce flag conditionne tout le workspace.
 */
export async function setRegIntelligenceEnabled(companyId: string, enabled: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  if (!companyId) return { ok: false, error: "Organisation manquante." };

  await prisma.regulatoryFeatureAccess.upsert({
    where: { companyId },
    create: { companyId, enabled, updatedById: user.id },
    update: { enabled, updatedById: user.id },
  });
  await regAudit({
    companyId, actorId: user.id, action: enabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
    detail: `Regulatory Intelligence OS ${enabled ? "activé" : "désactivé"} pour l'organisation.`,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/regulatory/enregistrement/analyse");
  return { ok: true };
}

// ───────────────────────── Constats : revue humaine ─────────────────────────

/** Change le statut d'un constat. Lever un bloqueur (WAIVED) = rôle d'approbation + justification. */
export async function updateFindingStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const findingId = str(formData, "findingId");
  const status = str(formData, "status") as RegFindingStatus | null;
  const note = str(formData, "note");
  if (!findingId || !status || !FINDING_STATUSES.includes(status)) return { ok: false, error: "Paramètres invalides." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };

  const finding = await prisma.regulatoryFinding.findFirst({
    where: { id: findingId, dossierVersion: { dossier: { companyId } } },
    select: { id: true, title: true, blocker: true, source: true, draft: true, dossierVersion: { select: { dossierId: true } } },
  });
  if (!finding) return { ok: false, error: "Constat introuvable." };

  if (status === "WAIVED") {
    if (!regCan(user, "regulatory.finding.approve")) return { ok: false, error: "La levée d'un constat requiert un rôle d'approbation." };
    if (finding.blocker && !note) return { ok: false, error: "Une justification est obligatoire pour lever un bloqueur." };
  } else if (!regCan(user, "regulatory.finding.edit")) {
    return { ok: false, error: "Modification non autorisée." };
  }

  await prisma.regulatoryFinding.update({
    where: { id: findingId },
    data: {
      status, resolutionNote: note ?? null, reviewedById: user.id, reviewedAt: new Date(),
      draft: finding.source === "AI" ? false : finding.draft, // une revue humaine lève le statut DRAFT de l'IA
    },
  });
  await regAudit({
    companyId, actorId: user.id, dossierId: finding.dossierVersion.dossierId,
    action: `FINDING_${status}`, detail: `Constat « ${finding.title} » → ${status}${note ? ` — ${note}` : ""}.`,
  });
  revalidateDossier(finding.dossierVersion.dossierId);
  return { ok: true };
}

/** Ajout d'un constat manuel (humain) sur la dernière version. Jamais bloquant. */
export async function addHumanFinding(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.finding.edit")) return { ok: false, error: "Non autorisé." };
  const dossierId = str(formData, "dossierId");
  const title = str(formData, "title");
  const detail = str(formData, "detail");
  const sevRaw = (str(formData, "severity") ?? "MAJOR") as RegFindingSeverity;
  if (!dossierId || !title) return { ok: false, error: "Le titre est obligatoire." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, error: "Aucune version à annoter." };

  const severity: RegFindingSeverity = SEVERITIES.includes(sevRaw) ? sevRaw : "MAJOR";
  await prisma.regulatoryFinding.create({
    data: {
      dossierVersionId: version.id, code: "HUMAN_NOTE", severity, category: "content",
      title, detail: detail || title, source: "HUMAN", draft: false, blocker: false, createdById: user.id,
    },
  });
  await regAudit({ companyId, actorId: user.id, dossierId, action: "FINDING_ADDED", detail: `Constat manuel ajouté : « ${title} ».` });
  revalidateDossier(dossierId);
  return { ok: true };
}

/** Approuve le nom de fichier proposé (renommage définitif de la copie de travail). */
export async function approveDocumentName(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.document.approve")) return { ok: false, error: "Non autorisé." };
  const documentId = str(formData, "documentId");
  if (!documentId) return { ok: false, error: "Document manquant." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const doc = await prisma.regulatoryDocument.findFirst({
    where: { id: documentId, dossierVersion: { dossier: { companyId } } },
    select: { id: true, suggestedFilename: true, dossierVersion: { select: { dossierId: true } } },
  });
  if (!doc?.suggestedFilename) return { ok: false, error: "Aucun nom proposé pour ce document." };

  await prisma.regulatoryDocument.update({ where: { id: documentId }, data: { approvedFilename: doc.suggestedFilename } });
  await regAudit({ companyId, actorId: user.id, dossierId: doc.dossierVersion.dossierId, action: "DOC_NAME_APPROVED", detail: `Nom approuvé : « ${doc.suggestedFilename} ».` });
  revalidateDossier(doc.dossierVersion.dossierId);
  return { ok: true };
}

/** Relance les contrôles déterministes (et l'IA si configurée) sur la dernière version. */
export async function reanalyseDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse")) return { ok: false, error: "Non autorisé." };
  const dossierId = str(formData, "dossierId");
  if (!dossierId) return { ok: false, error: "Dossier manquant." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, error: "Aucune version à analyser." };

  await prisma.regulatoryJob.create({ data: { companyId, dossierId, dossierVersionId: version.id, type: "RULES", status: "QUEUED", payload: {} } });
  await regAudit({ companyId, actorId: user.id, dossierId, action: "REANALYSE", detail: "Relance des contrôles réglementaires." });
  revalidateDossier(dossierId);
  return { ok: true };
}

/**
 * PORTE DE SOUMISSION : passe le dossier à « prêt pour revue » (submission.prepare) ou
 * « soumis » (submission.approve). Refuse tant qu'un bloqueur n'est pas levé.
 */
export async function submitDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const dossierId = str(formData, "dossierId");
  const target = str(formData, "target"); // "READY_FOR_REVIEW" | "SUBMITTED"
  if (!dossierId || !target) return { ok: false, error: "Paramètres manquants." };

  const companyId = await targetCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: dossierId, companyId }, select: { id: true, reference: true } });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const isSubmit = target === "SUBMITTED";
  if (!regCan(user, isSubmit ? "regulatory.submission.approve" : "regulatory.submission.prepare")) {
    return { ok: false, error: "Autorisation insuffisante." };
  }

  const readiness = await submissionReadiness(dossierId);
  if (!readiness.hasVersion) return { ok: false, error: "Aucune version ingérée." };
  if (readiness.openBlockers.length > 0) {
    return { ok: false, error: `Soumission bloquée : ${readiness.openBlockers.length} bloqueur(s) non levé(s). Résolvez-les ou levez-les avec justification.` };
  }

  await prisma.regulatoryDossier.update({ where: { id: dossierId }, data: { status: isSubmit ? "SUBMITTED" : "READY_FOR_REVIEW" } });
  await regAudit({
    companyId, actorId: user.id, dossierId, action: isSubmit ? "SUBMITTED" : "READY_FOR_REVIEW",
    detail: `Dossier « ${dossier.reference} » → ${isSubmit ? "soumis (ANPP)" : "prêt pour revue finale"}${readiness.clearedBlockers > 0 ? ` (${readiness.clearedBlockers} bloqueur·s levé·s)` : ""}.`,
  });
  revalidateDossier(dossierId);
  return { ok: true };
}
