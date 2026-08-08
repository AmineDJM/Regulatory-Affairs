import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { putBlob, putBlobFromFile, getBlob, releaseBlob, sha256, sha256File } from "./drive-storage";

/**
 * Stockage EN TRANCHES d'un gros blob en base (sans bucket) : un fichier au-delà du seuil est écrit
 * en plusieurs lignes ordonnées (mémoire bornée, pas d'encodage hex géant → pas d'OOM ~1 Go), relu
 * octet pour octet, et purgé en CASCADE au déréférencement. Vérifie aussi la déduplication par SHA-256.
 */

const prevChunk = process.env.REG_BLOB_CHUNK_MB;

describe("drive-storage — gros blob chunké (base), round-trip + purge cascade + dédup", () => {
  let blobId = "";
  beforeAll(() => {
    process.env.REG_BLOB_CHUNK_MB = "1"; // tranches de 1 Mo pour tester sans allouer 1 Go
  });
  afterAll(async () => {
    if (blobId) await prisma.fileBlob.deleteMany({ where: { id: blobId } }).catch(() => undefined);
    if (prevChunk === undefined) delete process.env.REG_BLOB_CHUNK_MB;
    else process.env.REG_BLOB_CHUNK_MB = prevChunk;
  });

  it("écrit plusieurs tranches, relit à l'identique, release supprime blob + tranches", async () => {
    const plain = crypto.randomBytes(Math.floor(2.5 * 1024 * 1024)); // 2,5 Mo > seuil 1 Mo → chunké
    const put = await putBlob(plain);
    blobId = put.blobId;
    expect(put.size).toBe(plain.length);

    const row = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { data: true, storageKey: true } });
    expect(row?.data).toBeNull(); // pas de bytea unique
    expect(row?.storageKey).toBeNull(); // pas d'objet S3 → bien en base, en tranches
    const chunks = await prisma.fileBlobChunk.count({ where: { blobId } });
    expect(chunks).toBeGreaterThan(1); // découpé en plusieurs tranches (2,5 Mo / 1 Mo)

    const back = await getBlob(blobId);
    expect(back).not.toBeNull();
    expect(Buffer.compare(back!, plain)).toBe(0); // identique octet pour octet (déchiffrement OK)

    await releaseBlob(blobId);
    expect(await prisma.fileBlob.findUnique({ where: { id: blobId } })).toBeNull();
    expect(await prisma.fileBlobChunk.count({ where: { blobId } })).toBe(0); // cascade
    blobId = "";
  });

  it("un petit fichier reste en bytea unique (pas de tranche)", async () => {
    const plain = Buffer.from(`petit dossier — ${Date.now()}`, "utf8");
    const put = await putBlob(plain);
    try {
      const row = await prisma.fileBlob.findUnique({ where: { id: put.blobId }, select: { data: true } });
      expect(row?.data).not.toBeNull(); // sous le seuil → une seule valeur
      expect(await prisma.fileBlobChunk.count({ where: { blobId: put.blobId } })).toBe(0);
      expect(Buffer.compare((await getBlob(put.blobId))!, plain)).toBe(0);
    } finally {
      await releaseBlob(put.blobId).catch(() => undefined);
    }
  });

  it("putBlobFromFile — lecture EN FLUX, plusieurs tranches, relu octet pour octet", async () => {
    // Chemin des grosses archives CTD : le fichier n'est JAMAIS chargé entier en mémoire. La taille
    // choisie ne tombe pas sur un multiple de la tranche → vérifie aussi la dernière tranche partielle.
    const dir = await mkdtemp(join(tmpdir(), "blob-file-test-"));
    const path = join(dir, "archive.zip");
    const plain = crypto.randomBytes(Math.floor(3.3 * 1024 * 1024)); // 3,3 Mo, tranches de 1 Mo
    await writeFile(path, plain);
    try {
      expect(await sha256File(path)).toBe(sha256(plain)); // empreinte en flux == empreinte en mémoire

      const put = await putBlobFromFile(path, { sha256: sha256(plain) });
      try {
        expect(put.size).toBe(plain.length);
        expect(await prisma.fileBlobChunk.count({ where: { blobId: put.blobId } })).toBeGreaterThan(3);
        expect(Buffer.compare((await getBlob(put.blobId))!, plain)).toBe(0);

        // Même contenu déjà stocké → déduplication SANS relire le fichier (compteur incrémenté).
        const again = await putBlobFromFile(path);
        expect(again.blobId).toBe(put.blobId);
        await releaseBlob(again.blobId);
      } finally {
        await releaseBlob(put.blobId).catch(() => undefined);
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("déduplique un contenu identique et gère le compteur de références", async () => {
    const plain = crypto.randomBytes(Math.floor(1.5 * 1024 * 1024)); // > seuil → chunké
    const a = await putBlob(plain);
    const b = await putBlob(plain);
    expect(b.blobId).toBe(a.blobId); // même SHA-256 → même blob, pas de nouvelles tranches
    await releaseBlob(b.blobId); // ref 2 → 1 : le blob survit
    expect(await prisma.fileBlob.findUnique({ where: { id: a.blobId } })).not.toBeNull();
    await releaseBlob(a.blobId); // ref 1 → 0 : suppression + cascade
    expect(await prisma.fileBlob.findUnique({ where: { id: a.blobId } })).toBeNull();
    expect(await prisma.fileBlobChunk.count({ where: { blobId: a.blobId } })).toBe(0);
  });
});
