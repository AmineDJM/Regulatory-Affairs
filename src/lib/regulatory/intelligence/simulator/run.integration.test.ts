import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runReviewerSimulation, PERSPECTIVES, type AiFn } from "./run";

/**
 * Intégration G11 : simulation multi-perspectives (IA MOCKÉE). Vérifie la persistance, la
 * validation Zod, et l'ABSTENTION honnête sans clé (aucune donnée simulée). Nettoyage complet.
 */
const TAG = `test-sim-${Date.now()}`;
let companyId = "", dossierId = "", versionId = "";

const goodAi: AiFn = async () => ({
  ok: true, configured: true,
  text: JSON.stringify({ overall: "Synthèse simulée.", perspectives: [
    { perspective: "Recevabilité", verdict: "RESERVES", questions: ["Formulaire signé ?"], risks: ["Pièce manquante"] },
    { perspective: "Stabilité", verdict: "FAVORABLE", questions: [], risks: [] },
  ] }),
});

describe("runReviewerSimulation — simulation non prédictive", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "Sim", createdById: "u", procedureType: "GENERIC" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u" }, select: { id: true } })).id;
    await prisma.regulatoryFact.create({ data: { dossierVersionId: versionId, factKey: "INN", label: "DCI", value: "Amoxicilline", status: "CONFIRMED" } });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("expose 10 perspectives", () => {
    expect(PERSPECTIVES.length).toBe(10);
  });

  it("produit et persiste une simulation valide (IA mockée)", async () => {
    const r = await runReviewerSimulation(versionId, "u", goodAi);
    expect(r.ok).toBe(true);
    expect(r.configured).toBe(true);
    expect(r.perspectives.length).toBe(2);
    expect(r.perspectives[0].verdict).toBe("RESERVES");
    const row = await prisma.regulatorySimulation.findFirst({ where: { dossierVersionId: versionId }, select: { configured: true, perspectives: true } });
    expect(row?.configured).toBe(true);
    expect(Array.isArray(row?.perspectives)).toBe(true);
  });

  it("sortie non conforme → échec (jamais d'invention)", async () => {
    const badAi: AiFn = async () => ({ ok: true, configured: true, text: "pas du JSON" });
    const r = await runReviewerSimulation(versionId, "u", badAi);
    expect(r.ok).toBe(false);
  });

  it("sans clé (askClaude) : abstention honnête, aucune simulation", async () => {
    // aiFn par défaut = askClaude ; aucune ANTHROPIC_API_KEY en test → abstention.
    const r = await runReviewerSimulation(versionId, "u");
    expect(r.configured).toBe(false);
    expect(r.error).toContain("non configurée");
    expect(r.perspectives).toHaveLength(0);
  });
});
