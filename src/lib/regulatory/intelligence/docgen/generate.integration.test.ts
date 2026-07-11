import { describe, it, expect, beforeAll, afterAll } from "vitest";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { getBlob, releaseBlob } from "@/lib/drive-storage";
import { generateDocument } from "./generate";
import { MISSING_MARKER } from "./build-docx";

/**
 * Intégration G10 : la génération n'utilise QUE le jumeau numérique APPROUVÉ (CONFIRMED/
 * CORRECTED, valeur approuvée). Les faits PROPOSED ne doivent PAS apparaître ; les données
 * absentes deviennent un marqueur explicite. Nettoyage complet.
 */
const TAG = `test-docgen-${Date.now()}`;
let companyId = "", dossierId = "", versionId = "", blobId = "";

describe("generateDocument — données du jumeau approuvé uniquement", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "Docgen", createdById: "u", procedureType: "INITIAL_REGISTRATION" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u" }, select: { id: true } })).id;
    await prisma.regulatoryFact.createMany({
      data: [
        { dossierVersionId: versionId, factKey: "PRODUCT_NAME", label: "Nom", value: "Amoxival 500", status: "CONFIRMED" },
        { dossierVersionId: versionId, factKey: "STRENGTH", label: "Dosage", value: "500", approvedValue: "500 mg", status: "CORRECTED" },
        { dossierVersionId: versionId, factKey: "INN", label: "DCI", value: "NE_DOIT_PAS_APPARAITRE", status: "PROPOSED" }, // non approuvé
      ],
    });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    if (blobId) await releaseBlob(blobId).catch(() => undefined);
  });

  it("génère un docx traçable ; approuvés inclus, non-approuvés exclus, manquants marqués", async () => {
    const r = await generateDocument({ dossierVersionId: versionId, templateCode: "PRESUBMISSION_NOTE", actorId: "u" });
    expect(r.ok).toBe(true);
    expect(r.generatedDocId).toBeTruthy();

    const rec = await prisma.regulatoryGeneratedDoc.findUnique({ where: { id: r.generatedDocId! }, select: { blobId: true, templateVersion: true, factsUsed: true, factsMissing: true } });
    expect(rec).toBeTruthy();
    expect(rec!.templateVersion).toBe("1.0");
    blobId = rec!.blobId;

    const buf = await getBlob(blobId);
    const xml = new PizZip(buf!).file("word/document.xml")!.asText();
    expect(xml).toContain("Amoxival 500"); // CONFIRMED
    expect(xml).toContain("500 mg"); // CORRECTED → valeur approuvée
    expect(xml).not.toContain("NE_DOIT_PAS_APPARAITRE"); // PROPOSED exclu
    expect(xml).toContain(MISSING_MARKER); // DCI non approuvée → à compléter
    expect(rec!.factsUsed).toBeGreaterThanOrEqual(2);
    expect(rec!.factsMissing).toBeGreaterThan(0);
  });
});
