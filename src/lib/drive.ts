import type { SessionUser } from "./rbac";
import { prisma } from "./prisma";

export type DriveAccessLevel = "NONE" | "VIEW" | "EDIT";

/**
 * Effective access to a Drive node. A Super Admin manages everything; a user with
 * DRIVE scope = ALL (admin-granted, e.g. Direction) gets org-wide read; otherwise
 * access comes from ownership or a share — inherited down the folder tree.
 */
export async function resolveDriveAccess(user: SessionUser, nodeId: string): Promise<DriveAccessLevel> {
  if (user.role === "SUPER_ADMIN") return "EDIT";
  let best: DriveAccessLevel = user.access.modules.get("DRIVE")?.scope === "ALL" ? "VIEW" : "NONE";

  let currentId: string | null = nodeId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node: { ownerId: string | null; parentId: string | null; shares: { access: string }[] } | null =
      await prisma.driveNode.findUnique({
        where: { id: currentId },
        select: { ownerId: true, parentId: true, shares: { where: { userId: user.id }, select: { access: true } } },
      });
    if (!node) break;
    if (node.ownerId === user.id) return "EDIT";
    for (const s of node.shares) {
      if (s.access === "EDIT") return "EDIT";
      best = "VIEW";
    }
    currentId = node.parentId;
  }
  return best;
}

export const canEditDrive = (level: DriveAccessLevel) => level === "EDIT";
export const canViewDrive = (level: DriveAccessLevel) => level === "VIEW" || level === "EDIT";

/** Breadcrumb from root to the given node (inclusive). */
export async function driveBreadcrumb(nodeId: string | null): Promise<{ id: string; name: string }[]> {
  const crumbs: { id: string; name: string }[] = [];
  let currentId = nodeId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = await prisma.driveNode.findUnique({ where: { id: currentId }, select: { id: true, name: true, parentId: true } });
    if (!node) break;
    crumbs.unshift({ id: node.id, name: node.name });
    currentId = node.parentId;
  }
  return crumbs;
}

/** Coarse file kind for choosing a viewer. */
export function fileKind(mime: string | null | undefined, name: string): "pdf" | "image" | "video" | "audio" | "text" | "office" | "other" {
  const m = (mime ?? "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (m.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (m.startsWith("text/") || ["txt", "csv", "md", "json", "log"].includes(ext)) return "text";
  return "other";
}
