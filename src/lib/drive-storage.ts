import crypto from "crypto";
import { prisma } from "./prisma";
import { objectStorageConfigured, putObject, getObject, deleteObject } from "./regulatory/intelligence/upload/object-storage";

/**
 * Drive blob backend — content-addressed, encrypted at rest.
 *
 * Les octets sont chiffrés (AES-256-GCM) puis dédupliqués par le SHA-256 du *clair*. Le contenu
 * chiffré est stocké soit **dans un bucket S3/R2** (si `REG_S3_*` configuré → la base ne garde que
 * les métadonnées, son disque arrête de gonfler), soit **en base** (repli historique). La base
 * conserve toujours l'IV (12 o) + taille + SHA + compteur de références. **Rétrocompatible** : un
 * blob existant sans `storageKey` est lu depuis la colonne `data`. Point unique touchant les octets.
 */

function masterKey(): Buffer {
  const explicit = process.env.DRIVE_ENCRYPTION_KEY;
  if (explicit) {
    const buf = Buffer.from(explicit, explicit.length === 64 ? "hex" : "base64");
    if (buf.length === 32) return buf;
  }
  // Fallback: derive a stable 32-byte key from the auth secret (always present).
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "amd-internal-os";
  return crypto.createHash("sha256").update(secret).digest();
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Clé objet du contenu chiffré d'un blob (adressé par le SHA-256 du clair → déduplication naturelle).
const blobKey = (hash: string) => `blobs/${hash.slice(0, 2)}/${hash}`;

/** Store bytes (encrypted, deduplicated). Increments the ref-count on reuse. */
export async function putBlob(plain: Buffer): Promise<{ blobId: string; sha256: string; size: number }> {
  const hash = sha256(plain);
  const existing = await prisma.fileBlob.findUnique({ where: { sha256: hash }, select: { id: true, size: true } });
  if (existing) {
    await prisma.fileBlob.update({ where: { id: existing.id }, data: { refCount: { increment: 1 } } });
    return { blobId: existing.id, sha256: hash, size: existing.size };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([enc, tag]); // ciphertext || 16-byte auth tag

  // Stockage OBJET (S3/R2) si configuré → la base ne garde que les métadonnées + l'IV.
  if (objectStorageConfigured()) {
    const key = blobKey(hash);
    await putObject(key, data); // contenu CHIFFRÉ dans le bucket (l'objet stocke du ciphertext)
    const blob = await prisma.fileBlob.create({
      data: { sha256: hash, size: plain.length, iv, data: null, storageKey: key, refCount: 1 },
      select: { id: true },
    });
    return { blobId: blob.id, sha256: hash, size: plain.length };
  }

  // Repli historique : contenu chiffré en base.
  const blob = await prisma.fileBlob.create({
    data: { sha256: hash, size: plain.length, iv, data, refCount: 1 },
    select: { id: true },
  });
  return { blobId: blob.id, sha256: hash, size: plain.length };
}

/** Retrieve and decrypt bytes by blob id (bucket S3/R2 ou base, selon storageKey). */
export async function getBlob(blobId: string): Promise<Buffer | null> {
  const blob = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { iv: true, data: true, storageKey: true } });
  if (!blob) return null;
  const cipherBytes = blob.storageKey ? await getObject(blob.storageKey) : blob.data ? Buffer.from(blob.data) : null;
  if (!cipherBytes) return null;
  const iv = Buffer.from(blob.iv);
  const tag = cipherBytes.subarray(cipherBytes.length - 16);
  const enc = cipherBytes.subarray(0, cipherBytes.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/** Decrement the ref-count; physically delete the blob (base + objet) when no longer referenced. */
export async function releaseBlob(blobId: string): Promise<void> {
  const blob = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { refCount: true, storageKey: true } });
  if (!blob) return;
  if (blob.refCount <= 1) {
    await prisma.fileBlob.delete({ where: { id: blobId } }).catch(() => undefined);
    if (blob.storageKey) await deleteObject(blob.storageKey); // ne lève jamais
  } else {
    await prisma.fileBlob.update({ where: { id: blobId }, data: { refCount: { decrement: 1 } } });
  }
}
