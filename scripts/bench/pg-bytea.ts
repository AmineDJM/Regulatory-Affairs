import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

/** Où est le plafond d'écriture de gros octets ? Disque, Prisma, ou Postgres lui-même ? */
async function main() {
  const buf = crypto.randomBytes(16 * 1024 * 1024);
  const MB = 16;

  let t = Date.now();
  await writeFile(join(tmpdir(), "bench-disk.bin"), buf);
  console.log(`disque local        → ${((Date.now() - t) / 1000).toFixed(2)} s (${(MB / ((Date.now() - t) / 1000)).toFixed(0)} Mo/s)`);

  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_bench_bytea" (id text primary key, data bytea)`);

  t = Date.now();
  await prisma.$executeRaw`INSERT INTO "_bench_bytea" (id, data) VALUES (${id}, ${buf})`;
  const raw = (Date.now() - t) / 1000;
  console.log(`INSERT brut (SQL)   → ${raw.toFixed(2)} s (${(MB / raw).toFixed(0)} Mo/s)`);

  t = Date.now();
  const blob = await prisma.fileBlob.create({ data: { sha256: crypto.randomBytes(32).toString("hex"), size: buf.length, iv: crypto.randomBytes(12), data: buf, refCount: 1 }, select: { id: true } });
  const orm = (Date.now() - t) / 1000;
  console.log(`create() Prisma     → ${orm.toFixed(2)} s (${(MB / orm).toFixed(0)} Mo/s)`);

  t = Date.now();
  const c = crypto.createCipheriv("aes-256-gcm", crypto.randomBytes(32), crypto.randomBytes(12));
  Buffer.concat([c.update(buf), c.final()]);
  console.log(`chiffrement AES-GCM → ${((Date.now() - t) / 1000).toFixed(2)} s`);

  await prisma.fileBlob.delete({ where: { id: blob.id } }).catch(() => undefined);
  await prisma.$executeRawUnsafe(`DROP TABLE "_bench_bytea"`);
  process.exit(0);
}
void main();
