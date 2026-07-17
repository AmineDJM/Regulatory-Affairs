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
  // Note de frais
  expenseMonth: string | null;
  approvedMonth: string | null;
  originalsAckAt: string | null;
  originalsAckByName: string | null;
  // Congé / absence : période demandée + jours + débit du solde effectué (congé annuel).
  periodStart: string | null;
  periodEnd: string | null;
  periodDays: number | null;
  balanceApplied: boolean;
  // Entrevue RH
  meetingAt: string | null;
  meetingProposedById: string | null;
  meetingConfirmedAt: string | null;
  // Archive « Dossier traité » (Drive)
  archivedNodeId: string | null;
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
    // Rémunération visible par le salarié (brut, Ret SS 35 % et TFP exclus volontairement).
    baseSalary: number | null;
    retSS9: number | null;
    retIrg: number | null;
    expenseRefund: number | null;
    netToPay: number | null;
  };
  documents: HrDocumentDTO[];
  requests: HrRequestDTO[];
}

function mapDoc(d: { id: string; category: HrDocumentCategory; name: string; mime: string; size: number; period: string | null; createdAt: Date }): HrDocumentDTO {
  return { id: d.id, category: d.category, name: d.name, mime: d.mime, size: d.size, period: d.period, createdAt: d.createdAt.toISOString() };
}

type ReqRow = {
  id: string; type: HrRequestType; status: HrRequestStatus; details: string | null; hrNote: string | null;
  createdAt: Date; fulfilment: { id: string } | null;
  expenseMonth: string | null; approvedMonth: string | null; originalsAckAt: Date | null; originalsAckById: string | null;
  periodStart: Date | null; periodEnd: Date | null; periodDays: unknown; balanceAppliedAt: Date | null;
  meetingAt: Date | null; meetingProposedById: string | null; meetingConfirmedAt: Date | null;
  archivedNodeId: string | null;
};

function mapReq(r: ReqRow): HrRequestDTO {
  return {
    id: r.id, type: r.type, status: r.status, details: r.details, hrNote: r.hrNote,
    createdAt: r.createdAt.toISOString(), fulfilmentDocId: r.fulfilment?.id ?? null,
    expenseMonth: r.expenseMonth, approvedMonth: r.approvedMonth,
    originalsAckAt: r.originalsAckAt?.toISOString() ?? null,
    originalsAckByName: r.originalsAckById, // remplacé par le nom dans attachThreads
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    periodDays: r.periodDays == null ? null : Number(r.periodDays.toString()),
    balanceApplied: Boolean(r.balanceAppliedAt),
    meetingAt: r.meetingAt?.toISOString() ?? null,
    meetingProposedById: r.meetingProposedById,
    meetingConfirmedAt: r.meetingConfirmedAt?.toISOString() ?? null,
    archivedNodeId: r.archivedNodeId,
    documents: [], comments: [],
  };
}

/** Charge pièces jointes + fil d'échange + noms (accusé de réception) de chaque demande RH. */
async function attachThreads(requests: HrRequestDTO[]): Promise<void> {
  const ids = requests.map((r) => r.id);
  if (ids.length === 0) return;
  const ackIds = [...new Set(requests.map((r) => r.originalsAckByName).filter((v): v is string => Boolean(v)))];
  const [documents, comments, ackUsers] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "HR_REQUEST", entityId: { in: ids } }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.comment.findMany({ where: { entityType: "HR_REQUEST", entityId: { in: ids } }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    ackIds.length ? prisma.user.findMany({ where: { id: { in: ackIds } }, select: { id: true, name: true } }) : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const ackNameById = new Map(ackUsers.map((u) => [u.id, u.name]));
  for (const r of requests) {
    if (r.originalsAckByName) r.originalsAckByName = ackNameById.get(r.originalsAckByName) ?? null;
  }
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
  const num = (v: unknown) => (v == null ? null : Number(v.toString()));
  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      department: employee.department,
      contractType: employee.contractType,
      hireDate: employee.hireDate?.toISOString() ?? null,
      cnasNumber: employee.cnasNumber,
      baseSalary: num(employee.baseSalary),
      retSS9: num(employee.retSS9),
      retIrg: num(employee.retIrg),
      expenseRefund: num(employee.expenseRefund),
      netToPay: num(employee.netToPay),
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
