import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { ingestDossierZip } from "../ingest/ingest-dossier";
import { runRegulatoryJob } from "./runner";

/**
 * Intégration du runner : après ingestion, le job EXTRACT extrait le texte des documents
 * sûrs (txt + xlsx), renseigne le statut + le MIME détecté, et se termine (DONE). Ciblé
 * sur le job du dossier de test (pas d'interférence avec la file globale).
 */

const TAG = `test-runner-${Date.now()}`;
let companyId = "";
let dossierId = "";

describe("runner EXTRACT — extraction pilotée par job (intégration)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-ref`, title: "Runner", createdById: "test-user" },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    const [docs, vers] = await Promise.all([
      prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } }, select: { blobId: true } }),
      prisma.regulatoryDossierVersion.findMany({ where: { dossierId }, select: { originalZipBlobId: true } }),
    ]);
    for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) if (b) await releaseBlob(b).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("extrait le texte (txt + xlsx), renseigne MIME et statut, termine le job", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["DCI"], ["Amoxicilline"]]), "F1");
    const xlsx = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const z = new JSZip();
    z.file("m1/note.txt", "Lettre de demande d'enregistrement ANPP");
    z.file("m3/tableau.xlsx", xlsx);
    const buf = await z.generateAsync({ type: "nodebuffer" });

    const ing = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "d.zip", buffer: buf });
    expect(ing.ok).toBe(true);

    const job = await prisma.regulatoryJob.findFirst({ where: { dossierId, type: "EXTRACT" }, select: { id: true } });
    expect(job).toBeTruthy();

    await runRegulatoryJob(job!.id);

    const done = await prisma.regulatoryJob.findUnique({ where: { id: job!.id }, select: { status: true, progress: true } });
    expect(done?.status).toBe("DONE");
    expect(done?.progress).toBe(100);

    const docs = await prisma.regulatoryDocument.findMany({
      where: { dossierVersion: { dossierId } },
      select: { ext: true, extractionStatus: true, detectedMimeType: true, extraction: { select: { content: true, method: true } } },
    });
    const txt = docs.find((d) => d.ext === "txt")!;
    expect(txt.extractionStatus).toBe("TEXT_EXTRACTED");
    expect(txt.extraction?.content).toContain("ANPP");

    const sheet = docs.find((d) => d.ext === "xlsx")!;
    expect(sheet.extractionStatus).toBe("TEXT_EXTRACTED");
    expect(sheet.detectedMimeType).toBe("application/zip"); // OOXML = archive PK
    expect(sheet.extraction?.content).toContain("Amoxicilline");

    // Le dossier passe à ANALYSING une fois l'extraction terminée.
    const d = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(d?.status).toBe("ANALYSING");
  });

  it("enchaîne FACTS puis les contrôles déterministes (RULES) → bilan + constats persistés", async () => {
    // Nouvelle chaîne : EXTRACT → FACTS → RULES. L'extraction a mis en file FACTS ; on le traite,
    // ce qui enfile RULES à son tour (pour que les règles FACT_REQUIRED disposent des faits).
    const facts = await prisma.regulatoryJob.findFirst({ where: { dossierId, type: "FACTS" }, select: { id: true } });
    expect(facts).toBeTruthy();
    await runRegulatoryJob(facts!.id);

    const rules = await prisma.regulatoryJob.findFirst({ where: { dossierId, type: "RULES" }, select: { id: true } });
    expect(rules).toBeTruthy();
    await runRegulatoryJob(rules!.id);

    const version = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId }, orderBy: { versionNo: "desc" }, select: { id: true } });
    const assessment = await prisma.regulatoryAssessment.findUnique({ where: { dossierVersionId: version!.id } });
    expect(assessment).toBeTruthy();
    // Le mini-dossier (txt + xlsx) ne couvre pas les sections obligatoires → non conforme, bloqueurs.
    expect(assessment?.conforme).toBe(false);
    expect(assessment?.blockers).toBeGreaterThan(0);

    const findings = await prisma.regulatoryFinding.count({ where: { dossierVersionId: version!.id, source: "RULE" } });
    expect(findings).toBeGreaterThan(0);

    const d = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(d?.status).toBe("IN_REVIEW");
  });
});
