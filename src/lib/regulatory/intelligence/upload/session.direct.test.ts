import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, createHash } from "crypto";
import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import JSZip from "jszip";

/**
 * DOSSIER CTD ENVOYÉ DIRECTEMENT AU BUCKET — par les VRAIES fonctions serveur, base réelle,
 * bucket SIMULÉ (aucun appel réseau).
 *
 *   • REPRISE : le même ZIP relancé sur le même dossier retrouve son envoi ; seules les parties
 *     manquantes repartent (avant : toute relance abandonnait l'envoi et repartait de zéro) ;
 *   • FINALISATION EN FLUX : l'archive est lue du bucket vers un fichier temporaire, jamais en
 *     mémoire (audit du 04/10, constat 6 : 858 Mo pour un ZIP de 60 Mo) ;
 *   • un envoi incomplet est nommé et reprenable ; une empreinte fausse est refusée.
 */

for (const [k, v] of Object.entries({ S3_ENDPOINT: "https://compte.r2.cloudflarestorage.com", S3_BUCKET: "t", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" })) process.env[k] = v;

import { vi } from "vitest";

// Le test pose des variables S3 pour que la finalisation « voie » un stockage objet ; l'ingestion
// écrit alors ses blobs par `putObject`. On les range en mémoire : aucun appel réseau, et le
// juge ne dépend plus de ce que le bac distant répond (503 observé derrière le mandataire).
vi.mock("@/lib/storage/object-storage", async (orig) => {
  const m = await orig<typeof import("@/lib/storage/object-storage")>();
  const mem = new Map<string, Buffer>();
  return {
    ...m,
    putObject: async (k: string, b: Buffer) => { mem.set(k, Buffer.from(b)); },
    putObjectStream: async (k: string, it: AsyncIterable<Buffer>) => {
      const c: Buffer[] = [];
      for await (const x of it) c.push(Buffer.from(x));
      mem.set(k, Buffer.concat(c));
    },
    getObject: async (k: string) => mem.get(k) ?? null,
    deleteObject: async (k: string) => { mem.delete(k); },
  };
});

import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import type { ClientS3Direct } from "@/lib/storage/televersement-direct";
import type { PartieRecue } from "@/lib/storage/object-storage";
import { flushOriginalArchives } from "../ingest/ingest-dossier";
import { startDirectUploadSession, finalizeDirectUploadSession, objetVersFichier } from "./session";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `test-direct-${Date.now()}`;
const MO = 1024 * 1024;
let companyId = "";

function bucket() {
  const etat = { recues: [] as PartieRecue[], taille: null as number | null, recolle: false };
  const client: ClientS3Direct = {
    ouvrir: async () => "UP",
    parties: async () => (etat.recolle ? Promise.reject(new Error("NoSuchUpload")) : etat.recues),
    signerPartie: (_c, _u, n) => `https://bucket/p${n}`,
    recoller: async () => { etat.recolle = true; },
    abandonner: async () => {},
    taille: async () => etat.taille,
  };
  return { client, etat };
}
const flux = (buf: Buffer) => async () => new Blob([buf]).stream() as ReadableStream<Uint8Array>;

async function zip(): Promise<Buffer> {
  const z = new JSZip();
  z.file("m1/1.0-lettre.txt", "ADVENTUM PHARMA\nDCI : Amoxicilline\n");
  z.file("data/payload.bin", randomBytes(64 * 1024));
  return z.generateAsync({ type: "nodebuffer" });
}
const dossier = async (s: string) => (await prisma.regulatoryDossier.create({
  data: { companyId, reference: `${TAG}-${s}`, title: s, procedureType: "GENERIC", createdById: "test-user" }, select: { id: true },
})).id;

suite("CTD — envoi direct au bucket (reprise, finalisation en flux)", () => {
  beforeAll(async () => { companyId = (await prisma.company.create({ data: { name: `${TAG}-co` } })).id; }, 60_000);
  afterAll(async () => {
    await flushOriginalArchives();
    const ds = await prisma.regulatoryDossier.findMany({ where: { companyId }, select: { id: true } });
    for (const d of ds) {
      const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: d.id } }, select: { blobId: true } });
      const vs = await prisma.regulatoryDossierVersion.findMany({ where: { dossierId: d.id }, select: { originalZipBlobId: true } });
      for (const b of [...docs.map((x) => x.blobId), ...vs.map((v) => v.originalZipBlobId)]) if (b) await releaseBlob(b).catch(() => undefined);
    }
    await prisma.regulatoryUploadSession.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  }, 120_000);

  it("REPRISE : le même ZIP relancé ne renvoie que les parties manquantes", async () => {
    const d = await dossier("reprise");
    const { client, etat } = bucket();
    const a = await startDirectUploadSession({ companyId, dossierId: d, createdById: "test-user", filename: "ctd.zip", totalBytes: 70 * MO }, client);
    expect(a.ok && a.plan?.nbParties === 3).toBe(true);
    etat.recues = [{ numero: 1, etag: '"a"', taille: 32 * MO }];
    const b = await startDirectUploadSession({ companyId, dossierId: d, createdById: "test-user", filename: "ctd.zip", totalBytes: 70 * MO }, client);
    expect(b.resumed).toBe(true);
    expect(b.sessionId).toBe(a.sessionId);
    expect(Object.keys(b.plan!.urls).map(Number)).toEqual([2, 3]);
  });

  it("FINALISE en flux : incomplet → nommé ; complet → ingéré, empreinte vérifiée ; rejeu idempotent", async () => {
    const d = await dossier("final");
    const archive = await zip();
    const sha = createHash("sha256").update(archive).digest("hex");
    const { client, etat } = bucket();
    const s = await startDirectUploadSession({ companyId, dossierId: d, createdById: "test-user", filename: "ctd.zip", totalBytes: archive.length, expectedSha256: sha }, client);
    expect(s.ok).toBe(true);

    const tot = await finalizeDirectUploadSession(s.sessionId!, companyId, "test-user", undefined, client, flux(archive));
    expect(tot.ok).toBe(false);
    expect(tot.manquantes).toEqual([1]);
    expect((await prisma.regulatoryUploadSession.findUniqueOrThrow({ where: { id: s.sessionId! } })).status).toBe("UPLOADING");

    etat.recues = [{ numero: 1, etag: '"a"', taille: archive.length }];
    etat.taille = archive.length;
    const fin = await finalizeDirectUploadSession(s.sessionId!, companyId, "test-user", undefined, client, flux(archive));
    expect(fin.ok, JSON.stringify({ e: fin.error, m: fin.manquantes })).toBe(true);
    expect(fin.ingest?.versionId).toBeTruthy();
    const replay = await finalizeDirectUploadSession(s.sessionId!, companyId, "test-user", undefined, client, flux(archive));
    expect(replay.ingest?.versionId).toBe(fin.ingest?.versionId);
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId: d } })).toBe(1);
  }, 120_000);

  it("une empreinte fausse est refusée : rien n'est ingéré", async () => {
    const d = await dossier("sha");
    const archive = await zip();
    const { client, etat } = bucket();
    const s = await startDirectUploadSession({ companyId, dossierId: d, createdById: "test-user", filename: "ctd.zip", totalBytes: archive.length, expectedSha256: "0".repeat(64) }, client);
    etat.recues = [{ numero: 1, etag: '"a"', taille: archive.length }];
    etat.taille = archive.length;
    const fin = await finalizeDirectUploadSession(s.sessionId!, companyId, "test-user", undefined, client, flux(archive));
    expect(fin.ok).toBe(false);
    expect(fin.error).toMatch(/SHA-256/);
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId: d } })).toBe(0);
  }, 60_000);
});

describe("objetVersFichier — l'archive ne passe jamais entière en mémoire (constat 6)", () => {
  it("copie 160 Mo en flux vers le disque sans faire gonfler la mémoire du processus", async () => {
    const MORCEAU = Buffer.alloc(MO, 7);
    const total = 160;
    const lire = async () => new ReadableStream<Uint8Array>({
      i: 0,
      pull(c: ReadableStreamDefaultController<Uint8Array>) { const s = this as unknown as { i: number }; if (s.i++ < total) c.enqueue(new Uint8Array(MORCEAU)); else c.close(); },
    } as UnderlyingDefaultSource<Uint8Array> & { i: number });
    const dir = await mkdtemp(join(tmpdir(), "flux-"));
    try {
      const avant = process.memoryUsage().rss;
      const r = await objetVersFichier("k", join(dir, "a.zip"), lire);
      const pris = process.memoryUsage().rss - avant;
      expect(r.taille).toBe(total * MO);
      expect((await stat(join(dir, "a.zip"))).size).toBe(total * MO);
      expect(pris, `mémoire prise : ${Math.round(pris / MO)} Mo`).toBeLessThan(100 * MO);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 60_000);
});
