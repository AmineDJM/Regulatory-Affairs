"use server";

import { revalidatePath } from "next/cache";
import type { DriveAccess } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { resolveDriveAccess } from "@/lib/drive";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

export async function createFolder(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "DRIVE", "CREATE")) return DENIED;
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Nom du dossier requis." };
  const parentId = fdStr(formData, "parentId");
  if (parentId && (await resolveDriveAccess(user, parentId)) !== "EDIT") return DENIED;

  const node = await prisma.driveNode.create({
    data: { name, type: "FOLDER", parentId: parentId ?? null, ownerId: user.id, createdById: user.id },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id, summary: `Dossier « ${name} »` });
  revalidatePath("/drive");
  return { ok: true, id: node.id };
}

export async function renameNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  await prisma.driveNode.update({ where: { id }, data: { name } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, field: "name", newValue: name, summary: `Renommé en « ${name} »` });
  revalidatePath("/drive");
  revalidatePath(`/drive/${id}`);
  return { ok: true };
}

export async function moveNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const targetId = fdStr(formData, "targetId"); // null/"" → racine
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  if (targetId) {
    if ((await resolveDriveAccess(user, targetId)) !== "EDIT") return DENIED;
    // empêcher de déplacer un dossier dans lui-même ou un descendant
    let cur: string | null = targetId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (cur === id) return { ok: false, error: "Déplacement invalide (dans son propre sous-dossier)." };
      seen.add(cur);
      const n: { parentId: string | null } | null = await prisma.driveNode.findUnique({ where: { id: cur }, select: { parentId: true } });
      cur = n?.parentId ?? null;
    }
  }
  await prisma.driveNode.update({ where: { id }, data: { parentId: targetId ?? null } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, summary: "Déplacé" });
  revalidatePath("/drive");
  return { ok: true };
}

export async function trashNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  await prisma.driveNode.update({ where: { id }, data: { isTrashed: true } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, field: "isTrashed", newValue: "true", summary: "Mis à la corbeille" });
  revalidatePath("/drive");
  return { ok: true };
}

export async function restoreNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  await prisma.driveNode.update({ where: { id }, data: { isTrashed: false } });
  revalidatePath("/drive");
  return { ok: true };
}

/** Permanent delete (file, or empty folder) — releases the underlying blobs. */
export async function deleteNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  const node = await prisma.driveNode.findUnique({
    where: { id },
    select: { type: true, name: true, _count: { select: { children: true } }, versions: { select: { blobId: true } } },
  });
  if (!node) return { ok: false, error: "Élément introuvable." };
  if (node.type === "FOLDER" && node._count.children > 0) {
    return { ok: false, error: "Videz le dossier avant de le supprimer définitivement." };
  }
  const blobIds = node.versions.map((v) => v.blobId);
  await prisma.driveNode.delete({ where: { id } }); // cascade les versions
  for (const b of blobIds) await releaseBlob(b);
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, summary: `Supprimé « ${node.name} »` });
  revalidatePath("/drive");
  return { ok: true };
}

export async function shareNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const nodeId = fdStr(formData, "nodeId");
  const userId = fdStr(formData, "userId");
  const access = (fdStr(formData, "access") as DriveAccess) ?? "VIEW";
  if (!nodeId || !userId) return { ok: false, error: "Paramètres manquants." };
  if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") return DENIED;

  await prisma.driveShare.upsert({
    where: { nodeId_userId: { nodeId, userId } },
    create: { nodeId, userId, access },
    update: { access },
  });
  const node = await prisma.driveNode.findUnique({ where: { id: nodeId }, select: { name: true } });
  await notifyUser({ userId, type: "DOCUMENT_UPLOADED", title: "Fichier partagé avec vous", body: node?.name ?? "Un élément du Drive", link: `/drive/${nodeId}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: nodeId, summary: `Partagé (${access})` });
  revalidatePath(`/drive/${nodeId}`);
  revalidatePath("/drive");
  return { ok: true };
}

export async function unshareNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const nodeId = fdStr(formData, "nodeId");
  const userId = fdStr(formData, "userId");
  if (!nodeId || !userId) return { ok: false, error: "Paramètres manquants." };
  if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") return DENIED;
  await prisma.driveShare.deleteMany({ where: { nodeId, userId } });
  revalidatePath(`/drive/${nodeId}`);
  return { ok: true };
}
