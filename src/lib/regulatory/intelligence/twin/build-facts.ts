import { prisma } from "@/lib/prisma";
import { extractFactsFromDocuments, type DocFactHit } from "./extract-facts";
import { factLabel } from "./facts-catalog";

/**
 * Construit le JUMEAU NUMÉRIQUE d'une version : extrait les faits sourcés des documents,
 * choisit une valeur canonique proposée par fait, et persiste faits + occurrences. **Préserve
 * les décisions humaines** (un fait CONFIRMED/CORRECTED garde sa valeur ; seules les preuves
 * sont rafraîchies). Retourne le nombre de faits/occurrences.
 */
export async function buildTwinFacts(dossierVersionId: string): Promise<{ facts: number; occurrences: number }> {
  const docs = await prisma.regulatoryDocument.findMany({
    where: {
      dossierVersionId,
      extractionStatus: "TEXT_EXTRACTED",
      securityStatus: { in: ["SAFE", "SUSPICIOUS"] },
    },
    select: { id: true, ctdSection: true, extraction: { select: { content: true } } },
  });

  const hits = extractFactsFromDocuments(
    docs.filter((d) => d.extraction?.content).map((d) => ({ documentId: d.id, sectionCode: d.ctdSection, text: d.extraction!.content })),
  );

  // Regroupe par clé de fait.
  const byKey = new Map<string, DocFactHit[]>();
  for (const h of hits) {
    const list = byKey.get(h.factKey) ?? [];
    list.push(h);
    byKey.set(h.factKey, list);
  }

  const existing = await prisma.regulatoryFact.findMany({ where: { dossierVersionId }, select: { id: true, factKey: true, status: true } });
  const existingByKey = new Map(existing.map((f) => [f.factKey, f]));

  let factCount = 0;
  let occCount = 0;

  for (const [factKey, list] of byKey) {
    // Valeur canonique = valeur (normalisée) cumulant la plus forte confiance.
    const scoreByValue = new Map<string, { rep: string; score: number }>();
    for (const h of list) {
      const v = (h.normalizedValue ?? h.rawValue).toLowerCase().trim();
      const cur = scoreByValue.get(v) ?? { rep: h.rawValue, score: 0 };
      cur.score += h.confidence;
      scoreByValue.set(v, cur);
    }
    const canonical = [...scoreByValue.values()].sort((a, b) => b.score - a.score)[0]?.rep ?? null;

    const prev = existingByKey.get(factKey);
    const humanDecided = prev && prev.status !== "PROPOSED";

    const fact = await prisma.regulatoryFact.upsert({
      where: { dossierVersionId_factKey: { dossierVersionId, factKey } },
      create: { dossierVersionId, factKey, label: factLabel(factKey), value: canonical, status: "PROPOSED" },
      update: humanDecided ? { label: factLabel(factKey) } : { value: canonical, label: factLabel(factKey) },
      select: { id: true },
    });
    factCount++;

    // Rafraîchit les preuves (occurrences) à chaque passage.
    await prisma.regulatoryFactOccurrence.deleteMany({ where: { factId: fact.id } });
    await prisma.regulatoryFactOccurrence.createMany({
      data: list.slice(0, 40).map((h) => ({
        factId: fact.id, documentId: h.documentId, sectionCode: h.sectionCode ?? null,
        rawValue: h.rawValue.slice(0, 300), normalizedValue: h.normalizedValue ?? null,
        extract: h.extract.slice(0, 600), confidence: h.confidence, method: h.method,
      })),
    });
    occCount += Math.min(list.length, 40);
  }

  return { facts: factCount, occurrences: occCount };
}
