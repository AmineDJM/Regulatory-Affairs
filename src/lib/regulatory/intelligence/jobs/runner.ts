import type { RegulatoryJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { extractText } from "../extract/extract-text";
import { detectMime } from "../extract/mime";
import { classifyDocument } from "../ctd/classify";
import { assessVersion, type TwinDoc } from "../rules/engine";
import { regAudit } from "../audit";

/**
 * RUNNER de jobs Node-first (en base Postgres, sans Redis/BullMQ). Idempotent, verrou
 * optimiste, reprise après verrou expiré, réessais bornés. Déclenché par le planificateur
 * interne (runScheduledJobs) ; borné par tick (mémoire + latence maîtrisées).
 *
 * Phase 2 : handler EXTRACT (détection MIME + extraction texte, par lots). Les autres
 * types (CLASSIFY, RULES, AI_REVIEW…) arrivent aux phases suivantes ; un type sans handler
 * est marqué CANCELLED (jamais de boucle).
 */

const STALE_LOCK_MS = 5 * 60_000; // un job « RUNNING » figé > 5 min est repris
const MAX_JOBS_PER_TICK = 5;
const EXTRACT_BATCH = 20; // documents traités par passage (le reste est re-mis en file)

export async function runDueRegulatoryJobs(max = MAX_JOBS_PER_TICK): Promise<void> {
  // Reprise des jobs bloqués (process interrompu) : verrou expiré → re-QUEUED.
  await prisma.regulatoryJob
    .updateMany({
      where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
      data: { status: "QUEUED", error: "Reprise après verrou expiré." },
    })
    .catch(() => undefined);

  for (let i = 0; i < max; i++) {
    const job = await claimNext();
    if (!job) break;
    try {
      await dispatch(job);
    } catch (err) {
      await failJob(job, err);
    }
  }
}

/**
 * Traite UN job précis jusqu'à son état terminal (DONE/FAILED/CANCELLED). Utilisé pour un
 * traitement ciblé (tests, reprise d'un dossier donné) sans toucher au reste de la file.
 */
export async function runRegulatoryJob(jobId: string, maxPasses = 100): Promise<void> {
  for (let i = 0; i < maxPasses; i++) {
    const claimed = await prisma.regulatoryJob.updateMany({
      where: { id: jobId, status: "QUEUED" },
      data: { status: "RUNNING", lockedAt: new Date(), startedAt: new Date(), error: null },
    });
    if (claimed.count === 0) {
      const cur = await prisma.regulatoryJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (!cur || cur.status !== "QUEUED") return; // terminal ou disparu
      continue;
    }
    const job = await prisma.regulatoryJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    try {
      await dispatch(job);
    } catch (err) {
      await failJob(job, err);
    }
    const after = await prisma.regulatoryJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!after || (after.status !== "QUEUED" && after.status !== "RUNNING")) return;
  }
}

/** Réclame atomiquement le prochain job en file (verrou optimiste anti-double-prise). */
async function claimNext(): Promise<RegulatoryJob | null> {
  const candidate = await prisma.regulatoryJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;
  const claim = await prisma.regulatoryJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", lockedAt: new Date(), startedAt: new Date(), error: null },
  });
  if (claim.count === 0) return null; // pris par un autre passage
  return prisma.regulatoryJob.findUnique({ where: { id: candidate.id } });
}

async function dispatch(job: RegulatoryJob): Promise<void> {
  switch (job.type) {
    case "EXTRACT":
      return handleExtract(job);
    case "RULES":
      return handleRules(job);
    default:
      // Type non encore pris en charge à ce stade → terminal propre (pas de boucle).
      await prisma.regulatoryJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", error: `Type ${job.type} non pris en charge (phase ultérieure).`, finishedAt: new Date() },
      });
  }
}

async function failJob(job: RegulatoryJob, err: unknown): Promise<void> {
  const attempts = job.attempts + 1;
  const message = err instanceof Error ? err.message : String(err);
  const terminal = attempts >= job.maxAttempts;
  await prisma.regulatoryJob
    .update({
      where: { id: job.id },
      data: {
        attempts,
        status: terminal ? "FAILED" : "QUEUED",
        error: message.slice(0, 500),
        finishedAt: terminal ? new Date() : null,
        lockedAt: null,
      },
    })
    .catch(() => undefined);
  if (terminal) {
    await regAudit({
      companyId: job.companyId, actorId: "system", dossierId: job.dossierId,
      action: "JOB_FAILED", detail: `Job ${job.type} en échec définitif : ${message.slice(0, 200)}`,
    });
  }
}

/** EXTRACT : détecte le MIME et extrait le texte des documents sûrs, par lots. */
async function handleExtract(job: RegulatoryJob): Promise<void> {
  const versionId = job.dossierVersionId;
  if (!versionId) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    return;
  }

  const pending = await prisma.regulatoryDocument.findMany({
    where: {
      dossierVersionId: versionId,
      extractionStatus: "PENDING",
      securityStatus: { in: ["SAFE", "SUSPICIOUS"] },
      blobId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: EXTRACT_BATCH,
    select: { id: true, ext: true, blobId: true, originalPath: true, originalFilename: true },
  });

  for (const doc of pending) {
    await extractOne(doc);
  }

  // Progression + décision de reprise / fin.
  const scope = { dossierVersionId: versionId, securityStatus: { in: ["SAFE" as const, "SUSPICIOUS" as const] } };
  const [total, remaining] = await Promise.all([
    prisma.regulatoryDocument.count({ where: scope }),
    prisma.regulatoryDocument.count({ where: { ...scope, extractionStatus: "PENDING", blobId: { not: null } } }),
  ]);
  const progress = total > 0 ? Math.round(((total - remaining) / total) * 100) : 100;

  if (remaining > 0) {
    // Reprise au prochain tick (sans consommer de tentative) — mémoire/latence bornées.
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "QUEUED", progress, lockedAt: null } });
  } else {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    if (job.dossierId) {
      await prisma.regulatoryDossier.update({ where: { id: job.dossierId }, data: { status: "ANALYSING" } }).catch(() => undefined);
    }
    // Enchaîne les contrôles réglementaires déterministes (complétude/conformité).
    await prisma.regulatoryJob.create({
      data: { companyId: job.companyId, dossierId: job.dossierId, dossierVersionId: versionId, type: "RULES", status: "QUEUED", payload: {} },
    });
  }
}

/** RULES : jumeau numérique + moteur déterministe → constats + bilan de conformité. */
async function handleRules(job: RegulatoryJob): Promise<void> {
  const versionId = job.dossierVersionId;
  if (!versionId) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    return;
  }

  const version = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: versionId },
    select: { dossier: { select: { id: true, procedureType: true } } },
  });
  if (!version) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date() } });
    return;
  }

  const docs = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId: versionId },
    select: { id: true, originalFilename: true, ctdSection: true, ctdModule: true, securityStatus: true, extractionStatus: true, classificationMethod: true },
  });
  const twinDocs: TwinDoc[] = docs.map((d) => ({ ...d, securityStatus: String(d.securityStatus), extractionStatus: String(d.extractionStatus) }));

  const { findings, summary } = assessVersion({ procedureType: version.dossier.procedureType, documents: twinDocs });

  await prisma.$transaction([
    // Recalcul idempotent : on remplace les constats du MOTEUR (on préserve IA/HUMAIN).
    prisma.regulatoryFinding.deleteMany({ where: { dossierVersionId: versionId, source: "RULE" } }),
    prisma.regulatoryFinding.createMany({
      data: findings.map((f) => ({
        dossierVersionId: versionId, code: f.code, severity: f.severity, category: f.category,
        title: f.title, detail: f.detail, evidence: f.evidence ?? null, sectionCode: f.sectionCode ?? null,
        documentId: f.documentId ?? null, source: "RULE" as const, blocker: f.blocker ?? false, draft: false,
      })),
    }),
    prisma.regulatoryAssessment.upsert({
      where: { dossierVersionId: versionId },
      create: {
        dossierVersionId: versionId, completeness: summary.completeness, conforme: summary.conforme,
        blockers: summary.blockers, criticals: summary.criticals, majors: summary.majors, minors: summary.minors,
        requiredPresent: summary.requiredPresent, requiredTotal: summary.requiredTotal, computedAt: new Date(),
      },
      update: {
        completeness: summary.completeness, conforme: summary.conforme,
        blockers: summary.blockers, criticals: summary.criticals, majors: summary.majors, minors: summary.minors,
        requiredPresent: summary.requiredPresent, requiredTotal: summary.requiredTotal, computedAt: new Date(),
      },
    }),
    prisma.regulatoryDossier.update({ where: { id: version.dossier.id }, data: { status: "IN_REVIEW" } }),
    prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } }),
  ]);

  await regAudit({
    companyId: job.companyId, actorId: "system", dossierId: version.dossier.id, dossierVersionId: versionId,
    action: "RULES_ASSESSED",
    detail: `Contrôles déterministes : complétude ${summary.completeness}%, ${summary.conforme ? "aucun bloqueur" : `${summary.blockers} bloqueur(s)`} — ${summary.criticals} critique(s), ${summary.majors} majeur(s).`,
    meta: { ...summary },
  });
}

interface ExtractDoc { id: string; ext: string; blobId: string | null; originalPath: string; originalFilename: string }

/**
 * Extrait un document (MIME + texte) PUIS le classe (CTD déterministe, avec le texte en main).
 * Persiste statut + MIME + classification + nom suggéré. Ne lève jamais (statut d'erreur sinon).
 */
async function extractOne(doc: ExtractDoc): Promise<void> {
  const documentId = doc.id;
  try {
    const buffer = doc.blobId ? await getBlob(doc.blobId) : null;
    if (!buffer) {
      await prisma.regulatoryDocument.update({ where: { id: documentId }, data: { extractionStatus: "CORRUPTED" } });
      return;
    }
    const mime = detectMime(buffer, doc.ext);
    const result = await extractText(doc.ext, buffer);

    // Classification CTD déterministe (chemin/nom + texte extrait) — proposition.
    const cls = classifyDocument({ path: doc.originalPath, filename: doc.originalFilename, ext: doc.ext, textSample: result.text });

    await prisma.$transaction([
      prisma.regulatoryDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: result.status,
          detectedMimeType: mime.mime,
          ctdModule: cls.module,
          ctdSection: cls.section,
          ctdConfidence: cls.confidence,
          classificationMethod: cls.method,
          suggestedFilename: cls.suggestedFilename,
        },
      }),
      ...(result.text
        ? [
            prisma.regulatoryExtraction.upsert({
              where: { documentId },
              create: { documentId, method: result.method, lang: result.lang ?? null, charCount: result.chars, truncated: result.truncated, content: result.text },
              update: { method: result.method, lang: result.lang ?? null, charCount: result.chars, truncated: result.truncated, content: result.text },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    console.error("[reg-extract] document", documentId, err);
    await prisma.regulatoryDocument
      .update({ where: { id: documentId }, data: { extractionStatus: "MANUAL_REVIEW_REQUIRED" } })
      .catch(() => undefined);
  }
}
