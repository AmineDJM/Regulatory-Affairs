import { prisma } from "@/lib/prisma";
import { factLabel } from "./facts-catalog";

/**
 * DÉTECTION DE CONFLITS (G2) : pour les faits **mono-valués** (identité, titulaire, durée de
 * conservation…), plusieurs valeurs divergentes entre documents = conflit. Les faits
 * multi-valués légitimes (dosages, conditionnements) sont exclus. Idempotent : ne recrée que
 * les conflits OUVERTS (préserve les résolutions humaines). Retourne le nombre de conflits.
 */

// Faits dont une divergence de valeur constitue un conflit (par nature mono-valués).
const SINGLE_VALUED = new Set(["INN", "PRODUCT_NAME", "MAH", "APPLICANT", "OPERATOR", "SHELF_LIFE", "DOSAGE_FORM", "ROUTE", "REFERENCE_PRODUCT"]);
// Divergence sur l'identité produit / titulaire = critique.
const CRITICAL_KEYS = new Set(["INN", "PRODUCT_NAME", "MAH"]);

const normVal = (s: string) => s.toLowerCase().replace(/[\s.,;:'"()]+/g, "").trim();

export async function detectConflicts(dossierVersionId: string): Promise<number> {
  const facts = await prisma.regulatoryFact.findMany({
    where: { dossierVersionId, factKey: { in: [...SINGLE_VALUED] } },
    select: {
      id: true, factKey: true,
      occurrences: { select: { documentId: true, sectionCode: true, rawValue: true, normalizedValue: true, extract: true, confidence: true } },
    },
  });

  // Repart des conflits OUVERTS uniquement (conserve RESOLVED/WAIVED).
  await prisma.regulatoryConflict.deleteMany({ where: { dossierVersionId, status: "OPEN" } });
  await prisma.regulatoryFact.updateMany({ where: { dossierVersionId }, data: { hasConflict: false } });

  let count = 0;
  for (const fact of facts) {
    if (fact.occurrences.length < 2) continue;

    // Regroupe les occurrences par valeur normalisée.
    const groups = new Map<string, { value: string; documentId: string; sectionCode: string | null; extract: string; confidence: number }>();
    for (const o of fact.occurrences) {
      const key = normVal(o.normalizedValue ?? o.rawValue);
      if (!key) continue;
      const best = groups.get(key);
      if (!best || o.confidence > best.confidence) {
        groups.set(key, { value: o.rawValue, documentId: o.documentId, sectionCode: o.sectionCode, extract: o.extract, confidence: o.confidence });
      }
    }
    if (groups.size < 2) continue; // valeur unique → pas de conflit

    const values = [...groups.values()];
    await prisma.regulatoryConflict.create({
      data: {
        dossierVersionId, factKey: fact.factKey, label: factLabel(fact.factKey),
        severity: CRITICAL_KEYS.has(fact.factKey) ? "CRITICAL" : "MAJOR",
        status: "OPEN", values,
        proposedAction: `Vérifier la valeur exacte de « ${factLabel(fact.factKey)} » et harmoniser les documents divergents.`,
      },
    });
    await prisma.regulatoryFact.update({ where: { id: fact.id }, data: { hasConflict: true } });
    count++;
  }

  return count;
}
