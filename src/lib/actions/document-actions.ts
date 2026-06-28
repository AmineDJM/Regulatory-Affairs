"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Confidentiality, DocumentCategory, EntityType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canAccessEntity, ENTITY_MODULE } from "@/lib/entity-access";
import { saveFile, validateUpload, deleteFileByKey } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { ENTITY_TYPE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function uploadDocument(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const entityType = formData.get("entityType") as EntityType;
  const entityId = String(formData.get("entityId") ?? "");
  const category = (formData.get("category") as DocumentCategory) || "OTHER";
  const confidentiality = (formData.get("confidentiality") as Confidentiality) || "INTERNAL";
  const path = String(formData.get("path") ?? "");
  const file = formData.get("file") as File | null;

  if (!entityType || !entityId) return { ok: false, error: "Entité manquante." };
  if (!(await canAccessEntity(user, entityType, entityId, "UPLOAD"))) {
    return { ok: false, error: "Vous n'êtes pas autorisé à téléverser ici." };
  }
  if (!file || file.size === 0) return { ok: false, error: "Aucun fichier sélectionné." };

  const validationError = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (validationError) return { ok: false, error: validationError };

  const key = `${entityType}/${entityId}/${randomUUID()}__${file.name}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(key, buffer);
  } catch (err) {
    // On read-only/unconfigured storage we still record metadata so the
    // document library stays consistent; the binary can be re-attached later.
    console.error("[upload] storage write failed, recording metadata only", err);
  }

  // Versioning: increment based on existing docs with the same name + entity.
  const previous = await prisma.document.count({
    where: { entityType, entityId, name: file.name },
  });

  const doc = await prisma.document.create({
    data: {
      name: file.name,
      category,
      entityType,
      entityId,
      fileKey: key,
      mimeType: file.type || null,
      sizeBytes: file.size,
      version: previous + 1,
      confidentiality,
      uploadedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPLOAD",
    module: ENTITY_TYPE_LABELS[entityType] ?? ENTITY_MODULE[entityType],
    entityType,
    entityId,
    summary: `Document « ${file.name} » téléversé`,
  });

  if (path) revalidatePath(path);
  return { ok: true };
}

export async function deleteDocument(id: string, path?: string): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Document introuvable." };

  if (!(await canAccessEntity(user, doc.entityType, doc.entityId, "DELETE"))) {
    return { ok: false, error: "Suppression non autorisée." };
  }

  await prisma.document.delete({ where: { id } });
  if (doc.fileKey) await deleteFileByKey(doc.fileKey);

  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    module: ENTITY_TYPE_LABELS[doc.entityType] ?? ENTITY_MODULE[doc.entityType],
    entityType: doc.entityType,
    entityId: doc.entityId,
    summary: `Document « ${doc.name} » supprimé`,
  });

  if (path) revalidatePath(path);
  return { ok: true };
}
