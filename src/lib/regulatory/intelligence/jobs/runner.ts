import type { RegulatoryJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { extractText } from "../extract/extract-text";
import { detectMime } from "../extract/mime";
import { classifyDocument } from "../ctd/classify";
import { detectContainedSections } from "../ctd/detect-sections";
import { assessVersion, type TwinDoc } from "../rules/engine";
import { loadActiveRules, loadPresentFactKeys } from "../rules/rule-engine";
import { ocrDocument, canOcr } from "../ocr/ocr-engine";
import { mistralOcrConfigured } from "../ocr/mistral-ocr";
import { buildTwinFacts } from "../twin/build-facts";
import { detectConflicts } from "../twin/detect-conflicts";
import { reviewDocumentText, type AiFinding } from "../agents/review-agent";
import { splitTextIntoChunks } from "../agents/chunk-text";
import { sectionByCode } from "../ctd/taxonomy";
import { aiConfigured } from "@/lib/ai";
import { enrichVersionFindings, type EnrichmentContext } from "../findings/enrich";
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
const OCR_BATCH_LOCAL = 3; // Tesseract = WASM/CPU lourd → petit lot séquentiel, reste re-mis en file

const ocrEnabled = () => (process.env.REG_OCR_ENABLED ?? "1") !== "0";

/**
 * Débit OCR adapté au moteur actif. Mistral (cloud) = latence RÉSEAU → on parallélise un gros
 * lot (plusieurs documents en vol) pour finir un dossier en quelques minutes. Tesseract (WASM
 * local, CPU/mémoire) reste SÉQUENTIEL (concurrence 1) sur un petit lot pour borner la RAM.
 */
function ocrIsCloud(): boolean {
  return (process.env.REG_OCR_ENGINE ?? "auto").trim().toLowerCase() !== "tesseract" && mistralOcrConfigured();
}
function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function ocrBatchSize(): number {
  return ocrIsCloud() ? clampInt(process.env.REG_OCR_BATCH, 24, 1, 200) : OCR_BATCH_LOCAL;
}
// Concurrence AU NIVEAU DOCUMENT (défaut 3). Volontairement modérée : un document massif
// (8 000–10 000 pages) charge un gros blob + le découpe en mémoire, ET fait lui-même du parallélisme
// PAR TRANCHES en interne. Trop de gros documents en vol simultané = risque OOM. Ajustable selon la RAM.
function ocrConcurrency(): number {
  return ocrIsCloud() ? clampInt(process.env.REG_OCR_CONCURRENCY, 3, 1, 20) : 1;
}
// Plafond du texte extrait persisté (fin de la troncature 1 M) et des pages OCR détaillées stockées
// (borne la taille de ligne pour un document de 10 000 pages, sans fausser les agrégats).
const extractionMaxChars = () => clampInt(process.env.REG_EXTRACTION_MAX_CHARS, 20_000_000, 100_000, 200_000_000);
const ocrStoredPages = () => clampInt(process.env.REG_OCR_STORED_PAGES, 5000, 100, 20_000);
// SOUPAPE DE SÉCURITÉ (désactivée par défaut) : pdf-parse (extraction) et mupdf (OCR) chargent le
// PDF ENTIER en mémoire ; sur une instance à faible RAM, un fichier de plusieurs centaines de Mo peut
// provoquer un OOM. Défaut 1000 Mo → au-dessus du plafond de stockage (950 Mo) : aucun fichier n'est
// bloqué en fonctionnement normal (pas de régression). À ABAISSER (ex. 200) sur une petite instance :
// un fichier au-delà est alors marqué REVUE MANUELLE (sans être chargé) pour ne pas bloquer le lot.
const maxProcessBytes = () => clampInt(process.env.REG_MAX_PROCESS_MB, 1000, 20, 4000) * 1024 * 1024;

/**
 * REND LA MAIN À LA BOUCLE D'ÉVÉNEMENTS (macro-tâche). Node est mono-thread : entre deux unités
 * de travail LOURDES (pdf-parse, OCR WASM, jumeau numérique…), on cède la main pour que les autres
 * requêtes HTTP (navigation, messagerie, autres utilisateurs) soient servies IMMÉDIATEMENT →
 * l'application reste fluide PENDANT l'extraction/analyse d'un dossier, au lieu de « geler ».
 */
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/**
 * Exécute `fn` sur `items` avec au plus `concurrency` traitements EN VOL (pool à curseur partagé).
 * `fn` NE DOIT JAMAIS lever (ici `ocrOne` avale ses erreurs) — le pool n'a donc pas à récupérer.
 * On cède la boucle d'événements entre deux unités pour ne jamais monopoliser le thread.
 */
async function runPool<T>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
      await yieldToEventLoop(); // laisser respirer les autres requêtes entre deux documents
    }
  });
  await Promise.all(workers);
}

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
    case "OCR":
      return handleOcr(job);
    case "RULES":
      return handleRules(job);
    case "FACTS":
      return handleFacts(job);
    case "AI_REVIEW":
      return handleAiReview(job);
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
    orderBy: { sizeBytes: "asc" }, // PETITS D'ABORD : un fichier géant ne bloque jamais les autres
    take: EXTRACT_BATCH,
    select: { id: true, ext: true, blobId: true, originalPath: true, originalFilename: true, sizeBytes: true },
  });

  for (const doc of pending) {
    await extractOne(doc);
    await yieldToEventLoop(); // ne pas monopoliser le thread : l'app reste réactive pendant l'extraction
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
    // Chaîne : EXTRACT → [OCR si scans] → FACTS → RULES. L'OCR (auto-hébergé) océrise les
    // documents scannés AVANT le jumeau numérique pour que leur contenu alimente les faits.
    const ocrPending = ocrEnabled()
      ? await prisma.regulatoryDocument.count({ where: { dossierVersionId: versionId, extractionStatus: "OCR_REQUIRED", blobId: { not: null } } })
      : 0;
    await prisma.regulatoryJob.create({
      data: { companyId: job.companyId, dossierId: job.dossierId, dossierVersionId: versionId, type: ocrPending > 0 ? "OCR" : "FACTS", status: "QUEUED", payload: {} },
    });
  }
}

/**
 * OCR (G13) : océrise les documents scannés (OCR_REQUIRED) — auto-hébergé (tesseract.js +
 * mupdf + sharp, données de langue locales). Par lots bornés (WASM lourd), avec reprise.
 * Le texte OCR est stocké SÉPARÉMENT (method="ocr") ; les pages de faible confiance sont
 * signalées pour REVUE HUMAINE (statut LOW_CONFIDENCE), jamais présumées correctes.
 */
async function handleOcr(job: RegulatoryJob): Promise<void> {
  const versionId = job.dossierVersionId;
  if (!versionId || !ocrEnabled()) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    if (versionId) await enqueueFacts(job, versionId);
    return;
  }

  const pending = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId: versionId, extractionStatus: "OCR_REQUIRED", blobId: { not: null } },
    orderBy: { sizeBytes: "asc" }, // petits d'abord (un scan géant ne bloque pas le lot)
    take: ocrBatchSize(),
    select: { id: true, ext: true, blobId: true, originalPath: true, originalFilename: true, sizeBytes: true },
  });

  // Mistral (cloud) → pool parallèle (rapide) ; Tesseract (local) → concurrence 1 (séquentiel).
  await runPool(pending, ocrConcurrency(), ocrOne);

  const remaining = await prisma.regulatoryDocument.count({
    where: { dossierVersionId: versionId, extractionStatus: "OCR_REQUIRED", blobId: { not: null } },
  });
  if (remaining > 0) {
    // Reprise au prochain tick (sans consommer de tentative) — mémoire/latence bornées.
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "QUEUED", lockedAt: null } });
  } else {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    await enqueueFacts(job, versionId);
  }
}

/** Enfile le jumeau numérique (FACTS) — étape suivante après extraction/OCR. */
async function enqueueFacts(job: RegulatoryJob, versionId: string): Promise<void> {
  const exists = await prisma.regulatoryJob.count({ where: { dossierVersionId: versionId, type: "FACTS", status: { in: ["QUEUED", "RUNNING"] } } });
  if (exists === 0) {
    await prisma.regulatoryJob.create({ data: { companyId: job.companyId, dossierId: job.dossierId, dossierVersionId: versionId, type: "FACTS", status: "QUEUED", payload: {} } });
  }
}

/** Océrise UN document scanné et persiste texte + confiance + revue. Ne lève jamais. */
async function ocrOne(doc: { id: string; ext: string; blobId: string | null; originalFilename: string; sizeBytes: number }): Promise<void> {
  try {
    // Garde ANTI-OOM (défense) : un scan trop volumineux (mupdf le chargerait en entier) → revue manuelle.
    if (doc.sizeBytes > maxProcessBytes()) {
      console.warn(`[reg-ocr] ${doc.originalFilename} (${Math.round(doc.sizeBytes / 1048576)} Mo) > seuil ${Math.round(maxProcessBytes() / 1048576)} Mo → revue manuelle.`);
      await prisma.regulatoryDocument.update({ where: { id: doc.id }, data: { extractionStatus: "MANUAL_REVIEW_REQUIRED" } });
      return;
    }
    const buffer = doc.blobId ? await getBlob(doc.blobId) : null;
    if (!buffer || !canOcr(doc.ext)) {
      await prisma.regulatoryDocument.update({ where: { id: doc.id }, data: { extractionStatus: "MANUAL_REVIEW_REQUIRED" } });
      return;
    }
    const r = await ocrDocument({ ext: doc.ext, buffer });
    const status = r.text.length === 0 ? "MANUAL_REVIEW_REQUIRED" : r.needsReview ? "LOW_CONFIDENCE" : "OCR_COMPLETED";
    // Trace le MOTEUR OCR réellement utilisé (Mistral cloud vs Tesseract local) pour que ce soit
    // VISIBLE côté dossier (sources du jumeau) — on ne pouvait pas savoir lequel avait tourné.
    const ocrMethod = /^mistral/i.test(r.engine) ? "ocr-mistral" : /^tesseract/i.test(r.engine) ? "ocr-tesseract" : "ocr";
    // Texte complet (cap élevé configurable) + détail par page borné (documents de 10 000 pages :
    // on garde tous les agrégats exacts mais on limite le JSON par-page stocké).
    const content = r.text.slice(0, extractionMaxChars());
    const truncated = r.truncated || content.length < r.text.length;
    const ocrPages = r.pages.slice(0, ocrStoredPages());
    const data = {
      method: ocrMethod, lang: r.langs, charCount: content.length, truncated,
      content, ocrConfidence: r.meanConfidence, pageCount: r.pageCount,
      ocrPages: ocrPages as unknown as object, needsReview: r.needsReview,
    };
    await prisma.$transaction([
      prisma.regulatoryExtraction.upsert({ where: { documentId: doc.id }, create: { documentId: doc.id, ...data }, update: data }),
      prisma.regulatoryDocument.update({ where: { id: doc.id }, data: { extractionStatus: status } }),
    ]);
  } catch (err) {
    console.error("[reg-ocr] document", doc.id, err);
    await prisma.regulatoryDocument.update({ where: { id: doc.id }, data: { extractionStatus: "MANUAL_REVIEW_REQUIRED" } }).catch(() => undefined);
  }
}

/** FACTS : jumeau numérique (faits sourcés) + détection de conflits. */
async function handleFacts(job: RegulatoryJob): Promise<void> {
  const versionId = job.dossierVersionId;
  if (!versionId) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
    return;
  }
  const facts = await buildTwinFacts(versionId);
  const conflicts = await detectConflicts(versionId);
  await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } });
  // Enchaîne les contrôles déterministes (RULES) maintenant que les faits existent.
  await prisma.regulatoryJob.create({
    data: { companyId: job.companyId, dossierId: job.dossierId, dossierVersionId: versionId, type: "RULES", status: "QUEUED", payload: {} },
  });
  await regAudit({
    companyId: job.companyId, actorId: "system", dossierId: job.dossierId, dossierVersionId: versionId,
    action: "FACTS_BUILT",
    detail: `Jumeau numérique : ${facts.facts} fait(s) sourcé(s) (${facts.occurrences} occurrence(s)), ${conflicts} conflit(s) détecté(s).`,
    meta: { ...facts, conflicts },
  });
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
    select: { dossier: { select: { id: true, procedureType: true, productId: true } } },
  });
  if (!version) {
    await prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date() } });
    return;
  }

  const docs = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId: versionId },
    select: { id: true, originalFilename: true, ctdSection: true, ctdModule: true, containedSections: true, securityStatus: true, extractionStatus: true, classificationMethod: true },
  });

  // Rattrapage multi-sections : pour un document déjà lu MAIS sans sections détectées (dossier
  // analysé avant cette fonctionnalité, ou « Relancer l'analyse »), on les calcule depuis le texte
  // déjà stocké (un document à la fois → mémoire bornée) et on les persiste. Corrige les fausses
  // « sections manquantes » d'un gros PDF consolidé sans devoir tout ré-extraire.
  for (const d of docs) {
    await yieldToEventLoop(); // détection de sections = regex lourde sur le texte → céder la main entre docs
    if (d.containedSections.length > 0) continue;
    const ext = await prisma.regulatoryExtraction.findUnique({ where: { documentId: d.id }, select: { content: true } });
    if (!ext?.content) continue;
    const detected = detectContainedSections(ext.content).map((x) => x.code);
    if (detected.length > 0) {
      await prisma.regulatoryDocument.update({ where: { id: d.id }, data: { containedSections: detected } }).catch(() => undefined);
      d.containedSections = detected;
    }
  }

  const twinDocs: TwinDoc[] = docs.map((d) => ({ ...d, securityStatus: String(d.securityStatus), extractionStatus: String(d.extractionStatus) }));

  // G5 : règles administrables du/des pack(s) ACTIF(s) — sinon repli sur les profils codés.
  const [rules, factKeys] = await Promise.all([
    loadActiveRules(version.dossier.procedureType),
    loadPresentFactKeys(versionId),
  ]);
  const { findings, summary } = assessVersion({ procedureType: version.dossier.procedureType, documents: twinDocs, rules, factKeys });

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

  // Précédents ANPP attachés aux constats — après persistance, jamais bloquant.
  await attachPrecedents(job, versionId, await enrichmentContextOf(version.dossier.productId));

  // Revue IA (PROJET, non bloquante) uniquement si l'IA est configurée — sinon on n'empile
  // pas de jobs annulés.
  if (aiConfigured()) {
    await prisma.regulatoryJob.create({
      data: { companyId: job.companyId, dossierId: version.dossier.id, dossierVersionId: versionId, type: "AI_REVIEW", status: "QUEUED", payload: {} },
    });
  }
}

// Sections prioritaires (analysées EN PREMIER quand le budget de parts est limité).
const AI_PRIORITY_SECTIONS = new Set(["1.2", "1.3", "2.3", "2.5", "3.2.P.5", "3.2.P.8", "3.2.S.4", "5.3"]);
// Documents lisibles par l'IA (texte natif + OCR, y compris faible confiance pour couverture max).
const AI_REVIEWABLE_STATUSES = ["TEXT_EXTRACTED", "OCR_COMPLETED", "LOW_CONFIDENCE"] as const;
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };

// Parts d'analyse océrisées EN PARALLÈLE (borne le débit vers l'IA) ; plafond de parts par version
// (coût — 0 = illimité) ; plafond de constats persistés (évite d'inonder l'UI/la base).
const aiConcurrency = () => clampInt(process.env.REG_AI_CONCURRENCY, 4, 1, 12);
const aiMaxChunks = () => clampInt(process.env.REG_AI_MAX_CHUNKS, 120, 0, 1_000_000);
const aiMaxFindings = () => clampInt(process.env.REG_AI_MAX_FINDINGS, 300, 10, 5000);

/**
 * AI_REVIEW : revue de fond/forme (PROJET, non bloquante). Chaque document lisible est découpé
 * en PARTS d'environ 10 pages (splitTextIntoChunks) ; chaque part est envoyée SÉPARÉMENT à l'IA,
 * EN PARALLÈLE (borné) — jamais le document entier. Sections prioritaires d'abord. ROBUSTE : une
 * part qui échoue est ignorée (les autres passent). Bornée en coût (REG_AI_MAX_CHUNKS) et en
 * nombre de constats persistés (les plus sévères d'abord). Mémoire bornée : un contenu à la fois.
 */
async function handleAiReview(job: RegulatoryJob): Promise<void> {
  const versionId = job.dossierVersionId;
  if (!versionId || !aiConfigured()) {
    await prisma.regulatoryJob.update({
      where: { id: job.id },
      data: { status: "CANCELLED", finishedAt: new Date(), error: aiConfigured() ? "Version absente." : "IA non configurée (ANTHROPIC_API_KEY absente) — aucune revue simulée." },
    });
    return;
  }

  const docs = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId: versionId, extractionStatus: { in: [...AI_REVIEWABLE_STATUSES] }, securityStatus: { in: ["SAFE", "SUSPICIOUS"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, originalFilename: true, ctdSection: true },
  });
  // Sections prioritaires en tête (tri stable), puis le reste → couverture complète, budget permettant.
  const ordered = [...docs].sort((a, b) => Number(!!b.ctdSection && AI_PRIORITY_SECTIONS.has(b.ctdSection)) - Number(!!a.ctdSection && AI_PRIORITY_SECTIONS.has(a.ctdSection)));

  const maxChunks = aiMaxChunks();
  const concurrency = aiConcurrency();
  const collected: (AiFinding & { documentId: string })[] = [];
  let usedChunks = 0;
  let analyzedDocs = 0;

  for (const d of ordered) {
    if (maxChunks > 0 && usedChunks >= maxChunks) break;
    await yieldToEventLoop(); // céder la main entre documents (découpage + appels IA)
    // Contenu chargé UN document à la fois (pic mémoire borné même pour un document de 10 000 pages).
    const ext = await prisma.regulatoryExtraction.findUnique({ where: { documentId: d.id }, select: { content: true } });
    let parts = splitTextIntoChunks(ext?.content ?? "");
    if (parts.length === 0) continue;
    if (maxChunks > 0) parts = parts.slice(0, maxChunks - usedChunks);
    usedChunks += parts.length;
    analyzedDocs++;
    const ctdTitle = d.ctdSection ? sectionByCode(d.ctdSection)?.title ?? null : null;
    const total = parts.length;
    // Parts de CE document envoyées à l'IA en parallèle ; une part en échec n'arrête pas les autres.
    await runPool(parts, concurrency, async (part, i) => {
      try {
        const r = await reviewDocumentText({
          filename: total > 1 ? `${d.originalFilename} — partie ${i + 1}/${total}` : d.originalFilename,
          ctdSection: d.ctdSection, ctdTitle, text: part,
        });
        if (r.ok) for (const f of r.findings) collected.push({ ...f, documentId: d.id });
      } catch (err) {
        console.error("[reg-ai] analyse d'une part échouée", d.id, i, err instanceof Error ? err.message : err);
      }
    });
  }

  // Dédoublonne (même document + même titre) puis garde les constats les PLUS SÉVÈRES (plafond).
  const seen = new Set<string>();
  const deduped = collected.filter((f) => {
    const key = `${f.documentId}|${f.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const kept = deduped.slice(0, aiMaxFindings());

  await prisma.$transaction([
    prisma.regulatoryFinding.deleteMany({ where: { dossierVersionId: versionId, source: "AI" } }),
    prisma.regulatoryFinding.createMany({
      data: kept.map((f) => ({
        dossierVersionId: versionId, code: "AI_REVIEW", severity: f.severity, category: f.category.slice(0, 40),
        title: f.title.slice(0, 200), detail: f.detail.slice(0, 2000), evidence: f.evidence ? f.evidence.slice(0, 1200) : null,
        sectionCode: f.sectionCode, documentId: f.documentId, source: "AI" as const, blocker: false, draft: true,
        // Ce qui rend le constat défendable : la pièce, le degré de certitude, et quoi faire.
        excerpt: f.evidence ? f.evidence.slice(0, 1200) : null,
        page: f.page, confidence: f.confidence, recommendation: f.recommendation,
        conflictingValues: f.conflictingValues,
      })),
    }),
    prisma.regulatoryJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, finishedAt: new Date() } }),
  ]);

  await regAudit({
    companyId: job.companyId, actorId: "system", dossierId: job.dossierId, dossierVersionId: versionId,
    action: "AI_REVIEW_DONE",
    detail: `Revue IA (PROJET — revue humaine requise) : ${kept.length} constat(s) sur ${usedChunks} part(s) de ${analyzedDocs} document(s)${maxChunks > 0 && usedChunks >= maxChunks ? ` (plafond ${maxChunks} parts atteint)` : ""}.`,
  });

  const productId = job.dossierId
    ? (await prisma.regulatoryDossier.findUnique({ where: { id: job.dossierId }, select: { productId: true } }))?.productId ?? null
    : null;
  await attachPrecedents(job, versionId, await enrichmentContextOf(productId));
}

/**
 * DCI et fournisseur du dossier : ils affinent la recherche de précédents ANPP (« cette réserve,
 * l'avons-nous déjà eue SUR CETTE MOLÉCULE, chez CE fournisseur ? »). Un dossier sans produit
 * rattaché cherche sans filtre — moins précis, mais jamais bloquant.
 */
async function enrichmentContextOf(productId: string | null): Promise<EnrichmentContext> {
  if (!productId) return {};
  const p = await prisma.regulatoryProduct
    .findUnique({ where: { id: productId }, select: { dci: true, partnerLab: true } })
    .catch(() => null);
  return { dci: p?.dci ?? null, supplier: p?.partnerLab ?? null };
}

/**
 * Attache à chaque constat les réserves ANPP comparables et la probabilité qu'elle revienne.
 *
 * Volontairement APRÈS la persistance et hors transaction : c'est un enrichissement, pas une
 * condition. Un échec ici laisse l'analyse complète et exploitable — on perd seulement la
 * mémoire des précédents, qu'un « Relancer l'analyse » rattrapera.
 *
 * ⚠️ Ces précédents n'aggravent jamais la sévérité d'un constat : « l'ANPP nous l'a déjà
 * reproché » informe la préparation, ce n'est pas une règle de droit.
 */
async function attachPrecedents(job: RegulatoryJob, versionId: string, ctx: EnrichmentContext): Promise<void> {
  try {
    const n = await enrichVersionFindings(versionId, ctx);
    if (n > 0) {
      await regAudit({
        companyId: job.companyId, actorId: "system", dossierId: job.dossierId, dossierVersionId: versionId,
        action: "FINDINGS_ENRICHED",
        detail: `${n} constat(s) rapproché(s) de réserves ANPP déjà reçues. Précédents à titre indicatif — aucune sévérité n'a été modifiée.`,
      });
    }
  } catch (err) {
    console.error("[reg-ai] rapprochement des précédents impossible", versionId, err);
  }
}

interface ExtractDoc { id: string; ext: string; blobId: string | null; originalPath: string; originalFilename: string; sizeBytes: number }

/**
 * Extrait un document (MIME + texte) PUIS le classe (CTD déterministe, avec le texte en main).
 * Persiste statut + MIME + classification + nom suggéré. Ne lève jamais (statut d'erreur sinon).
 */
async function extractOne(doc: ExtractDoc): Promise<void> {
  const documentId = doc.id;
  try {
    // Garde ANTI-OOM : un fichier trop volumineux n'est même pas chargé (pdf-parse/mupdf le liraient
    // en entier) → marqué revue manuelle. Les autres fichiers du dossier continuent.
    if (doc.sizeBytes > maxProcessBytes()) {
      console.warn(`[reg-extract] ${doc.originalFilename} (${Math.round(doc.sizeBytes / 1048576)} Mo) > seuil ${Math.round(maxProcessBytes() / 1048576)} Mo → revue manuelle (augmenter REG_MAX_PROCESS_MB / la RAM, ou scinder le PDF).`);
      await prisma.regulatoryDocument.update({ where: { id: documentId }, data: { extractionStatus: "MANUAL_REVIEW_REQUIRED" } });
      return;
    }
    const buffer = doc.blobId ? await getBlob(doc.blobId) : null;
    if (!buffer) {
      await prisma.regulatoryDocument.update({ where: { id: documentId }, data: { extractionStatus: "CORRUPTED" } });
      return;
    }
    const mime = detectMime(buffer, doc.ext);
    const result = await extractText(doc.ext, buffer);

    // Classification CTD déterministe (chemin/nom + texte extrait) — proposition.
    const cls = classifyDocument({ path: doc.originalPath, filename: doc.originalFilename, ext: doc.ext, textSample: result.text });
    // MULTI-SECTIONS : sections CTD réellement présentes dans le TEXTE (PDF consolidé « Module X.pdf »).
    const contained = detectContainedSections(result.text).map((d) => d.code);

    await prisma.$transaction([
      prisma.regulatoryDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: result.status,
          detectedMimeType: mime.mime,
          ctdModule: cls.module,
          ctdSection: cls.section,
          containedSections: contained,
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
