import { prisma } from "@/lib/prisma";
import { scopeDirectives, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { canReadDirective } from "@/lib/directives/audience";
import { companyIdsOf, directiveAttachments, resolveRecipientIds, scopeOf } from "@/lib/directives/recipients";

export async function getDirectives(user: SessionUser) {
  // Les notes adressées « aux salariés d'une entité » n'apparaissent qu'à ceux qui en relèvent :
  // il faut donc savoir de quelle(s) entité(s) la personne relève AVANT de composer la portée.
  const companyIds = await companyIdsOf(user.id);
  return prisma.directive.findMany({
    where: scopeDirectives(user, companyIds),
    include: {
      from: { select: { name: true } },
      targetUser: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
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
      approvedBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, shortName: true } },
      messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type DirectiveDetail = NonNullable<Awaited<ReturnType<typeof getDirective>>>;

/**
 * Tout ce qu'une fiche de directive doit afficher en plus de la note : ses pièces jointes, le
 * nom des personnes visées, et le nombre réel de destinataires. Résolu ici plutôt que dans la
 * page, pour que la conversation d'Adam et l'écran lisent exactement la même chose.
 */
export async function getDirectiveContext(d: DirectiveDetail) {
  const [attachments, recipientIds, named] = await Promise.all([
    directiveAttachments(d.id),
    resolveRecipientIds(scopeOf({
      audience: d.audience, targetUserIds: d.targetUserIds,
      targetRole: d.targetRole as string | null, companyId: d.companyId,
    })),
    d.targetUserIds.length
      ? prisma.user.findMany({ where: { id: { in: d.targetUserIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  return { attachments, recipientCount: recipientIds.length, namedRecipients: named };
}

/**
 * Qui peut ouvrir CETTE directive.
 *
 * La règle de publication prime : une note non signée par la direction générale n'est lisible
 * que de son auteur et de ceux qui peuvent la signer. Le reste — portée, entité, rôle cumulé —
 * est tranché par le module pur `directives/audience.ts`, le même que celui de la liste.
 */
export async function canViewDirective(user: SessionUser, d: DirectiveDetail): Promise<boolean> {
  const isManager = hasGlobalView(user.role) || userCan(user, "DIRECTIVES", "CREATE");
  const companyIds = await companyIdsOf(user.id);
  return canReadDirective(
    { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null, companyIds },
    {
      ...scopeOf({
        audience: d.audience, targetUserIds: d.targetUserIds,
        targetRole: d.targetRole as string | null, companyId: d.companyId,
      }),
      publication: d.publication,
      fromId: d.fromId,
    },
    { isManager },
  );
}
