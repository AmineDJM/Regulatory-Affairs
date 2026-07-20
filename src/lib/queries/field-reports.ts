import { hasGlobalView, hasRole, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** Lecture des rapports terrain (vocaux). Un délégué voit les siens ; un manager
 *  / la Direction / un chef de produit **gèrent** tout (édition + validation + synthèse).
 *  Le **superviseur national** (National Sales), lui, **voit** tous les rapports des
 *  délégués (lecture + synthèse), sans les éditer. */

export function managesReports(user: SessionUser): boolean {
  return hasGlobalView(user) || user.role === "MEDICAL_PROMOTION_MANAGER" || user.role === "PRODUCT_MANAGER";
}

/** Voit TOUS les rapports (managers + superviseur national). */
export function viewsAllReports(user: SessionUser): boolean {
  return managesReports(user) || hasRole(user, "NATIONAL_SALES");
}

/** Peut voir l'onglet « Overview » (graphes d'analyse) : Super Admin, ou un rôle que le Super
 *  Admin a explicitement autorisé (réglage `fieldReportsOverviewRoles`, configuré en Administration). */
export function canViewFieldReportsOverview(user: SessionUser, overviewRoles: string[]): boolean {
  return user.role === "SUPER_ADMIN" || overviewRoles.includes(user.role) || overviewRoles.includes(user.secondaryRole ?? "");
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
  doctorIds: string[]; // médecins (annuaire) de la visite
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
    where: viewsAllReports(user) ? {} : { delegateId: user.id },
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
  // Le superviseur national peut CONSULTER sans éditer.
  if (!canEdit && !viewsAllReports(user)) return null;

  return {
    id: r.id, status: r.status, visitDate: r.visitDate.toISOString(),
    transcript: r.transcript, hasAudio: Boolean(r.audioBlobId),
    doctorId: r.doctorId, doctorIds: r.doctorIds.length ? r.doctorIds : (r.doctorId ? [r.doctorId] : []),
    doctorName: r.doctorName, institution: r.institution, specialty: r.specialty,
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

// ─────────── Overview (graphes d'analyse) — suivi des rapports terrain ───────────

export interface NamedCount { name: string; value: number }
export interface FieldReportsOverview {
  kpis: { reports: number; validated: number; doctors: number; institutions: number; delegates: number; specialties: number };
  byMonth: NamedCount[]; // 12 derniers mois (nombre de visites)
  byDoctor: NamedCount[]; // top médecins visités
  byInstitution: NamedCount[]; // top hôpitaux / établissements
  byDelegate: NamedCount[]; // visites par délégué
  bySpecialty: NamedCount[]; // visites par spécialité
  byStatus: NamedCount[]; // brouillon / validé / archivé
  topProducts: NamedCount[]; // produits les plus discutés
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * Données d'analyse des rapports terrain (onglet « Overview ») : volumes de visites par
 * médecin / hôpital / délégué / spécialité, tendance sur 12 mois, répartition par statut et
 * produits les plus discutés. Calculé sur l'ensemble des rapports (cap raisonnable).
 */
export async function getFieldReportsOverview(): Promise<FieldReportsOverview> {
  const reports = await prisma.fieldReport.findMany({
    orderBy: { visitDate: "desc" },
    take: 5000,
    include: { delegate: { select: { name: true } }, doctor: { select: { name: true } } },
  });

  const top = (m: Map<string, number>, n: number): NamedCount[] =>
    [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, n);

  const byDoctor = new Map<string, number>();
  const byInstitution = new Map<string, number>();
  const byDelegate = new Map<string, number>();
  const bySpecialty = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const institutionSet = new Set<string>();
  const doctorSet = new Set<string>();
  const specialtySet = new Set<string>();
  const delegateSet = new Set<string>();

  // 12 derniers mois (buckets ordonnés, du plus ancien au plus récent).
  const now = new Date();
  const monthKeys: string[] = [];
  const monthLabels = new Map<string, string>();
  const byMonth = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthKeys.push(key);
    monthLabels.set(key, `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
    byMonth.set(key, 0);
  }

  const inc = (m: Map<string, number>, k: string | null | undefined) => {
    const key = (k ?? "").trim();
    if (key) m.set(key, (m.get(key) ?? 0) + 1);
  };

  let validated = 0;
  for (const r of reports) {
    const doctor = (r.doctor?.name ?? r.doctorName ?? "").trim();
    const institution = (r.institution ?? "").trim();
    const delegate = (r.delegate?.name ?? "").trim();
    const specialty = (r.specialty ?? "").trim();
    if (doctor) { inc(byDoctor, doctor); doctorSet.add(doctor.toLowerCase()); }
    if (institution) { inc(byInstitution, institution); institutionSet.add(institution.toLowerCase()); }
    if (delegate) { inc(byDelegate, delegate); delegateSet.add(delegate.toLowerCase()); }
    if (specialty) { inc(bySpecialty, specialty); specialtySet.add(specialty.toLowerCase()); }
    for (const p of (r.products ?? "").split(/[,;/]/).map((s) => s.trim()).filter(Boolean)) inc(byProduct, p);
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    if (r.status === "VALIDATED") validated++;
    const mk = `${r.visitDate.getFullYear()}-${r.visitDate.getMonth()}`;
    if (byMonth.has(mk)) byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
  }

  return {
    kpis: { reports: reports.length, validated, doctors: doctorSet.size, institutions: institutionSet.size, delegates: delegateSet.size, specialties: specialtySet.size },
    byMonth: monthKeys.map((k) => ({ name: monthLabels.get(k)!, value: byMonth.get(k) ?? 0 })),
    byDoctor: top(byDoctor, 12),
    byInstitution: top(byInstitution, 12),
    byDelegate: top(byDelegate, 15),
    bySpecialty: top(bySpecialty, 10),
    byStatus: [...byStatus.entries()].map(([name, value]) => ({ name, value })),
    topProducts: top(byProduct, 10),
  };
}
