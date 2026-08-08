import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { ingestDossierZipFromFile } from "@/lib/regulatory/intelligence/ingest/ingest-dossier";

/** Même contenu FRAIS à chaque essai (jamais dédupliqué) : séquentiel vs pool. */
async function run(label: string, concurrency: string) {
  process.env.REG_INGEST_STORE_CONCURRENCY = concurrency;
  const TAG = `pool-${Date.now()}-${concurrency}`;
  const companyId = (await prisma.company.create({ data: { name: TAG }, select: { id: true } })).id;
  const dossierId = (await prisma.regulatoryDossier.create({
    data: { companyId, reference: TAG, title: "Pool", procedureType: "GENERIC", createdById: "u" }, select: { id: true },
  })).id;
  const z = new JSZip();
  for (let i = 0; i < 60; i++) z.file(`m3/a-${i}.pdf`, randomBytes(1024 * 1024)); // contenu unique
  const dir = await mkdtemp(join(tmpdir(), "pool-"));
  const zipPath = join(dir, "a.zip");
  await writeFile(zipPath, await z.generateAsync({ type: "nodebuffer" }));

  const t = Date.now();
  const r = await ingestDossierZipFromFile({ companyId, dossierId, actorId: "u", filename: "a.zip", zipPath });
  console.log(`${label} → ${((Date.now() - t) / 1000).toFixed(1)} s (ok=${r.ok}, ${r.summary?.stored} fichiers)`);

  await rm(dir, { recursive: true, force: true });
  await prisma.regulatoryDossier.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}
async function main() {
  await run("séquentiel (1)", "1");
  await run("pool (4)      ", "4");
  process.exit(0);
}
void main();
