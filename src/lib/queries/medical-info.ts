import { prisma } from "@/lib/prisma";
import { scopeMedicalInfo, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";

export async function getDeclarations(user: SessionUser) {
  return prisma.medicalInfoDeclaration.findMany({
    where: scopeMedicalInfo(user),
    include: {
      pharmacist: { select: { name: true } },
      requests: { select: { id: true, status: true } },
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
    default: return null;
  }
}
