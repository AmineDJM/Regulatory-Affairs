import { prisma } from "@/lib/prisma";
import { scopeDossiers, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";

export async function getDossiers(user: SessionUser) {
  return prisma.dossier.findMany({
    where: scopeDossiers(user),
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getDossier(id: string) {
  return prisma.dossier.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type DossierDetail = NonNullable<Awaited<ReturnType<typeof getDossier>>>;

/** Visible par : la Direction/admin, le créateur, le responsable ou un participant. */
export function canViewDossier(user: SessionUser, d: DossierDetail): boolean {
  if (hasGlobalView(user.role) || userCan(user, "DOSSIERS", "VALIDATE")) return true;
  return d.createdById === user.id || d.assignedToId === user.id || d.participantIds.includes(user.id);
}

/** Tout membre du dossier (créateur, responsable, participant) peut y contribuer. */
export function isDossierMember(user: SessionUser, d: DossierDetail): boolean {
  return canViewDossier(user, d);
}

/** Pilotage (changement de statut / réassignation) : créateur, responsable ou Direction. */
export function canManageDossier(user: SessionUser, d: DossierDetail): boolean {
  return hasGlobalView(user.role) || d.createdById === user.id || d.assignedToId === user.id;
}
