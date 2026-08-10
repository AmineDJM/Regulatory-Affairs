import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai";
import { extractFactsFromDocuments, type DocFactHit } from "./extract-facts";
import { extractFactsWithAI, type AiFactDoc } from "./ai-facts";
import { selectAmbiguousFacts, arbitrateAmbiguousFacts, type FactCandidate } from "./arbitrate-facts";
import { factLabel } from "./facts-catalog";
import { sectionByCode } from "../ctd/taxonomy";
import { TEXTUAL_EXTRACTION_STATUSES } from "../extract/extract-text";

// Fiabilité moindre du texte OCR vs natif : départage les conflits en faveur de la couche
// texte native quand deux documents proposent des valeurs concurrentes pour un même fait.
const OCR_CONFIDENCE_FACTOR = 0.9;

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Sections les plus PORTEUSES de faits (ordre de priorité d'envoi à l'IA) : RCP/notice, QOS,
// résumés cliniques, formulaire, produit fini, substance, table des matières…
const AI_FACT_PRIORITY = ["1.3", "2.3", "2.5", "2.7", "1.2", "3.2.P", "3.2.S", "2.1", "1.0"];
function aiSectionPriority(section: string | null): number {
  if (!section) return AI_FACT_PRIORITY.length + 1;
  const i = AI_FACT_PRIORITY.findIndex((p) => section === p || section.startsWith(`${p}.`));
  return i === -1 ? AI_FACT_PRIORITY.length : i;
}

/**
 * COMPRÉHENSION PAR IA (complète le déterministe) — BORNÉE : on n'envoie qu'une sélection des
 * sections les plus porteuses de faits (jamais un dossier de 10 000 pages), chacune tronquée à un
 * budget de caractères. Un seul appel IA quel que soit le volume du dossier. Pondération OCR
 * identique au déterministe. Ne renvoie que des faits SOURCÉS et ancrés (voir ai-facts.ts).
 */
async function extractAiFactsBounded(
  docMeta: { id: string; ctdSection: string | null }[],
  ocrDocIds: Set<string>,
): Promise<DocFactHit[]> {
  const maxDocs = clampInt(process.env.REG_AI_FACTS_MAX_DOCS, 6, 1, 20);
  const perDocChars = clampInt(process.env.REG_AI_FACTS_PER_DOC_CHARS, 7000, 1000, 20000);
  const selected = [...docMeta].sort((a, b) => aiSectionPriority(a.ctdSection) - aiSectionPriority(b.ctdSection)).slice(0, maxDocs);
  if (selected.length === 0) return [];

  const rows = await prisma.regulatoryDocument.findMany({
    where: { id: { in: selected.map((d) => d.id) } },
    select: { id: true, extraction: { select: { content: true } } },
  });
  const contentById = new Map(rows.map((r) => [r.id, r.extraction?.content ?? ""]));
  const aiDocs: AiFactDoc[] = selected
    .map((d) => ({
      documentId: d.id,
      sectionCode: d.ctdSection,
      ctdTitle: d.ctdSection ? sectionByCode(d.ctdSection)?.title ?? null : null,
      text: (contentById.get(d.id) ?? "").slice(0, perDocChars),
    }))
    .filter((d) => d.text.trim().length >= 40);

  const aiHits = await extractFactsWithAI(aiDocs);
  for (const h of aiHits) {
    if (ocrDocIds.has(h.documentId)) h.confidence = Number((h.confidence * OCR_CONFIDENCE_FACTOR).toFixed(3));
  }
  return aiHits;
}

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
    select: { id: true, ctdSection: true, extraction: { select: { method: true, charCount: true } } },
  });
  // Provenance OCR (fiabilité moindre) → pondération à la baisse des occurrences.
  const ocrDocIds = new Set(docMeta.filter((d) => d.extraction?.method?.startsWith("ocr")).map((d) => d.id));
  const sectionById = new Map(docMeta.map((d) => [d.id, d.ctdSection] as const));

  // Extraction des faits PAR LOTS BORNÉS EN OCTETS : un document massif (jusqu'à 10 000 pages
  // océrisées = plusieurs Mo de texte) rendrait un lot à effectif fixe démesuré (plusieurs Go → OOM).
  // On PACKE les documents jusqu'à un budget mémoire (via charCount déjà connu) : pic ≈ le budget,
  // quel que soit le nombre/la taille des documents. On n'accumule que les « hits » (petits extraits).
  const budgetBytes = clampInt(process.env.REG_FACTS_CONTENT_BUDGET_MB, 64, 8, 2048) * 1024 * 1024;
  const batches: string[][] = [];
  let cur: string[] = [];
  let curBytes = 0;
  for (const d of docMeta) {
    const bytes = (d.extraction?.charCount ?? 0) * 2 + 512; // ≈ octets JS (UTF-16) + surcoût
    if (cur.length > 0 && (curBytes + bytes > budgetBytes || cur.length >= 200)) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(d.id);
    curBytes += bytes;
  }
  if (cur.length > 0) batches.push(cur);

  const hits: DocFactHit[] = [];
  for (const ids of batches) {
    // Extraction de faits = regex lourde sur le texte : on cède la boucle d'événements entre deux
    // lots pour que l'application reste réactive pendant la construction du jumeau numérique.
    await new Promise((resolve) => setImmediate(resolve));
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

  // Compréhension par IA — complète le déterministe (jamais ne le remplace). Non bloquant :
  // toute défaillance IA (non configurée, réseau, JSON) est ignorée et n'altère pas le jumeau.
  if (aiConfigured()) {
    try {
      const aiHits = await extractAiFactsBounded(docMeta, ocrDocIds);
      for (const h of aiHits) hits.push(h);
    } catch {
      /* l'IA ne doit JAMAIS casser la construction déterministe du jumeau numérique */
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

  // 1ᵉʳ passage : CANDIDATS par fait (valeur normalisée → score cumulé + extraits-preuves).
  const candidatesByKey = new Map<string, FactCandidate[]>();
  for (const [factKey, list] of byKey) {
    const scoreByValue = new Map<string, FactCandidate>();
    for (const h of list) {
      const v = (h.normalizedValue ?? h.rawValue).toLowerCase().trim();
      const cur = scoreByValue.get(v) ?? { rep: h.rawValue, score: 0, extracts: [] };
      cur.score += h.confidence;
      if (cur.extracts.length < 2 && h.extract) cur.extracts.push(h.extract);
      scoreByValue.set(v, cur);
    }
    candidatesByKey.set(factKey, [...scoreByValue.values()].sort((a, b) => b.score - a.score));
  }

  // ARBITRAGE CONTEXTUEL : quand deux valeurs se disputent un fait (scores proches), les regex ne
  // peuvent plus rien — seul le CONTEXTE des extraits départage (comparateur d'étude vs produit du
  // dossier, posologie vs teneur…). Un appel IA borné choisit ; toute panne laisse le déterministe
  // décider. Les faits déjà tranchés par un humain ne sont jamais soumis.
  let arbitration = new Map<string, string>();
  if (aiConfigured()) {
    const ambiguous = selectAmbiguousFacts(
      [...candidatesByKey.entries()]
        .filter(([factKey]) => {
          const prev = existingByKey.get(factKey);
          return !prev || prev.status === "PROPOSED";
        })
        .map(([factKey, candidates]) => ({ factKey, label: factLabel(factKey), candidates })),
    );
    if (ambiguous.length > 0) {
      const version = await prisma.regulatoryDossierVersion.findUnique({
        where: { id: dossierVersionId },
        select: { dossier: { select: { title: true, reference: true } } },
      });
      arbitration = await arbitrateAmbiguousFacts(
        { title: version?.dossier.title ?? "", reference: version?.dossier.reference ?? null },
        ambiguous,
      );
    }
  }

  let factCount = 0;
  let occCount = 0;

  for (const [factKey, list] of byKey) {
    // Valeur canonique : le choix ARBITRÉ s'il existe, sinon le meilleur score cumulé.
    const candidates = candidatesByKey.get(factKey) ?? [];
    const canonical = arbitration.get(factKey) ?? candidates[0]?.rep ?? null;

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
