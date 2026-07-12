import { readFile } from "fs/promises";
import type { RegDocExtractionStatus, RegDocSecurityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob, sha256 } from "@/lib/drive-storage";
import { objectStorageConfigured } from "../upload/object-storage";
import { regAudit } from "../audit";
import { inspectZip, inspectZipFile, type ManifestEntry, type SecurityStatus, type ZipInspection } from "./zip-inspector";

/**
 * SERVICE D'INGESTION d'un dossier CTD (ZIP) — Regulatory Intelligence OS.
 *
 * Chaîne robuste et transactionnelle :
 *  1. inspection sécurisée AVANT tout stockage (anti-bombe / traversal / exécutables) ;
 *  2. stockage inline de chaque fichier SÛR (blob chiffré, adressé par SHA-256), un fichier
 *     à la fois → mémoire bornée ;
 *  3. conservation de l'archive ORIGINALE **immuable** (blob + SHA-256) ;
 *  4. création atomique de la version + du manifeste (une ligne par entrée, y compris les
 *     entrées BLOQUÉES — traçabilité, jamais de fausse conformité) ;
 *  5. mise en file d'un job EXTRACT (traitement lourd asynchrone, Node-first) ;
 *  6. audit.
 * En cas d'échec à toute étape après stockage : **rollback** (libération de tous les blobs).
 */

const SECURITY_MAP: Record<SecurityStatus, RegDocSecurityStatus> = {
  SAFE: "SAFE",
  SUSPICIOUS: "SUSPICIOUS",
  BLOCKED_EXECUTABLE: "BLOCKED_EXECUTABLE",
  BLOCKED_ENCRYPTED: "BLOCKED_ENCRYPTED",
  BLOCKED_PATH: "BLOCKED_PATH",
  BLOCKED_OVERSIZE: "BLOCKED_OVERSIZE",
  CORRUPTED: "CORRUPTED",
};

const isStorable = (s: SecurityStatus) => s === "SAFE" || s === "SUSPICIOUS";

// Int32 de sécurité pour les colonnes `sizeBytes`/`totalBytes` (garde anti-débordement).
const INT32_MAX = 2_147_483_647;
const clampInt = (n: number) => Math.max(0, Math.min(INT32_MAX, Math.round(n)));

// Plafond de taille d'UN blob stocké EN BASE (Postgres bytea) : au-delà, l'insert d'un seul bytea
// géant sature la mémoire (protocole hex ≈ 2×) voire dépasse la limite dure ~1 Go → tue le process.
// En stockage OBJET (R2/S3) cette limite ne s'applique pas. Réglable via REG_MAX_PG_BLOB_MB.
const maxPgBlobBytes = () => Number(process.env.REG_MAX_PG_BLOB_MB ?? 400) * 1024 * 1024;

export interface IngestSummary {
  total: number;
  stored: number;
  blocked: number;
  suspicious: number;
  totalBytes: number;
}

export interface IngestResult {
  ok: boolean;
  error?: string;
  rejectionCode?: string;
  versionId?: string;
  versionNo?: number;
  summary?: IngestSummary;
}

/** Ingestion d'un dossier CTD depuis un BUFFER (petits fichiers, route directe). */
export async function ingestDossierZip(opts: {
  companyId: string;
  dossierId: string;
  actorId: string;
  filename: string;
  buffer: Buffer;
  label?: string | null;
}): Promise<IngestResult> {
  return ingestCore(
    opts,
    (onStorableEntry) => inspectZip(opts.buffer, { onStorableEntry }),
    async () => opts.buffer,
  );
}

/**
 * Ingestion d'un dossier CTD depuis un FICHIER sur disque (gros dossiers, upload résumable). Lit
 * l'archive EN FLUX (yauzl, une entrée à la fois) → pic mémoire ≈ plus gros fichier, jamais
 * l'archive entière. Corrige l'OOM d'ingestion des gros ZIP.
 */
export async function ingestDossierZipFromFile(opts: {
  companyId: string;
  dossierId: string;
  actorId: string;
  filename: string;
  zipPath: string;
  label?: string | null;
}): Promise<IngestResult> {
  return ingestCore(
    opts,
    (onStorableEntry) => inspectZipFile(opts.zipPath, { onStorableEntry }),
    () => readFile(opts.zipPath),
  );
}

/**
 * Cœur d'ingestion partagé (buffer OU fichier) : inspection sécurisée avec stockage inline,
 * archive originale immuable, persistance atomique version + manifeste + job EXTRACT, rollback.
 * `runInspection` fournit la source (buffer/flux) ; `getOriginalBytes` fournit les octets de
 * l'archive originale à figer (lus seulement APRÈS l'inspection → opérations séquentielles, pas
 * de double détention mémoire).
 */
async function ingestCore(
  opts: { companyId: string; dossierId: string; actorId: string; filename: string; label?: string | null },
  runInspection: (onStorableEntry: (entry: ManifestEntry, data: Buffer) => Promise<void>) => Promise<ZipInspection>,
  getOriginalBytes: () => Promise<Buffer>,
): Promise<IngestResult> {
  const { companyId, dossierId, actorId, filename } = opts;

  // Blobs stockés pendant l'inspection → à libérer si la suite échoue.
  const blobByPath = new Map<string, string>();
  const releaseAll = async () => {
    for (const id of new Set(blobByPath.values())) await releaseBlob(id).catch(() => undefined);
  };

  // 1) + 2) Inspection sécurisée avec stockage inline des fichiers sûrs.
  let inspection: ZipInspection;
  try {
    inspection = await runInspection(async (entry: ManifestEntry, data: Buffer) => {
      const b = await putBlob(data);
      blobByPath.set(entry.path, b.blobId);
    });
  } catch (err) {
    console.error("[ingest] inspection échouée", err);
    await releaseAll();
    return { ok: false, error: "Échec de l'inspection de l'archive (fichier illisible ?)." };
  }

  if (!inspection.ok) {
    await releaseAll(); // une bombe rejetée en cours de boucle a pu stocker des blobs partiels
    await regAudit({
      companyId, actorId, dossierId, action: "INGEST_REJECTED",
      detail: `Archive « ${filename} » refusée : ${inspection.rejection?.message ?? "raison inconnue"}.`,
      meta: { code: inspection.rejection?.code ?? null, filename },
    });
    return { ok: false, error: inspection.rejection?.message ?? "Archive refusée.", rejectionCode: inspection.rejection?.code };
  }

  // 3) Archive ORIGINALE immuable — BEST-EFFORT. Une archive trop volumineuse pour un seul blob en
  // base (limite Postgres ~1 Go) NE doit PAS faire échouer tout le dossier : l'analyse se poursuit
  // avec les fichiers déjà stockés. On conserve TOUJOURS l'empreinte SHA-256 (traçabilité) ; pour
  // retenir l'archive COMPLÈTE quelle que soit sa taille, activez le stockage objet (R2/S3).
  let originalBlobId: string | null = null;
  let originalSha256 = "";
  let originalStored = false;
  try {
    const bytes = await getOriginalBytes();
    originalSha256 = sha256(bytes); // empreinte calculée même si le stockage n'est pas possible
    // Garde anti-OOM : en base, on n'INSÈRE pas un bytea géant (crash process). Objet → pas de limite.
    if (objectStorageConfigured() || bytes.length <= maxPgBlobBytes()) {
      const ob = await putBlob(bytes);
      originalBlobId = ob.blobId;
      originalStored = true;
    } else {
      console.warn(`[ingest] archive originale ${Math.round(bytes.length / (1024 * 1024))} Mo > plafond base ${Math.round(maxPgBlobBytes() / (1024 * 1024))} Mo — non retenue (activez R2 pour la conserver). Analyse poursuivie.`);
    }
  } catch (err) {
    // Échec de lecture/stockage de l'archive originale → on continue quand même (dossier analysable).
    console.error("[ingest] stockage de l'archive originale échoué (analyse poursuivie)", err instanceof Error ? err.message : err);
  }

  // 4) Numéro de version + création atomique version + documents.
  try {
    const last = await prisma.regulatoryDossierVersion.findFirst({
      where: { dossierId }, orderBy: { versionNo: "desc" }, select: { versionNo: true },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;

    const storableBytes = inspection.entries
      .filter((e) => isStorable(e.securityStatus))
      .reduce((s, e) => s + e.sizeBytes, 0);

    // Lignes documents préparées HORS transaction (le `dossierVersionId` est ajouté au moment de
    // l'insertion). Insertion PAR LOTS : Postgres plafonne à 65 535 paramètres/requête (~5000 docs
    // × 11 colonnes) — un très gros dossier CTD dépasse ce seuil, d'où l'échec « enregistrement
    // annulé ». On découpe donc le createMany, et on ALLONGE le délai de transaction (le défaut
    // Prisma de 5 s est trop court pour des milliers de lignes).
    const docData = inspection.entries.map((e) => {
      const storable = isStorable(e.securityStatus);
      const extraction: RegDocExtractionStatus = storable ? "PENDING" : "UNSUPPORTED";
      return {
        kind: "ORIGINAL" as const,
        originalPath: e.path,
        originalFilename: e.filename,
        ext: e.ext,
        sizeBytes: clampInt(e.sizeBytes),
        sha256: e.sha256 || "",
        compressionRatio: e.compressionRatio ?? null,
        securityStatus: SECURITY_MAP[e.securityStatus],
        extractionStatus: extraction,
        blobId: blobByPath.get(e.path) ?? null,
      };
    });
    const DOC_CHUNK = 1000; // 1000 × 11 colonnes = 11 000 paramètres, très en-deçà des 65 535

    const versionId = await prisma.$transaction(
      async (tx) => {
        const version = await tx.regulatoryDossierVersion.create({
          data: {
            dossierId, versionNo, label: opts.label ?? null,
            originalZipBlobId: originalBlobId, originalSha256: originalSha256 || null,
            fileCount: inspection.entries.length,
            totalBytes: clampInt(storableBytes),
            createdById: actorId,
          },
          select: { id: true },
        });

        for (let i = 0; i < docData.length; i += DOC_CHUNK) {
          await tx.regulatoryDocument.createMany({
            data: docData.slice(i, i + DOC_CHUNK).map((d) => ({ ...d, dossierVersionId: version.id })),
          });
        }

        // 5) Job EXTRACT (Node-first) — le runner le traitera en arrière-plan.
        await tx.regulatoryJob.create({
          data: { companyId, dossierId, dossierVersionId: version.id, type: "EXTRACT", status: "QUEUED", payload: { filename } },
        });

        await tx.regulatoryDossier.update({ where: { id: dossierId }, data: { status: "INGESTED" } });
        return version.id;
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    const summary: IngestSummary = {
      total: inspection.entries.length,
      stored: inspection.entries.filter((e) => e.securityStatus === "SAFE").length,
      blocked: inspection.entries.filter((e) => e.securityStatus.startsWith("BLOCKED") || e.securityStatus === "CORRUPTED").length,
      suspicious: inspection.entries.filter((e) => e.securityStatus === "SUSPICIOUS").length,
      totalBytes: clampInt(storableBytes),
    };

    const originalNote = originalStored ? "" : " — archive originale non retenue (trop volumineuse pour la base ; activez R2 pour la conserver)";
    await regAudit({
      companyId, actorId, dossierId, dossierVersionId: versionId, action: "INGEST_OK",
      detail: `Archive « ${filename} » ingérée (v${versionNo}) : ${summary.stored} fichier(s) conservé(s), ${summary.blocked} bloqué(s), ${summary.suspicious} suspect(s)${originalNote}.`,
      meta: { filename, versionNo, ...summary, originalSha256, originalStored },
    });

    return { ok: true, versionId, versionNo, summary };
  } catch (err) {
    console.error("[ingest] persistance échouée — rollback", err);
    if (originalBlobId) await releaseBlob(originalBlobId).catch(() => undefined);
    await releaseAll();
    return { ok: false, error: "Échec de l'enregistrement du dossier (annulé)." };
  }
}
