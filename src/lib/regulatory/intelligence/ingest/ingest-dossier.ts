import type { RegDocExtractionStatus, RegDocSecurityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob } from "@/lib/drive-storage";
import { regAudit } from "../audit";
import { inspectZip, type ManifestEntry, type SecurityStatus, type ZipInspection } from "./zip-inspector";

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

export async function ingestDossierZip(opts: {
  companyId: string;
  dossierId: string;
  actorId: string;
  filename: string;
  buffer: Buffer;
  label?: string | null;
}): Promise<IngestResult> {
  const { companyId, dossierId, actorId, filename, buffer } = opts;

  // Blobs stockés pendant l'inspection → à libérer si la suite échoue.
  const blobByPath = new Map<string, string>();
  const releaseAll = async () => {
    for (const id of new Set(blobByPath.values())) await releaseBlob(id).catch(() => undefined);
  };

  // 1) + 2) Inspection sécurisée avec stockage inline des fichiers sûrs.
  let inspection: ZipInspection;
  try {
    inspection = await inspectZip(buffer, {
      onStorableEntry: async (entry: ManifestEntry, data: Buffer) => {
        const b = await putBlob(data);
        blobByPath.set(entry.path, b.blobId);
      },
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

  // 3) Archive ORIGINALE immuable.
  let originalBlobId: string;
  let originalSha256: string;
  try {
    const ob = await putBlob(buffer);
    originalBlobId = ob.blobId;
    originalSha256 = ob.sha256;
  } catch (err) {
    console.error("[ingest] stockage de l'archive originale échoué", err);
    await releaseAll();
    return { ok: false, error: "Échec du stockage de l'archive." };
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

    const versionId = await prisma.$transaction(async (tx) => {
      const version = await tx.regulatoryDossierVersion.create({
        data: {
          dossierId, versionNo, label: opts.label ?? null,
          originalZipBlobId: originalBlobId, originalSha256,
          fileCount: inspection.entries.length,
          totalBytes: clampInt(storableBytes),
          createdById: actorId,
        },
        select: { id: true },
      });

      await tx.regulatoryDocument.createMany({
        data: inspection.entries.map((e) => {
          const storable = isStorable(e.securityStatus);
          const extraction: RegDocExtractionStatus = storable ? "PENDING" : "UNSUPPORTED";
          return {
            dossierVersionId: version.id,
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
        }),
      });

      // 5) Job EXTRACT (Node-first) — le runner le traitera en arrière-plan.
      await tx.regulatoryJob.create({
        data: { companyId, dossierId, dossierVersionId: version.id, type: "EXTRACT", status: "QUEUED", payload: { filename } },
      });

      await tx.regulatoryDossier.update({ where: { id: dossierId }, data: { status: "INGESTED" } });
      return version.id;
    });

    const summary: IngestSummary = {
      total: inspection.entries.length,
      stored: inspection.entries.filter((e) => e.securityStatus === "SAFE").length,
      blocked: inspection.entries.filter((e) => e.securityStatus.startsWith("BLOCKED") || e.securityStatus === "CORRUPTED").length,
      suspicious: inspection.entries.filter((e) => e.securityStatus === "SUSPICIOUS").length,
      totalBytes: clampInt(storableBytes),
    };

    await regAudit({
      companyId, actorId, dossierId, dossierVersionId: versionId, action: "INGEST_OK",
      detail: `Archive « ${filename} » ingérée (v${versionNo}) : ${summary.stored} fichier(s) conservé(s), ${summary.blocked} bloqué(s), ${summary.suspicious} suspect(s).`,
      meta: { filename, versionNo, ...summary, originalSha256 },
    });

    return { ok: true, versionId, versionNo, summary };
  } catch (err) {
    console.error("[ingest] persistance échouée — rollback", err);
    await releaseBlob(originalBlobId).catch(() => undefined);
    await releaseAll();
    return { ok: false, error: "Échec de l'enregistrement du dossier (annulé)." };
  }
}
