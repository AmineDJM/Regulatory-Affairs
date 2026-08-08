import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";

/**
 * Écriture d'UN gros blob (archive originale) en base : où part le temps ?
 * Compare taille de tranche × nombre d'écritures en vol. Le chiffrement reste SÉQUENTIEL
 * (flux AES-GCM unique) ; seules les écritures sont mises en parallèle.
 */
const key = crypto.createHash("sha256").update(process.env.NEXTAUTH_SECRET ?? "amd-internal-os").digest();

async function write(plain: Buffer, chunkMB: number, inflight: number): Promise<string> {
  const hash = crypto.randomBytes(32).toString("hex"); // jamais dédupliqué
  const iv = crypto.randomBytes(12);
  const blob = await prisma.fileBlob.create({ data: { sha256: hash, size: plain.length, iv, data: null, refCount: 1 }, select: { id: true } });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const step = chunkMB * 1024 * 1024;
  let idx = 0;
  const pending: Promise<unknown>[] = [];
  const drain = async () => { if (pending.length >= inflight) await pending.shift(); };
  for (let off = 0; off < plain.length; off += step) {
    const enc = cipher.update(plain.subarray(off, Math.min(off + step, plain.length)));
    if (enc.length > 0) {
      await drain();
      pending.push(prisma.fileBlobChunk.create({ data: { blobId: blob.id, idx: idx++, data: enc } }));
    }
  }
  await drain();
  pending.push(prisma.fileBlobChunk.create({ data: { blobId: blob.id, idx: idx++, data: Buffer.concat([cipher.final(), cipher.getAuthTag()]) } }));
  await Promise.all(pending);
  return blob.id;
}

async function main() {
  const plain = crypto.randomBytes(60 * 1024 * 1024); // archive de 60 Mo
  const combos: [number, number][] = [[16, 1], [16, 4], [8, 4], [4, 4], [4, 8], [2, 8], [1, 8]];
  for (const [chunkMB, inflight] of combos) {
    const t = Date.now();
    const id = await write(plain, chunkMB, inflight);
    const s = (Date.now() - t) / 1000;
    console.log(`tranche ${String(chunkMB).padStart(2)} Mo × ${inflight} en vol → ${s.toFixed(1)} s  (${(60 / s).toFixed(0)} Mo/s)`);
    await releaseBlob(id).catch(() => undefined);
  }
  process.exit(0);
}
void main();
