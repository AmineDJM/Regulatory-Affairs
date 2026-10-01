import { prisma } from "@/lib/prisma";
import { scopeDossiers, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere } from "@/lib/company";

/**
 * LA LISTE DES SUJETS — la portée du module, composée à l'ENTITÉ par `companyScopedWhere`
 * (§118.163), qui GARDE les sujets sans entité.
 *
 * Elle lisait `platformScope` seul, qui les exclut : un sujet né sans société (ouvert par Adam, par
 * une tâche, avant le multi-entités) disparaissait de la liste de ses propres membres, alors que sa
 * fiche s'ouvrait — « chaque projet associé à une société/entité, et donc visible ». Une ligne sans
 * entité n'est le secret d'aucune société ; la cacher ne protège rien et perd du travail.
 */
export async function getDossiers(user: SessionUser) {
  return prisma.dossier.findMany({
    where: await companyScopedWhere(user.id, scopeDossiers(user)),
    include: {
      company: { select: { id: true, name: true, shortName: true, color: true } },
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
      company: { select: { id: true, name: true, shortName: true, color: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        include: {
          author: { select: { id: true, name: true } },
          attachments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true } },
        },
        orderBy: { createdAt: "asc" },
      },
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
