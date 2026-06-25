import type { SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, driveBreadcrumb, type DriveAccessLevel } from "@/lib/drive";

const NODE_INCLUDE = { owner: { select: { name: true } } } as const;

export interface DriveListing {
  folder: { id: string; name: string } | null;
  breadcrumb: { id: string; name: string }[];
  nodes: Awaited<ReturnType<typeof loadChildren>>;
  level: DriveAccessLevel;
  trash: boolean;
}

function loadChildren(where: object) {
  return prisma.driveNode.findMany({
    where,
    include: NODE_INCLUDE,
    orderBy: [{ type: "desc" }, { name: "asc" }], // dossiers avant fichiers
  });
}

/** List a folder's contents (or the user's roots / trash), enforcing access. */
export async function getDriveListing(
  user: SessionUser,
  folderId: string | null,
  trash: boolean,
): Promise<DriveListing | null> {
  if (trash) {
    const nodes = await loadChildren({ ownerId: user.id, isTrashed: true });
    return { folder: null, breadcrumb: [], nodes, level: "EDIT", trash: true };
  }

  if (folderId) {
    const level = await resolveDriveAccess(user, folderId);
    if (level === "NONE") return null;
    const folder = await prisma.driveNode.findUnique({ where: { id: folderId }, select: { id: true, name: true } });
    if (!folder) return null;
    const nodes = await loadChildren({ parentId: folderId, isTrashed: false });
    const breadcrumb = await driveBreadcrumb(folderId);
    return { folder, breadcrumb, nodes, level, trash: false };
  }

  // Root : ses propres dossiers/fichiers + ceux partagés (ou tout, si scope ALL).
  const scopeAll = user.role === "SUPER_ADMIN" || user.access.modules.get("DRIVE")?.scope === "ALL";
  const owned = await loadChildren({ parentId: null, isTrashed: false, ...(scopeAll ? {} : { ownerId: user.id }) });
  let merged = owned;
  if (!scopeAll) {
    const shares = await prisma.driveShare.findMany({ where: { userId: user.id }, include: { node: { include: NODE_INCLUDE } } });
    const map = new Map(owned.map((n) => [n.id, n]));
    for (const s of shares) if (s.node && !s.node.isTrashed) map.set(s.node.id, s.node);
    merged = [...map.values()].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "FOLDER" ? -1 : 1));
  }
  return { folder: null, breadcrumb: [], nodes: merged, level: "EDIT", trash: false };
}
