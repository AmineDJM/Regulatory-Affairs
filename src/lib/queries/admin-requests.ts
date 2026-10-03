import type { Prisma, AdminRequestStatus, AdminRequestType } from "@prisma/client";
import { scopeAdminRequests, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { clauseDemandesSecretariatVisibles } from "@/lib/queries/visibilite-listes";

const REQ_INCLUDE = {
  requester: { select: { name: true } },
  assignedTo: { select: { name: true } },
  validator: { select: { name: true } },
} as const;

export async function getRequestList(user: SessionUser, filters: { status?: string; type?: string }) {
  // Cloisonnement par entité : la vue « Adventum » ne montre que les demandes d'Adventum.
  const and: Prisma.AdministrativeRequestWhereInput[] = [await clauseDemandesSecretariatVisibles(user)];
  if (filters.status) and.push({ status: filters.status as AdminRequestStatus });
  if (filters.type) and.push({ type: filters.type as AdminRequestType });
  return prisma.administrativeRequest.findMany({
    where: { AND: and },
    include: REQ_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function getAssistantData(user: SessionUser) {
  const now = new Date();
  const scope = scopeAdminRequests(user);
  const [requests, missions] = await Promise.all([
    prisma.administrativeRequest.findMany({ where: scope, include: REQ_INCLUDE, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.driverMission.findMany({
      where: { status: { in: ["NEW", "ACCEPTED", "EN_ROUTE", "PROBLEM"] } },
      include: { assignedTo: { select: { name: true } }, request: { select: { reference: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);
  const terminal = ["DONE", "CANCELLED"];
  const open = requests.filter((r) => !terminal.includes(r.status));
  const stats = {
    nouvelles: requests.filter((r) => r.status === "NEW").length,
    urgentes: open.filter((r) => r.priority === "HIGH" || r.priority === "CRITICAL").length,
    enRetard: open.filter((r) => r.deadline && r.deadline < now).length,
    attenteValidation: requests.filter((r) => r.status === "AWAITING_VALIDATION").length,
    attentePaiement: requests.filter((r) => r.status === "AWAITING_PAYMENT").length,
    attenteExterne: requests.filter((r) => r.status === "AWAITING_EXTERNAL").length,
    attenteDoc: requests.filter((r) => r.status === "AWAITING_DOCUMENT").length,
    bloquees: requests.filter((r) => r.status === "BLOCKED").length,
    missions: missions.length,
    ouvertes: open.length,
  };
  return { requests, open, missions, stats };
}

/** Corbeille : demandes supprimées (soft delete) — réservé aux gestionnaires. */
export async function getDeletedRequests(user: SessionUser) {
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) return [];
  const rows = await prisma.administrativeRequest.findMany({
    where: { deletedAt: { not: null } },
    include: REQ_INCLUDE,
    orderBy: { deletedAt: "desc" },
    take: 200,
  });
  // Résolution du nom de l'auteur de la suppression (pas de relation dédiée).
  const actorIds = [...new Set(rows.map((r) => r.deletedById).filter((v): v is string => Boolean(v)))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, deletedByName: r.deletedById ? nameById.get(r.deletedById) ?? null : null }));
}

export async function getApprovals(user: SessionUser) {
  const manager = hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "VALIDATE");
  const where: Prisma.AdminApprovalWhereInput = manager ? { status: "PENDING" } : { status: "PENDING", validatorId: user.id };
  return prisma.adminApproval.findMany({
    where,
    include: { request: { select: { id: true, reference: true, title: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDriverMissions(user: SessionUser) {
  const manager = hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  const where: Prisma.DriverMissionWhereInput = manager ? {} : { assignedToId: user.id };
  return prisma.driverMission.findMany({
    where,
    include: {
      request: { select: { id: true, reference: true } },
      assignedTo: { select: { name: true } },
      stops: { orderBy: { position: "asc" } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** Pièces jointes des courses (Documents rattachés DRIVER_MISSION), groupées par mission. */
export async function getMissionAttachments(missionIds: string[]) {
  if (missionIds.length === 0) return new Map<string, { id: string; name: string; sizeBytes: number | null }[]>();
  const docs = await prisma.document.findMany({
    where: { entityType: "DRIVER_MISSION", entityId: { in: missionIds } },
    select: { id: true, name: true, sizeBytes: true, entityId: true },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, { id: string; name: string; sizeBytes: number | null }[]>();
  for (const d of docs) {
    if (!d.entityId) continue;
    const list = map.get(d.entityId) ?? [];
    list.push({ id: d.id, name: d.name, sizeBytes: d.sizeBytes });
    map.set(d.entityId, list);
  }
  return map;
}

/**
 * QUI LIT UNE DEMANDE AU SECRÉTARIAT — la clause de la FICHE (`/demandes/[id]`), lue aussi par les gestes
 * qui s'y attachent (§118.184 — audit 360°, S12).
 *
 * Mesuré par l'audit : `addRequestComment` ne vérifiait RIEN. N'importe quel compte, avec l'identifiant
 * d'une demande, y écrivait un commentaire — et le demandeur ou la personne chargée recevait une
 * notification signée de quelqu'un qui n'avait jamais vu la demande. La fiche, elle, a toujours lu deux
 * entrées : la portée du module, et le validateur d'une PIÈCE (« on ne valide pas une facture hors de son
 * contexte » : il voit la demande entière, même hors de son périmètre). Une seule écriture de cette règle,
 * sinon le commentaire s'ouvrirait à quelqu'un que la fiche refuse — ou l'inverse (§118.5).
 */
export async function clauseDemandeLisible(user: SessionUser, requestId: string): Promise<Prisma.AdministrativeRequestWhereInput> {
  const validateurDePiece = (await prisma.validationRequest.count({
    where: { entityType: "ADMIN_REQUEST", entityId: requestId, documentId: { not: null }, steps: { some: { validatorId: user.id } } },
  })) > 0;
  // Les clauses se COMPOSENT en `AND` (§118.133) : `scopeAdminRequests` rend `{ id: "__none__" }` sans le
  // module, et un étalement après `id` aurait remplacé l'identifiant visé.
  return { AND: [{ id: requestId }, validateurDePiece ? { deletedAt: null } : scopeAdminRequests(user)] };
}
