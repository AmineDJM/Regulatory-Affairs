import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { ingestDossierZip, type IngestResult } from "../ingest/ingest-dossier";
import { DEFAULT_ZIP_LIMITS } from "../ingest/zip-inspector";
import { regAudit } from "../audit";

/**
 * UPLOAD RÉSUMABLE DE GROS FICHIERS (G14) — cœur logique.
 *
 * Principe : le fichier est envoyé en PARTIES ; chaque partie est stockée séparément → le
 * chemin d'upload ne charge JAMAIS l'archive complète en RAM. Reprise possible (idempotence
 * par index). La FINALISATION vérifie taille + SHA-256 côté stockage, PUIS lance l'ingestion
 * sécurisée (inspection seulement après finalisation). Quotas par organisation + limite de
 * concurrence appliqués à la création ; parties nettoyées à la finalisation/abandon.
 *
 * Coût mémoire : le chemin d'upload est borné à la taille d'UNE partie. Le pic mémoire ne
 * survient qu'à la finalisation (un buffer unique pour le stockage adressé par contenu), hors
 * chemin de requête d'upload et borné par la limite d'archive.
 */

const MB = 1024 * 1024;
// Parties de 8 Mo : premières briques envoyées vite + mémoire modérée (client : concurrence ×
// 8 Mo). Combiné à l'envoi PARALLÈLE côté client (pool borné) et à la progression d'octets réelle,
// remplit le lien montant sans laisser la barre figée. Réglable (REG_UPLOAD_PART_MB), borné à 32 Mo.
export const DEFAULT_PART_SIZE = Number(process.env.REG_UPLOAD_PART_MB ?? 8) * MB;
export const SMALL_FILE_THRESHOLD = Number(process.env.REG_UPLOAD_SMALL_MB ?? 12) * MB; // en-deçà : route directe
export const MAX_TOTAL_BYTES = DEFAULT_ZIP_LIMITS.maxArchiveBytes; // aligné sur la limite d'archive
export const MAX_ACTIVE_SESSIONS_PER_ORG = Number(process.env.REG_UPLOAD_MAX_ACTIVE ?? 3);
export const ORG_QUOTA_BYTES = Number(process.env.REG_ORG_QUOTA_GB ?? 50) * 1024 * MB;
const STALE_SESSION_MS = Number(process.env.REG_UPLOAD_STALE_HOURS ?? 12) * 3600_000;

export interface StartResult { ok: boolean; error?: string; sessionId?: string; partSize?: number; expectedParts?: number }
export interface PartResult { ok: boolean; error?: string; receivedBytes?: number; storedParts?: number }
export interface StatusResult {
  ok: boolean; error?: string; status?: string; totalBytes?: number; receivedBytes?: number;
  expectedParts?: number; receivedIndices?: number[]; complete?: boolean;
}
export interface FinalizeResult { ok: boolean; error?: string; ingest?: IngestResult }

const looksZip = (name: string) => /\.zip$/i.test(name);
export const expectedPartsFor = (totalBytes: number, partSize: number) => Math.max(1, Math.ceil(totalBytes / partSize));

/** Valide la taille d'une partie (déterministe, pure). Non-dernière = partSize ; dernière ≤ partSize. */
export function validatePartSize(opts: { index: number; size: number; partSize: number; totalBytes: number }): string | null {
  const { index, size, partSize, totalBytes } = opts;
  const expected = expectedPartsFor(totalBytes, partSize);
  if (index < 0 || index >= expected) return `Index de partie hors bornes (0..${expected - 1}).`;
  if (size <= 0) return "Partie vide.";
  if (size > partSize) return `Partie trop grande (${size} > ${partSize}).`;
  const isLast = index === expected - 1;
  const lastSize = totalBytes - partSize * (expected - 1);
  if (!isLast && size !== partSize) return "Seule la dernière partie peut être plus petite.";
  if (isLast && size > lastSize) return `Dernière partie trop grande (${size} > ${lastSize}).`;
  return null;
}

/** Consommation réglementaire actuelle d'une organisation (versions + sessions en cours). */
async function orgUsageBytes(companyId: string): Promise<number> {
  const [versions, active] = await Promise.all([
    prisma.regulatoryDossierVersion.aggregate({ where: { dossier: { companyId } }, _sum: { totalBytes: true } }),
    prisma.regulatoryUploadSession.findMany({ where: { companyId, status: { in: ["UPLOADING", "FINALIZING"] } }, select: { totalBytes: true } }),
  ]);
  const inFlight = active.reduce((s, a) => s + Number(a.totalBytes), 0);
  return (versions._sum.totalBytes ?? 0) + inFlight;
}

/** Ouvre une session d'upload résumable (quota + concurrence + type contrôlés). */
export async function startUploadSession(opts: {
  companyId: string; dossierId: string; createdById: string; filename: string; contentType?: string | null;
  totalBytes: number; partSize?: number; expectedSha256?: string | null;
}): Promise<StartResult> {
  const partSize = Math.min(Math.max(opts.partSize ?? DEFAULT_PART_SIZE, 1024), 32 * MB);
  if (!Number.isFinite(opts.totalBytes) || opts.totalBytes <= 0) return { ok: false, error: "Taille invalide." };
  if (opts.totalBytes > MAX_TOTAL_BYTES) return { ok: false, error: `Archive trop volumineuse (${Math.round(opts.totalBytes / MB)} Mo > ${Math.round(MAX_TOTAL_BYTES / MB)} Mo).` };
  if (!looksZip(opts.filename)) return { ok: false, error: "Le dossier CTD doit être un ZIP (.zip)." };

  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: opts.dossierId, companyId: opts.companyId }, select: { id: true } });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const active = await prisma.regulatoryUploadSession.count({ where: { companyId: opts.companyId, status: "UPLOADING" } });
  if (active >= MAX_ACTIVE_SESSIONS_PER_ORG) return { ok: false, error: `Trop d'envois simultanés (max ${MAX_ACTIVE_SESSIONS_PER_ORG}). Terminez ou abandonnez un envoi en cours.` };

  const usage = await orgUsageBytes(opts.companyId);
  if (usage + opts.totalBytes > ORG_QUOTA_BYTES) {
    return { ok: false, error: `Quota de l'organisation dépassé (${Math.round((usage + opts.totalBytes) / (1024 * MB))} Go > ${Math.round(ORG_QUOTA_BYTES / (1024 * MB))} Go).` };
  }

  const session = await prisma.regulatoryUploadSession.create({
    data: {
      companyId: opts.companyId, dossierId: opts.dossierId, createdById: opts.createdById,
      filename: opts.filename.slice(0, 255), contentType: opts.contentType ?? null,
      totalBytes: BigInt(Math.floor(opts.totalBytes)), partSize, expectedSha256: opts.expectedSha256 ?? null,
    },
    select: { id: true },
  });
  await regAudit({ companyId: opts.companyId, actorId: opts.createdById, dossierId: opts.dossierId, action: "UPLOAD_SESSION_START", detail: `Session d'upload « ${opts.filename} » (${Math.round(opts.totalBytes / MB)} Mo, parties de ${Math.round(partSize / MB)} Mo).` });
  return { ok: true, sessionId: session.id, partSize, expectedParts: expectedPartsFor(opts.totalBytes, partSize) };
}

/** Stocke UNE partie (idempotent par index → reprise). Contrôle de taille côté stockage. */
export async function putUploadPart(opts: { sessionId: string; companyId: string; index: number; data: Buffer }): Promise<PartResult> {
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: opts.sessionId, companyId: opts.companyId }, select: { id: true, status: true, partSize: true, totalBytes: true },
  });
  if (!session) return { ok: false, error: "Session introuvable." };
  if (session.status !== "UPLOADING") return { ok: false, error: `Session non ouverte (${session.status}).` };

  const totalBytes = Number(session.totalBytes);
  const sizeErr = validatePartSize({ index: opts.index, size: opts.data.length, partSize: session.partSize, totalBytes });
  if (sizeErr) return { ok: false, error: sizeErr };

  const sha = createHash("sha256").update(opts.data).digest("hex");
  await prisma.regulatoryUploadPart.upsert({
    where: { sessionId_index: { sessionId: session.id, index: opts.index } },
    create: { sessionId: session.id, index: opts.index, size: opts.data.length, sha256: sha, data: opts.data },
    update: { size: opts.data.length, sha256: sha, data: opts.data },
  });

  // Recalcule les octets reçus depuis les parties (robuste aux ré-envois).
  const agg = await prisma.regulatoryUploadPart.aggregate({ where: { sessionId: session.id }, _sum: { size: true }, _count: true });
  const receivedBytes = agg._sum.size ?? 0;
  if (receivedBytes > totalBytes) return { ok: false, error: "Octets reçus supérieurs à la taille annoncée." };
  await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { receivedBytes: BigInt(receivedBytes) } });
  return { ok: true, receivedBytes, storedParts: agg._count };
}

/** État d'une session (pour la reprise : quelles parties sont déjà reçues). */
export async function uploadSessionStatus(sessionId: string, companyId: string): Promise<StatusResult> {
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: sessionId, companyId }, select: { status: true, totalBytes: true, receivedBytes: true, partSize: true, parts: { select: { index: true }, orderBy: { index: "asc" } } },
  });
  if (!session) return { ok: false, error: "Session introuvable." };
  const totalBytes = Number(session.totalBytes);
  const expectedParts = expectedPartsFor(totalBytes, session.partSize);
  const receivedIndices = session.parts.map((p) => p.index);
  return {
    ok: true, status: session.status, totalBytes, receivedBytes: Number(session.receivedBytes),
    expectedParts, receivedIndices, complete: receivedIndices.length === expectedParts && Number(session.receivedBytes) === totalBytes,
  };
}

/** Finalise : vérifie taille + SHA-256, assemble, PUIS ingère (inspection après finalisation). */
export async function finalizeUploadSession(sessionId: string, companyId: string, actorId: string): Promise<FinalizeResult> {
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: sessionId, companyId }, select: { id: true, status: true, dossierId: true, filename: true, totalBytes: true, partSize: true, expectedSha256: true },
  });
  if (!session) return { ok: false, error: "Session introuvable." };
  if (session.status === "COMPLETED") return { ok: false, error: "Session déjà finalisée." };
  if (session.status !== "UPLOADING") return { ok: false, error: `Session non finalisable (${session.status}).` };
  if (!session.dossierId) return { ok: false, error: "Dossier manquant." };

  const totalBytes = Number(session.totalBytes);
  const expectedParts = expectedPartsFor(totalBytes, session.partSize);
  // Métadonnées SEULEMENT (pas les octets) pour vérifier contiguïté/complétude sans charger le fichier.
  const meta = await prisma.regulatoryUploadPart.findMany({ where: { sessionId: session.id }, orderBy: { index: "asc" }, select: { index: true, size: true } });

  const abort = async (error: string): Promise<FinalizeResult> => {
    await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "ABORTED", error } });
    await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: session.id } });
    return { ok: false, error };
  };

  // Contiguïté + complétude AVANT d'assembler (aucune inspection tant que non finalisé).
  if (meta.length !== expectedParts) return { ok: false, error: `Parties manquantes (${meta.length}/${expectedParts}).` };
  for (let i = 0; i < expectedParts; i++) if (meta[i].index !== i) return { ok: false, error: `Partie ${i} manquante.` };
  const sumBytes = meta.reduce((s, p) => s + p.size, 0);
  if (sumBytes !== totalBytes) return abort(`Taille reçue incohérente (${sumBytes} ≠ ${totalBytes}).`);

  await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "FINALIZING" } });

  // Assemblage en FLUX vers un buffer pré-alloué : on lit UNE partie à la fois (pic ≈ taille du
  // fichier + une partie, au lieu de 2× avec un concat), et on calcule le SHA-256 au passage.
  const buffer = Buffer.allocUnsafe(totalBytes);
  const hash = createHash("sha256");
  let offset = 0;
  for (let i = 0; i < expectedParts; i++) {
    const part = await prisma.regulatoryUploadPart.findUnique({ where: { sessionId_index: { sessionId: session.id, index: i } }, select: { data: true } });
    if (!part) return abort(`Partie ${i} introuvable à l'assemblage.`);
    const b = Buffer.from(part.data);
    b.copy(buffer, offset);
    hash.update(b);
    offset += b.length;
  }
  if (offset !== totalBytes) return abort(`Assemblage incohérent (${offset} ≠ ${totalBytes}).`);
  const sha = hash.digest("hex");
  if (session.expectedSha256 && session.expectedSha256.toLowerCase() !== sha.toLowerCase()) {
    return abort(`Empreinte SHA-256 non concordante (fichier corrompu en transit).`);
  }

  const ingest = await ingestDossierZip({ companyId, dossierId: session.dossierId, actorId, filename: session.filename, buffer });
  if (!ingest.ok) {
    await abort(ingest.error ?? "Ingestion refusée.");
    return { ok: false, error: ingest.error, ingest };
  }

  await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "COMPLETED", blobId: null, versionId: ingest.versionId ?? null, receivedBytes: BigInt(totalBytes) } });
  await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: session.id } }); // nettoyage des parties
  await regAudit({ companyId, actorId, dossierId: session.dossierId, action: "UPLOAD_SESSION_FINALIZE", detail: `Upload finalisé « ${session.filename} » (${Math.round(totalBytes / MB)} Mo, SHA-256 vérifié).` });
  return { ok: true, ingest };
}

/** Abandonne une session et supprime ses parties (nettoyage des envois incomplets). */
export async function abortUploadSession(sessionId: string, companyId: string): Promise<{ ok: boolean }> {
  await prisma.regulatoryUploadSession.updateMany({ where: { id: sessionId, companyId, status: { in: ["UPLOADING", "FINALIZING"] } }, data: { status: "ABORTED", error: "Abandon demandé." } });
  await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId } });
  return { ok: true };
}

/** Purge les sessions incomplètes trop anciennes + leurs parties (déclenché par le planificateur). */
export async function pruneStaleUploadSessions(): Promise<number> {
  const stale = await prisma.regulatoryUploadSession.findMany({
    where: { status: { in: ["UPLOADING", "FINALIZING"] }, updatedAt: { lt: new Date(Date.now() - STALE_SESSION_MS) } }, select: { id: true },
  });
  if (stale.length === 0) return 0;
  const ids = stale.map((s) => s.id);
  await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.regulatoryUploadSession.updateMany({ where: { id: { in: ids } }, data: { status: "ABORTED", error: "Expirée (inactive)." } });
  return ids.length;
}
