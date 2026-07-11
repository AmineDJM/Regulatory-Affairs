"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type RegProcedureType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "./access";
import { regAudit } from "./audit";
import { PROCEDURE_TYPE_LABELS } from "./labels";

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
