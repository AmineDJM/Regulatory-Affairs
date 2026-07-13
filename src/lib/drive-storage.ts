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

// Taille d'une TRANCHE de contenu chiffré en base (défaut 16 Mo). Au-delà de cette taille, un fichier
// est stocké en plusieurs lignes ordonnées plutôt qu'en un bytea unique — dont l'encodage hex sur le
// fil doublerait la taille en mémoire (cause d'OOM). Permet des fichiers jusqu'à ~1 Go en base.
const blobChunkBytes = () => {
  const mb = Number(process.env.REG_BLOB_CHUNK_MB ?? 16);
  return Math.max(1, Number.isFinite(mb) && mb > 0 ? mb : 16) * 1024 * 1024;
};

/** Chiffre le clair en UN buffer `ciphertext || tag` (petits fichiers / stockage objet). */
function encryptWhole(plain: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([enc, cipher.getAuthTag()]);
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

  // Stockage OBJET (S3/R2) si configuré → la base ne garde que les métadonnées + l'IV.
  if (objectStorageConfigured()) {
    const key = blobKey(hash);
    await putObject(key, encryptWhole(plain, iv)); // contenu CHIFFRÉ dans le bucket
    const blob = await prisma.fileBlob.create({
      data: { sha256: hash, size: plain.length, iv, data: null, storageKey: key, refCount: 1 },
      select: { id: true },
    });
    return { blobId: blob.id, sha256: hash, size: plain.length };
  }

  // Base, gros fichier → écriture EN TRANCHES (mémoire bornée à une tranche, pas d'hex géant).
  if (plain.length > blobChunkBytes()) return putBlobChunked(plain, hash, iv);

  // Base, petit fichier → une seule valeur bytea (chemin historique, rétrocompatible).
  const blob = await prisma.fileBlob.create({
    data: { sha256: hash, size: plain.length, iv, data: encryptWhole(plain, iv), refCount: 1 },
    select: { id: true },
  });
  return { blobId: blob.id, sha256: hash, size: plain.length };
}

/** Écrit le contenu chiffré en tranches ordonnées (streaming du chiffrement → mémoire bornée). */
async function putBlobChunked(plain: Buffer, hash: string, iv: Buffer): Promise<{ blobId: string; sha256: string; size: number }> {
  const blob = await prisma.fileBlob.create({
    data: { sha256: hash, size: plain.length, iv, data: null, refCount: 1 },
    select: { id: true },
  });
  try {
    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
    const step = blobChunkBytes();
    let idx = 0;
    for (let off = 0; off < plain.length; off += step) {
      const enc = cipher.update(plain.subarray(off, Math.min(off + step, plain.length)));
      if (enc.length > 0) await prisma.fileBlobChunk.create({ data: { blobId: blob.id, idx: idx++, data: enc } });
    }
    // Dernière tranche : reliquat éventuel + tag d'authentification (16 o). Concat des tranches = ciphertext || tag.
    await prisma.fileBlobChunk.create({ data: { blobId: blob.id, idx: idx++, data: Buffer.concat([cipher.final(), cipher.getAuthTag()]) } });
    return { blobId: blob.id, sha256: hash, size: plain.length };
  } catch (err) {
    await prisma.fileBlob.delete({ where: { id: blob.id } }).catch(() => undefined); // cascade → supprime les tranches partielles
    throw err;
  }
}

/** Retrieve and decrypt bytes by blob id (objet S3/R2, bytea unique, ou tranches — selon le stockage). */
export async function getBlob(blobId: string): Promise<Buffer | null> {
  const blob = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { iv: true, data: true, storageKey: true, size: true } });
  if (!blob) return null;
  let cipherBytes: Buffer | null;
  if (blob.storageKey) cipherBytes = await getObject(blob.storageKey);
  else if (blob.data) cipherBytes = Buffer.from(blob.data);
  else {
    const chunks = await prisma.fileBlobChunk.findMany({ where: { blobId }, orderBy: { idx: "asc" }, select: { data: true } });
    cipherBytes = chunks.length > 0 ? Buffer.concat(chunks.map((c) => Buffer.from(c.data))) : null;
    // Intégrité : le chiffré GCM fait taille_claire + 16 (tag). Un blob chunké incomplet est écarté.
    if (cipherBytes && cipherBytes.length !== blob.size + 16) return null;
  }
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

/**
 * RAMASSE-MIETTES du stockage physique : supprime définitivement les blobs qui ne sont plus
 * référencés par AUCUNE version de fichier (Drive) NI par aucun fichier stocké (Documents, etc.).
 * C'est ce qui libère RÉELLEMENT l'espace disque de la BDD après des suppressions (les suppressions
 * en cascade laissent des blobs orphelins avec un compteur de références périmé). Renvoie le nombre
 * de blobs détruits et les octets physiques récupérés. Les tranches (FileBlobChunk) tombent en cascade.
 */
export async function purgeOrphanBlobs(): Promise<{ count: number; bytes: number }> {
  const orphans = await prisma.$queryRaw<{ id: string; size: number; storageKey: string | null }[]>`
    DELETE FROM "FileBlob" b
    WHERE NOT EXISTS (SELECT 1 FROM "FileVersion" v WHERE v."blobId" = b.id)
      AND NOT EXISTS (SELECT 1 FROM "StoredFile" s WHERE s."blobId" = b.id)
    RETURNING b.id, b.size, b."storageKey"`;
  let bytes = 0;
  for (const o of orphans) {
    bytes += o.size;
    if (o.storageKey) await deleteObject(o.storageKey); // ne lève jamais
  }
  return { count: orphans.length, bytes };
}

/** Octets physiques réellement récupérables par un ramasse-miettes (blobs non référencés). */
export async function countOrphanBlobs(): Promise<{ count: number; bytes: number }> {
  const rows = await prisma.$queryRaw<{ count: bigint; bytes: bigint | null }[]>`
    SELECT COUNT(*)::bigint AS count, COALESCE(SUM(b.size), 0)::bigint AS bytes
    FROM "FileBlob" b
    WHERE NOT EXISTS (SELECT 1 FROM "FileVersion" v WHERE v."blobId" = b.id)
      AND NOT EXISTS (SELECT 1 FROM "StoredFile" s WHERE s."blobId" = b.id)`;
  const r = rows[0];
  return { count: Number(r?.count ?? 0), bytes: Number(r?.bytes ?? 0) };
}
