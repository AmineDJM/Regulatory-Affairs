import type { HrDocumentCategory, HrRequestType, HrRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DocItem } from "@/components/documents/document-list";
import type { CommentItem } from "@/components/shared/comment-thread";

/** Lecture du dossier RH employé (documents + demandes d'attestation). */

export interface HrDocumentDTO {
  id: string;
  category: HrDocumentCategory;
  name: string;
  mime: string;
  size: number;
  period: string | null;
  createdAt: string;
}

export interface HrRequestDTO {
  id: string;
  type: HrRequestType;
  status: HrRequestStatus;
  details: string | null;
  hrNote: string | null;
  createdAt: string;
  fulfilmentDocId: string | null;
  documents: DocItem[];
  comments: CommentItem[];
}

export interface MyHrDossier {
  employee: {
    id: string;
    fullName: string;
    position: string | null;
    department: string | null;
    contractType: string | null;
    hireDate: string | null;
    cnasNumber: string | null;
  };
  documents: HrDocumentDTO[];
  requests: HrRequestDTO[];
}

function mapDoc(d: { id: string; category: HrDocumentCategory; name: string; mime: string; size: number; period: string | null; createdAt: Date }): HrDocumentDTO {
  return { id: d.id, category: d.category, name: d.name, mime: d.mime, size: d.size, period: d.period, createdAt: d.createdAt.toISOString() };
}

function mapReq(r: { id: string; type: HrRequestType; status: HrRequestStatus; details: string | null; hrNote: string | null; createdAt: Date; fulfilment: { id: string } | null }): HrRequestDTO {
  return { id: r.id, type: r.type, status: r.status, details: r.details, hrNote: r.hrNote, createdAt: r.createdAt.toISOString(), fulfilmentDocId: r.fulfilment?.id ?? null, documents: [], comments: [] };
}

/** Charge les pièces jointes + le fil d'échange de chaque demande RH (groupés par demande). */
async function attachThreads(requests: HrRequestDTO[]): Promise<void> {
  const ids = requests.map((r) => r.id);
  if (ids.length === 0) return;
  const [documents, comments] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "HR_REQUEST", entityId: { in: ids } }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.comment.findMany({ where: { entityType: "HR_REQUEST", entityId: { in: ids } }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const byReq = new Map(requests.map((r) => [r.id, r]));
  for (const d of documents) {
    byReq.get(d.entityId)?.documents.push({ id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes, confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey) });
  }
  for (const c of comments) {
    byReq.get(c.entityId)?.comments.push({ id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId, body: c.body, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null });
  }
}

/** Dossier RH de l'utilisateur connecté (ou null s'il n'a pas de fiche employé). */
export async function getMyHrDossier(userId: string): Promise<MyHrDossier | null> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      documents: { where: { visibleToEmployee: true }, orderBy: { createdAt: "desc" } },
      hrRequests: { orderBy: { createdAt: "desc" }, include: { fulfilment: { select: { id: true } } } },
    },
  });
  if (!employee) return null;
  const requests = employee.hrRequests.map(mapReq);
  await attachThreads(requests);
  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      department: employee.department,
      contractType: employee.contractType,
      hireDate: employee.hireDate?.toISOString() ?? null,
      cnasNumber: employee.cnasNumber,
    },
    documents: employee.documents.map(mapDoc),
    requests,
  };
}

/** Documents + demandes d'un employé, pour la vue RH (gestionnaire). */
export async function getEmployeeHrDossier(employeeId: string) {
  const [documents, requests] = await Promise.all([
    prisma.employeeDocument.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } }),
    prisma.hrDocumentRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, include: { fulfilment: { select: { id: true } } } }),
  ]);
  const reqs = requests.map(mapReq);
  await attachThreads(reqs);
  return { documents: documents.map(mapDoc), requests: reqs };
}

export interface HrQueueItem extends HrRequestDTO {
  employeeId: string;
  employeeName: string;
}

/** File des demandes RH ouvertes (pour la page /rh). */
export async function getHrRequestQueue(): Promise<HrQueueItem[]> {
  const rows = await prisma.hrDocumentRequest.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    orderBy: { createdAt: "asc" },
    include: { employee: { select: { id: true, fullName: true } }, fulfilment: { select: { id: true } } },
    take: 50,
  });
  return rows.map((r) => ({ ...mapReq(r), employeeId: r.employee.id, employeeName: r.employee.fullName }));
}
