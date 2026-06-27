import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";

/**
 * Adventum Brain — moteur Risk Radar. **Lecture seule, calculé à la volée** (aucune
 * table de risque). Chaque détecteur interroge des données RÉELLES et produit des
 * « Risk Cards » : niveau, objet, impact, responsable, cause probable, preuves,
 * action recommandée (réutilisant les mécanismes existants : Tâche, Notification).
 */

export type RiskLevel = "critical" | "high" | "medium" | "low";

/** Action proposée par l'Autopilot — exécutée seulement après confirmation. */
export type AutopilotPayload =
  | { kind: "task"; title: string; assigneeId?: string | null; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; module?: string }
  | { kind: "notify"; role?: UserRole; userId?: string | null; title: string; body: string; link?: string };

export interface RiskAction {
  label: string;
  icon?: string;
  /** Présent → ouvre la confirmation Autopilot. */
  payload?: AutopilotPayload;
  /** Présent → simple lien d'ouverture (pas d'action). */
  href?: string;
}

export interface Risk {
  id: string;
  level: RiskLevel;
  category: string; // clé de filtre : REGULATORY | PCH | BUDGET | EVENTS | MEDICAL | CONGRESS | SPONSORING | FINANCE | QUALITY | DOCUMENTS | VALIDATION | DIRECTIVES
  module: string; // libellé lisible
  title: string;
  object: string;
  impact: string;
  owner: string;
  deadline: string | null;
  ageDays: number | null;
  probableCause: string;
  recommendation: string;
  evidence: string[];
  href: string | null;
  actions: RiskAction[];
  /** Date pertinente pour le fil (détection ≈ date du signal). */
  at: string;
}

const LEVEL_RANK: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const DAY = 86_400_000;
const daysSince = (d: Date | null | undefined): number | null => (d ? Math.floor((Date.now() - d.getTime()) / DAY) : null);
const daysUntil = (d: Date | null | undefined): number | null => (d ? Math.ceil((d.getTime() - Date.now()) / DAY) : null);

// Quelques responsables types (résolus une fois, réutilisés par les détecteurs).
async function firstActive(role: UserRole): Promise<{ id: string; name: string } | null> {
  return prisma.user.findFirst({ where: { role, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ───────────────────────────── Détecteurs ─────────────────────────────

async function pchCautionRisks(): Promise<Risk[]> {
  const tenders = await prisma.pchTender.findMany({
    where: { status: { not: "COMPLETED" }, cautionEnd: { not: null } },
    select: { id: true, reference: true, supplier: true, cautionEnd: true, cautionDeposited: true, cautionAmount: true },
  });
  const finance = await firstActive("FINANCE_BUDGET_MANAGER");
  const out: Risk[] = [];
  for (const t of tenders) {
    const left = daysUntil(t.cautionEnd);
    if (left === null || left > 30) continue;
    const level: RiskLevel = left <= 0 ? "critical" : left <= 7 ? "critical" : left <= 15 ? "high" : "medium";
    out.push({
      id: `pch-caution-${t.id}`, level, category: "PCH", module: "PCH — Marchés",
      title: left <= 0 ? "Caution PCH expirée" : "Caution PCH proche de l'expiration",
      object: t.reference, impact: "Risque administratif / financier (marché exposé).",
      owner: "Finance", deadline: t.cautionEnd?.toISOString() ?? null, ageDays: null,
      probableCause: "Aucune action de renouvellement créée.",
      recommendation: `Renouveler ou récupérer la caution ${t.reference} avant le ${t.cautionEnd?.toLocaleDateString("fr-FR")}.`,
      evidence: [
        `Échéance caution : ${t.cautionEnd?.toLocaleDateString("fr-FR")} (${left <= 0 ? "dépassée" : `dans ${left} j`})`,
        `Caution déposée : ${t.cautionDeposited ? "oui" : "non"}`,
        t.cautionAmount ? `Montant : ${formatCurrency(toNumber(t.cautionAmount))}` : "Montant non renseigné",
        t.supplier ? `Fournisseur : ${t.supplier}` : "Fournisseur non renseigné",
      ],
      href: `/pch/${t.id}`, at: new Date().toISOString(),
      actions: [
        { label: "Créer tâche Finance", icon: "ListChecks", payload: { kind: "task", title: `Renouveler/récupérer la caution ${t.reference} avant le ${t.cautionEnd?.toLocaleDateString("fr-FR")}`, assigneeId: finance?.id, priority: level === "critical" ? "CRITICAL" : "HIGH", module: "PCH" } },
        { label: "Notifier Direction", icon: "Bell", payload: { kind: "notify", role: "DIRECTION", title: "Caution PCH à renouveler", body: `${t.reference} — échéance ${t.cautionEnd?.toLocaleDateString("fr-FR")}`, link: `/pch/${t.id}` } },
        { label: "Ouvrir PCH", icon: "ExternalLink", href: `/pch/${t.id}` },
      ],
    });
  }
  return out;
}

type CongressRow = { id: string; name: string; requestStatus: string; updatedAt: Date; productManagerId: string | null; requesterId: string | null };
async function congressLikeRisks(): Promise<Risk[]> {
  const [intl, natl] = await Promise.all([
    prisma.congressInternational.findMany({ where: { requestStatus: { in: ["PRELIMINARY_APPROVED", "AWAITING_FINAL"] } }, select: { id: true, name: true, requestStatus: true, updatedAt: true, productManagerId: true, requesterId: true } }),
    prisma.congressNational.findMany({ where: { requestStatus: { in: ["PRELIMINARY_APPROVED", "AWAITING_FINAL"] } }, select: { id: true, name: true, requestStatus: true, updatedAt: true, productManagerId: true, requesterId: true } }),
  ]);
  const rows: (CongressRow & { kind: "ci" | "cn" })[] = [
    ...intl.map((c) => ({ ...c, kind: "ci" as const })),
    ...natl.map((c) => ({ ...c, kind: "cn" as const })),
  ];
  const out: Risk[] = [];
  for (const c of rows) {
    const age = daysSince(c.updatedAt) ?? 0;
    if (age < 4) continue; // délai normal ~3 j
    const awaitingPm = c.requestStatus === "PRELIMINARY_APPROVED";
    const level: RiskLevel = age >= 10 ? "critical" : age >= 6 ? "high" : "medium";
    const path = c.kind === "ci" ? "/congress-international" : "/congress-national";
    out.push({
      id: `congress-${c.kind}-${c.id}`, level, category: "CONGRESS", module: c.kind === "ci" ? "Congrès international" : "Congrès national",
      title: "Congrès bloqué", object: c.name,
      impact: "Validation définitive impossible ; logistique non lancée ; risque de hausse des prix billets/hôtels.",
      owner: awaitingPm ? "Chef de produit" : "Direction", deadline: null, ageDays: age,
      probableCause: awaitingPm ? "Analyse du chef de produit non soumise." : "Validation définitive de la Direction en attente.",
      recommendation: awaitingPm ? "Relancer le chef de produit aujourd'hui." : "Trancher la validation définitive.",
      evidence: [
        `Statut : ${awaitingPm ? "analyse chef de produit" : "validation définitive"}`,
        `Sans évolution depuis ${age} j (délai normal ~3 j)`,
        awaitingPm ? (c.productManagerId ? "Chef de produit assigné, aucun budget proposé" : "Aucun chef de produit assigné") : "Analyse soumise, décision en attente",
      ],
      href: `${path}/${c.id}`, at: c.updatedAt.toISOString(),
      actions: [
        awaitingPm && c.productManagerId
          ? { label: "Relancer chef de produit", icon: "Bell", payload: { kind: "notify", userId: c.productManagerId, title: "Analyse de congrès en attente", body: `${c.name} — bloqué depuis ${age} j`, link: `${path}/${c.id}` } }
          : { label: "Notifier Direction", icon: "Bell", payload: { kind: "notify", role: "DIRECTION", title: "Congrès en attente de décision", body: `${c.name} — depuis ${age} j`, link: `${path}/${c.id}` } },
        { label: "Créer une relance", icon: "ListChecks", payload: { kind: "task", title: `Débloquer le congrès « ${c.name} » (en attente depuis ${age} j)`, assigneeId: c.productManagerId, priority: level === "critical" ? "CRITICAL" : "HIGH", module: "Congrès" } },
        { label: "Ouvrir dossier", icon: "ExternalLink", href: `${path}/${c.id}` },
      ],
    });
  }
  return out;
}

async function sponsoringRisks(): Promise<Risk[]> {
  const rows = await prisma.sponsoringRequest.findMany({
    where: { status: { in: ["PRELIMINARY_APPROVED", "AWAITING_FINAL", "AWAITING_FINAL_APPEAL"] } },
    select: { id: true, reference: true, institution: true, status: true, updatedAt: true, productManagerId: true },
  });
  const out: Risk[] = [];
  for (const s of rows) {
    const age = daysSince(s.updatedAt) ?? 0;
    if (age < 4) continue;
    const awaitingPm = s.status === "PRELIMINARY_APPROVED";
    const level: RiskLevel = age >= 10 ? "high" : "medium";
    out.push({
      id: `spo-${s.id}`, level, category: "SPONSORING", module: "Sponsoring",
      title: "Sponsoring bloqué", object: `${s.reference} — ${s.institution}`,
      impact: "Décision retardée ; engagement vis-à-vis de l'institution en suspens.",
      owner: awaitingPm ? "Chef de produit" : "Direction", deadline: null, ageDays: age,
      probableCause: awaitingPm ? "Analyse du chef de produit non soumise." : "Décision définitive de la Direction en attente.",
      recommendation: awaitingPm ? "Relancer le chef de produit." : "Rendre la décision définitive.",
      evidence: [`Statut : ${awaitingPm ? "analyse chef de produit" : "décision Direction"}`, `Sans évolution depuis ${age} j`],
      href: `/sponsoring/${s.id}`, at: s.updatedAt.toISOString(),
      actions: [
        awaitingPm && s.productManagerId
          ? { label: "Relancer chef de produit", icon: "Bell", payload: { kind: "notify", userId: s.productManagerId, title: "Analyse de sponsoring en attente", body: `${s.reference} — depuis ${age} j`, link: `/sponsoring/${s.id}` } }
          : { label: "Notifier Direction", icon: "Bell", payload: { kind: "notify", role: "DIRECTION", title: "Sponsoring en attente de décision", body: `${s.reference} — depuis ${age} j`, link: `/sponsoring/${s.id}` } },
        { label: "Ouvrir dossier", icon: "ExternalLink", href: `/sponsoring/${s.id}` },
      ],
    });
  }
  return out;
}

async function medicalKolRisks(): Promise<Risk[]> {
  const doctors = await prisma.medicalDoctor.findMany({
    where: { influenceLevel: { in: ["KEY_OPINION_LEADER", "HIGH"] } },
    select: { id: true, name: true, title: true, specialty: true, targetProducts: true, lastVisit: true, delegateId: true, delegate: { select: { name: true } } },
    take: 200,
  });
  const out: Risk[] = [];
  for (const d of doctors) {
    const age = daysSince(d.lastVisit);
    if (age !== null && age < 60) continue; // visité récemment → pas un risque
    const level: RiskLevel = age === null || age >= 90 ? "high" : "medium";
    const since = age === null ? "jamais enregistrée" : `il y a ${age} j`;
    out.push({
      id: `kol-${d.id}`, level, category: "MEDICAL", module: "Promotion médicale",
      title: "Médecin stratégique non visité", object: `${d.title ? d.title + " " : ""}${d.name}`,
      impact: "Perte d'engagement et risque concurrentiel.",
      owner: d.delegate?.name ?? "Délégué", deadline: null, ageDays: age,
      probableCause: "Aucune visite récente planifiée.",
      recommendation: "Planifier une visite cette semaine.",
      evidence: [
        d.specialty ? `Spécialité : ${d.specialty}` : "Spécialité non renseignée",
        `Dernière visite : ${since}`,
        d.targetProducts ? `Produits liés : ${d.targetProducts}` : "Produits non renseignés",
        d.delegate?.name ? `Délégué : ${d.delegate.name}` : "Aucun délégué assigné",
      ],
      href: `/medical`, at: (d.lastVisit ?? new Date(0)).toISOString(),
      actions: [
        d.delegateId
          ? { label: "Message délégué", icon: "Bell", payload: { kind: "notify", userId: d.delegateId, title: "Médecin KOL à visiter", body: `${d.name} — non visité ${since}`, link: `/medical` } }
          : { label: "Notifier Promotion médicale", icon: "Bell", payload: { kind: "notify", role: "MEDICAL_PROMOTION_MANAGER", title: "Médecin KOL sans délégué", body: d.name, link: `/medical` } },
        { label: "Créer tâche visite", icon: "ListChecks", payload: { kind: "task", title: `Planifier une visite : ${d.name} (KOL non visité ${since})`, assigneeId: d.delegateId, priority: "HIGH", module: "Promotion médicale" } },
        { label: "Voir médecin", icon: "ExternalLink", href: `/medical` },
      ],
    });
  }
  return out.slice(0, 12);
}

async function expenseOrderRisks(): Promise<Risk[]> {
  const orders = await prisma.expenseOrder.findMany({ where: { status: "PENDING" }, select: { id: true, reference: true, label: true, amount: true, createdAt: true, dueDate: true } });
  const finance = await firstActive("FINANCE_BUDGET_MANAGER");
  const out: Risk[] = [];
  for (const o of orders) {
    const age = daysSince(o.createdAt) ?? 0;
    if (age < 7) continue;
    const level: RiskLevel = age >= 21 ? "high" : "medium";
    out.push({
      id: `od-${o.id}`, level, category: "FINANCE", module: "Espace comptable",
      title: "Ordre de dépense non réglé", object: `${o.reference} — ${o.label}`,
      impact: "Règlement en retard ; relation fournisseur/bénéficiaire exposée.",
      owner: "Comptable", deadline: o.dueDate?.toISOString() ?? null, ageDays: age,
      probableCause: "Aucun règlement effectué depuis l'émission.",
      recommendation: "Régler ou demander une révision de budget.",
      evidence: [`Montant : ${formatCurrency(toNumber(o.amount))}`, `Émis il y a ${age} j`, o.dueDate ? `Échéance : ${o.dueDate.toLocaleDateString("fr-FR")}` : "Pas d'échéance"],
      href: `/finances/ordres-de-depense`, at: o.createdAt.toISOString(),
      actions: [
        { label: "Notifier comptable", icon: "Bell", payload: { kind: "notify", userId: finance?.id, role: finance ? undefined : "FINANCE_BUDGET_MANAGER", title: "Ordre de dépense à régler", body: `${o.reference} — ${formatCurrency(toNumber(o.amount))}`, link: `/finances/ordres-de-depense` } },
        { label: "Ouvrir", icon: "ExternalLink", href: `/finances/ordres-de-depense` },
      ],
    });
  }
  return out;
}

async function budgetRisks(): Promise<Risk[]> {
  const envelope = await prisma.budgetEnvelope.findFirst({ where: { isActive: true }, orderBy: { periodStart: "desc" }, select: { id: true } });
  if (!envelope) return [];
  const lines = await prisma.budgetCategoryLine.findMany({ where: { envelopeId: envelope.id }, select: { id: true, name: true, allocated: true } });
  const out: Risk[] = [];
  for (const l of lines) {
    const allocated = toNumber(l.allocated);
    if (allocated <= 0) continue;
    const agg = await prisma.financeTransaction.aggregate({ where: { budgetCategoryId: l.id, direction: "OUT" }, _sum: { amount: true } });
    const consumed = toNumber(agg._sum.amount ?? 0);
    const ratio = consumed / allocated;
    if (ratio < 0.85) continue;
    const level: RiskLevel = ratio >= 1 ? "critical" : ratio >= 0.95 ? "high" : "medium";
    out.push({
      id: `budget-${l.id}`, level, category: "BUDGET", module: "Budgets",
      title: ratio >= 1 ? "Budget dépassé" : "Budget à surveiller", object: l.name,
      impact: "Risque de dépassement budgétaire.",
      owner: "Direction / Finance", deadline: null, ageDays: null,
      probableCause: "Consommation élevée des dépenses attribuées.",
      recommendation: ratio >= 1 ? "Arbitrer : réallouer ou geler les engagements." : "Surveiller et anticiper les prochains engagements.",
      evidence: [`Consommé : ${formatCurrency(consumed)} / ${formatCurrency(allocated)} (${Math.round(ratio * 100)} %)`],
      href: `/budgets`, at: new Date().toISOString(),
      actions: [
        { label: "Notifier Direction", icon: "Bell", payload: { kind: "notify", role: "DIRECTION", title: "Alerte budget", body: `${l.name} consommé à ${Math.round(ratio * 100)} %`, link: `/budgets` } },
        { label: "Ouvrir budgets", icon: "ExternalLink", href: `/budgets` },
      ],
    });
  }
  return out;
}

async function medicalInfoRisks(): Promise<Risk[]> {
  const decls = await prisma.medicalInfoDeclaration.findMany({ where: { status: { in: ["AWAITING_REVIEW", "DOCS_REQUESTED"] } }, select: { id: true, reference: true, label: true, updatedAt: true, pharmacistId: true } });
  const out: Risk[] = [];
  for (const d of decls) {
    const age = daysSince(d.updatedAt) ?? 0;
    if (age < 5) continue;
    out.push({
      id: `mi-${d.id}`, level: age >= 14 ? "high" : "medium", category: "REGULATORY", module: "Information médicale",
      title: "Déclaration réglementaire en attente", object: `${d.reference} — ${d.label}`,
      impact: "Ordre de dépense bloqué tant que le pharmacien n'a pas validé.",
      owner: "Pharmacien information médicale", deadline: null, ageDays: age,
      probableCause: "Déclaration aux autorités / validation non finalisée.",
      recommendation: "Relancer le pharmacien responsable.",
      evidence: [`Sans évolution depuis ${age} j`],
      href: `/information-medicale/${d.id}`, at: d.updatedAt.toISOString(),
      actions: [
        { label: "Relancer pharmacien", icon: "Bell", payload: { kind: "notify", userId: d.pharmacistId, role: d.pharmacistId ? undefined : "MEDICAL_INFO_PHARMACIST", title: "Déclaration en attente", body: `${d.reference} — depuis ${age} j`, link: `/information-medicale/${d.id}` } },
        { label: "Ouvrir", icon: "ExternalLink", href: `/information-medicale/${d.id}` },
      ],
    });
  }
  return out;
}

async function directiveRisks(): Promise<Risk[]> {
  const dirs = await prisma.directive.findMany({ where: { status: { notIn: ["DONE", "ARCHIVED"] }, dueDate: { lt: new Date() } }, select: { id: true, reference: true, title: true, dueDate: true, targetUserId: true, targetRole: true } });
  return dirs.map((d) => ({
    id: `dir-${d.id}`, level: "medium" as RiskLevel, category: "DIRECTIVES", module: "Directives",
    title: "Directive en retard", object: `${d.reference} — ${d.title}`,
    impact: "Instruction de la Direction non traitée dans les délais.",
    owner: d.targetRole ?? "Destinataire", deadline: d.dueDate?.toISOString() ?? null, ageDays: daysSince(d.dueDate),
    probableCause: "Échéance dépassée sans clôture.",
    recommendation: "Relancer le destinataire.",
    evidence: [`Échéance dépassée : ${d.dueDate?.toLocaleDateString("fr-FR")}`],
    href: `/directives/${d.id}`, at: (d.dueDate ?? new Date()).toISOString(),
    actions: [
      { label: "Relancer", icon: "Bell", payload: d.targetUserId ? { kind: "notify", userId: d.targetUserId, title: "Directive en retard", body: d.title, link: `/directives/${d.id}` } : { kind: "notify", role: d.targetRole ?? "DIRECTION", title: "Directive en retard", body: d.title, link: `/directives/${d.id}` } },
      { label: "Ouvrir", icon: "ExternalLink", href: `/directives/${d.id}` },
    ],
  }));
}

async function silentSupplierRisks(): Promise<Risk[]> {
  const cutoff = new Date(Date.now() - 14 * DAY);
  const prods = await prisma.regulatoryProduct.findMany({
    where: { portalVisible: true, supplierId: { not: null }, status: { notIn: ["CLOSED", "DECISION_OBTAINED"] }, OR: [{ externalUpdatedAt: null }, { externalUpdatedAt: { lt: cutoff } }] },
    select: { id: true, dci: true, reference: true, externalUpdatedAt: true, supplier: { select: { name: true } } },
    take: 50,
  });
  return prods.map((p) => {
    const age = daysSince(p.externalUpdatedAt);
    return {
      id: `supplier-${p.id}`, level: (age !== null && age >= 30 ? "high" : "medium") as RiskLevel, category: "REGULATORY", module: "Regulatory",
      title: "Fournisseur silencieux", object: `${p.reference} — ${p.dci}`,
      impact: "Dossier Regulatory ralenti faute de retour fournisseur.",
      owner: p.supplier?.name ?? "Fournisseur", deadline: null, ageDays: age,
      probableCause: "Aucune mise à jour du fournisseur sur le portail.",
      recommendation: "Relancer le fournisseur via le portail.",
      evidence: [p.supplier?.name ? `Fournisseur : ${p.supplier.name}` : "Fournisseur lié", age === null ? "Aucune mise à jour externe" : `Dernière mise à jour il y a ${age} j`],
      href: `/regulatory/${p.id}`, at: (p.externalUpdatedAt ?? new Date(0)).toISOString(),
      actions: [{ label: "Ouvrir le dossier", icon: "ExternalLink", href: `/regulatory/${p.id}` }],
    };
  });
}

async function qualitySignalRisks(): Promise<Risk[]> {
  const cutoff = new Date(Date.now() - 30 * DAY);
  const reports = await prisma.fieldReport.findMany({
    where: { qualitySignal: { not: null }, createdAt: { gte: cutoff } },
    select: { id: true, qualitySignal: true, doctorName: true, products: true, createdAt: true, delegate: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 30,
  });
  return reports.filter((r) => (r.qualitySignal ?? "").trim().length > 0).map((r) => ({
    id: `quality-${r.id}`, level: "high" as RiskLevel, category: "QUALITY", module: "Rapports terrain",
    title: "Signal qualité / pharmacovigilance", object: r.products?.slice(0, 60) || "Signalement terrain",
    impact: "Sujet qualité/PV à tracer (confirmation renforcée requise).",
    owner: r.delegate?.name ?? "Délégué", deadline: null, ageDays: daysSince(r.createdAt),
    probableCause: "Signalement remonté du terrain, à instruire.",
    recommendation: "Instruire le signalement et confirmer avec le responsable qualité.",
    evidence: [`Signal : ${(r.qualitySignal ?? "").slice(0, 160)}`, r.doctorName ? `Médecin : ${r.doctorName}` : "", r.delegate?.name ? `Remonté par : ${r.delegate.name}` : ""].filter(Boolean),
    href: `/field-reports/${r.id}`, at: r.createdAt.toISOString(),
    actions: [
      { label: "Créer tâche de suivi", icon: "ListChecks", payload: { kind: "task", title: `Instruire signalement qualité/PV (${r.products?.slice(0, 40) || "terrain"})`, priority: "HIGH", module: "Qualité" } },
      { label: "Ouvrir le rapport", icon: "ExternalLink", href: `/field-reports/${r.id}` },
    ],
  }));
}

const DETECTORS: (() => Promise<Risk[]>)[] = [
  pchCautionRisks, congressLikeRisks, sponsoringRisks, medicalKolRisks, expenseOrderRisks,
  budgetRisks, medicalInfoRisks, directiveRisks, silentSupplierRisks, qualitySignalRisks,
];

/** Calcule tous les risques (détecteurs en parallèle, tolérants aux pannes), triés par gravité. */
export async function getRisks(): Promise<Risk[]> {
  const results = await Promise.all(DETECTORS.map((d) => d().catch((e) => { console.error("[brain] detector failed", e); return [] as Risk[]; })));
  return results.flat().sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || (b.ageDays ?? 0) - (a.ageDays ?? 0));
}
