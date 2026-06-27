import { prisma } from "@/lib/prisma";
import { scopeDirectives, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";

export async function getDirectives(user: SessionUser) {
  return prisma.directive.findMany({
    where: scopeDirectives(user),
    include: {
      from: { select: { name: true } },
      targetUser: { select: { name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getDirective(id: string) {
  return prisma.directive.findUnique({
    where: { id },
    include: {
      from: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
      messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type DirectiveDetail = NonNullable<Awaited<ReturnType<typeof getDirective>>>;

/** Visible par : la Direction/admin, l'émetteur, le destinataire nommé, ou un membre du rôle ciblé. */
export function canViewDirective(user: SessionUser, d: DirectiveDetail): boolean {
  if (hasGlobalView(user.role) || userCan(user, "DIRECTIVES", "CREATE")) return true;
  return d.fromId === user.id || d.targetUserId === user.id || d.targetRole === user.role;
}
