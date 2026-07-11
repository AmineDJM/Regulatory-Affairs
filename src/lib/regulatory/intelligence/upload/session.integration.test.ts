import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomBytes } from "crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { startUploadSession, putUploadPart, uploadSessionStatus, finalizeUploadSession } from "./session";

/**
 * Intégration G14 : upload résumable de bout en bout — session, parties (dont ré-envoi/reprise),
 * finalisation avec vérification taille + SHA-256, ingestion, nettoyage des parties. Nettoyage complet.
 */
const TAG = `test-upl-${Date.now()}`;
let companyId = "", dossierId = "", sessionId = "";

describe("upload résumable — flux complet", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "Upload", createdById: "u" }, select: { id: true } })).id;
  });

  afterAll(async () => {
    const vers = await prisma.regulatoryDossierVersion.findMany({ where: { dossierId }, select: { originalZipBlobId: true } });
    const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } }, select: { blobId: true } });
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    for (const b of [...vers.map((v) => v.originalZipBlobId), ...docs.map((d) => d.blobId)]) if (b) await releaseBlob(b).catch(() => undefined);
  });

  it("session → parties (reprise) → finalisation vérifiée → version créée → parties nettoyées", async () => {
    // ZIP CTD réaliste + un binaire incompressible (STORE) pour obtenir plusieurs parties.
    const z = new JSZip();
    z.file("m1/lettre.txt", "Lettre de demande d'enregistrement ANPP — amoxicilline 500 mg.");
    z.file("m3/spec.txt", "Spécifications du produit fini.");
    z.file("m3/data.bin", randomBytes(6000));
    const zip = await z.generateAsync({ type: "nodebuffer", compression: "STORE" });
    const sha = createHash("sha256").update(zip).digest("hex");

    // Découpe en parties de 1 Ko → plusieurs parties.
    const partSize = 1024;
    const parts: Buffer[] = [];
    for (let o = 0; o < zip.length; o += partSize) parts.push(zip.subarray(o, Math.min(o + partSize, zip.length)));

    const start = await startUploadSession({ companyId, dossierId, createdById: "u", filename: "dossier.zip", totalBytes: zip.length, partSize, expectedSha256: sha });
    expect(start.ok).toBe(true);
    expect(start.expectedParts).toBe(parts.length);
    sessionId = start.sessionId!;

    // Envoi dans le désordre + un ré-envoi (reprise/idempotence).
    for (let i = parts.length - 1; i >= 0; i--) {
      const r = await putUploadPart({ sessionId, companyId, index: i, data: parts[i] });
      expect(r.ok).toBe(true);
    }
    const again = await putUploadPart({ sessionId, companyId, index: 0, data: parts[0] }); // ré-envoi
    expect(again.ok).toBe(true);

    const status = await uploadSessionStatus(sessionId, companyId);
    expect(status.complete).toBe(true);
    expect(status.receivedBytes).toBe(zip.length);
    expect(status.receivedIndices).toHaveLength(parts.length);

    const fin = await finalizeUploadSession(sessionId, companyId, "u");
    expect(fin.ok).toBe(true);
    expect(fin.ingest?.versionId).toBeTruthy();

    // La version existe avec le bon SHA et le bon nombre de fichiers.
    const version = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId }, orderBy: { versionNo: "desc" }, select: { originalSha256: true, fileCount: true } });
    expect(version?.originalSha256).toBe(sha);
    expect(version?.fileCount).toBeGreaterThanOrEqual(2);

    // Session COMPLETED + parties nettoyées (aucune donnée transitoire résiduelle).
    const session = await prisma.regulatoryUploadSession.findUnique({ where: { id: sessionId }, select: { status: true } });
    expect(session?.status).toBe("COMPLETED");
    const remainingParts = await prisma.regulatoryUploadPart.count({ where: { sessionId } });
    expect(remainingParts).toBe(0);
  });

  it("rejette une empreinte SHA-256 non concordante (corruption en transit) et abandonne", async () => {
    const z = new JSZip(); z.file("a.txt", "contenu");
    const zip = await z.generateAsync({ type: "nodebuffer" });
    const start = await startUploadSession({ companyId, dossierId, createdById: "u", filename: "bad.zip", totalBytes: zip.length, partSize: 1000, expectedSha256: "0".repeat(64) });
    expect(start.ok).toBe(true);
    await putUploadPart({ sessionId: start.sessionId!, companyId, index: 0, data: zip });
    const fin = await finalizeUploadSession(start.sessionId!, companyId, "u");
    expect(fin.ok).toBe(false);
    expect(fin.error).toContain("SHA-256");
    const session = await prisma.regulatoryUploadSession.findUnique({ where: { id: start.sessionId! }, select: { status: true } });
    expect(session?.status).toBe("ABORTED");
  });
});
