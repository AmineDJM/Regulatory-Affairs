import type { NotificationType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Create an internal notification for a user (best-effort). */
export async function notifyUser(input: NotifyInput) {
  try {
    await prisma.notification.create({ data: input });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

export type BroadcastAudience = "ALL" | "ROLE" | "USERS";

/**
 * Diffuse une notification à une **audience** : tous les comptes actifs, un rôle,
 * ou des personnes précises. Renvoie le nombre de destinataires. Best-effort.
 */
export async function broadcastNotification(opts: {
  audience: BroadcastAudience;
  role?: string | null;
  userIds?: string[];
  title: string;
  body?: string;
  link?: string;
}): Promise<number> {
  try {
    let ids: string[];
    if (opts.audience === "USERS") {
      ids = [...new Set((opts.userIds ?? []).filter(Boolean))];
      if (ids.length) {
        const valid = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
        ids = valid.map((u) => u.id);
      }
    } else {
      const where = opts.audience === "ROLE" && opts.role
        ? { isActive: true, role: opts.role as UserRole }
        : { isActive: true };
      ids = (await prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id);
    }
    if (ids.length === 0) return 0;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type: "GENERIC" as NotificationType, title: opts.title, body: opts.body, link: opts.link })),
    });
    return ids.length;
  } catch (err) {
    console.error("[notify] broadcast failed", err);
    return 0;
  }
}

/** Notify every user holding one of the given roles. */
export async function notifyRoles(
  roles: import("@prisma/client").UserRole[],
  input: Omit<NotifyInput, "userId">,
) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({ ...input, userId: u.id })),
    });
  } catch (err) {
    console.error("[notify] failed (roles)", err);
  }
}
