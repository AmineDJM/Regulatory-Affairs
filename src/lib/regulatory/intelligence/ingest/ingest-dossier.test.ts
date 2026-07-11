import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { releaseBlob, getBlob } from "@/lib/drive-storage";
import { ingestDossierZip } from "./ingest-dossier";

/**
 * Test d'INTÉGRATION du pipeline d'ingestion (base réelle). Vérifie : conservation des
 * fichiers sûrs (blob + SHA-256), refus des exécutables (jamais matérialisés), archive
 * originale figée, mise en file du job EXTRACT, incrément de version, rejet des archives
 * invalides, et purge en CASCADE à la suppression du dossier. Nettoyage complet en fin.
 */

const TAG = `test-ingest-${Date.now()}`;
let companyId = "";
let dossierId = "";

async function makeZip(files: Record<string, Buffer | string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "nodebuffer" });
}

async function releaseDossierBlobs(id: string) {
  const [docs, vers] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: id } }, select: { blobId: true } }),
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId: id }, select: { originalZipBlobId: true } }),
  ]);
  for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) {
    if (b) await releaseBlob(b).catch(() => undefined);
  }
}

describe("ingestDossierZip — pipeline d'ingestion CTD (intégration)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } });
    companyId = company.id;
    const dossier = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-ref`, title: "Dossier de test", createdById: "test-user" },
      select: { id: true },
    });
    dossierId = dossier.id;
  });

  afterAll(async () => {
    await releaseDossierBlobs(dossierId).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("conserve les fichiers sûrs, bloque les exécutables, fige l'archive originale", async () => {
    const pdf = Buffer.from("Rapport de stabilité — donnees CTD");
    const buf = await makeZip({
      "m3/3.2.p.8-stabilite.pdf": pdf,
      "m1/1.2-formulaire.docx": Buffer.from("formulaire"),
      "outils/setup.exe": Buffer.from("MZ programme"),
    });
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "dossier.zip", buffer: buf });

    expect(res.ok).toBe(true);
    expect(res.versionNo).toBe(1);
    expect(res.summary?.stored).toBe(2);
    expect(res.summary?.blocked).toBe(1);

    const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } } });
    const exe = docs.find((d) => d.ext === "exe")!;
    expect(exe.securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(exe.blobId).toBeNull(); // jamais matérialisé

    const stab = docs.find((d) => d.originalFilename === "3.2.p.8-stabilite.pdf")!;
    expect(stab.securityStatus).toBe("SAFE");
    expect(stab.blobId).toBeTruthy();
    expect(stab.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    // INTÉGRITÉ DU STOCKAGE : le fichier restitué est octet pour octet identique à l'original.
    const restored = await getBlob(stab.blobId!);
    expect(restored).not.toBeNull();
    expect(Buffer.compare(restored!, pdf)).toBe(0);

    const version = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId }, orderBy: { versionNo: "desc" } });
    expect(version?.originalZipBlobId).toBeTruthy();
    expect(version?.originalSha256).toBe(createHash("sha256").update(buf).digest("hex"));

    const job = await prisma.regulatoryJob.findFirst({ where: { dossierId, type: "EXTRACT" } });
    expect(job?.status).toBe("QUEUED");

    const d = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(d?.status).toBe("INGESTED");
  });

  it("incrémente le numéro de version à la 2ᵉ archive", async () => {
    const buf = await makeZip({ "m2/2.3-qualite.pdf": Buffer.from("resume qualite") });
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "v2.zip", buffer: buf });
    expect(res.ok).toBe(true);
    expect(res.versionNo).toBe(2);
  });

  it("rejette une archive vide sans rien persister", async () => {
    const before = await prisma.regulatoryDossierVersion.count({ where: { dossierId } });
    const buf = await makeZip({});
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "empty.zip", buffer: buf });
    expect(res.ok).toBe(false);
    expect(res.rejectionCode).toBe("EMPTY");
    const after = await prisma.regulatoryDossierVersion.count({ where: { dossierId } });
    expect(after).toBe(before); // aucune version créée
  });

  it("supprime en CASCADE versions → documents → jobs à la suppression du dossier", async () => {
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-cascade`, title: "Cascade", createdById: "test-user" },
      select: { id: true },
    });
    const buf = await makeZip({ "m1/lettre.pdf": Buffer.from("lettre de demande") });
    await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "c.zip", buffer: buf });

    expect(await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id } } })).toBeGreaterThan(0);

    await releaseDossierBlobs(tmp.id);
    await prisma.regulatoryDossier.delete({ where: { id: tmp.id } });

    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId: tmp.id } })).toBe(0);
    expect(await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id } } })).toBe(0);
    expect(await prisma.regulatoryJob.count({ where: { dossierId: tmp.id } })).toBe(0);
  });
});
