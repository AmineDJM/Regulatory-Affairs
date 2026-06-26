import type { HrDocumentCategory, HrRequestType, HrRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  return { id: r.id, type: r.type, status: r.status, details: r.details, hrNote: r.hrNote, createdAt: r.createdAt.toISOString(), fulfilmentDocId: r.fulfilment?.id ?? null };
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
    requests: employee.hrRequests.map(mapReq),
  };
}

/** Documents + demandes d'un employé, pour la vue RH (gestionnaire). */
export async function getEmployeeHrDossier(employeeId: string) {
  const [documents, requests] = await Promise.all([
    prisma.employeeDocument.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } }),
    prisma.hrDocumentRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, include: { fulfilment: { select: { id: true } } } }),
  ]);
  return { documents: documents.map(mapDoc), requests: requests.map(mapReq) };
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
