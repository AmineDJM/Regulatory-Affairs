import { prisma } from "@/lib/prisma";
import { scopeSupport, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { platformScope } from "@/lib/company";

export async function getSupportRequests(user: SessionUser) {
  return prisma.supportRequest.findMany({
    where: { AND: [scopeSupport(user), await platformScope(user.id)] },
    include: {
      requester: { select: { name: true } },
      targetUser: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getSupportRequest(id: string) {
  return prisma.supportRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type SupportDetail = NonNullable<Awaited<ReturnType<typeof getSupportRequest>>>;

/** Visible par : la Direction/admin, le demandeur, le destinataire (nommé ou par rôle) ou le répondant. */
export function canViewSupport(user: SessionUser, r: SupportDetail): boolean {
  if (hasGlobalView(user.role) || userCan(user, "SUPPORT", "VALIDATE")) return true;
  return r.requesterId === user.id || r.targetUserId === user.id || r.targetRole === user.role || r.assignedToId === user.id;
}

/** Le destinataire (fonction/personne) ou un répondant assigné peut traiter la demande. */
export function isSupportResponder(user: SessionUser, r: SupportDetail): boolean {
  return hasGlobalView(user.role) || r.targetUserId === user.id || r.targetRole === user.role || r.assignedToId === user.id;
}
