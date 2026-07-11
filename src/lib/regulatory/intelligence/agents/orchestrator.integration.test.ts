import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runAgentOnVersion } from "./orchestrator";
import type { AiFn, SearchFn } from "./agent-core";
import type { Citation } from "../corpus/rag";

/**
 * Intégration orchestrateur : exécute un agent (IA + RAG mockés) sur une version réelle et
 * vérifie la persistance des constats PROJET (source=AI, non bloquants, citation dans la preuve),
 * l'idempotence par agent, et la trace d'abstention sans invention. Nettoyage complet.
 */
const TAG = `test-orch-${Date.now()}`;
let companyId = "", dossierId = "", versionId = "";

const cite: Citation = { sectionId: "s", sourceId: "src", sourceVersionId: "v", authority: "ANPP", jurisdiction: "DZ", code: "Arrêté X", title: "T", version: "1.0", path: "art. 4", heading: "Pièces", snippet: "exigence", rank: 0.9 };
const aiFinding: AiFn = async () => ({ ok: true, configured: true, text: JSON.stringify({ findings: [{ severity: "MAJOR", category: "completeness", title: "Pièce manquante", detail: "Le certificat GMP est absent.", evidence: "extrait", sectionCode: "1.2", citationRef: 1, confidence: 0.8 }] }) });
const search1: SearchFn = async () => [cite];
const searchEmpty: SearchFn = async () => [];

describe("runAgentOnVersion — persistance des constats agent", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "D", createdById: "u", procedureType: "INITIAL_REGISTRATION" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u" }, select: { id: true } })).id;
    const doc = await prisma.regulatoryDocument.create({
      data: { dossierVersionId: versionId, originalPath: "m1/form.pdf", originalFilename: "form.pdf", ext: "pdf", sha256: `${TAG}-h`, securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", ctdModule: "M1", ctdSection: "1.2" },
      select: { id: true },
    });
    await prisma.regulatoryExtraction.create({ data: { documentId: doc.id, method: "plain", charCount: 200, content: "Formulaire de demande d'enregistrement ANPP — contenu suffisamment long pour analyse par l'agent." } });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("persiste un constat PROJET (source=AI, non bloquant) avec citation dans la preuve", async () => {
    const r = await runAgentOnVersion(versionId, "ALGERIA_M1", { aiFn: aiFinding, searchFn: search1 });
    expect(r.ok).toBe(true);
    expect(r.abstained).toBe(false);
    expect(r.findings).toBe(1);

    const findings = await prisma.regulatoryFinding.findMany({ where: { dossierVersionId: versionId, code: "AGENT:ALGERIA_M1" } });
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe("AI");
    expect(findings[0].draft).toBe(true);
    expect(findings[0].blocker).toBe(false);
    expect(findings[0].title).toContain("Module 1");
    expect(findings[0].detail).toContain("Arrêté X"); // citation intégrée à la preuve
    expect(findings[0].documentId).toBeTruthy(); // rattaché au doc 1.2
  });

  it("idempotent par agent : ré-exécuter remplace ses propres constats (pas de doublon)", async () => {
    await runAgentOnVersion(versionId, "ALGERIA_M1", { aiFn: aiFinding, searchFn: search1 });
    const count = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, code: "AGENT:ALGERIA_M1" } });
    expect(count).toBe(1);
  });

  it("abstention (agent sourcé, aucune source active) : aucun constat, trace d'abstention", async () => {
    const r = await runAgentOnVersion(versionId, "ALGERIA_M1", { aiFn: aiFinding, searchFn: searchEmpty });
    expect(r.abstained).toBe(true);
    expect(r.findings).toBe(0);
    const count = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, code: "AGENT:ALGERIA_M1" } });
    expect(count).toBe(0); // les anciens constats de l'agent sont retirés, aucun inventé
    const audit = await prisma.regulatoryAuditLog.findFirst({ where: { dossierVersionId: versionId, action: "AGENT_ABSTAINED" } });
    expect(audit).toBeTruthy();
  });
});
