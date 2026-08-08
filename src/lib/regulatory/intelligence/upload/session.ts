import { createHash, randomBytes } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { createWriteStream } from "fs";
import { prisma } from "@/lib/prisma";
import { ingestDossierZip, ingestDossierZipFromFile, type IngestResult } from "../ingest/ingest-dossier";
import { DEFAULT_ZIP_LIMITS } from "../ingest/zip-inspector";
import { presignPutUrl, getObject, deleteObject, objectStorageConfigured } from "./object-storage";
import { regAudit } from "../audit";

export { objectStorageConfigured } from "./object-storage";

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
/**
 * TAILLE DES PARTIES — 4 Mo. **Grossir les parties RALENTIT** : c'est contre-intuitif, et mesuré.
 *
 * L'idée « moins d'allers-retours = plus rapide » suppose que le coût dominant soit la poignée de
 * main. Il ne l'est pas : le coût dominant est l'ÉCRITURE des octets en base, et Postgres écrit
 * d'autant moins vite qu'on lui présente une valeur `bytea` volumineuse d'un seul tenant. Mesuré
 * sur le même ZIP de 60 Mo, à 8 envois en parallèle (`scripts/bench/upload.ts`) :
 *
 *     1 Mo → 8,2 s     2 Mo → 8,9 s     4 Mo → 9,0 s     8 Mo → 10,8 s     16 Mo → 16,3 s
 *
 * …et la finalisation suit la même pente (3,5 s à 4 Mo contre 13,8 s à 16 Mo), parce qu'il faut
 * ensuite RELIRE ces mêmes valeurs pour réassembler l'archive. Passer à 16 Mo avait donc rendu le
 * téléversement deux fois plus lent, pas plus rapide.
 *
 * 4 Mo est le bon compromis : à égalité de débit avec 1 Mo, quatre fois moins de requêtes, et une
 * retente ne coûte que 4 Mo sur un lien instable — ce qui limite aussi le recul visible de la barre
 * de progression. Réglable : REG_UPLOAD_PART_MB (borné à 32 Mo).
 */
export const DEFAULT_PART_SIZE = Number(process.env.REG_UPLOAD_PART_MB ?? 4) * MB;
export const SMALL_FILE_THRESHOLD = Number(process.env.REG_UPLOAD_SMALL_MB ?? 12) * MB; // en-deçà : route directe
export const MAX_TOTAL_BYTES = DEFAULT_ZIP_LIMITS.maxArchiveBytes; // aligné sur la limite d'archive
export const MAX_ACTIVE_SESSIONS_PER_ORG = Number(process.env.REG_UPLOAD_MAX_ACTIVE ?? 3);
/**
 * Parties envoyées EN PARALLÈLE par le client — 8 (était 3). **C'est ici qu'est le vrai gain** :
 * contrairement à la taille des parties, le parallélisme paie. Mesuré sur 60 Mo en parties de
 * 4 Mo : 9,6 s à un seul envoi, 5,2 s à deux, 4,3 s à quatre, 4,2 s à huit — soit ×2,3, avec un
 * palier atteint vers quatre côté serveur.
 *
 * On garde 8 malgré ce palier : la mesure est faite en local, sans latence réseau, et c'est
 * précisément la latence qu'un envoi supplémentaire en vol permet de masquer chez l'utilisateur.
 * Le plafond n'est pas le réseau mais le POOL DE CONNEXIONS de la base et la mémoire de
 * l'instance ; 8 × 4 Mo reste très en dessous. Réglable : REG_UPLOAD_CONCURRENCY.
 */
export const UPLOAD_CONCURRENCY = Math.min(Math.max(Number(process.env.REG_UPLOAD_CONCURRENCY ?? 8), 1), 16);
export const ORG_QUOTA_BYTES = Number(process.env.REG_ORG_QUOTA_GB ?? 50) * 1024 * MB;
const STALE_SESSION_MS = Number(process.env.REG_UPLOAD_STALE_HOURS ?? 12) * 3600_000;
// Bail de finalisation : une session FINALIZING inactive depuis plus longtemps que ce délai est
// considérée COMME CRASHÉE (OOM/redémarrage), et une nouvelle tentative peut la reprendre. Plus
// long que la durée d'une finalisation normale → évite de doubler une finalisation encore en cours.
const FINALIZE_LEASE_MS = Number(process.env.REG_UPLOAD_FINALIZE_LEASE_MIN ?? 10) * 60_000;

export interface StartResult { ok: boolean; error?: string; sessionId?: string; partSize?: number; expectedParts?: number; receivedIndices?: number[]; resumed?: boolean }
export interface PartResult { ok: boolean; error?: string; receivedBytes?: number; storedParts?: number }
export interface StatusResult {
  ok: boolean; error?: string; status?: string; totalBytes?: number; receivedBytes?: number;
  expectedParts?: number; receivedIndices?: number[]; complete?: boolean;
}
export interface FinalizeResult { ok: boolean; error?: string; ingest?: IngestResult; retryable?: boolean }

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
 * Suppression des parties d'envois abandonnés, EN FOND et par petits paquets. Une session dont
 * les octets survivent quelques secondes de plus ne gêne personne ; une ouverture de session qui
 * attend ce ménage, si. Les paquets évitent aussi une transaction unique gigantesque sur des
 * lignes de plusieurs Mo. Ne lève jamais : le planificateur repassera (`pruneStaleUploadSessions`).
 */
const PART_PURGE_BATCH = 25;
let partPurgeQueue: Promise<void> = Promise.resolve();

function purgePartsInBackground(sessionIds: string[]): void {
  partPurgeQueue = partPurgeQueue.then(async () => {
    for (const sessionId of sessionIds) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await prisma.regulatoryUploadPart
          .findMany({ where: { sessionId }, select: { index: true }, take: PART_PURGE_BATCH })
          .catch(() => []);
        if (batch.length === 0) break;
        const done = await prisma.regulatoryUploadPart
          .deleteMany({ where: { sessionId, index: { in: batch.map((p) => p.index) } } })
          .catch(() => ({ count: 0 }));
        if (done.count === 0) break; // suppression impossible → on laisse le planificateur reprendre
      }
    }
  });
}

/** Attend le ménage des parties encore en cours (tests, arrêt propre). */
export async function flushPartPurges(): Promise<void> {
  await partPurgeQueue;
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
    // L'ABANDON est ce qui compte pour l'utilisateur : c'est lui qui libère la limite d'envois
    // simultanés, et il tient en une mise à jour de statut. La suppression des PARTIES, elle, ne
    // libère que de l'espace — mais elle porte sur des lignes de plusieurs Mo chacune (parfois des
    // centaines pour un envoi interrompu en cours de route). La faire attendre à l'ouverture de
    // session, c'était payer le ménage de la tentative précédente avant de pouvoir en lancer une
    // nouvelle — et plus l'utilisateur réessayait, plus il y avait à nettoyer. On marque, on rend
    // la main, et les octets partent derrière.
    await prisma.regulatoryUploadSession.updateMany({ where: { id: { in: toAbort } }, data: { status: "ABORTED", error: "Envoi remplacé ou abandonné (nettoyage automatique)." } });
    void purgePartsInBackground(toAbort);
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

/** Reconstruit un résultat de SUCCÈS depuis une version déjà ingérée (rejeu idempotent). */
async function finalizeResultFromVersion(versionId: string | null): Promise<FinalizeResult> {
  if (!versionId) return { ok: true }; // finalisée mais version inconnue (cas limite) — succès quand même
  const v = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: versionId }, select: { id: true, versionNo: true, fileCount: true, totalBytes: true },
  });
  if (!v) return { ok: true };
  const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersionId: v.id }, select: { securityStatus: true } });
  const summary = {
    total: v.fileCount,
    stored: docs.filter((d) => d.securityStatus === "SAFE").length,
    blocked: docs.filter((d) => d.securityStatus.startsWith("BLOCKED") || d.securityStatus === "CORRUPTED").length,
    suspicious: docs.filter((d) => d.securityStatus === "SUSPICIOUS").length,
    totalBytes: v.totalBytes,
  };
  return { ok: true, ingest: { ok: true, versionId: v.id, versionNo: v.versionNo, summary } };
}

/** Réouvre une session FINALIZING vers UPLOADING (récupérable → reprise) sans jamais lever. */
async function reopenFinalizing(sessionId: string, error: string): Promise<void> {
  await prisma.regulatoryUploadSession
    .updateMany({ where: { id: sessionId, status: "FINALIZING" }, data: { status: "UPLOADING", error } })
    .catch(() => undefined);
}

/**
 * Finalise : vérifie taille + SHA-256, assemble, PUIS ingère (inspection après finalisation).
 *
 * ROBUSTESSE (toutes causes d'échec) :
 *  - IDEMPOTENT : une session déjà COMPLETED renvoie un SUCCÈS avec la version existante — une
 *    réponse perdue après un succès (proxy 502, coupure) ne doit JAMAIS paraître comme un échec ;
 *  - BAIL atomique : réclame UPLOADING → FINALIZING ; une FINALIZING PÉRIMÉE (finalisation crashée
 *    par OOM/redémarrage) est reprise ; une FINALIZING FRAÎCHE renvoie « en cours » (réessayable) →
 *    pas de double ingestion ;
 *  - JAMAIS COINCÉE : toute erreur inattendue (mémoire/DB) réouvre la session en UPLOADING (reprise
 *    possible) au lieu de la laisser bloquée en FINALIZING ;
 *  - erreurs de DONNÉES (taille/SHA/ingestion refusée) → ABORTED (le renvoi des mêmes octets serait
 *    vain), erreurs TRANSITOIRES → réouverture/reprise.
 */
export async function finalizeUploadSession(sessionId: string, companyId: string, actorId: string): Promise<FinalizeResult> {
  const pre = await prisma.regulatoryUploadSession.findFirst({ where: { id: sessionId, companyId }, select: { status: true, versionId: true } });
  if (!pre) return { ok: false, error: "Session introuvable." };
  if (pre.status === "COMPLETED") return finalizeResultFromVersion(pre.versionId); // rejeu idempotent

  // BAIL : passe UPLOADING → FINALIZING, OU reprend une FINALIZING périmée (crash). Atomique →
  // deux finalisations concurrentes ne peuvent pas réclamer la même session en même temps.
  const claim = await prisma.regulatoryUploadSession.updateMany({
    where: {
      id: sessionId, companyId,
      OR: [{ status: "UPLOADING" }, { status: "FINALIZING", updatedAt: { lt: new Date(Date.now() - FINALIZE_LEASE_MS) } }],
    },
    data: { status: "FINALIZING", error: null },
  });
  if (claim.count === 0) {
    const s = await prisma.regulatoryUploadSession.findFirst({ where: { id: sessionId, companyId }, select: { status: true, versionId: true } });
    if (!s) return { ok: false, error: "Session introuvable." };
    if (s.status === "COMPLETED") return finalizeResultFromVersion(s.versionId);
    if (s.status === "FINALIZING") return { ok: false, retryable: true, error: "Finalisation déjà en cours — patientez quelques secondes puis réessayez." };
    return { ok: false, error: `Session non finalisable (${s.status}).` };
  }

  // BATTEMENT DE CŒUR du bail : la finalisation d'un GROS dossier (des centaines de Mo) dure
  // plusieurs minutes. On rafraîchit `updatedAt` (via un update no-op) toutes les 2 min tant que
  // le travail est en cours → le bail ne périme JAMAIS pendant un travail actif (aucune double
  // ingestion possible), et un process réellement crashé cesse de battre → bail repris après délai.
  const heartbeat = setInterval(() => {
    prisma.regulatoryUploadSession
      .updateMany({ where: { id: sessionId, status: "FINALIZING" }, data: { error: null } })
      .catch(() => undefined);
  }, 120_000);
  heartbeat.unref?.();
  try {
  // On détient le bail (status = FINALIZING). Métadonnées de la session.
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: sessionId, companyId }, select: { id: true, dossierId: true, filename: true, totalBytes: true, partSize: true, expectedSha256: true },
  });
  if (!session || !session.dossierId) {
    await reopenFinalizing(sessionId, "Dossier manquant.");
    return { ok: false, error: "Dossier manquant." };
  }
  const dossierId = session.dossierId;
  const totalBytes = Number(session.totalBytes);
  const expectedParts = expectedPartsFor(totalBytes, session.partSize);

  const abort = async (error: string): Promise<FinalizeResult> => {
    await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "ABORTED", error } }).catch(() => undefined);
    await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: session.id } }).catch(() => undefined);
    return { ok: false, error };
  };

  try {
    // Métadonnées SEULEMENT (pas les octets) pour vérifier contiguïté/complétude. Des parties
    // manquantes sont RÉCUPÉRABLES → on réouvre pour laisser la reprise les renvoyer.
    const meta = await prisma.regulatoryUploadPart.findMany({ where: { sessionId: session.id }, orderBy: { index: "asc" }, select: { index: true, size: true } });
    if (meta.length !== expectedParts) {
      await reopenFinalizing(session.id, `Parties manquantes (${meta.length}/${expectedParts}).`);
      return { ok: false, error: `Parties manquantes (${meta.length}/${expectedParts}) — relancez pour reprendre.` };
    }
    for (let i = 0; i < expectedParts; i++) if (meta[i].index !== i) {
      await reopenFinalizing(session.id, `Partie ${i} manquante.`);
      return { ok: false, error: `Partie ${i + 1} manquante — relancez pour reprendre.` };
    }
    const sumBytes = meta.reduce((s, p) => s + p.size, 0);
    if (sumBytes !== totalBytes) return abort(`Taille reçue incohérente (${sumBytes} ≠ ${totalBytes}).`);

    // Assemblage vers un FICHIER TEMPORAIRE sur disque (jamais l'archive entière en RAM) : parties
    // écrites en flux, SHA-256 calculé au passage. L'ingestion lit ensuite l'archive EN FLUX
    // (yauzl, une entrée à la fois) → pic mémoire ≈ plus gros fichier, ce qui supprime l'OOM.
    const tmpDir = await mkdtemp(join(tmpdir(), "reg-ctd-"));
    const zipPath = join(tmpDir, "archive.zip");
    try {
      const ws = createWriteStream(zipPath);
      const hash = createHash("sha256");
      let offset = 0;
      let writeErr: Error | null = null;
      ws.on("error", (e) => { writeErr = e; });
      for (let i = 0; i < expectedParts; i++) {
        const part = await prisma.regulatoryUploadPart.findUnique({ where: { sessionId_index: { sessionId: session.id, index: i } }, select: { data: true } });
        if (!part) {
          ws.destroy();
          await reopenFinalizing(session.id, `Partie ${i} introuvable.`);
          return { ok: false, error: `Partie ${i + 1} introuvable — relancez pour reprendre.` };
        }
        const b = Buffer.from(part.data);
        if (!ws.write(b)) await new Promise<void>((res) => ws.once("drain", res)); // backpressure disque
        hash.update(b);
        offset += b.length;
      }
      await new Promise<void>((res, rej) => { ws.on("error", rej); ws.end(() => res()); });
      if (writeErr) throw writeErr;
      if (offset !== totalBytes) return abort(`Assemblage incohérent (${offset} ≠ ${totalBytes}).`);
      const sha = hash.digest("hex");
      if (session.expectedSha256 && session.expectedSha256.toLowerCase() !== sha.toLowerCase()) {
        return abort(`Empreinte SHA-256 non concordante (fichier corrompu en transit).`);
      }

      // `sha` est déjà l'empreinte de l'archive assemblée : la transmettre évite à l'ingestion de
      // relire le fichier entier une seconde fois pour la recalculer.
      const ingest = await ingestDossierZipFromFile({ companyId, dossierId, actorId, filename: session.filename, zipPath, sha256: sha });
      if (!ingest.ok) {
        await abort(ingest.error ?? "Ingestion refusée.");
        return { ok: false, error: ingest.error, ingest };
      }

      await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "COMPLETED", blobId: null, versionId: ingest.versionId ?? null, receivedBytes: BigInt(totalBytes) } });
      await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: session.id } }); // nettoyage des parties
      await regAudit({ companyId, actorId, dossierId, action: "UPLOAD_SESSION_FINALIZE", detail: `Upload finalisé « ${session.filename} » (${Math.round(totalBytes / MB)} Mo, SHA-256 vérifié).` });
      return { ok: true, ingest };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined); // nettoyage du fichier temporaire
    }
  } catch (err) {
    // Erreur INATTENDUE (mémoire/DB transitoire) → JAMAIS coincer la session : réouvrir en UPLOADING
    // (reprise possible côté client). Réessayable : le client relance la finalisation.
    console.error("[reg-upload] finalize — erreur inattendue", { sessionId, message: err instanceof Error ? err.message : String(err) });
    await reopenFinalizing(session.id, "Finalisation interrompue (serveur) — relancez pour reprendre.");
    return { ok: false, retryable: true, error: "Finalisation interrompue côté serveur — relancez le même fichier pour reprendre." };
  }
  } finally {
    clearInterval(heartbeat); // fin du battement de cœur quel que soit le chemin de sortie
  }
}

// ─────────────────────────── UPLOAD DIRECT S3/R2 (chantier 1) ───────────────────────────

export interface DirectStartResult { ok: boolean; error?: string; sessionId?: string; uploadUrl?: string }

/** Nettoie les sessions directes fantômes du même dossier (+ objets temporaires) avant un nouvel envoi. */
async function reapDirectSessions(companyId: string, dossierId: string): Promise<void> {
  const reapMs = Number(process.env.REG_UPLOAD_REAP_MIN ?? 15) * 60_000;
  const cutoff = new Date(Date.now() - reapMs);
  const sessions = await prisma.regulatoryUploadSession.findMany({
    where: { companyId, status: { in: ["UPLOADING", "FINALIZING"] } },
    select: { id: true, dossierId: true, storageKey: true, createdAt: true },
  });
  const toAbort = sessions.filter((s) => s.dossierId === dossierId || s.createdAt < cutoff);
  if (toAbort.length === 0) return;
  const ids = toAbort.map((s) => s.id);
  await prisma.regulatoryUploadPart.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.regulatoryUploadSession.updateMany({ where: { id: { in: ids } }, data: { status: "ABORTED", error: "Envoi remplacé ou abandonné (nettoyage automatique)." } });
  for (const s of toAbort) if (s.storageKey) await deleteObject(s.storageKey); // supprime l'archive temporaire du bucket
}

/**
 * Ouvre un envoi DIRECT vers le bucket : contrôles (taille/quota/concurrence), génère une clé objet
 * + une URL présignée PUT. Le navigateur téléverse ensuite DIRECTEMENT (bypass serveur + Postgres).
 */
export async function startDirectUploadSession(opts: {
  companyId: string; dossierId: string; createdById: string; filename: string; contentType?: string | null;
  totalBytes: number; expectedSha256?: string | null;
}): Promise<DirectStartResult> {
  if (!objectStorageConfigured()) return { ok: false, error: "Stockage objet non configuré." };
  if (!Number.isFinite(opts.totalBytes) || opts.totalBytes <= 0) return { ok: false, error: "Taille invalide." };
  if (opts.totalBytes > MAX_TOTAL_BYTES) return { ok: false, error: `Archive trop volumineuse (${Math.round(opts.totalBytes / MB)} Mo > ${Math.round(MAX_TOTAL_BYTES / MB)} Mo).` };
  if (!looksZip(opts.filename)) return { ok: false, error: "Le dossier CTD doit être un ZIP (.zip)." };

  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: opts.dossierId, companyId: opts.companyId }, select: { id: true } });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  await reapDirectSessions(opts.companyId, opts.dossierId);
  const active = await prisma.regulatoryUploadSession.count({ where: { companyId: opts.companyId, status: "UPLOADING" } });
  if (active >= MAX_ACTIVE_SESSIONS_PER_ORG) return { ok: false, error: `Trop d'envois simultanés (max ${MAX_ACTIVE_SESSIONS_PER_ORG}). Terminez ou abandonnez un envoi en cours.` };

  const usage = await orgUsageBytes(opts.companyId);
  if (usage + opts.totalBytes > ORG_QUOTA_BYTES) {
    return { ok: false, error: `Quota de l'organisation dépassé (${Math.round((usage + opts.totalBytes) / (1024 * MB))} Go > ${Math.round(ORG_QUOTA_BYTES / (1024 * MB))} Go).` };
  }

  const key = `reg-uploads/${opts.companyId}/${randomBytes(12).toString("hex")}.zip`;
  const uploadUrl = presignPutUrl(key, 3600);
  if (!uploadUrl) return { ok: false, error: "Génération de l'URL d'envoi impossible." };

  const session = await prisma.regulatoryUploadSession.create({
    data: {
      companyId: opts.companyId, dossierId: opts.dossierId, createdById: opts.createdById,
      filename: opts.filename.slice(0, 255), contentType: opts.contentType ?? null,
      totalBytes: BigInt(Math.floor(opts.totalBytes)), partSize: Math.max(1, Math.min(Math.floor(opts.totalBytes), 2_000_000_000)),
      expectedSha256: opts.expectedSha256 ?? null, storageKey: key,
    },
    select: { id: true },
  });
  await regAudit({ companyId: opts.companyId, actorId: opts.createdById, dossierId: opts.dossierId, action: "UPLOAD_SESSION_START", detail: `Envoi DIRECT « ${opts.filename} » (${Math.round(opts.totalBytes / MB)} Mo, bucket).` });
  return { ok: true, sessionId: session.id, uploadUrl };
}

/**
 * Finalise un envoi DIRECT : le serveur LIT l'objet depuis le bucket, vérifie taille (+ SHA-256 si
 * fourni), lance l'ingestion sécurisée, puis supprime l'archive temporaire du bucket. Une lecture
 * échouée (objet absent) laisse la session ré-ouverte (le client peut renvoyer le fichier).
 */
export async function finalizeDirectUploadSession(sessionId: string, companyId: string, actorId: string): Promise<FinalizeResult> {
  const session = await prisma.regulatoryUploadSession.findFirst({
    where: { id: sessionId, companyId }, select: { id: true, status: true, dossierId: true, filename: true, totalBytes: true, storageKey: true, expectedSha256: true, versionId: true },
  });
  if (!session) return { ok: false, error: "Session introuvable." };
  if (session.status === "COMPLETED") return finalizeResultFromVersion(session.versionId); // rejeu idempotent
  if (session.status !== "UPLOADING") return { ok: false, error: `Session non finalisable (${session.status}).` };
  if (!session.dossierId) return { ok: false, error: "Dossier manquant." };
  if (!session.storageKey) return { ok: false, error: "Session non directe." };

  await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "FINALIZING" } });

  let buffer: Buffer;
  try {
    buffer = await getObject(session.storageKey);
  } catch {
    await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "UPLOADING", error: "Fichier introuvable côté stockage — renvoyez-le." } });
    return { ok: false, error: "Fichier introuvable côté stockage (renvoyez-le)." };
  }

  const totalBytes = Number(session.totalBytes);
  const fail = async (error: string, status: "UPLOADING" | "ABORTED"): Promise<FinalizeResult> => {
    await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status, error } });
    if (status === "ABORTED" && session.storageKey) await deleteObject(session.storageKey);
    return { ok: false, error };
  };
  if (buffer.length !== totalBytes) return fail(`Taille reçue incohérente (${buffer.length} ≠ ${totalBytes}).`, "UPLOADING");
  if (session.expectedSha256) {
    const sha = createHash("sha256").update(buffer).digest("hex");
    if (sha.toLowerCase() !== session.expectedSha256.toLowerCase()) return fail("Empreinte SHA-256 non concordante (fichier corrompu en transit).", "ABORTED");
  }

  const ingest = await ingestDossierZip({ companyId, dossierId: session.dossierId, actorId, filename: session.filename, buffer });
  if (!ingest.ok) {
    const r = await fail(ingest.error ?? "Ingestion refusée.", "ABORTED");
    return { ...r, ingest };
  }

  await prisma.regulatoryUploadSession.update({ where: { id: session.id }, data: { status: "COMPLETED", versionId: ingest.versionId ?? null, receivedBytes: BigInt(totalBytes) } });
  await deleteObject(session.storageKey); // archive temporaire : l'originale immuable est déjà stockée par l'ingestion
  await regAudit({ companyId, actorId, dossierId: session.dossierId, action: "UPLOAD_SESSION_FINALIZE", detail: `Envoi DIRECT finalisé « ${session.filename} » (${Math.round(totalBytes / MB)} Mo).` });
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

/**
 * FILET du ménage de fond : les parties d'envois DÉJÀ clos n'appartiennent plus à personne. Le
 * ménage lancé à l'ouverture d'une session s'exécute en arrière-plan et peut être interrompu par
 * un redéploiement ; sans ce filet, ces octets resteraient en base indéfiniment. Appelé par le
 * planificateur, jamais sur le chemin d'une requête. Ne lève pas.
 */
export async function purgeClosedSessionParts(): Promise<number> {
  const done = await prisma.regulatoryUploadPart
    .deleteMany({ where: { session: { status: { in: ["ABORTED", "COMPLETED"] } } } })
    .catch(() => ({ count: 0 }));
  return done.count;
}
