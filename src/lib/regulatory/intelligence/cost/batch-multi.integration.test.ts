import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * MULTI-LOTS : le dépouillement d'un lot ne doit JAMAIS effacer le travail des lots frères.
 *
 * Une version part désormais en PLUSIEURS lots (le fournisseur borne un lot à 400 requêtes).
 * La première implémentation effaçait TOUS les constats IA de la version avant d'insérer ceux
 * du lot dépouillé : sur un dossier découpé en quatre lots, seuls les constats du dernier
 * dépouillé survivaient — trois quarts de l'analyse disparaissaient en silence. C'est le pire
 * genre de bug pour un outil auquel on veut se fier : le résultat a l'air complet.
 *
 * La règle correcte, verrouillée ici : on n'efface que les constats IA ANTÉRIEURS AU DÉPÔT
 * (l'analyse précédente) ; les constats des lots frères, postérieurs au dépôt, survivent.
 */

// L'IA et le fournisseur de lots sont MOCKÉS : le test vérifie la mécanique de persistance,
// pas le modèle. `parseBatchOutput` rend un résultat par customId présent dans le JSONL simulé.
vi.mock("@/lib/openai-luna", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/openai-luna")>();
  return {
    ...mod,
    fetchBatchOutput: vi.fn(async (fileId: string) => fileId), // le « JSONL » est notre clé de scénario
    parseBatchOutput: vi.fn((jsonl: string) => {
      // Scénario encodé dans l'outputFileId : "lot:<customId>,<customId>…"
      const ids = jsonl.replace(/^lot:/, "").split(",").filter(Boolean);
      return ids.map((customId) => ({
        customId,
        ok: true as const,
        text: JSON.stringify({
          findings: [{
            severity: "MAJOR", category: "completeness",
            title: `Constat ${customId}`, detail: `Détail du constat ${customId}, suffisamment long pour l'enrichissement.`,
            evidence: "extrait exact du document", sectionCode: "3.2.P.8", page: 4, confidence: 0.8,
          }],
        }),
        usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, costUsd: 0.0001 },
      }));
    }),
  };
});

import { processCompletedBatch } from "./batch-runner";

const TAG = `test-multibatch-${Date.now()}`;
let companyId = "", dossierId = "", versionId = "", docId = "";

/** Crée un lot « terminé » prêt à dépouiller, dont le scénario est porté par outputFileId. */
async function makeBatch(externalId: string, customIds: string[], submittedAt: Date): Promise<string> {
  const mapping: Record<string, unknown> = {};
  for (const id of customIds) mapping[id] = { documentId: docId, filename: "stab.pdf", ctdSection: "3.2.P.8", part: 1, total: 1 };
  const b = await prisma.regulatoryAiBatch.create({
    data: {
      companyId, dossierId, dossierVersionId: versionId, step: "review", model: "gpt-5.6-luna",
      externalId: `${TAG}-${externalId}`, status: "completed", requestCount: customIds.length,
      outputFileId: `lot:${customIds.join(",")}`, mapping: mapping as object, submittedAt,
    },
    select: { id: true },
  });
  return b.id;
}

describe("processCompletedBatch — plusieurs lots pour une même version", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-D`, title: "D", createdById: "u", procedureType: "INITIAL_REGISTRATION" },
      select: { id: true },
    })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u" }, select: { id: true } })).id;
    docId = (await prisma.regulatoryDocument.create({
      data: {
        dossierVersionId: versionId, originalPath: "m3/stab.pdf", originalFilename: "stab.pdf", ext: "pdf",
        sha256: `${TAG}-h`, securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", ctdModule: "M3", ctdSection: "3.2.P.8",
      },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryAiBatch.deleteMany({ where: { dossierId } }).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("conserve les constats des lots frères, efface ceux de l'analyse précédente, dédoublonne entre lots", async () => {
    const submittedAt = new Date();

    // Constat d'une ANALYSE PRÉCÉDENTE (antérieur au dépôt) : lui doit disparaître.
    await prisma.regulatoryFinding.create({
      data: {
        dossierVersionId: versionId, code: "AI_REVIEW", severity: "MINOR", category: "content",
        title: "Constat périmé de l'analyse précédente", detail: "d", source: "AI", draft: true, blocker: false,
        documentId: docId, createdAt: new Date(submittedAt.getTime() - 60_000),
      },
    });
    // Constat HUMAIN : il ne doit JAMAIS être touché par un recalcul IA.
    await prisma.regulatoryFinding.create({
      data: {
        dossierVersionId: versionId, code: "HUM-1", severity: "MAJOR", category: "content",
        title: "Constat humain intouchable", detail: "d", source: "HUMAN", draft: false, blocker: false,
        createdAt: new Date(submittedAt.getTime() - 60_000),
      },
    });

    // Deux lots frères, déposés au même moment. « doc:1 » figure dans les DEUX lots :
    // le dédoublonnage inter-lots doit n'en garder qu'un.
    const lotA = await makeBatch("A", ["doc:0", "doc:1"], submittedAt);
    const lotB = await makeBatch("B", ["doc:1", "doc:2"], submittedAt);

    const a = await processCompletedBatch(lotA);
    expect(a).toBe(2); // doc:0 + doc:1

    const afterA = await prisma.regulatoryFinding.findMany({ where: { dossierVersionId: versionId, source: "AI" }, select: { title: true } });
    expect(afterA.map((f) => f.title).sort()).toEqual(["Constat doc:0", "Constat doc:1"]);

    const b = await processCompletedBatch(lotB);
    expect(b).toBe(1); // doc:1 déjà inséré par le lot A → seul doc:2 est nouveau

    const titles = (await prisma.regulatoryFinding.findMany({ where: { dossierVersionId: versionId, source: "AI" }, select: { title: true } }))
      .map((f) => f.title).sort();
    // LE CŒUR DU TEST : les constats du lot A ont survécu au dépouillement du lot B.
    expect(titles).toEqual(["Constat doc:0", "Constat doc:1", "Constat doc:2"]);

    // Le constat humain est toujours là ; le constat périmé n'y est plus.
    const human = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, source: "HUMAN" } });
    expect(human).toBe(1);
    const stale = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, title: "Constat périmé de l'analyse précédente" } });
    expect(stale).toBe(0);

    // Le coût des DEUX lots est entré au registre (le plafond budgétaire voit la dépense différée).
    const calls = await prisma.regulatoryAiCall.count({ where: { dossierId, step: "review" } });
    expect(calls).toBe(2);
  });

  it("ne dépouille jamais deux fois le même lot (verrou processedAt)", async () => {
    const lot = await makeBatch("C", ["doc:9"], new Date());
    expect(await processCompletedBatch(lot)).toBe(1);
    expect(await processCompletedBatch(lot)).toBe(0); // déjà traité → aucun doublon
    const n = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, title: "Constat doc:9" } });
    expect(n).toBe(1);
  });
});
