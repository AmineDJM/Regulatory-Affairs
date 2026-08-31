import { prisma } from "@/lib/prisma";
import { scopeMedicalInfo, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere } from "@/lib/company";

/**
 * COMBIEN LE FILTRE D'ENTITÉ RETIRE de cette liste — compté ici, DIT par l'écran.
 *
 * Le cloisonnement est voulu ; son silence ne l'est pas. Le pharmacien voyait deux déclarations
 * dans « Mon espace » et zéro dans son module, sans qu'aucun écran ne relie les deux faits.
 */
export async function declarationsHiddenByScope(user: SessionUser): Promise<{ shown: number; total: number }> {
  const metier = scopeMedicalInfo(user);
  const [total, shown] = await Promise.all([
    prisma.medicalInfoDeclaration.count({ where: metier }),
    prisma.medicalInfoDeclaration.count({ where: await companyScopedWhere(user.id, metier) }),
  ]);
  return { shown, total };
}

export async function getDeclarations(user: SessionUser) {
  return prisma.medicalInfoDeclaration.findMany({
    where: await companyScopedWhere(user.id, scopeMedicalInfo(user)),
    include: {
      pharmacist: { select: { name: true } },
      requests: { select: { id: true, status: true } },
      company: { select: { id: true, name: true, shortName: true, color: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getDeclaration(id: string) {
  return prisma.medicalInfoDeclaration.findUnique({
    where: { id },
    include: {
      pharmacist: { select: { name: true } },
      requests: {
        include: { targetUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export type DeclarationDetail = NonNullable<Awaited<ReturnType<typeof getDeclaration>>>;

/**
 * Le détail d'une déclaration est visible par : le pharmacien responsable / la
 * Direction / un admin (accès au module), ou tout utilisateur sollicité pour une
 * pièce sur cette déclaration (afin qu'il puisse la déposer).
 */
export function canViewDeclaration(user: SessionUser, decl: DeclarationDetail): boolean {
  if (hasGlobalView(user.role)) return true;
  if (userCan(user, "MEDICAL_INFO", "VIEW") && (decl.pharmacistId === user.id || user.role === "MEDICAL_INFO_PHARMACIST")) return true;
  if (decl.requests.some((r) => r.targetUserId === user.id)) return true;
  // Accès module avec portée ALL (ex. configuré par un admin).
  return userCan(user, "MEDICAL_INFO", "VALIDATE");
}

/** Lien vers l'événement source (pour l'interconnexion). */
export function sourceLink(sourceType: string, sourceId: string): string | null {
  switch (sourceType) {
    case "SPONSORING": return `/sponsoring/${sourceId}`;
    case "CONGRESS_INTERNATIONAL": return `/congress-international/${sourceId}`;
    case "CONGRESS_NATIONAL": return `/congress-national/${sourceId}`;
    case "EVENT": return `/events/${sourceId}`;
    default: return null;
  }
}
