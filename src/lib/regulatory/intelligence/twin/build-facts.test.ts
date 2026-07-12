import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildTwinFacts } from "./build-facts";
import { detectConflicts } from "./detect-conflicts";

/**
 * Intégration : construction du jumeau numérique (faits sourcés) + détection de conflit
 * d'identité entre deux documents (DCI divergente). Nettoyage complet.
 */
const TAG = `test-twin-${Date.now()}`;
let companyId = "";
let versionId = "";

async function addDoc(filename: string, ctdSection: string | null, text: string) {
  const doc = await prisma.regulatoryDocument.create({
    data: {
      dossierVersionId: versionId, kind: "ORIGINAL", originalPath: filename, originalFilename: filename,
      ext: "pdf", sizeBytes: text.length, sha256: `${TAG}-${filename}`, securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED",
      ctdSection,
    },
    select: { id: true },
  });
  await prisma.regulatoryExtraction.create({ data: { documentId: doc.id, method: "plain", charCount: text.length, content: text } });
  return doc.id;
}

describe("buildTwinFacts + detectConflicts — jumeau numérique (intégration)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    const dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-ref`, title: "Twin", createdById: "test-user" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "test-user" }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("extrait des faits sourcés et détecte un conflit d'identité (DCI divergente)", async () => {
    await addDoc("m1-rcp.pdf", "1.3", "RCP. DCI : Amoxicilline. Comprimé pelliculé dosé à 500 mg. Voie orale. Durée de conservation : 24 mois.");
    await addDoc("m2-qos.pdf", "2.3", "Résumé qualité. DCI : Paracétamol. Durée de conservation : 24 mois.");

    const built = await buildTwinFacts(versionId);
    expect(built.facts).toBeGreaterThan(0);
    expect(built.occurrences).toBeGreaterThan(0);

    const inn = await prisma.regulatoryFact.findFirst({ where: { dossierVersionId: versionId, factKey: "INN" }, include: { occurrences: true } });
    expect(inn).toBeTruthy();
    expect(inn!.occurrences.length).toBe(2); // deux sources
    expect(inn!.occurrences.every((o) => o.extract.length > 0)).toBe(true); // preuve présente

    const conflicts = await detectConflicts(versionId);
    expect(conflicts).toBeGreaterThanOrEqual(1);

    const innConflict = await prisma.regulatoryConflict.findFirst({ where: { dossierVersionId: versionId, factKey: "INN" } });
    expect(innConflict).toBeTruthy();
    expect(innConflict!.severity).toBe("CRITICAL"); // identité produit = critique
    expect((innConflict!.values as unknown[]).length).toBe(2);

    const flagged = await prisma.regulatoryFact.findFirst({ where: { dossierVersionId: versionId, factKey: "INN" }, select: { hasConflict: true } });
    expect(flagged!.hasConflict).toBe(true);
  });
});

/**
 * À L'ÉCHELLE : `buildTwinFacts` lit le texte PAR LOTS (pic mémoire borné, jamais tout le dossier
 * en RAM). Vérifie que la construction reste correcte au-delà d'un lot (160 docs > lot de 150).
 */
describe("buildTwinFacts — extraction PAR LOTS au-delà d'un lot (mémoire bornée)", () => {
  const TAG2 = `test-twin-batch-${Date.now()}`;
  let companyId2 = "";
  let versionId2 = "";

  beforeAll(async () => {
    companyId2 = (await prisma.company.create({ data: { name: `${TAG2}-co` }, select: { id: true } })).id;
    const dossierId = (await prisma.regulatoryDossier.create({ data: { companyId: companyId2, reference: `${TAG2}-ref`, title: "Batch", createdById: "test-user" }, select: { id: true } })).id;
    versionId2 = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "test-user" }, select: { id: true } })).id;
    for (let i = 0; i < 160; i++) {
      const doc = await prisma.regulatoryDocument.create({
        data: { dossierVersionId: versionId2, kind: "ORIGINAL", originalPath: `m1/doc-${i}.txt`, originalFilename: `doc-${i}.txt`, ext: "txt", sizeBytes: 60, sha256: `${TAG2}-${i}`, securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", ctdSection: "1.0" },
        select: { id: true },
      });
      await prisma.regulatoryExtraction.create({ data: { documentId: doc.id, method: "plain", charCount: 50, content: "DCI : Amoxicilline. Nom commercial : Amoxival 500 mg." } });
    }
  }, 120_000);

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId: companyId2 } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId2 } }).catch(() => undefined);
  });

  it("construit les faits correctement sur 160 documents (≥ 2 lots)", async () => {
    const res = await buildTwinFacts(versionId2);
    expect(res.facts).toBeGreaterThan(0);
    const facts = await prisma.regulatoryFact.findMany({ where: { dossierVersionId: versionId2 }, select: { factKey: true, value: true } });
    const inn = facts.find((f) => f.factKey === "INN");
    expect(inn).toBeTruthy();
    expect((inn?.value ?? "").toLowerCase()).toContain("amoxicilline");
    expect(facts.some((f) => f.factKey === "PRODUCT_NAME")).toBe(true);
  }, 120_000);
});
