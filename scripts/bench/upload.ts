import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { startUploadSession, putUploadPart, finalizeUploadSession } from "@/lib/regulatory/intelligence/upload/session";
import { flushOriginalArchives } from "@/lib/regulatory/intelligence/ingest/ingest-dossier";

// Dossier réaliste : 60 fichiers × 1 Mo INCOMPRESSIBLE (~60 Mo) — même forme qu'un CTD.
async function main() {
  const TAG = `bench-${Date.now()}`;
  const companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
  const dossierId = (await prisma.regulatoryDossier.create({
    data: { companyId, reference: TAG, title: "Bench", procedureType: "GENERIC", createdById: "u" }, select: { id: true },
  })).id;

  const z = new JSZip();
  z.file("m1/1.0-lettre.txt", "DCI : Amoxicilline");
  for (let i = 0; i < 60; i++) z.file(`m3/annexe-${i}.pdf`, randomBytes(1024 * 1024));
  const zip = await z.generateAsync({ type: "nodebuffer" });
  const mb = (zip.length / 1048576).toFixed(0);

  const sizes = (process.argv[2] ?? "4").split(",").map(Number);
  const inflight = Number(process.argv[3] ?? 1);
  for (const partMb of sizes) {
    const t0 = Date.now();
    const start = await startUploadSession({
      companyId, dossierId, createdById: "u", filename: `bench-${partMb}.zip`,
      totalBytes: zip.length, partSize: partMb * 1024 * 1024,
    });
    const parts = start.expectedParts!;
    const tStart = Date.now() - t0;

    // Phase TRANSFERT (écriture des parties en base) — avec N envois EN VOL, comme le navigateur.
    const t1 = Date.now();
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(inflight, parts) }, async () => {
      while (cursor < parts) {
        const i = cursor++;
        const data = Buffer.from(zip.subarray(i * start.partSize!, Math.min((i + 1) * start.partSize!, zip.length)));
        await putUploadPart({ sessionId: start.sessionId!, companyId, index: i, data });
      }
    }));
    const tTransfer = Date.now() - t1;

    // Phase FINALISATION (relecture des parties + décompression + stockage fichier par fichier).
    const t2 = Date.now();
    const fin = await finalizeUploadSession(start.sessionId!, companyId, "u");
    const tFinalize = Date.now() - t2;

    console.log(`${mb} Mo · parties de ${partMb} Mo ×${inflight} en vol (${parts} parties) → ouverture ${tStart} ms | TRANSFERT ${(tTransfer/1000).toFixed(1)} s | FINALISATION ${(tFinalize/1000).toFixed(1)} s | ok=${fin.ok} fichiers=${fin.ingest?.summary?.stored ?? "?"}`);
    // L'archive originale part EN FOND : l'attendre avant l'itération suivante, sinon elle
    // sature la base pendant la mesure d'après (biais mesuré à +10 s).
    await flushOriginalArchives();
    await prisma.regulatoryDossierVersion.deleteMany({ where: { dossierId } });
  }

  await prisma.regulatoryDossier.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  process.exit(0);
}
void main();
