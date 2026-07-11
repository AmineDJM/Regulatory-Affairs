import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { submissionReadiness } from "./lifecycle";

/** Intégration : la porte de soumission n'ouvre que si aucun bloqueur n'est OPEN/ACKNOWLEDGED. */

const TAG = `test-gate-${Date.now()}`;
let companyId = "";
let dossierId = "";
let versionId = "";
let blockerId = "";

describe("submissionReadiness — porte de soumission", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-ref`, title: "Gate", createdById: "test-user" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "test-user" }, select: { id: true } })).id;
    await prisma.regulatoryAssessment.create({ data: { dossierVersionId: versionId, completeness: 60, conforme: false, blockers: 1, criticals: 1 } });
    blockerId = (await prisma.regulatoryFinding.create({
      data: { dossierVersionId: versionId, code: "MISSING_REQUIRED_SECTION", severity: "CRITICAL", category: "completeness", title: "Section 3.2.P.8 manquante", detail: "…", blocker: true, source: "RULE", draft: false, status: "OPEN" },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("bloqueur OUVERT → soumission verrouillée", async () => {
    const r = await submissionReadiness(dossierId);
    expect(r.hasVersion).toBe(true);
    expect(r.openBlockers).toHaveLength(1);
    expect(r.conforme).toBe(false);
  });

  it("bloqueur PRIS EN COMPTE reste bloquant (ACKNOWLEDGED ≠ résolu)", async () => {
    await prisma.regulatoryFinding.update({ where: { id: blockerId }, data: { status: "ACKNOWLEDGED" } });
    const r = await submissionReadiness(dossierId);
    expect(r.openBlockers).toHaveLength(1);
  });

  it("bloqueur LEVÉ (WAIVED) → soumission ouverte", async () => {
    await prisma.regulatoryFinding.update({ where: { id: blockerId }, data: { status: "WAIVED", resolutionNote: "Justifié : fourni hors dossier." } });
    const r = await submissionReadiness(dossierId);
    expect(r.openBlockers).toHaveLength(0);
    expect(r.clearedBlockers).toBe(1);
  });
});
