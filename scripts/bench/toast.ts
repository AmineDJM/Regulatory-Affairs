import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * TOAST : Postgres tente de COMPRESSER (pglz) tout gros `bytea` avant de le stocker hors ligne.
 * Notre contenu est CHIFFRÉ → incompressible : le CPU est brûlé pour rien à chaque écriture.
 * `SET STORAGE EXTERNAL` conserve le stockage hors ligne mais SAUTE la compression.
 */
async function bench(storage: "EXTENDED" | "EXTERNAL", rounds = 4): Promise<number> {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_bench_toast"`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "_bench_toast" (id serial primary key, data bytea)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "_bench_toast" ALTER COLUMN data SET STORAGE ${storage}`);
  const buf = crypto.randomBytes(16 * 1024 * 1024);
  const t = Date.now();
  for (let i = 0; i < rounds; i++) await prisma.$executeRaw`INSERT INTO "_bench_toast" (data) VALUES (${buf})`;
  const s = (Date.now() - t) / 1000;
  await prisma.$executeRawUnsafe(`DROP TABLE "_bench_toast"`);
  console.log(`${storage.padEnd(9)} → ${s.toFixed(2)} s pour ${rounds * 16} Mo (${((rounds * 16) / s).toFixed(0)} Mo/s)`);
  return s;
}

async function main() {
  await bench("EXTENDED");
  await bench("EXTERNAL");
  await bench("EXTENDED");
  await bench("EXTERNAL");
  process.exit(0);
}
void main();
