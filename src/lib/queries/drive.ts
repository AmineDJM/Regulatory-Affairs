import type { DriveNodeType } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, driveBreadcrumb, type DriveAccessLevel } from "@/lib/drive";

/** Ligne du Drive prête pour l'UI, avec le droit d'édition **résolu par nœud**. */
export interface DriveNodeRow {
  id: string;
  name: string;
  type: DriveNodeType;
  mimeType: string | null;
  size: number;
  category: string | null;
  isTrashed: boolean;
  updatedAt: Date;
  owner: { name: string } | null;
  /** L'utilisateur courant peut-il modifier CE nœud (renommer / corbeille / déplacer) ? */
  canEdit: boolean;
}

export interface DriveListing {
  folder: { id: string; name: string } | null;
  breadcrumb: { id: string; name: string }[];
  nodes: DriveNodeRow[];
  /** Droit sur le dossier courant (gouverne « Nouveau dossier / Importer ici »). */
  level: DriveAccessLevel;
  trash: boolean;
}

type RawNode = {
  id: string; name: string; type: DriveNodeType; mimeType: string | null; size: number;
  category: string | null; isTrashed: boolean; ownerId: string | null; updatedAt: Date;
  owner: { name: string } | null; shares: { access: string }[];
};

function nodeInclude(userId: string) {
  return {
    owner: { select: { name: true } },
    shares: { where: { userId }, select: { access: true } },
  };
}
function nodeArgs(userId: string) {
  return {
    include: nodeInclude(userId),
    orderBy: [{ type: "desc" as const }, { name: "asc" as const }], // dossiers avant fichiers
  };
}

/** Droit d'édition effectif sur un nœud listé (sans requête supplémentaire). */
function rowCanEdit(user: SessionUser, n: RawNode, inheritedEdit: boolean): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (n.ownerId === user.id) return true;
  if (n.shares.some((s) => s.access === "EDIT")) return true;
  return inheritedEdit;
}

function toRow(user: SessionUser, n: RawNode, inheritedEdit: boolean): DriveNodeRow {
  return {
    id: n.id, name: n.name, type: n.type, mimeType: n.mimeType, size: n.size,
    category: n.category, isTrashed: n.isTrashed, updatedAt: n.updatedAt, owner: n.owner,
    canEdit: rowCanEdit(user, n, inheritedEdit),
  };
}

/** List a folder's contents (or the user's roots / trash), enforcing access. */
export async function getDriveListing(
  user: SessionUser,
  folderId: string | null,
  trash: boolean,
): Promise<DriveListing | null> {
  if (trash) {
    // Corbeille : seulement les éléments de **plus haut niveau** mis à la corbeille
    // (un dossier corbeillé apparaît, pas chacun de ses enfants).
    const nodes = (await prisma.driveNode.findMany({
      where: { ownerId: user.id, isTrashed: true, OR: [{ parentId: null }, { parent: { isTrashed: false } }] },
      ...nodeArgs(user.id),
    })) as RawNode[];
    return { folder: null, breadcrumb: [], nodes: nodes.map((n) => toRow(user, n, true)), level: "EDIT", trash: true };
  }

  if (folderId) {
    const level = await resolveDriveAccess(user, folderId);
    if (level === "NONE") return null;
    const folder = await prisma.driveNode.findUnique({ where: { id: folderId }, select: { id: true, name: true, isTrashed: true } });
    if (!folder || folder.isTrashed) return null; // pas de navigation dans un dossier corbeillé
    const nodes = (await prisma.driveNode.findMany({ where: { parentId: folderId, isTrashed: false }, ...nodeArgs(user.id) })) as RawNode[];
    const breadcrumb = await driveBreadcrumb(folderId);
    return { folder, breadcrumb, nodes: nodes.map((n) => toRow(user, n, level === "EDIT")), level, trash: false };
  }

  // Racine : ses propres dossiers/fichiers + ceux partagés (ou tout, si scope ALL).
  const scopeAll = user.role === "SUPER_ADMIN" || user.access.modules.get("DRIVE")?.scope === "ALL";
  const owned = (await prisma.driveNode.findMany({
    where: { parentId: null, isTrashed: false, ...(scopeAll ? {} : { ownerId: user.id }) },
    ...nodeArgs(user.id),
  })) as RawNode[];

  const map = new Map(owned.map((n) => [n.id, n]));
  if (!scopeAll) {
    const shares = await prisma.driveShare.findMany({ where: { userId: user.id }, include: { node: { include: nodeInclude(user.id) } } });
    for (const s of shares) {
      const node = s.node as RawNode | null;
      if (node && !node.isTrashed) map.set(node.id, node);
    }
  }
  const merged = [...map.values()].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "FOLDER" ? -1 : 1));
  // À la racine il n'y a pas d'héritage : chaque nœud est éditable selon sa propre propriété/partage.
  return { folder: null, breadcrumb: [], nodes: merged.map((n) => toRow(user, n, false)), level: "EDIT", trash: false };
}
