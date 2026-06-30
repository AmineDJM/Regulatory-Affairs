import type { EntityType, MissionRole, MissionOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DocItem } from "@/components/documents/document-list";

export interface MissionCommentDTO {
  id: string; author: string; authorId: string | null; body: string; createdAt: string; editedAt: string | null;
}

export interface MissionAssignmentDTO {
  id: string;
  entityType: EntityType;
  entityId: string;
  parentLabel: string;
  parentPath: string;
  userId: string;
  userName: string;
  role: MissionRole;
  orderStatus: MissionOrderStatus;
  requestedAt: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  note: string | null;
  documents: DocItem[];
  comments: MissionCommentDTO[];
}

function pathFor(entityType: EntityType, entityId: string): string {
  switch (entityType) {
    case "CONGRESS_INTERNATIONAL": return `/congress-international/${entityId}`;
    case "CONGRESS_NATIONAL": return `/congress-national/${entityId}`;
    case "EVENT": return `/events/${entityId}`;
    case "SPONSORING": return `/sponsoring/${entityId}`;
    default: return "/";
  }
}

type Row = {
  id: string; entityType: EntityType; entityId: string; userId: string; role: MissionRole;
  orderStatus: MissionOrderStatus; requestedAt: Date | null; issuedAt: Date | null; issuedById: string | null;
  note: string | null; user: { name: string };
};

/** Enrichit des assignations brutes avec pièces, discussions, libellés et noms. */
async function hydrate(rows: Row[]): Promise<MissionAssignmentDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [documents, comments, issuers, parents] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "MISSION_ASSIGNMENT", entityId: { in: ids } },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { entityType: "MISSION_ASSIGNMENT", entityId: { in: ids } },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { in: Array.from(new Set(rows.map((r) => r.issuedById).filter(Boolean) as string[])) } },
      select: { id: true, name: true },
    }),
    resolveParents(rows),
  ]);

  const issuerName = new Map(issuers.map((u) => [u.id, u.name]));
  const docsByAssignment = new Map<string, DocItem[]>();
  for (const d of documents) {
    const item: DocItem = {
      id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
      confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
    };
    (docsByAssignment.get(d.entityId) ?? docsByAssignment.set(d.entityId, []).get(d.entityId)!).push(item);
  }
  const commentsByAssignment = new Map<string, MissionCommentDTO[]>();
  for (const c of comments) {
    const item: MissionCommentDTO = {
      id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId,
      body: c.body, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null,
    };
    (commentsByAssignment.get(c.entityId) ?? commentsByAssignment.set(c.entityId, []).get(c.entityId)!).push(item);
  }

  return rows.map((r) => ({
    id: r.id, entityType: r.entityType, entityId: r.entityId,
    parentLabel: parents.get(`${r.entityType}:${r.entityId}`) ?? "Mission",
    parentPath: pathFor(r.entityType, r.entityId),
    userId: r.userId, userName: r.user.name, role: r.role, orderStatus: r.orderStatus,
    requestedAt: r.requestedAt?.toISOString() ?? null, issuedAt: r.issuedAt?.toISOString() ?? null,
    issuedByName: r.issuedById ? issuerName.get(r.issuedById) ?? null : null,
    note: r.note, documents: docsByAssignment.get(r.id) ?? [], comments: commentsByAssignment.get(r.id) ?? [],
  }));
}

/** Résout les libellés des entités parentes (par type), en lots. */
async function resolveParents(rows: Row[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byType = new Map<EntityType, string[]>();
  for (const r of rows) (byType.get(r.entityType) ?? byType.set(r.entityType, []).get(r.entityType)!).push(r.entityId);

  for (const [type, idList] of byType) {
    const ids = Array.from(new Set(idList));
    if (type === "EVENT") {
      const items = await prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      for (const i of items) out.set(`EVENT:${i.id}`, i.name);
    } else if (type === "SPONSORING") {
      const items = await prisma.sponsoringRequest.findMany({ where: { id: { in: ids } }, select: { id: true, reference: true, institution: true } });
      for (const i of items) out.set(`SPONSORING:${i.id}`, `${i.reference} — ${i.institution}`);
    } else if (type === "CONGRESS_INTERNATIONAL") {
      const items = await prisma.congressInternational.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      for (const i of items) out.set(`CONGRESS_INTERNATIONAL:${i.id}`, i.name);
    } else if (type === "CONGRESS_NATIONAL") {
      const items = await prisma.congressNational.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      for (const i of items) out.set(`CONGRESS_NATIONAL:${i.id}`, i.name);
    }
  }
  return out;
}

/** Assignations d'une entité (congrès / événement / sponsoring) — vue responsable. */
export async function getEntityMissions(entityType: EntityType, entityId: string): Promise<MissionAssignmentDTO[]> {
  const rows = await prisma.missionAssignment.findMany({
    where: { entityType, entityId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return hydrate(rows);
}

/** Mes assignations (vue de la personne assignée) — toutes entités confondues. */
export async function getMyMissions(userId: string): Promise<MissionAssignmentDTO[]> {
  const rows = await prisma.missionAssignment.findMany({
    where: { userId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return hydrate(rows);
}
