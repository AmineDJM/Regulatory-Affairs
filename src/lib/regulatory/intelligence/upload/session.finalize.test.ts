import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { startUploadSession, putUploadPart, finalizeUploadSession } from "./session";
import { flushOriginalArchives } from "../ingest/ingest-dossier";

/**
 * ROBUSTESSE DE LA FINALISATION D'UPLOAD (base réelle, aucune simulation).
 *
 * Vérifie les garanties qui suppriment DÉFINITIVEMENT les échecs d'upload observés :
 *  1. CHEMIN NOMINAL   — session → parties → finalisation → version ingérée, parties nettoyées ;
 *  2. IDEMPOTENCE      — rejouer la finalisation d'une session déjà finalisée = SUCCÈS, SANS créer
 *                        de doublon de version (une réponse perdue après succès ≠ échec) ;
 *  3. REPRISE APRÈS CRASH — une session coincée en FINALIZING (OOM/redémarrage) au bail périmé est
 *                        reprise et finalisée (jamais bloquée) ;
 *  4. GARDE CONCURRENTE — une FINALIZING FRAÎCHE (finalisation en cours) renvoie un échec RÉESSAYABLE
 *                        au lieu de doubler l'ingestion.
 */

const TAG = `test-finalize-${Date.now()}`;
const PART = 64 * 1024; // petites parties → assemblage multi-parties réellement exercé
let companyId = "";

async function buildZip(): Promise<Buffer> {
  const z = new JSZip();
  z.file("m1/1.0-lettre.txt", "ADVENTUM PHARMA\nDCI : Amoxicilline\nNom commercial : Amoxival 500 mg\n");
  // Charge INCOMPRESSIBLE (aléatoire) → l'archive dépasse la taille d'une partie = plusieurs parties.
  z.file("data/payload.bin", randomBytes(300 * 1024));
  return z.generateAsync({ type: "nodebuffer" });
}

async function makeDossier(suffix: string): Promise<string> {
  const d = await prisma.regulatoryDossier.create({
    data: { companyId, reference: `${TAG}-${suffix}`, title: `Dossier ${suffix}`, procedureType: "GENERIC", createdById: "test-user" },
    select: { id: true },
  });
  return d.id;
}

/** Ouvre une session et envoie TOUTES les parties (sans finaliser). Renvoie sessionId + parts. */
async function uploadAllParts(dossierId: string, zip: Buffer): Promise<{ sessionId: string; parts: number }> {
  const start = await startUploadSession({ companyId, dossierId, createdById: "test-user", filename: "dossier.zip", totalBytes: zip.length, partSize: PART });
  expect(start.ok).toBe(true);
  const sessionId = start.sessionId!;
  const partSize = start.partSize!;
  const parts = start.expectedParts!;
  for (let i = 0; i < parts; i++) {
    const data = Buffer.from(zip.subarray(i * partSize, Math.min((i + 1) * partSize, zip.length)));
    const r = await putUploadPart({ sessionId, companyId, index: i, data });
    expect(r.ok).toBe(true);
  }
  return { sessionId, parts };
}

async function releaseDossierBlobs(dossierId: string) {
  await flushOriginalArchives(); // l'archive originale est écrite EN FOND : ne rien laisser en vol
  const [docs, vers] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } }, select: { blobId: true } }),
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId }, select: { originalZipBlobId: true } }),
  ]);
  for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) if (b) await releaseBlob(b).catch(() => undefined);
}

describe("finalizeUploadSession — robustesse (idempotence, reprise après crash, garde concurrente)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
  }, 60_000);

  afterAll(async () => {
    const dossiers = await prisma.regulatoryDossier.findMany({ where: { companyId }, select: { id: true } });
    for (const d of dossiers) await releaseDossierBlobs(d.id).catch(() => undefined);
    await prisma.regulatoryUploadSession.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("finalise (multi-parties) → version ingérée + parties nettoyées ; rejeu idempotent SANS doublon", async () => {
    const dossierId = await makeDossier("nominal");
    const zip = await buildZip();
    const { sessionId, parts } = await uploadAllParts(dossierId, zip);
    expect(parts).toBeGreaterThan(1); // assemblage multi-parties réellement testé

    const fin = await finalizeUploadSession(sessionId, companyId, "test-user");
    expect(fin.ok).toBe(true);
    expect(fin.ingest?.versionId).toBeTruthy();
    expect(fin.ingest?.summary?.stored).toBeGreaterThan(0);
    // Parties nettoyées + session COMPLETED.
    expect(await prisma.regulatoryUploadPart.count({ where: { sessionId } })).toBe(0);
    expect((await prisma.regulatoryUploadSession.findUnique({ where: { id: sessionId }, select: { status: true } }))?.status).toBe("COMPLETED");

    // REJEU IDEMPOTENT : même version, PAS de seconde version créée.
    const replay = await finalizeUploadSession(sessionId, companyId, "test-user");
    expect(replay.ok).toBe(true);
    expect(replay.ingest?.versionId).toBe(fin.ingest?.versionId);
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId } })).toBe(1);
  }, 120_000);

  it("reprend une session coincée en FINALIZING au bail périmé (crash) et finalise", async () => {
    const dossierId = await makeDossier("crash");
    const zip = await buildZip();
    const { sessionId } = await uploadAllParts(dossierId, zip);

    // Simule un crash pendant la finalisation : FINALIZING avec un updatedAt ancien (bail périmé).
    await prisma.$executeRawUnsafe(
      `UPDATE "RegulatoryUploadSession" SET status='FINALIZING', "updatedAt" = NOW() - INTERVAL '1 hour' WHERE id = $1`,
      sessionId,
    );

    const fin = await finalizeUploadSession(sessionId, companyId, "test-user");
    expect(fin.ok).toBe(true);
    expect(fin.ingest?.versionId).toBeTruthy();
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId } })).toBe(1);
  }, 120_000);

  it("refuse (réessayable, sans doubler) une finalisation quand une autre est FRAÎCHEMENT en cours", async () => {
    const dossierId = await makeDossier("concurrent");
    const zip = await buildZip();
    const { sessionId } = await uploadAllParts(dossierId, zip);

    // FINALIZING FRAÎCHE (updatedAt = maintenant, auto @updatedAt) = « une autre finalisation tourne ».
    await prisma.regulatoryUploadSession.update({ where: { id: sessionId }, data: { status: "FINALIZING" } });

    const fin = await finalizeUploadSession(sessionId, companyId, "test-user");
    expect(fin.ok).toBe(false);
    expect(fin.retryable).toBe(true);
    // Aucune version créée : pas de double ingestion.
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId } })).toBe(0);
  }, 120_000);
});
