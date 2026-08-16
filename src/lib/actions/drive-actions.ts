"use server";

import { revalidatePath } from "next/cache";
import type { DriveAccess } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, effectiveSpaceId, canCreateInSpace } from "@/lib/drive";
import { blankOffice, isOfficeKind } from "@/lib/office-templates";
import { convertConfigured, convertDocument } from "@/lib/office-convert";
import { makeEditToken, appBaseUrl, onlyofficeEditable, fileExt } from "@/lib/onlyoffice";
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
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Nom du dossier requis." };
  const parentId = fdStr(formData, "parentId");
  const spaceId = fdStr(formData, "spaceId");
  // Un accès ÉDITEUR sur le dossier parent (partage/catégorie) suffit à y créer un sous-dossier,
  // même sans le droit module « Créer ». À la racine d'une CATÉGORIE : gestionnaire requis.
  // À la racine PERSONNELLE : droit module « Créer ».
  if (parentId) {
    if ((await resolveDriveAccess(user, parentId)) !== "EDIT") return DENIED;
  } else if (spaceId) {
    if (!(await canCreateInSpace(user, spaceId))) return DENIED;
  } else if (!userCan(user, "DRIVE", "CREATE")) {
    return DENIED;
  }
  const effSpaceId = await effectiveSpaceId(parentId || null, spaceId || null);

  const node = await prisma.driveNode.create({
    data: { name, type: "FOLDER", parentId: parentId || null, spaceId: effSpaceId, ownerId: user.id, createdById: user.id },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id, summary: `Dossier « ${name} »` });
  revalidatePath("/drive");
  if (effSpaceId) revalidatePath(`/drive/espace/${effSpaceId}`);
  return { ok: true, id: node.id };
}

/**
 * Import de DOSSIER (façon Google Drive) : recrée l'arborescence exacte à partir des chemins
 * relatifs des fichiers (`webkitRelativePath`). Pour chaque chemin de dossier, crée les niveaux
 * manquants sous `parentId` en RÉUTILISANT un dossier existant du même nom (pas de doublon), et
 * renvoie la carte `chemin relatif → id du dossier` pour y téléverser ensuite chaque fichier.
 */
export async function ensureDriveFolders(
  parentId: string | null,
  paths: string[],
  spaceId: string | null = null,
): Promise<{ ok: boolean; error?: string; map?: Record<string, string> }> {
  const user = await requireUser();
  // Éditeur sur le dossier de destination (partage/catégorie) suffit ; racine d'une catégorie →
  // gestionnaire ; racine personnelle → droit module « Créer ».
  if (parentId) {
    if ((await resolveDriveAccess(user, parentId)) !== "EDIT") return { ok: false, error: "Dossier de destination non autorisé." };
  } else if (spaceId) {
    if (!(await canCreateInSpace(user, spaceId))) return { ok: false, error: "Catégorie non autorisée." };
  } else if (!userCan(user, "DRIVE", "CREATE")) {
    return { ok: false, error: "Non autorisé." };
  }
  // Tout l'arbre importé atterrit dans une même catégorie (ou le Drive personnel).
  const baseSpace = await effectiveSpaceId(parentId || null, spaceId || null);

  const map: Record<string, string> = {};
  for (const raw of paths) {
    const segments = raw.split("/").map((s) => s.trim()).filter(Boolean);
    let curParent = parentId;
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (map[acc]) { curParent = map[acc]; continue; }
      const existing = await prisma.driveNode.findFirst({
        where: { parentId: curParent, name: seg, type: "FOLDER", isTrashed: false, spaceId: baseSpace },
        select: { id: true },
      });
      const id = existing
        ? existing.id
        : (await prisma.driveNode.create({
            data: { name: seg.slice(0, 200), type: "FOLDER", parentId: curParent ?? null, spaceId: baseSpace, ownerId: user.id, createdById: user.id },
            select: { id: true },
          })).id;
      map[acc] = id;
      curParent = id;
    }
  }
  revalidatePath("/drive");
  if (baseSpace) revalidatePath(`/drive/espace/${baseSpace}`);
  return { ok: true, map };
}

/** Partages actuels d'un nœud (dossier OU fichier) pour le panneau « Gérer l'accès ». */
export async function getDriveNodeShares(
  nodeId: string,
): Promise<{ ok: boolean; error?: string; canEdit?: boolean; shares?: { userId: string; name: string; access: string }[] }> {
  const user = await requireUser();
  const level = await resolveDriveAccess(user, nodeId);
  if (level === "NONE") return { ok: false, error: "Non autorisé." };
  const node = await prisma.driveNode.findUnique({
    where: { id: nodeId },
    select: { shares: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!node) return { ok: false, error: "Introuvable." };
  return {
    ok: true,
    canEdit: level === "EDIT",
    shares: node.shares.map((s) => ({ userId: s.userId, name: s.user?.name ?? "—", access: s.access })),
  };
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
  const contextSpaceId = fdStr(formData, "spaceId") || null; // catégorie courante (racine)
  if (!id) return { ok: false, error: "Élément introuvable." };
  if ((await resolveDriveAccess(user, id)) !== "EDIT") return DENIED;

  // Catégorie de DESTINATION : celle du dossier cible, ou la catégorie courante à la racine.
  let targetSpaceId: string | null;
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
    const t = await prisma.driveNode.findUnique({ where: { id: targetId }, select: { spaceId: true } });
    targetSpaceId = t?.spaceId ?? null;
  } else {
    // Déplacement à la racine d'une catégorie : gestionnaire requis (racine personnelle : libre).
    if (contextSpaceId && !(await canCreateInSpace(user, contextSpaceId))) return DENIED;
    targetSpaceId = contextSpaceId;
  }

  // Maintient l'invariant « tout le sous-arbre porte le spaceId de sa catégorie » : le sous-arbre
  // déplacé adopte la catégorie de destination (ou repasse en personnel si null).
  const subtree = await collectSubtree(id);
  await prisma.driveNode.updateMany({ where: { id: { in: subtree } }, data: { spaceId: targetSpaceId } });
  await prisma.driveNode.update({ where: { id }, data: { parentId: targetId || null } });
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

/**
 * PARTAGER AVEC PLUSIEURS PERSONNES EN UNE FOIS.
 *
 * Partager un dossier de campagne avec six délégués un par un, c'est six ouvertures du panneau,
 * six sélections, six clics — et la sixième personne se fait oublier une fois sur deux. On accepte
 * donc une liste, avec le même droit pour tout le monde : c'est le cas réel (« l'équipe peut
 * lire »), et les exceptions se règlent ensuite personne par personne.
 *
 * Le droit d'écrire sur le nœud est vérifié UNE fois — il ne dépend pas du destinataire — puis
 * chaque partage est écrit et notifié. Un destinataire déjà présent voit son droit mis à jour
 * plutôt que dupliqué.
 */
export async function shareNodeWithMany(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const nodeId = fdStr(formData, "nodeId");
  const access = (fdStr(formData, "access") as DriveAccess) ?? "VIEW";
  const userIds = Array.from(new Set(formData.getAll("userId").map(String).filter(Boolean)))
    // On ne se partage pas à soi-même : le partage n'ajouterait rien et brouillerait la liste.
    .filter((id) => id !== user.id);
  if (!nodeId) return { ok: false, error: "Élément introuvable." };
  if (userIds.length === 0) return { ok: false, error: "Choisissez au moins une personne." };
  if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") return DENIED;

  const node = await prisma.driveNode.findUnique({ where: { id: nodeId }, select: { name: true } });
  if (!node) return { ok: false, error: "Élément introuvable." };

  for (const userId of userIds) {
    await prisma.driveShare.upsert({
      where: { nodeId_userId: { nodeId, userId } },
      create: { nodeId, userId, access },
      update: { access },
    });
    await notifyUser({
      userId, type: "DOCUMENT_UPLOADED", title: "Élément partagé avec vous",
      body: node.name, link: `/drive/${nodeId}`,
    });
  }

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: nodeId,
    summary: `Partagé avec ${userIds.length} personne(s) — ${access === "EDIT" ? "modification" : "lecture"}`,
  });
  revalidatePath(`/drive/${nodeId}`);
  revalidatePath("/drive");
  return { ok: true, message: `Partagé avec ${userIds.length} personne(s).` };
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

/**
 * Crée un document Office **vierge** (Word / Excel / PowerPoint) dans le Drive, puis
 * renvoie son id pour l'ouvrir dans l'éditeur OnlyOffice. Le fichier est un vrai OOXML
 * valide généré côté serveur (sans dépendance), donc téléchargeable même sans OnlyOffice.
 */
export async function createOfficeNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind");
  if (!kind || !isOfficeKind(kind)) return { ok: false, error: "Type de document invalide." };
  const parentId = fdStr(formData, "parentId");
  const spaceId = fdStr(formData, "spaceId");
  // Éditeur sur le dossier de destination (partage/catégorie) suffit ; racine d'une catégorie →
  // gestionnaire ; racine personnelle → droit module « Créer ».
  if (parentId) {
    if ((await resolveDriveAccess(user, parentId)) !== "EDIT") return DENIED;
  } else if (spaceId) {
    if (!(await canCreateInSpace(user, spaceId))) return DENIED;
  } else if (!userCan(user, "DRIVE", "CREATE")) {
    return DENIED;
  }
  const effSpaceId = await effectiveSpaceId(parentId || null, spaceId || null);

  const { data, ext, mime } = blankOffice(kind);
  const base = (fdStr(formData, "name") ?? "Document").replace(/\.(docx|xlsx|pptx)$/i, "").trim() || "Document";
  const name = `${base}.${ext}`;

  const { blobId, size } = await putBlob(data);
  const node = await prisma.driveNode.create({
    data: {
      name, type: "FILE", parentId: parentId || null, spaceId: effSpaceId, ownerId: user.id, createdById: user.id, mimeType: mime, size,
      versions: { create: { blobId, version: 1, size, mimeType: mime, createdById: user.id } },
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id, summary: `Nouveau document « ${name} »` });
  revalidatePath("/drive");
  if (effSpaceId) revalidatePath(`/drive/espace/${effSpaceId}`);
  return { ok: true, id: node.id };
}

/**
 * Convertit un fichier Office du Drive (docx / xlsx / pptx) en **PDF** via OnlyOffice,
 * et range le PDF dans le Drive (à côté de la source si possible). Renvoie l'id du PDF.
 */
export async function convertNodeToPdf(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "DRIVE", "CREATE")) return DENIED;
  if (!convertConfigured()) return { ok: false, error: "Conversion PDF indisponible (éditeur Office non configuré)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Fichier introuvable." };
  if ((await resolveDriveAccess(user, id)) === "NONE") return DENIED;

  const node = await prisma.driveNode.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!node || node.type !== "FILE") return { ok: false, error: "Fichier introuvable." };
  if (!onlyofficeEditable(node.name)) return { ok: false, error: "Ce type de fichier ne peut pas être converti." };
  const version = node.versions[0];
  if (!version) return { ok: false, error: "Aucun contenu à convertir." };

  // URL signée que le Document Server peut télécharger (serveur-à-serveur).
  const token = makeEditToken(id, user.id, 300);
  const srcUrl = `${appBaseUrl()}/api/onlyoffice/file?token=${token}`;
  let pdf: Buffer;
  try {
    pdf = await convertDocument({ srcUrl, fromExt: fileExt(node.name), outputType: "pdf", key: `topdf_${id}_${version.version}` });
  } catch (e) {
    console.error("[drive] conversion PDF échouée", e);
    return { ok: false, error: "La conversion a échoué. Réessayez plus tard." };
  }

  const pdfName = `${node.name.replace(/\.[a-z0-9]+$/i, "")}.pdf`;
  // À côté de la source si on peut éditer son dossier, sinon à la racine (chez soi).
  const parentId = node.parentId && (await resolveDriveAccess(user, node.parentId)) === "EDIT" ? node.parentId : null;
  const { blobId, size } = await putBlob(pdf);
  const created = await prisma.driveNode.create({
    data: {
      name: pdfName, type: "FILE", parentId, ownerId: user.id, createdById: user.id, mimeType: "application/pdf", size,
      versions: { create: { blobId, version: 1, size, mimeType: "application/pdf", createdById: user.id } },
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Drive", entityType: "DRIVE_NODE", entityId: created.id, summary: `PDF généré depuis « ${node.name} »` });
  revalidatePath("/drive");
  return { ok: true, id: created.id };
}

/**
 * AGIR SUR UNE SÉLECTION — corbeille et partage, sur plusieurs éléments à la fois.
 *
 * Sélectionner cinq fichiers puis devoir ouvrir cinq menus pour les supprimer, c'est ne pas avoir
 * de sélection du tout. Les deux actions ci-dessous prennent la liste entière.
 *
 * **Un refus ne fait pas tout échouer** : sur dix éléments dont deux ne nous appartiennent pas,
 * on traite les huit et on dit lesquels ont été refusés. Tout annuler pour deux lignes obligerait
 * à recommencer en devinant lesquelles retirer.
 */
export interface BulkResult { ok: boolean; done: number; denied: number; error?: string }

export async function trashNodes(formData: FormData): Promise<BulkResult> {
  const user = await requireUser();
  const ids = Array.from(new Set(formData.getAll("id").map(String).filter(Boolean)));
  if (ids.length === 0) return { ok: false, done: 0, denied: 0, error: "Aucun élément sélectionné." };

  let done = 0;
  let denied = 0;
  for (const id of ids) {
    if ((await resolveDriveAccess(user, id)) !== "EDIT") { denied += 1; continue; }
    // Cascade : un dossier mis à la corbeille y emmène tout son contenu.
    const subtree = await collectSubtree(id);
    await prisma.driveNode.updateMany({ where: { id: { in: subtree } }, data: { isTrashed: true } });
    done += 1;
  }
  if (done > 0) {
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: ids[0],
      field: "isTrashed", newValue: "true",
      summary: `Mis à la corbeille (${done} élément·s${denied ? `, ${denied} refusé·s` : ""})`,
    });
    revalidatePath("/drive");
  }
  return {
    ok: done > 0,
    done,
    denied,
    error: done === 0 ? "Vous ne pouvez supprimer aucun des éléments sélectionnés." : undefined,
  };
}

export async function shareNodesWithMany(formData: FormData): Promise<BulkResult> {
  const user = await requireUser();
  const nodeIds = Array.from(new Set(formData.getAll("nodeId").map(String).filter(Boolean)));
  const access = (fdStr(formData, "access") as DriveAccess) ?? "VIEW";
  const userIds = Array.from(new Set(formData.getAll("userId").map(String).filter(Boolean)))
    .filter((id) => id !== user.id);
  if (nodeIds.length === 0) return { ok: false, done: 0, denied: 0, error: "Aucun élément sélectionné." };
  if (userIds.length === 0) return { ok: false, done: 0, denied: 0, error: "Choisissez au moins une personne." };

  let done = 0;
  let denied = 0;
  const sharedNames: string[] = [];
  for (const nodeId of nodeIds) {
    if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") { denied += 1; continue; }
    const node = await prisma.driveNode.findUnique({ where: { id: nodeId }, select: { name: true } });
    if (!node) { denied += 1; continue; }
    for (const userId of userIds) {
      await prisma.driveShare.upsert({
        where: { nodeId_userId: { nodeId, userId } },
        create: { nodeId, userId, access },
        update: { access },
      });
    }
    sharedNames.push(node.name);
    done += 1;
  }

  // UNE notification par personne pour TOUT le lot : partager douze fichiers d'un coup ne doit
  // pas remplir douze fois la boîte de chacun — c'est le meilleur moyen de faire ignorer les
  // notifications suivantes.
  if (done > 0) {
    const body = sharedNames.length === 1
      ? sharedNames[0]
      : `${sharedNames.length} éléments — ${sharedNames.slice(0, 3).join(", ")}${sharedNames.length > 3 ? "…" : ""}`;
    for (const userId of userIds) {
      await notifyUser({
        userId, type: "DOCUMENT_UPLOADED",
        title: sharedNames.length === 1 ? "Élément partagé avec vous" : "Éléments partagés avec vous",
        body, link: sharedNames.length === 1 ? `/drive/${nodeIds[0]}` : "/drive",
      });
    }
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Drive", entityType: "DRIVE_NODE", entityId: nodeIds[0],
      summary: `${done} élément·s partagé·s avec ${userIds.length} personne·s — ${access === "EDIT" ? "modification" : "lecture"}${denied ? ` (${denied} refusé·s)` : ""}`,
    });
    revalidatePath("/drive");
  }
  return {
    ok: done > 0,
    done,
    denied,
    error: done === 0 ? "Vous ne pouvez partager aucun des éléments sélectionnés." : undefined,
  };
}
