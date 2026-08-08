import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { regAudit } from "../audit";
import { PROCEDURE_TYPE_LABELS } from "../labels";
import { buildSimpleDocx, MISSING_MARKER, type SimplePara } from "./build-docx";

/** Résultat d'une production de document (rapport de constats, lettre de réponse). */
export interface GenerateResult {
  ok: boolean;
  error?: string;
  generatedDocId?: string;
  filename?: string;
  /** Éléments réellement repris du dossier. */
  used?: number;
  /** Éléments laissés « [À COMPLÉTER] » — jamais inventés. */
  missing?: number;
}

/**
 * DOCUMENTS COMPOSÉS DEPUIS L'ANALYSE — deux livrables que le pharmacien produisait à la main :
 *
 *   • le RAPPORT DE CONSTATS (.docx) : l'état exact de l'analyse, groupé par gravité, avec
 *     preuve, page et recommandation pour chaque constat — le document qu'on pose en réunion ;
 *   • la LETTRE DE RÉPONSE AUX RÉSERVES (.docx) : chaque réserve ANPP reprise MOT À MOT, suivie
 *     de la réponse approuvée (ou du brouillon, ou d'un « [À COMPLÉTER] » explicite — jamais
 *     d'invention).
 *
 * Les deux passent par le même circuit de stockage que la génération G10 (blob chiffré +
 * RegulatoryGeneratedDoc + audit) : la route de téléchargement existante les sert telle quelle.
 */

const SEV_ORDER = ["CRITICAL", "MAJOR", "MINOR", "INFO"] as const;
const SEV_LABELS: Record<string, string> = { CRITICAL: "CRITIQUE", MAJOR: "MAJEUR", MINOR: "MINEUR", INFO: "INFORMATION" };
const STATUS_LABELS: Record<string, string> = { OPEN: "Ouvert", ACKNOWLEDGED: "Pris en compte", RESOLVED: "Résolu", WAIVED: "Levé (justifié)" };

const sanitize = (s: string) => s.replace(/[^\w.\-]+/g, "_");

async function storeGenerated(opts: {
  dossierVersionId: string;
  dossier: { id: string; companyId: string; reference: string };
  templateCode: string;
  templateName: string;
  buffer: Buffer;
  filename: string;
  used: number;
  missing: number;
  actorId: string;
}): Promise<GenerateResult> {
  const stored = await putBlob(opts.buffer);
  const doc = await prisma.regulatoryGeneratedDoc.create({
    data: {
      dossierVersionId: opts.dossierVersionId, templateCode: opts.templateCode, templateVersion: "1.0",
      filename: opts.filename, blobId: stored.blobId, sizeBytes: stored.size,
      factsUsed: opts.used, factsMissing: opts.missing, generatedById: opts.actorId,
    },
    select: { id: true },
  });
  await regAudit({
    companyId: opts.dossier.companyId, actorId: opts.actorId, dossierId: opts.dossier.id, dossierVersionId: opts.dossierVersionId,
    action: "DOC_GENERATED",
    detail: `Document « ${opts.templateName} » généré : ${opts.used} élément(s), ${opts.missing} à compléter.`,
    meta: { templateCode: opts.templateCode },
  });
  return { ok: true, generatedDocId: doc.id, filename: opts.filename, used: opts.used, missing: opts.missing };
}

/** Rapport de constats de la version : l'analyse complète, dans l'ordre où on la défend. */
export async function buildFindingsReport(opts: { dossierVersionId: string; actorId: string }): Promise<GenerateResult> {
  const version = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: opts.dossierVersionId },
    select: {
      id: true, versionNo: true,
      dossier: { select: { id: true, companyId: true, reference: true, title: true, procedureType: true } },
    },
  });
  if (!version) return { ok: false, error: "Version introuvable." };

  const [findings, assessment] = await Promise.all([
    prisma.regulatoryFinding.findMany({
      where: { dossierVersionId: version.id },
      orderBy: { createdAt: "asc" },
      select: {
        severity: true, status: true, title: true, detail: true, excerpt: true, evidence: true,
        recommendation: true, ruleRef: true, sectionCode: true, page: true, documentId: true,
        blocker: true, source: true, reserveRisk: true, resolutionNote: true,
      },
    }),
    prisma.regulatoryAssessment.findUnique({
      where: { dossierVersionId: version.id },
      select: { completeness: true, conforme: true, blockers: true, criticals: true, majors: true, minors: true },
    }),
  ]);
  if (findings.length === 0) return { ok: false, error: "Aucun constat sur cette version — lancez d'abord l'analyse." };

  const docIds = [...new Set(findings.map((f) => f.documentId).filter((x): x is string => Boolean(x)))];
  const docs = await prisma.regulatoryDocument.findMany({ where: { id: { in: docIds } }, select: { id: true, originalFilename: true } });
  const docNames = new Map(docs.map((d) => [d.id, d.originalFilename]));

  const now = new Date();
  const paras: SimplePara[] = [
    { text: `Rapport de constats — ${version.dossier.reference}`, bold: true, size: 32 },
    { text: `${version.dossier.title} · ${PROCEDURE_TYPE_LABELS[version.dossier.procedureType] ?? String(version.dossier.procedureType)} · version ${version.versionNo} · ${now.toLocaleDateString("fr-FR")}`, size: 20 },
  ];
  if (assessment) {
    paras.push({
      text: `Bilan : complétude ${assessment.completeness} % · ${assessment.conforme ? "aucun bloqueur" : `${assessment.blockers} bloqueur(s) — non conforme en l'état`} · ${assessment.criticals} critique(s), ${assessment.majors} majeur(s), ${assessment.minors} mineur(s).`,
      size: 22,
    });
  }
  paras.push({ text: "Constats issus des contrôles déterministes, de la revue IA (relus ou marqués PROJET) et des revues humaines. Chaque constat cite sa pièce quand elle existe. Aide à la décision — la décision de soumettre appartient au pharmacien directeur technique.", italic: true, size: 18 });

  for (const sev of SEV_ORDER) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    paras.push({ text: `${SEV_LABELS[sev]} (${group.length})`, bold: true, size: 28 });
    let i = 0;
    for (const f of group) {
      i++;
      const flags = [f.blocker ? "BLOQUEUR" : null, f.source === "AI" ? "IA" : f.source === "HUMAN" ? "HUMAIN" : "RÈGLE", STATUS_LABELS[f.status] ?? f.status].filter(Boolean).join(" · ");
      paras.push({ text: `${i}. ${f.title} — [${flags}]`, bold: true, size: 22 });
      const where = [
        f.documentId ? docNames.get(f.documentId) : null,
        f.sectionCode ? `CTD ${f.sectionCode}` : null,
        f.page != null ? `page ${f.page}` : null,
        f.ruleRef ?? null,
      ].filter(Boolean).join(" · ");
      if (where) paras.push({ text: where, size: 18 });
      paras.push({ text: f.detail, size: 22 });
      const quote = f.excerpt ?? f.evidence;
      if (quote) paras.push({ text: `« ${quote.length > 500 ? `${quote.slice(0, 500)}…` : quote} »`, italic: true, size: 20 });
      if (f.recommendation) paras.push({ text: `À faire : ${f.recommendation}`, size: 20 });
      if (f.reserveRisk != null) paras.push({ text: `Probabilité de réserve ANPP (d'après nos précédents) : ${Math.round(f.reserveRisk * 100)} %.`, size: 18 });
      if (f.resolutionNote) paras.push({ text: `Note de revue : ${f.resolutionNote}`, italic: true, size: 18 });
    }
  }

  const buffer = buildSimpleDocx(paras);
  const filename = sanitize(`RAPPORT_CONSTATS_${version.dossier.reference}_v${version.versionNo}_${now.toISOString().slice(0, 10)}.docx`);
  return storeGenerated({
    dossierVersionId: version.id, dossier: version.dossier, templateCode: "RAPPORT_CONSTATS",
    templateName: "Rapport de constats", buffer, filename, used: findings.length, missing: 0, actorId: opts.actorId,
  });
}

/**
 * Lettre de réponse aux réserves d'un cycle : verbatim ANPP + réponse (approuvée, sinon
 * brouillon, sinon marqueur explicite). Document de travail — la signature reste humaine.
 */
export async function buildReserveResponseLetter(opts: { cycleId: string; actorId: string }): Promise<GenerateResult> {
  const cycle = await prisma.regulatoryReserveCycle.findUnique({
    where: { id: opts.cycleId },
    select: {
      id: true, cycle: true, receivedAt: true,
      dossier: { select: { id: true, companyId: true, reference: true, title: true, procedureType: true } },
      points: { orderBy: { ordinal: "asc" }, select: { ordinal: true, category: true, verbatim: true, proposedResponse: true, finalResponse: true, status: true } },
    },
  });
  if (!cycle) return { ok: false, error: "Cycle de réserves introuvable." };
  if (cycle.points.length === 0) return { ok: false, error: "Ce cycle ne contient aucun point de réserve." };

  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId: cycle.dossier.id }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, error: "Aucune version de dossier à laquelle rattacher la lettre." };

  const now = new Date();
  const paras: SimplePara[] = [
    { text: `Réponse aux réserves — ${cycle.dossier.reference}`, bold: true, size: 32 },
    { text: "À l'attention de l'Agence Nationale des Produits Pharmaceutiques (ANPP)", size: 22 },
    { text: `Objet : réponses aux réserves émises sur le dossier ${cycle.dossier.reference} — ${cycle.dossier.title} (cycle ${cycle.cycle}, lettre reçue le ${new Date(cycle.receivedAt).toLocaleDateString("fr-FR")}).`, size: 22 },
    { text: `Date : ${now.toLocaleDateString("fr-FR")}`, size: 22 },
    { text: "Madame, Monsieur,", size: 22 },
    { text: "Suite à votre courrier de réserves, veuillez trouver ci-dessous nos réponses, point par point. Chaque réserve est reprise mot à mot telle que formulée dans votre lettre.", size: 22 },
  ];

  let answered = 0;
  let missing = 0;
  for (const p of cycle.points) {
    const response = (p.finalResponse ?? p.proposedResponse ?? "").trim();
    if (response) answered++; else missing++;
    paras.push({ text: `Réserve n° ${p.ordinal} — ${p.category}${p.status === "APPROVED" ? "" : " (réponse non approuvée en interne)"}`, bold: true, size: 24 });
    paras.push({ text: `« ${p.verbatim} »`, italic: true, size: 20 });
    paras.push({ text: `Réponse : ${response || MISSING_MARKER}`, size: 22 });
  }

  paras.push({ text: "Nous restons à votre disposition pour tout complément d'information.", size: 22 });
  paras.push({ text: "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.", size: 22 });
  paras.push({ text: "Pharmacien directeur technique : ______________________", size: 22 });

  const buffer = buildSimpleDocx(paras);
  const filename = sanitize(`REPONSE_RESERVES_${cycle.dossier.reference}_cycle${cycle.cycle}_${now.toISOString().slice(0, 10)}.docx`);
  return storeGenerated({
    dossierVersionId: version.id, dossier: cycle.dossier, templateCode: "REPONSE_RESERVES",
    templateName: `Réponse aux réserves (cycle ${cycle.cycle})`, buffer, filename, used: answered, missing, actorId: opts.actorId,
  });
}
