import { hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** Lecture des rapports terrain (vocaux). Un délégué voit les siens ; un manager
 *  / la Direction / un chef de produit voient tout et la synthèse agrégée. */

export function managesReports(user: SessionUser): boolean {
  return hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER" || user.role === "PRODUCT_MANAGER";
}

export interface FieldReportListItem {
  id: string;
  status: string;
  visitDate: string;
  doctorName: string | null;
  specialty: string | null;
  products: string | null;
  summary: string | null;
  delegateName: string | null;
  attachments: number;
  validatedAt: string | null;
}

export interface FieldReportAttachmentDTO { id: string; name: string; mime: string; size: number; isImage: boolean }

export interface FieldReportDetail {
  id: string;
  status: string;
  visitDate: string;
  transcript: string | null;
  hasAudio: boolean;
  doctorId: string | null;
  doctorName: string | null;
  institution: string | null;
  specialty: string | null;
  products: string | null;
  interest: string | null;
  objection: string | null;
  medicalQuestion: string | null;
  documentRequest: string | null;
  sponsoringRequest: string | null;
  careRequest: string | null;
  competitorInfo: string | null;
  opportunity: string | null;
  qualitySignal: string | null;
  nextAction: string | null;
  summary: string | null;
  aiNotes: string | null;
  delegateName: string | null;
  validatedAt: string | null;
  attachments: FieldReportAttachmentDTO[];
  canEdit: boolean;
}

export async function getMyFieldReports(user: SessionUser): Promise<FieldReportListItem[]> {
  const reports = await prisma.fieldReport.findMany({
    where: managesReports(user) ? {} : { delegateId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { delegate: { select: { name: true } }, doctor: { select: { name: true } }, _count: { select: { attachments: true } } },
  });
  return reports.map((r) => ({
    id: r.id, status: r.status, visitDate: r.visitDate.toISOString(),
    doctorName: r.doctor?.name ?? r.doctorName, specialty: r.specialty, products: r.products, summary: r.summary,
    delegateName: r.delegate?.name ?? null, attachments: r._count.attachments,
    validatedAt: r.validatedAt?.toISOString() ?? null,
  }));
}

export async function getFieldReportDetail(user: SessionUser, id: string): Promise<FieldReportDetail | null> {
  const r = await prisma.fieldReport.findUnique({
    where: { id },
    include: { delegate: { select: { name: true } }, attachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!r) return null;
  const canEdit = managesReports(user) || r.delegateId === user.id;
  if (!canEdit && !managesReports(user)) return null;

  return {
    id: r.id, status: r.status, visitDate: r.visitDate.toISOString(),
    transcript: r.transcript, hasAudio: Boolean(r.audioBlobId),
    doctorId: r.doctorId, doctorName: r.doctorName, institution: r.institution, specialty: r.specialty,
    products: r.products, interest: r.interest, objection: r.objection, medicalQuestion: r.medicalQuestion,
    documentRequest: r.documentRequest, sponsoringRequest: r.sponsoringRequest, careRequest: r.careRequest,
    competitorInfo: r.competitorInfo, opportunity: r.opportunity, qualitySignal: r.qualitySignal,
    nextAction: r.nextAction, summary: r.summary, aiNotes: r.aiNotes,
    delegateName: r.delegate?.name ?? null, validatedAt: r.validatedAt?.toISOString() ?? null,
    attachments: r.attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, isImage: a.mime.startsWith("image/") })),
    canEdit,
  };
}

export interface ReportSnippet { text: string; delegate: string | null; doctor: string | null; date: string }
export interface FieldReportAggregation {
  stats: { reports: number; doctors: number; withSponsoring: number; withCare: number; withQuality: number; withOpportunity: number };
  topProducts: { name: string; count: number }[];
  objections: ReportSnippet[];
  medicalQuestions: ReportSnippet[];
  competitors: ReportSnippet[];
  opportunities: ReportSnippet[];
  qualitySignals: ReportSnippet[];
  nextActions: ReportSnippet[];
  sponsoringRequests: ReportSnippet[];
}

/** Synthèse agrégée des rapports validés (vue Direction / managers). */
export async function getFieldReportsAggregation(): Promise<FieldReportAggregation> {
  const reports = await prisma.fieldReport.findMany({
    where: { status: "VALIDATED" },
    orderBy: { validatedAt: "desc" },
    take: 300,
    include: { delegate: { select: { name: true } }, doctor: { select: { name: true } } },
  });

  const snip = (text: string | null, r: (typeof reports)[number]): ReportSnippet | null =>
    text && text.trim() ? { text: text.trim(), delegate: r.delegate?.name ?? null, doctor: r.doctor?.name ?? r.doctorName, date: (r.validatedAt ?? r.createdAt).toISOString() } : null;

  const collect = (sel: (r: (typeof reports)[number]) => string | null): ReportSnippet[] =>
    reports.map((r) => snip(sel(r), r)).filter((x): x is ReportSnippet => x !== null).slice(0, 25);

  const doctorSet = new Set<string>();
  const productCount = new Map<string, number>();
  for (const r of reports) {
    const d = r.doctor?.name ?? r.doctorName;
    if (d) doctorSet.add(d.toLowerCase());
    for (const p of (r.products ?? "").split(/[,;/]/).map((s) => s.trim()).filter(Boolean)) {
      productCount.set(p, (productCount.get(p) ?? 0) + 1);
    }
  }

  return {
    stats: {
      reports: reports.length,
      doctors: doctorSet.size,
      withSponsoring: reports.filter((r) => r.sponsoringRequest?.trim()).length,
      withCare: reports.filter((r) => r.careRequest?.trim()).length,
      withQuality: reports.filter((r) => r.qualitySignal?.trim()).length,
      withOpportunity: reports.filter((r) => r.opportunity?.trim()).length,
    },
    topProducts: [...productCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    objections: collect((r) => r.objection),
    medicalQuestions: collect((r) => r.medicalQuestion),
    competitors: collect((r) => r.competitorInfo),
    opportunities: collect((r) => r.opportunity),
    qualitySignals: collect((r) => r.qualitySignal),
    nextActions: collect((r) => r.nextAction),
    sponsoringRequests: collect((r) => r.sponsoringRequest),
  };
}
