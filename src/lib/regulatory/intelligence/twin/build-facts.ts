import { prisma } from "@/lib/prisma";
import { extractFactsFromDocuments, type DocFactHit } from "./extract-facts";
import { factLabel } from "./facts-catalog";
import { TEXTUAL_EXTRACTION_STATUSES } from "../extract/extract-text";

// Fiabilité moindre du texte OCR vs natif : départage les conflits en faveur de la couche
// texte native quand deux documents proposent des valeurs concurrentes pour un même fait.
const OCR_CONFIDENCE_FACTOR = 0.9;

/**
 * Construit le JUMEAU NUMÉRIQUE d'une version : extrait les faits sourcés des documents,
 * choisit une valeur canonique proposée par fait, et persiste faits + occurrences. **Préserve
 * les décisions humaines** (un fait CONFIRMED/CORRECTED garde sa valeur ; seules les preuves
 * sont rafraîchies). Retourne le nombre de faits/occurrences.
 */
export async function buildTwinFacts(dossierVersionId: string): Promise<{ facts: number; occurrences: number }> {
  // Métadonnées SEULEMENT (pas le texte) : on connaît la liste + la provenance OCR sans charger
  // le contenu de TOUS les documents en mémoire — un gros dossier = plusieurs Go de texte → OOM.
  // Faits construits à partir de TOUT document réellement lu : texte natif ET texte OCR des scans.
  const docMeta = await prisma.regulatoryDocument.findMany({
    where: {
      dossierVersionId,
      extractionStatus: { in: TEXTUAL_EXTRACTION_STATUSES },
      securityStatus: { in: ["SAFE", "SUSPICIOUS"] },
    },
    select: { id: true, ctdSection: true, extraction: { select: { method: true } } },
  });
  // Provenance OCR (fiabilité moindre) → pondération à la baisse des occurrences.
  const ocrDocIds = new Set(docMeta.filter((d) => d.extraction?.method === "ocr").map((d) => d.id));
  const sectionById = new Map(docMeta.map((d) => [d.id, d.ctdSection] as const));

  // Extraction des faits PAR LOTS : le texte n'est chargé que pour un lot à la fois (pic mémoire
  // borné ≈ un lot), et on n'accumule que les « hits » (petits extraits), jamais le texte intégral.
  const hits: DocFactHit[] = [];
  const FACT_BATCH = 150;
  for (let i = 0; i < docMeta.length; i += FACT_BATCH) {
    const ids = docMeta.slice(i, i + FACT_BATCH).map((d) => d.id);
    const batch = await prisma.regulatoryDocument.findMany({
      where: { id: { in: ids } },
      select: { id: true, extraction: { select: { content: true } } },
    });
    const batchHits = extractFactsFromDocuments(
      batch.filter((d) => d.extraction?.content).map((d) => ({ documentId: d.id, sectionCode: sectionById.get(d.id) ?? null, text: d.extraction!.content })),
    );
    for (const h of batchHits) {
      if (ocrDocIds.has(h.documentId)) h.confidence = Number((h.confidence * OCR_CONFIDENCE_FACTOR).toFixed(3));
      hits.push(h);
    }
  }

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
