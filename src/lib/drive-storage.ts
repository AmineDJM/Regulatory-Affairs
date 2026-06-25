import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Drive blob backend — content-addressed, encrypted at rest.
 *
 * v1 substrate: PostgreSQL (works on Render, fully internal). Bytes are encrypted
 * with AES-256-GCM before storage; blobs are deduplicated by the SHA-256 of the
 * *plaintext*. This module is the only place that touches raw bytes, so swapping
 * to MinIO/S3 later only means re-implementing put/get/release.
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
  const blob = await prisma.fileBlob.create({
    data: { sha256: hash, size: plain.length, iv, data, refCount: 1 },
    select: { id: true },
  });
  return { blobId: blob.id, sha256: hash, size: plain.length };
}

/** Retrieve and decrypt bytes by blob id. */
export async function getBlob(blobId: string): Promise<Buffer | null> {
  const blob = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { iv: true, data: true } });
  if (!blob) return null;
  const data = Buffer.from(blob.data);
  const iv = Buffer.from(blob.iv);
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/** Decrement the ref-count; physically delete the blob when no longer referenced. */
export async function releaseBlob(blobId: string): Promise<void> {
  const blob = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { refCount: true } });
  if (!blob) return;
  if (blob.refCount <= 1) {
    await prisma.fileBlob.delete({ where: { id: blobId } }).catch(() => undefined);
  } else {
    await prisma.fileBlob.update({ where: { id: blobId }, data: { refCount: { decrement: 1 } } });
  }
}
