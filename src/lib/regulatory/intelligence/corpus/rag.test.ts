import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchCorpus } from "./rag";

/**
 * Intégration RAG : recherche FTS `french` dans le corpus ACTIF avec citation exacte.
 * Vérifie aussi qu'une version RETIRED n'est pas retournée. Nettoyage complet.
 */
const TAG = `test-rag-${Date.now()}`;
let sourceId = "";
let activeVersionId = "";
let retiredVersionId = "";

describe("searchCorpus — RAG FTS + citations", () => {
  beforeAll(async () => {
    const src = await prisma.regulatorySource.create({ data: { authority: "ANPP", jurisdiction: "DZ", code: `${TAG}-code`, title: "Test" }, select: { id: true } });
    sourceId = src.id;
    const active = await prisma.regulatorySourceVersion.create({ data: { sourceId, version: "1.0", status: "ACTIVE" }, select: { id: true } });
    activeVersionId = active.id;
    await prisma.regulatorySourceSection.createMany({
      data: [
        { sourceVersionId: active.id, path: "art. 8", heading: "Stabilité", text: "Les études de stabilité doivent couvrir la durée de conservation revendiquée en zone climatique IVb.", ordinal: 0 },
        { sourceVersionId: active.id, path: "art. 4", heading: "Pièces", text: "Le dossier comporte le formulaire de demande et le bordereau de versement des droits.", ordinal: 1 },
      ],
    });
    const retired = await prisma.regulatorySourceVersion.create({ data: { sourceId, version: "0.9", status: "RETIRED" }, select: { id: true } });
    retiredVersionId = retired.id;
    await prisma.regulatorySourceSection.create({ data: { sourceVersionId: retired.id, path: "art. 99", heading: "Obsolète", text: "Ancienne exigence de stabilité retirée.", ordinal: 0 } });
  });

  afterAll(async () => {
    await prisma.regulatorySource.deleteMany({ where: { id: sourceId } }).catch(() => undefined);
  });

  it("trouve la section pertinente (stabilité) avec citation et extrait", async () => {
    const hits = await searchCorpus("stabilité durée de conservation");
    const stab = hits.find((h) => h.sourceVersionId === activeVersionId && h.path === "art. 8");
    expect(stab).toBeTruthy();
    expect(stab!.heading).toBe("Stabilité");
    expect(stab!.snippet.length).toBeGreaterThan(0);
    expect(stab!.authority).toBe("ANPP");
    expect(stab!.rank).toBeGreaterThan(0);
  });

  it("ignore les versions RETIRED (seul le corpus ACTIF fait foi)", async () => {
    const hits = await searchCorpus("stabilité");
    expect(hits.some((h) => h.sourceVersionId === retiredVersionId)).toBe(false);
  });

  it("requête vide → aucun résultat (jamais d'invention)", async () => {
    expect(await searchCorpus("")).toHaveLength(0);
  });
});
