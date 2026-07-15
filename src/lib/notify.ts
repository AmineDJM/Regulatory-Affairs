import type { NotificationType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { anyRoleFilter } from "@/lib/rbac";
import { sendPushToUser } from "@/lib/push";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Create an internal notification for a user (best-effort) + push sur ses appareils. */
export async function notifyUser(input: NotifyInput) {
  try {
    await prisma.notification.create({ data: input });
  } catch (err) {
    console.error("[notify] failed", err);
  }
  // Push (PWA) — best-effort, inerte si VAPID non configuré.
  await sendPushToUser(input.userId, { title: input.title, body: input.body, url: input.link ?? "/" });
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
  /** Affiche aussi la notification en **pop-up plein écran** (grande fenêtre centrée) chez le destinataire. */
  popup?: boolean;
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
      // Audience « rôle » : couvre le rôle principal ET le rôle secondaire.
      const where = opts.audience === "ROLE" && opts.role
        ? { isActive: true, ...anyRoleFilter([opts.role as UserRole]) }
        : { isActive: true };
      ids = (await prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id);
    }
    if (ids.length === 0) return 0;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type: "GENERIC" as NotificationType, title: opts.title, body: opts.body, link: opts.link, popup: opts.popup ?? false })),
    });
    // Push (PWA) sur les appareils de chaque destinataire — best-effort.
    await Promise.all(ids.map((userId) => sendPushToUser(userId, { title: opts.title, body: opts.body, url: opts.link ?? "/" })));
    return ids.length;
  } catch (err) {
    console.error("[notify] broadcast failed", err);
    return 0;
  }
}

/** Notify every user holding one of the given roles — en principal OU en secondaire
 *  (ex. un compte « délégué » dont l'autre rôle est National Sales doit être prévenu). */
export async function notifyRoles(
  roles: import("@prisma/client").UserRole[],
  input: Omit<NotifyInput, "userId">,
) {
  try {
    const users = await prisma.user.findMany({
      where: { ...anyRoleFilter(roles), isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({ ...input, userId: u.id })),
    });
    await Promise.all(users.map((u) => sendPushToUser(u.id, { title: input.title, body: input.body, url: input.link ?? "/" })));
  } catch (err) {
    console.error("[notify] failed (roles)", err);
  }
}
