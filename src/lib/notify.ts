import type { NotificationType } from "@prisma/client";
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
