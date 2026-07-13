import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob } from "@/lib/drive-storage";
import { runRegulatoryJob } from "./runner";

/**
 * Intégration OCR de bout en bout via le runner (G13) : un document scanné (image) au statut
 * OCR_REQUIRED est traité par le job OCR — texte réellement extrait, confiance mesurée, statut
 * mis à jour, et FACTS enchaîné. Aucune donnée simulée. Nettoyage complet.
 */
const TAG = `test-ocr-run-${Date.now()}`;
let companyId = "", dossierId = "", versionId = "", blobId = "";

describe("runner OCR — océrisation pilotée par job", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "OCR", createdById: "u" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u" }, select: { id: true } })).id;

    // Image scannée : PNG contenant du texte, stockée comme blob chiffré (copie de travail).
    const svg = `<svg width="760" height="130" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="20" y="82" font-family="DejaVu Sans" font-size="46" fill="black">CERTIFICAT GMP AMOXICILLINE</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const stored = await putBlob(png);
    blobId = stored.blobId;

    await prisma.regulatoryDocument.create({
      data: {
        dossierVersionId: versionId, originalPath: "m1/scan.png", originalFilename: "scan.png", ext: "png",
        sha256: stored.sha256, sizeBytes: stored.size, blobId, securityStatus: "SAFE", extractionStatus: "OCR_REQUIRED",
        ctdModule: "M1", ctdSection: "1.2",
      },
    });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    if (blobId) await releaseBlob(blobId).catch(() => undefined);
  });

  it("océrise le document scanné, persiste le texte + la confiance, enchaîne FACTS", async () => {
    const job = await prisma.regulatoryJob.create({ data: { companyId, dossierId, dossierVersionId: versionId, type: "OCR", status: "QUEUED", payload: {} }, select: { id: true } });
    await runRegulatoryJob(job.id);

    const doc = await prisma.regulatoryDocument.findFirst({
      where: { dossierVersionId: versionId }, select: { extractionStatus: true, extraction: { select: { method: true, content: true, ocrConfidence: true, ocrPages: true } } },
    });
    // Statut terminal d'OCR (complété ou faible confiance selon le rendu), jamais resté "à océriser".
    expect(["OCR_COMPLETED", "LOW_CONFIDENCE"]).toContain(doc?.extractionStatus);
    expect(doc?.extraction?.method).toMatch(/^ocr/); // moteur tracé : « ocr-tesseract » / « ocr-mistral »
    expect(doc?.extraction?.content.toUpperCase()).toContain("AMOXICILLINE");
    expect(Number(doc?.extraction?.ocrConfidence)).toBeGreaterThan(0);
    expect(Array.isArray(doc?.extraction?.ocrPages)).toBe(true);

    // Le job OCR est terminé et a enchaîné le jumeau numérique (FACTS).
    const ocrDone = await prisma.regulatoryJob.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(ocrDone?.status).toBe("DONE");
    const facts = await prisma.regulatoryJob.count({ where: { dossierVersionId: versionId, type: "FACTS" } });
    expect(facts).toBe(1);
  }, 60_000);
});
