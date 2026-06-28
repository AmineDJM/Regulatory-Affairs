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

/** IDs d'un nœud **et de tout son sous-arbre** (dossiers → enfants), pour cascader
 *  corbeille / restauration / suppression sur l'ensemble du dossier. */
async function collectSubtree(rootId: string): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let frontier = [rootId];
  while (frontier.length) {
    const batch = frontier.filter((id) => !seen.has(id));
    if (batch.length === 0) break;
    batch.forEach((id) => seen.add(id));
    ids.push(...batch);
    const children = await prisma.driveNode.findMany({ where: { parentId: { in: batch } }, select: { id: true } });
    frontier = children.map((c) => c.id);
  }
  return ids;
}

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
  // Cascade : un dossier mis à la corbeille y emmène tout son contenu.
  const ids = await collectSubtree(id);
  await prisma.driveNode.updateMany({ where: { id: { in: ids } }, data: { isTrashed: true } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, field: "isTrashed", newValue: "true", summary: ids.length > 1 ? `Mis à la corbeille (${ids.length} éléments)` : "Mis à la corbeille" });
  revalidatePath("/drive");
  return { ok: true };
}

export async function restoreNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  const node = await prisma.driveNode.findUnique({ where: { id }, select: { parentId: true } });
  // Restaure le dossier ET tout son sous-arbre.
  const ids = await collectSubtree(id);
  await prisma.driveNode.updateMany({ where: { id: { in: ids } }, data: { isTrashed: false } });
  // Si le parent est lui-même à la corbeille (ou supprimé), on restaure à la racine.
  if (node?.parentId) {
    const parent = await prisma.driveNode.findUnique({ where: { id: node.parentId }, select: { isTrashed: true } });
    if (!parent || parent.isTrashed) await prisma.driveNode.update({ where: { id }, data: { parentId: null } });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, field: "isTrashed", newValue: "false", summary: "Restauré" });
  revalidatePath("/drive");
  return { ok: true };
}

/** Permanent delete (file or folder, recursively) — releases all underlying blobs. */
export async function deleteNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;
  const node = await prisma.driveNode.findUnique({ where: { id }, select: { name: true } });
  if (!node) return { ok: false, error: "Élément introuvable." };
  // Récupère les blobs de TOUT le sous-arbre avant suppression (sinon blobs orphelins).
  const ids = await collectSubtree(id);
  const versions = await prisma.fileVersion.findMany({ where: { nodeId: { in: ids } }, select: { blobId: true } });
  await prisma.driveNode.delete({ where: { id } }); // cascade enfants + versions
  for (const v of versions) await releaseBlob(v.blobId);
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Drive", entityType: "DRIVE_NODE", entityId: id, summary: `Supprimé « ${node.name} »${ids.length > 1 ? ` (${ids.length} éléments)` : ""}` });
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
