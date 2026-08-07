import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  submitBatch, getBatchStatus, fetchBatchOutput, parseBatchOutput, lunaModel, lunaCostUsd,
  type BatchRequest,
} from "@/lib/openai-luna";
import { splitTextIntoChunks } from "../agents/chunk-text";
import { buildPrompt, SYSTEM_PROMPT, parseReviewOutput, type AiFinding } from "../agents/review-agent";
import { sectionByCode } from "../ctd/taxonomy";
import { budgetState } from "./ledger";
import { regAudit } from "../audit";
import { enrichVersionFindings } from "../findings/enrich";

/**
 * ANALYSE DIFFÉRÉE — la voie à MOITIÉ PRIX.
 *
 * Le fournisseur facture **deux fois moins cher** les analyses qu'on accepte d'attendre (jusqu'à
 * 24 h). Cela n'a aucun intérêt pour une analyse qu'on regarde tout de suite ; c'est décisif pour
 * la **réanalyse complète d'un dossier volumineux** — qu'on lance le soir et qu'on lit le
 * lendemain. Le choix reste explicite : l'écran propose la voie immédiate ET la voie économique,
 * en disant ce que chacune coûte et combien de temps elle prend.
 *
 * Ce qui est identique aux deux voies, volontairement : la consigne, le prompt et la validation
 * de la sortie sont **les mêmes fonctions** (`buildPrompt`, `SYSTEM_PROMPT`, `parseReviewOutput`).
 * Sans cela, « moitié prix » finirait par vouloir dire « moins bien ».
 *
 * Trois garde-fous :
 *   1. **On ne dépose pas un lot qu'on ne peut pas payer** : le budget est vérifié AVANT dépôt,
 *      avec une estimation, et le dépôt est refusé s'il ne tient pas.
 *   2. **On ne traite un lot qu'une fois** : `processedAt` est le verrou. Un résultat lu deux
 *      fois créerait des constats en double.
 *   3. **Les constats restent des PROJETS** (`draft: true`, non bloquants) : différer une analyse
 *      ne lui donne pas plus d'autorité.
 */

/** Parts envoyées dans un même lot. Au-delà, on découpe : un lot géant échoue en entier. */
const MAX_REQUESTS_PER_BATCH = 400;
/** Estimation grossière : 4 caractères ≈ 1 jeton. Sert à REFUSER un lot trop cher, pas à facturer. */
const CHARS_PER_TOKEN = 4;
const EST_OUTPUT_TOKENS = 900;
const MAX_FINDINGS = 400;

interface ChunkRef {
  documentId: string;
  filename: string;
  ctdSection: string | null;
  part: number;
  total: number;
}

export interface SubmitBatchResult {
  ok: boolean;
  batchId?: string;
  requests?: number;
  estimatedUsd?: number;
  error?: string;
  message?: string;
}

/**
 * Dépose la revue complète d'une version en analyse différée.
 *
 * Le découpage est le MÊME que celui de la voie immédiate (parts d'environ 10 pages) : c'est le
 * mode de facturation qui change, pas la façon de lire.
 */
export async function submitVersionReviewBatch(
  versionId: string,
  opts: { companyId?: string | null; dossierId?: string | null; userId?: string | null } = {},
): Promise<SubmitBatchResult> {
  const docs = await prisma.regulatoryDocument.findMany({
    where: {
      dossierVersionId: versionId,
      extractionStatus: { in: ["TEXT_EXTRACTED", "OCR_COMPLETED", "LOW_CONFIDENCE"] },
      securityStatus: { in: ["SAFE", "SUSPICIOUS"] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, originalFilename: true, ctdSection: true },
  });
  if (docs.length === 0) return { ok: false, error: "Aucun document lisible dans cette version." };

  const requests: BatchRequest[] = [];
  const mapping: Record<string, ChunkRef> = {};
  let estimatedInputTokens = 0;

  for (const d of docs) {
    // Un document à la fois : le pic mémoire reste borné même sur un dossier de 10 000 pages.
    const ext = await prisma.regulatoryExtraction.findUnique({ where: { documentId: d.id }, select: { content: true } });
    const parts = splitTextIntoChunks(ext?.content ?? "");
    if (parts.length === 0) continue;

    const ctdTitle = d.ctdSection ? sectionByCode(d.ctdSection)?.title ?? null : null;
    for (let i = 0; i < parts.length; i++) {
      const customId = `${d.id}:${i}`;
      const filename = parts.length > 1 ? `${d.originalFilename} — partie ${i + 1}/${parts.length}` : d.originalFilename;
      const user = buildPrompt({ filename, ctdSection: d.ctdSection, ctdTitle, text: parts[i] });
      estimatedInputTokens += Math.ceil((user.length + SYSTEM_PROMPT.length) / CHARS_PER_TOKEN);
      requests.push({ customId, input: { system: SYSTEM_PROMPT, user, maxOutputTokens: 2600, temperature: 0.2 } });
      mapping[customId] = { documentId: d.id, filename: d.originalFilename, ctdSection: d.ctdSection, part: i + 1, total: parts.length };
    }
  }

  if (requests.length === 0) return { ok: false, error: "Aucun texte exploitable à analyser." };

  // On ne dépose PAS un lot qu'on ne pourra pas payer : le refus arrive avant la dépense.
  const estimatedUsd = lunaCostUsd(estimatedInputTokens, requests.length * EST_OUTPUT_TOKENS, true);
  if (opts.dossierId) {
    const b = await budgetState(opts.dossierId);
    if (b.exhausted) return { ok: false, error: `Budget IA du dossier déjà atteint (${b.spentUsd.toFixed(2)} $). Relevez le plafond avant de lancer une analyse.` };
    if (b.remainingUsd != null && estimatedUsd > b.remainingUsd) {
      return {
        ok: false,
        error: `Ce lot coûterait environ ${estimatedUsd.toFixed(2)} $ alors qu'il reste ${b.remainingUsd.toFixed(2)} $ sur le dossier. Relevez le plafond ou analysez moins de documents.`,
      };
    }
  }

  // PLUSIEURS LOTS plutôt qu'une troncature. Le fournisseur borne la taille d'un lot ; c'est une
  // contrainte de transport, pas une raison de ne pas lire un dossier en entier. On découpe donc
  // en groupes, et chaque groupe devient un lot suivi séparément — un lot en panne n'emporte pas
  // les autres.
  const groups: BatchRequest[][] = [];
  for (let i = 0; i < requests.length; i += MAX_REQUESTS_PER_BATCH) {
    groups.push(requests.slice(i, i + MAX_REQUESTS_PER_BATCH));
  }

  const batchIds: string[] = [];
  const failures: string[] = [];
  for (const group of groups) {
    const sent = await submitBatch(group);
    if (!sent.ok || !sent.batchId) { failures.push(sent.error ?? "dépôt refusé"); continue; }
    batchIds.push(sent.batchId);
    // La correspondance est restreinte AU groupe : au dépouillement, chaque lot ne doit
    // reconstituer que SES parts, sinon deux lots créeraient les mêmes constats en double.
    const groupMapping: Record<string, ChunkRef> = {};
    for (const r of group) groupMapping[r.customId] = mapping[r.customId];
    await prisma.regulatoryAiBatch.create({
      data: {
        companyId: opts.companyId ?? null,
        dossierId: opts.dossierId ?? null,
        dossierVersionId: versionId,
        step: "review",
        model: lunaModel(),
        externalId: sent.batchId,
        status: "submitted",
        requestCount: group.length,
        mapping: groupMapping as unknown as object,
        createdById: opts.userId ?? null,
      },
    });
  }

  if (batchIds.length === 0) {
    return { ok: false, error: `Dépôt du lot impossible : ${failures[0] ?? "raison inconnue"}.` };
  }
  const sent = { batchId: batchIds[0] };

  await regAudit({
    companyId: opts.companyId, actorId: opts.userId ?? "system", dossierId: opts.dossierId, dossierVersionId: versionId,
    action: "AI_BATCH_SUBMITTED",
    detail: `Analyse différée déposée : ${requests.length} part(s) de ${docs.length} document(s) en ${batchIds.length} lot(s), coût estimé ${estimatedUsd.toFixed(2)} $ (moitié prix). Résultats sous 24 h.`
      + (failures.length > 0 ? ` ⚠ ${failures.length} lot(s) refusé(s) — analyse INCOMPLÈTE : ${failures[0]}` : ""),
  });

  return {
    ok: true, batchId: sent.batchId, requests: requests.length, estimatedUsd,
    message: `Analyse complète déposée : ${requests.length} part(s) en ${batchIds.length} lot(s), environ ${estimatedUsd.toFixed(2)} $ au lieu de ${(estimatedUsd * 2).toFixed(2)} $. Les constats arriveront sous 24 h.`
      + (failures.length > 0 ? ` ⚠ ${failures.length} lot(s) n'ont pas pu être déposés : l'analyse sera INCOMPLÈTE.` : ""),
  };
}

/**
 * Fait avancer les lots en cours : interroge leur état, et traite ceux qui sont terminés.
 * Appelée par le planificateur — ne lève jamais, un lot en panne n'arrête pas les autres.
 */
export async function pollAiBatches(max = 10): Promise<void> {
  let pending: { id: string; externalId: string }[] = [];
  try {
    pending = await prisma.regulatoryAiBatch.findMany({
      where: { status: { in: ["submitted", "validating", "in_progress", "finalizing"] } },
      orderBy: { submittedAt: "asc" },
      take: max,
      select: { id: true, externalId: true },
    });
  } catch (e) {
    console.error("[ctd-batch] lecture des lots impossible", e);
    return;
  }

  for (const b of pending) {
    try {
      const st = await getBatchStatus(b.externalId);
      if (!st.ok) {
        await prisma.regulatoryAiBatch.update({ where: { id: b.id }, data: { error: st.error ?? "État indisponible." } }).catch(() => {});
        continue;
      }
      await prisma.regulatoryAiBatch.update({
        where: { id: b.id },
        data: {
          status: st.status ?? "submitted",
          completedCount: st.counts?.completed ?? 0,
          failedCount: st.counts?.failed ?? 0,
          outputFileId: st.outputFileId ?? null,
          completedAt: st.status === "completed" ? new Date() : null,
        },
      });
      if (st.status === "completed" && st.outputFileId) await processCompletedBatch(b.id);
    } catch (e) {
      console.error("[ctd-batch] suivi du lot impossible", b.externalId, e);
    }
  }
}

/**
 * Lit les résultats d'un lot terminé et en tire des constats.
 *
 * `processedAt` est posé en PREMIER et sous condition (`updateMany` avec `processedAt: null`) :
 * c'est le verrou qui garantit qu'un lot n'est traité qu'une fois, même si deux ticks se
 * chevauchent. Sans lui, chaque relecture recréerait tous les constats.
 */
export async function processCompletedBatch(batchId: string): Promise<number> {
  const batch = await prisma.regulatoryAiBatch.findUnique({ where: { id: batchId } });
  if (!batch || !batch.outputFileId || batch.processedAt || !batch.dossierVersionId) return 0;

  const claim = await prisma.regulatoryAiBatch.updateMany({
    where: { id: batchId, processedAt: null },
    data: { processedAt: new Date() },
  });
  if (claim.count === 0) return 0; // un autre passage s'en occupe déjà

  try {
    const jsonl = await fetchBatchOutput(batch.outputFileId);
    if (!jsonl) {
      await prisma.regulatoryAiBatch.update({ where: { id: batchId }, data: { error: "Résultats illisibles." } });
      return 0;
    }

    const outcomes = parseBatchOutput(jsonl);
    const mapping = (batch.mapping ?? {}) as unknown as Record<string, ChunkRef>;
    const collected: (AiFinding & { documentId: string })[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    for (const o of outcomes) {
      inputTokens += o.usage.inputTokens;
      outputTokens += o.usage.outputTokens;
      costUsd += o.usage.costUsd;
      if (!o.ok) continue;
      const ref = mapping[o.customId];
      if (!ref) continue; // résultat orphelin : on ne devine pas à quel document il se rapporte
      const parsed = parseReviewOutput(o.text);
      if (!parsed.ok) continue;
      for (const f of parsed.findings) collected.push({ ...f, documentId: ref.documentId });
    }

    // Même dédoublonnage que la voie immédiate : les deux voies doivent donner le même dossier.
    const seen = new Set<string>();
    const kept = collected
      .filter((f) => {
        const key = `${f.documentId}|${f.title.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
      .slice(0, MAX_FINDINGS);

    await prisma.$transaction([
      // Recalcul idempotent : on remplace les constats IA (les constats HUMAIN et RULE restent).
      prisma.regulatoryFinding.deleteMany({ where: { dossierVersionId: batch.dossierVersionId, source: "AI" } }),
      prisma.regulatoryFinding.createMany({
        data: kept.map((f) => ({
          dossierVersionId: batch.dossierVersionId!, code: "AI_REVIEW", severity: f.severity,
          category: f.category.slice(0, 40), title: f.title.slice(0, 200), detail: f.detail.slice(0, 2000),
          evidence: f.evidence ? f.evidence.slice(0, 1200) : null, excerpt: f.evidence ? f.evidence.slice(0, 1200) : null,
          sectionCode: f.sectionCode, documentId: f.documentId, source: "AI" as const, blocker: false, draft: true,
          page: f.page, confidence: f.confidence, recommendation: f.recommendation, conflictingValues: f.conflictingValues,
        })),
      }),
      prisma.regulatoryAiBatch.update({
        where: { id: batchId },
        data: { inputTokens, outputTokens, costUsd, findingsCreated: kept.length, status: "completed" },
      }),
      // Le coût entre dans le registre du dossier : une dépense différée reste une dépense.
      prisma.regulatoryAiCall.create({
        data: {
          dossierId: batch.dossierId, dossierVersionId: batch.dossierVersionId, step: batch.step,
          provider: batch.provider, model: batch.model, batch: true,
          inputTokens, outputTokens, costUsd, ok: true, cacheKey: `batch:${batch.externalId}`,
        },
      }),
    ]);

    await enrichVersionFindings(batch.dossierVersionId).catch(() => 0);

    await regAudit({
      companyId: batch.companyId, actorId: "system", dossierId: batch.dossierId, dossierVersionId: batch.dossierVersionId,
      action: "AI_BATCH_DONE",
      detail: `Analyse différée terminée : ${kept.length} constat(s) (PROJET — revue humaine requise) sur ${outcomes.length} part(s), ${costUsd.toFixed(4)} $ facturés.`,
    });

    if (batch.createdById) {
      await notifyUser({
        userId: batch.createdById, type: "GENERIC",
        title: "Analyse différée terminée",
        body: `${kept.length} constat(s) à relire — ${costUsd.toFixed(2)} $ (moitié prix).`,
        link: batch.dossierId ? `/regulatory/enregistrement/analyse/${batch.dossierId}` : "/regulatory/enregistrement/analyse",
      }).catch(() => undefined);
    }

    return kept.length;
  } catch (e) {
    console.error("[ctd-batch] traitement des résultats impossible", batchId, e);
    await prisma.regulatoryAiBatch
      .update({ where: { id: batchId }, data: { error: "Traitement des résultats impossible." } })
      .catch(() => {});
    return 0;
  }
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
const severityRank = (s: string): number => SEVERITY_RANK[s] ?? 9;
