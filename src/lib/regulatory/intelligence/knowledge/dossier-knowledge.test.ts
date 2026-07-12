import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDossierKnowledge, getDossierFacts, getApprovedFactMap, getDossierDocuments, searchDossierContent } from "./dossier-knowledge";

/**
 * Test d'INTÉGRATION de la couche de connaissance (base réelle) : on matérialise une version de
 * dossier analysée (documents classés CTD + texte + faits + occurrences + bilan + constats), puis on
 * vérifie que la surface de lecture restitue tout de façon structurée — snapshot, faits validés
 * pré-remplissables, documents filtrés par module, recherche plein texte avec extrait. Nettoyage final.
 */

const TAG = `test-knowledge-${Date.now()}`;
let companyId = "";
let dossierId = "";
let versionId = "";
let docAId = "";

describe("dossier-knowledge — surface de lecture réutilisable", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-ref`, title: "Dossier de test", createdById: "test-user" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "test-user", fileCount: 2, totalBytes: 4096 }, select: { id: true } })).id;

    docAId = (await prisma.regulatoryDocument.create({
      data: { dossierVersionId: versionId, originalPath: "m3/3.2.p.8-stab.pdf", originalFilename: "3.2.p.8-stab.pdf", ext: "pdf", sha256: `${TAG}-a`, ctdModule: "3", ctdSection: "3.2.P.8", securityStatus: "SAFE", extractionStatus: "OCR_COMPLETED" },
      select: { id: true },
    })).id;
    const docBId = (await prisma.regulatoryDocument.create({
      data: { dossierVersionId: versionId, originalPath: "m1/1.2-form.pdf", originalFilename: "1.2-form.pdf", ext: "pdf", sha256: `${TAG}-b`, ctdModule: "1", ctdSection: "1.2", securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED" },
      select: { id: true },
    })).id;

    await prisma.regulatoryExtraction.create({ data: { documentId: docAId, method: "ocr", content: "Rapport de stabilité — AMOXICILLINE 500 mg, lot 001, 24 mois à 25°C/60%HR.", charCount: 72 } });
    await prisma.regulatoryExtraction.create({ data: { documentId: docBId, method: "docx", content: "Formulaire de demande d'enregistrement. Titulaire : Adventum Pharma.", charCount: 66 } });

    const inn = await prisma.regulatoryFact.create({ data: { dossierVersionId: versionId, factKey: "INN", label: "DCI", value: "amoxicilline", status: "CONFIRMED", approvedValue: "Amoxicilline" }, select: { id: true } });
    await prisma.regulatoryFact.create({ data: { dossierVersionId: versionId, factKey: "STRENGTH", label: "Dosage", value: "500 mg", unit: "mg", status: "PROPOSED" } });
    await prisma.regulatoryFactOccurrence.createMany({ data: [
      { factId: inn.id, documentId: docAId, sectionCode: "3.2.P.8", rawValue: "AMOXICILLINE", extract: "…AMOXICILLINE 500 mg…", confidence: 0.9, method: "regex" },
      { factId: inn.id, documentId: docBId, sectionCode: "1.2", rawValue: "amoxicilline", extract: "…amoxicilline…", confidence: 0.8, method: "keyword" },
    ] });

    await prisma.regulatoryAssessment.create({ data: { dossierVersionId: versionId, completeness: 80, conforme: false, blockers: 1, criticals: 1, majors: 0, minors: 1, requiredPresent: 8, requiredTotal: 10 } });
    await prisma.regulatoryFinding.createMany({ data: [
      { dossierVersionId: versionId, code: "MISSING_REQUIRED_SECTION", severity: "CRITICAL", category: "completeness", title: "Section 3.2.S manquante", detail: "…", source: "RULE", blocker: true },
      { dossierVersionId: versionId, code: "AI_REVIEW", severity: "MINOR", category: "content", title: "Formulation à préciser", detail: "…", source: "AI", draft: true },
    ] });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("snapshot structuré : méta, bilan, faits (valeur retenue + occurrences), arbre documents, constats", async () => {
    const k = await getDossierKnowledge(versionId);
    expect(k).not.toBeNull();
    expect(k!.version.versionNo).toBe(1);
    expect(k!.dossier.reference).toBe(`${TAG}-ref`);
    expect(k!.assessment?.completeness).toBe(80);
    expect(k!.assessment?.blockers).toBe(1);

    const inn = k!.facts.find((f) => f.factKey === "INN")!;
    expect(inn.value).toBe("Amoxicilline"); // valeur APPROUVÉE retenue (pas la proposée)
    expect(inn.humanValidated).toBe(true);
    expect(inn.occurrences).toBe(2);
    const strength = k!.facts.find((f) => f.factKey === "STRENGTH")!;
    expect(strength.humanValidated).toBe(false);

    // Arbre documents : module 3 → section 3.2.P.8 (avec titre CTD résolu), module 1 → 1.2.
    const m3 = k!.documentsByModule.find((m) => m.module === "3")!;
    expect(m3.total).toBe(1);
    expect(m3.sections[0].section).toBe("3.2.P.8");
    expect(m3.sections[0].title).toBeTruthy();

    expect(k!.findings.total).toBe(2);
    expect(k!.findings.bySeverity.CRITICAL).toBe(1);
    expect(k!.findings.bySource.AI).toBe(1);
  });

  it("faits validés → table clé/valeur prête pour un pré-remplissage", async () => {
    const map = await getApprovedFactMap(versionId);
    expect(map.INN?.value).toBe("Amoxicilline");
    expect(map.STRENGTH).toBeUndefined(); // PROPOSED non retenu
    const validated = await getDossierFacts(versionId, { humanValidatedOnly: true });
    expect(validated.map((f) => f.factKey)).toEqual(["INN"]);
  });

  it("documents filtrés par module CTD", async () => {
    const docs = await getDossierDocuments(versionId, { module: "3" });
    expect(docs).toHaveLength(1);
    expect(docs[0].ctdSection).toBe("3.2.P.8");
    expect(docs[0].sectionTitle).toBeTruthy();
  });

  it("recherche plein texte dans le dossier → extrait ciblé (insensible à la casse)", async () => {
    const hits = await searchDossierContent(versionId, "amoxicilline");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const a = hits.find((h) => h.documentId === docAId)!;
    expect(a).toBeTruthy();
    expect(a.snippet.toLowerCase()).toContain("amoxicilline");
    // Requête trop courte → aucune recherche (garde).
    expect(await searchDossierContent(versionId, "a")).toEqual([]);
  });
});
