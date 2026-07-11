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
// Parties de 4 Mo : chaque requête reste COURTE → termine bien avant tout délai de garde d'un
// proxy/hébergeur (une partie de 8 Mo sur un lien lent partagé entre 3 envois peut être réinitialisée
// → « réseau »), retentes plus rapides, mémoire réduite. Réglable (REG_UPLOAD_PART_MB), borné à 32 Mo.
export const DEFAULT_PART_SIZE = Number(process.env.REG_UPLOAD_PART_MB ?? 4) * MB;
export const SMALL_FILE_THRESHOLD = Number(process.env.REG_UPLOAD_SMALL_MB ?? 12) * MB; // en-deçà : route directe
export const MAX_TOTAL_BYTES = DEFAULT_ZIP_LIMITS.maxArchiveBytes; // aligné sur la limite d'archive
export const MAX_ACTIVE_SESSIONS_PER_ORG = Number(process.env.REG_UPLOAD_MAX_ACTIVE ?? 3);
export const ORG_QUOTA_BYTES = Number(process.env.REG_ORG_QUOTA_GB ?? 50) * 1024 * MB;
const STALE_SESSION_MS = Number(process.env.REG_UPLOAD_STALE_HOURS ?? 12) * 3600_000;

export interface StartResult { ok: boolean; error?: string; sessionId?: string; partSize?: number; expectedParts?: number; receivedIndices?: number[]; resumed?: boolean }
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

/**
 * REPRISE + nettoyage des sessions fantômes, à l'ouverture d'un envoi.
 *  - Cherche une session RÉSUMABLE : même dossier + même fichier (nom + taille) + même découpage,
 *    encore « UPLOADING » → on la réutilise pour ne renvoyer QUE les parties manquantes (survit à
 *    une coupure réseau ou un rechargement de page).
 *  - Abandonne les AUTRES envois du même dossier (remplacés) et les envois de l'org sans activité
 *    récente (dernière partie — ou création si aucune — trop ancienne), sinon ils satureraient à
 *    tort la limite de concurrence (« trop d'envois »). Jamais la session résumable.
 */
async function reapAndFindResumable(
  companyId: string, dossierId: string, filename: string, totalBytes: number, partSize: number,
): Promise<{ id: string; partSize: number } | null> {
  const reapMs = Number(process.env.REG_UPLOAD_REAP_MIN ?? 15) * 60_000;
  const cutoff = new Date(Date.now() - reapMs);
  const sessions = await prisma.regulatoryUploadSession.findMany({
    where: { companyId, status: { in: ["UPLOADING", "FINALIZING"] } },
    select: { id: true, dossierId: true, filename: true, totalBytes: true, partSize: true, status: true, createdAt: true, parts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const wantName = filename.slice(0, 255);
  const wantBytes = Math.floor(totalBytes);
  const resumable = sessions.find((s) =>
    s.status === "UPLOADING" && s.dossierId === dossierId && s.filename === wantName &&
    Number(s.totalBytes) === wantBytes && s.partSize === partSize) ?? null;
  const toAbort = sessions
    .filter((s) => s.id !== resumable?.id && (s.dossierId === dossierId || (s.parts[0]?.createdAt ?? s.createdAt) < cutoff))
    .map((s) => s.id);
  if (toAbort.length > 0) {
    await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: { in: toAbort } } });
    await prisma.regulatoryUploadSession.updateMany({ where: { id: { in: toAbort } }, data: { status: "ABORTED", error: "Envoi remplacé ou abandonné (nettoyage automatique)." } });
  }
  return resumable ? { id: resumable.id, partSize: resumable.partSize } : null;
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

  // REPRISE : réutilise une session compatible existante (ne renvoie que les parties manquantes) et
  // nettoie au passage les sessions fantômes/remplacées AVANT de compter les envois actifs.
  const resumable = await reapAndFindResumable(opts.companyId, opts.dossierId, opts.filename, opts.totalBytes, partSize);
  if (resumable) {
    const st = await uploadSessionStatus(resumable.id, opts.companyId);
    return { ok: true, sessionId: resumable.id, partSize: resumable.partSize, expectedParts: expectedPartsFor(opts.totalBytes, resumable.partSize), receivedIndices: st.receivedIndices ?? [], resumed: true };
  }
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
  return { ok: true, sessionId: session.id, partSize, expectedParts: expectedPartsFor(opts.totalBytes, partSize), receivedIndices: [], resumed: false };
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
  // Stockage MINIMAL : un seul upsert (idempotent par index → reprise/retente). PAS d'agrégat ni
  // de mise à jour de la session ici. Sous forte concurrence avec un pool de connexions limité
  // (défaut Prisma = CPUs×2+1, souvent 3), l'agrégat + la mise à jour de la MÊME ligne de session
  // épuisaient le pool / créaient de la contention → HTTP 500. `receivedBytes` est recalculé à la
  // demande (uploadSessionStatus) et fixé à la finalisation. On n'échoue jamais par exception :
  // toute erreur DB devient un statut réessayable.
  try {
    await prisma.regulatoryUploadPart.upsert({
      where: { sessionId_index: { sessionId: session.id, index: opts.index } },
      create: { sessionId: session.id, index: opts.index, size: opts.data.length, sha256: sha, data: opts.data },
      update: { size: opts.data.length, sha256: sha, data: opts.data },
    });
  } catch (err) {
    console.error("[reg-upload] putUploadPart — échec stockage", { sessionId: opts.sessionId, index: opts.index, message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Stockage de la partie momentanément indisponible — réessai." };
  }
  return { ok: true };
}

/** État d'une session (pour la reprise : quelles parties sont déjà reçues). */
export async function uploadSessionStatus(sessionId: string, companyId: string): Promise<StatusResult> {
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: sessionId, companyId }, select: { status: true, totalBytes: true, partSize: true, parts: { select: { index: true, size: true }, orderBy: { index: "asc" } } },
  });
  if (!session) return { ok: false, error: "Session introuvable." };
  const totalBytes = Number(session.totalBytes);
  const expectedParts = expectedPartsFor(totalBytes, session.partSize);
  const receivedIndices = session.parts.map((p) => p.index);
  // Octets reçus recalculés depuis les parties (le champ session n'est plus maintenu par partie).
  const receivedBytes = session.parts.reduce((s, p) => s + p.size, 0);
  return {
    ok: true, status: session.status, totalBytes, receivedBytes,
    expectedParts, receivedIndices, complete: receivedIndices.length === expectedParts && receivedBytes === totalBytes,
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
