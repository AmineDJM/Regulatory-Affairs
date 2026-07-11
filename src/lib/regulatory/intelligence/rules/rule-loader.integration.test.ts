import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadActiveRules, loadPresentFactKeys } from "./rule-engine";

/**
 * Intégration : chargement des règles des packs ACTIFS avec applicabilité par procédure et
 * résolution de citation corpus, + clés de faits présentes. Données jetables, nettoyage complet.
 */
const TAG = `test-rules-${Date.now()}`;
let activePackId = "";
let draftPackId = "";
let sourceId = "";
let versionId = "";
let dossierId = "";
let dossierVersionId = "";

describe("loadActiveRules — packs ACTIFS + applicabilité + citation", () => {
  beforeAll(async () => {
    // Source corpus + version ACTIVE pour la citation.
    const src = await prisma.regulatorySource.create({ data: { authority: "ANPP", jurisdiction: "DZ", code: `${TAG}-src`, title: "T" }, select: { id: true } });
    sourceId = src.id;
    const ver = await prisma.regulatorySourceVersion.create({ data: { sourceId, version: "2.0", status: "ACTIVE" }, select: { id: true } });
    versionId = ver.id;

    const active = await prisma.regulatoryRulePack.create({
      data: {
        code: `${TAG}-active`, name: "Pack actif", status: "ACTIVE",
        rules: {
          createMany: {
            data: [
              { code: "SEC-REQ-1.0", kind: "SECTION_REQUIRED", sectionCode: "1.0", severity: "CRITICAL", blocker: true, title: "1.0 requis", procedureTypes: ["INITIAL_REGISTRATION"], productTypes: [], sourceVersionId: versionId, sourcePath: "art. 4", ordinal: 0 },
              { code: "SEC-REQ-5.3", kind: "SECTION_REQUIRED", sectionCode: "5.3", severity: "CRITICAL", blocker: true, title: "5.3 (générique)", procedureTypes: ["GENERIC"], productTypes: [], ordinal: 1 },
              { code: "FACT-INN", kind: "FACT_REQUIRED", factKey: "INN", severity: "MAJOR", blocker: false, title: "DCI requise", procedureTypes: [], productTypes: [], ordinal: 2 },
              { code: "SEC-REQ-INACTIVE", kind: "SECTION_REQUIRED", sectionCode: "9.9", severity: "CRITICAL", blocker: true, title: "désactivée", active: false, procedureTypes: [], productTypes: [], ordinal: 3 },
            ],
          },
        },
      },
      select: { id: true },
    });
    activePackId = active.id;

    // Pack DRAFT : ses règles ne doivent PAS être chargées.
    const draft = await prisma.regulatoryRulePack.create({
      data: { code: `${TAG}-draft`, name: "Brouillon", status: "DRAFT", rules: { create: { code: "SEC-REQ-DRAFT", kind: "SECTION_REQUIRED", sectionCode: "1.2", severity: "CRITICAL", blocker: true, title: "brouillon", procedureTypes: [], productTypes: [] } } },
      select: { id: true },
    });
    draftPackId = draft.id;

    // Dossier + version + un fait pour loadPresentFactKeys.
    const dossier = await prisma.regulatoryDossier.create({ data: { companyId: "c-test", reference: `${TAG}-D`, title: "D", createdById: "u-test" }, select: { id: true } });
    dossierId = dossier.id;
    const dv = await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u-test" }, select: { id: true } });
    dossierVersionId = dv.id;
    await prisma.regulatoryFact.createMany({
      data: [
        { dossierVersionId, factKey: "INN", label: "DCI", value: "Amoxicilline", status: "PROPOSED" },
        { dossierVersionId, factKey: "STRENGTH", label: "Dosage", value: "", status: "PROPOSED" }, // vide → absent
        { dossierVersionId, factKey: "MAH", label: "Détenteur", value: "X", status: "REJECTED" }, // rejeté → absent
      ],
    });
  });

  afterAll(async () => {
    await prisma.regulatoryRulePack.deleteMany({ where: { id: { in: [activePackId, draftPackId] } } }).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { id: dossierId } }).catch(() => undefined);
    await prisma.regulatorySource.deleteMany({ where: { id: sourceId } }).catch(() => undefined);
  });

  it("charge les règles applicables à la procédure + les règles universelles, ignore inactives/DRAFT", async () => {
    const rules = await loadActiveRules("INITIAL_REGISTRATION");
    const codes = rules.map((r) => r.code);
    expect(codes).toContain("SEC-REQ-1.0"); // applicable à INITIAL_REGISTRATION
    expect(codes).toContain("FACT-INN"); // universelle (procedureTypes vide)
    expect(codes).not.toContain("SEC-REQ-5.3"); // réservée GENERIC
    expect(codes).not.toContain("SEC-REQ-INACTIVE"); // active=false
    expect(codes).not.toContain("SEC-REQ-DRAFT"); // pack DRAFT
  });

  it("filtre par procédure GENERIC", async () => {
    const codes = (await loadActiveRules("GENERIC")).map((r) => r.code);
    expect(codes).toContain("SEC-REQ-5.3");
    expect(codes).toContain("FACT-INN");
    expect(codes).not.toContain("SEC-REQ-1.0");
  });

  it("résout la citation corpus (autorité · code v… · article)", async () => {
    const rule = (await loadActiveRules("INITIAL_REGISTRATION")).find((r) => r.code === "SEC-REQ-1.0");
    expect(rule?.citation).toContain("ANPP");
    expect(rule?.citation).toContain("v2.0");
    expect(rule?.citation).toContain("art. 4");
  });

  it("loadPresentFactKeys ne retient que les faits renseignés et non rejetés", async () => {
    const keys = await loadPresentFactKeys(dossierVersionId);
    expect(keys.has("INN")).toBe(true);
    expect(keys.has("STRENGTH")).toBe(false); // valeur vide
    expect(keys.has("MAH")).toBe(false); // rejeté
  });
});
