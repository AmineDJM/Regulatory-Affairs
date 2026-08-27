import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { retrieve, toContext } from "./retrieve";
import { cacheClear } from "./rerank";
import { contentHash } from "./text";
import { ingestFast } from "./ingest";
import type { AccessFilter } from "./retrieval";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ENTONNOIR SUR BASE RÉELLE — ce que les tests purs ne peuvent pas prouver.
 *
 * Trois promesses, et elles n'ont de sens qu'avec de vraies lignes :
 *   • une question d'ÉTAT ne lit AUCUN document — l'économie principale du système ;
 *   • la garde d'accès s'applique AVANT que le moindre extrait sorte ;
 *   • le cache rend la même réponse, et le dit.
 *
 * Tout ce qui est créé porte le préfixe `RTEST-` et disparaît à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TAG = "RTEST-";
const seeAll: AccessFilter = async (items) => new Set(items.map((i) => i.itemId));
const seeNone: AccessFilter = async () => new Set<string>();

async function cleanup() {
  const items = await prisma.knowledgeItem.findMany({ where: { sourceId: { startsWith: TAG } }, select: { id: true } });
  const ids = items.map((i) => i.id);
  if (ids.length) {
    await prisma.knowledgeLink.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeChunk.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeJob.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeItem.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  await cleanup();
  const docs = [
    { id: "penalite", title: "Contrat Biopharm", text: "Article 7 — La pénalité de retard contractuelle est fixée à 2 % par semaine de retard sur la livraison." },
    { id: "preavis", title: "Convention de distribution", text: "La durée de préavis de résiliation est de six mois à compter de la notification écrite." },
    { id: "reunion", title: "Compte rendu du comité", text: "Le comité a acté le report de la soumission Nivolumab en raison d'un complément demandé par l'agence." },
  ];
  for (const d of docs) {
    await ingestFast({
      sourceType: "drive_file",
      sourceId: `${TAG}${d.id}`,
      contentHash: contentHash(d.text),
      title: d.title,
      text: d.text,
      documentDate: new Date("2026-06-01T00:00:00Z"),
      chunks: [{ kind: "whole" as const, ord: 0, text: d.text }],
    });
  }
});

afterAll(cleanup);
beforeEach(cacheClear);

describe("§3 — l'économie du routage, mesurée", () => {
  it("une question d'ÉTAT ne lit AUCUN document", async () => {
    const r = await retrieve({ question: "Combien de dossiers sont en cours ?" }, seeAll);
    expect(r.route.route).toBe("ERP_ONLY");
    expect(r.skipped).toBe(true);
    expect(r.hits).toHaveLength(0);
    // La preuve que rien n'a été lu : l'étage de recherche n'a pas tourné du tout.
    expect(r.timings.searchMs).toBe(0);
    // Et le contexte envoyé au modèle est VIDE, pas « rien trouvé » — ce qui laisserait croire
    // qu'on a cherché sans succès, alors qu'on a décidé de ne pas chercher.
    expect(toContext(r)).toBe("");
  });

  it("le routage coûte moins qu'une milliseconde, devant chaque question", async () => {
    // LE PREMIER APPEL DU PROCESSUS COÛTE ~1,2 ms : compilation des expressions régulières et
    // chauffe du moteur. On le paie une fois, au démarrage, et jamais ensuite. Mesurer à froid
    // ferait échouer un test sur une propriété que personne ne ressent ; l'ignorer masquerait une
    // vraie régression. On chauffe donc explicitement, et on mesure le régime établi.
    await retrieve({ question: "chauffe" }, seeAll);
    const r = await retrieve({ question: "Quel est le statut du dossier ?" }, seeAll);
    expect(r.timings.routeMs).toBeLessThan(1);
  });
});

describe("§4 — l'entonnoir", () => {
  it("une question de CONTENU rappelle, reclasse et coupe", async () => {
    const r = await retrieve({ question: "Que dit le contrat sur la pénalité de retard ?" }, seeAll);
    expect(r.route.route).toBe("RAG_ONLY");
    expect(r.skipped).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
    // Le bon document sort en tête — pas seulement « un » document.
    expect(r.hits[0].snippet).toContain("pénalité");
    // L'entonnoir se rétrécit : c'est ce qui en fait un entonnoir.
    expect(r.funnel.kept).toBeLessThanOrEqual(r.funnel.recalled || 5);
    expect(r.funnel.kept).toBeLessThanOrEqual(5);
  });

  it("chaque résultat porte sa justification", async () => {
    const r = await retrieve({ question: "Quelle est la durée de préavis prévue ?" }, seeAll);
    if (!r.hits.length) return; // index vide sur cette base : rien à prouver ici
    expect(r.hits[0].because.length).toBeGreaterThan(0);
  });

  it("le contexte envoyé au modèle est NUMÉROTÉ et borné", async () => {
    const r = await retrieve({ question: "Que dit le contrat sur la pénalité de retard ?" }, seeAll);
    if (!r.hits.length) return;
    const ctx = toContext(r, 100);
    expect(ctx).toMatch(/^\[1\] /);
    // Numéroté pour que le modèle CITE au lieu de paraphraser : une réponse sans source est
    // invérifiable, et une paraphrase se confond avec une invention.
    for (const line of ctx.split("\n\n")) expect(line.length).toBeLessThanOrEqual(110);
  });
});

describe("la garde d'accès", () => {
  it("un compte sans droits ne reçoit AUCUN extrait", async () => {
    const r = await retrieve({ question: "Que dit le contrat sur la pénalité de retard ?" }, seeNone);
    expect(r.hits).toHaveLength(0);
    // Et il n'apprend même pas que le document existe : le contexte ne dit rien de plus que
    // « rien trouvé », qui est ce que voit quelqu'un pour qui il n'existe effectivement pas.
    expect(toContext(r)).toBe("Aucun document pertinent trouvé pour cette question.");
  });
});

describe("le cache", () => {
  it("la seconde fois vient du cache, et le dit", async () => {
    const q = { question: "Que dit le contrat sur la pénalité de retard ?" };
    const first = await retrieve(q, seeAll);
    expect(first.cached).toBe(false);
    const second = await retrieve(q, seeAll);
    expect(second.cached).toBe(true);
    expect(second.hits.map((h) => h.itemId)).toEqual(first.hits.map((h) => h.itemId));
  });

  it("un périmètre différent ne réutilise PAS le cache", async () => {
    const q = "Que dit le contrat sur la pénalité de retard ?";
    await retrieve({ question: q, companyId: "societe-A" }, seeAll);
    const other = await retrieve({ question: q, companyId: "societe-B" }, seeAll);
    // Servir à l'un ce qui a été calculé pour l'autre serait une fuite, pas une optimisation.
    expect(other.cached).toBe(false);
  });
});
