import { prisma } from "@/lib/prisma";
import { sectionByCode } from "../ctd/taxonomy";

/**
 * COUCHE DE CONNAISSANCE DU DOSSIER — surface de LECTURE stable et structurée sur tout ce que
 * l'analyse a durablement conservé (faits du jumeau, documents classés CTD, contrôles, texte).
 *
 * C'est le socle de réutilisation « pour plus tard » : pré-remplissage de formulaire de
 * présoumission, préparation automatique de dossier, réponses aux réserves, ET interrogation par
 * le chatbot réglementaire (« quels faits pour le module 3 ? », « où parle-t-on de stabilité ? »).
 *
 * Tout est READ-ONLY et BORNÉ EN MÉMOIRE : les faits sont peu nombreux ; les documents sont
 * paginés ; la recherche plein texte extrait un extrait CÔTÉ BASE (jamais le contenu entier en RAM),
 * ce qui tient même face à un document océrisé de 10 000 pages. Le CONTRÔLE D'ACCÈS est à la charge
 * de l'appelant (server action / outil chatbot) — ces fonctions ne présument aucune identité.
 */

const HUMAN_VALIDATED: Array<"CONFIRMED" | "CORRECTED"> = ["CONFIRMED", "CORRECTED"];

export interface DossierFact {
  factKey: string;
  label: string;
  value: string | null; // valeur retenue : approuvée si décidée par un humain, sinon proposée
  unit: string | null;
  status: string; // PROPOSED | CONFIRMED | CORRECTED | REJECTED
  hasConflict: boolean;
  humanValidated: boolean;
  occurrences: number;
}

export interface DossierSectionNode { section: string | null; title: string | null; count: number }
export interface DossierModuleNode { module: string; total: number; sections: DossierSectionNode[] }

export interface DossierKnowledge {
  version: { id: string; versionNo: number; fileCount: number; totalBytes: number; createdAt: Date };
  dossier: { id: string; reference: string; title: string; procedureType: string; status: string };
  assessment: { completeness: number; conforme: boolean; blockers: number; criticals: number; majors: number; minors: number; requiredPresent: number; requiredTotal: number } | null;
  facts: DossierFact[];
  documentsByModule: DossierModuleNode[];
  findings: { total: number; bySeverity: Record<string, number>; bySource: Record<string, number> };
}

const bestValue = (f: { value: string | null; approvedValue: string | null; status: string }) =>
  HUMAN_VALIDATED.includes(f.status as "CONFIRMED" | "CORRECTED") ? f.approvedValue ?? f.value : f.value;

/**
 * SNAPSHOT structuré d'une version de dossier : métadonnées, bilan de conformité, faits (valeur
 * retenue + nb d'occurrences), arbre des documents par module/section CTD, et compte des constats.
 * Retourne null si la version n'existe pas. Point d'entrée pour un formulaire pré-rempli ou le chatbot.
 */
export async function getDossierKnowledge(dossierVersionId: string): Promise<DossierKnowledge | null> {
  const version = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: dossierVersionId },
    select: {
      id: true, versionNo: true, fileCount: true, totalBytes: true, createdAt: true,
      dossier: { select: { id: true, reference: true, title: true, procedureType: true, status: true } },
    },
  });
  if (!version) return null;

  const [assessment, factRows, docGroups, findingGroups] = await Promise.all([
    prisma.regulatoryAssessment.findUnique({
      where: { dossierVersionId },
      select: { completeness: true, conforme: true, blockers: true, criticals: true, majors: true, minors: true, requiredPresent: true, requiredTotal: true },
    }),
    prisma.regulatoryFact.findMany({
      where: { dossierVersionId },
      orderBy: { factKey: "asc" },
      select: { id: true, factKey: true, label: true, value: true, unit: true, status: true, hasConflict: true, approvedValue: true },
    }),
    prisma.regulatoryDocument.groupBy({ by: ["ctdModule", "ctdSection"], where: { dossierVersionId }, _count: { _all: true } }),
    prisma.regulatoryFinding.groupBy({ by: ["severity", "source"], where: { dossierVersionId }, _count: { _all: true } }),
  ]);

  // Occurrences par fait (compte seul — bornées, pas de contenu chargé).
  const factIds = factRows.map((f) => f.id);
  const occGroups = factIds.length > 0
    ? await prisma.regulatoryFactOccurrence.groupBy({ by: ["factId"], where: { factId: { in: factIds } }, _count: { _all: true } })
    : [];
  const occByFact = new Map(occGroups.map((o) => [o.factId, o._count._all]));

  const facts: DossierFact[] = factRows.map((f) => ({
    factKey: f.factKey, label: f.label, value: bestValue(f), unit: f.unit, status: f.status,
    hasConflict: f.hasConflict, humanValidated: HUMAN_VALIDATED.includes(f.status as "CONFIRMED" | "CORRECTED"),
    occurrences: occByFact.get(f.id) ?? 0,
  }));

  // Arbre documents par module → sections (avec titre CTD).
  const byModule = new Map<string, DossierSectionNode[]>();
  for (const g of docGroups) {
    const mod = g.ctdModule ?? "Non classé";
    const arr = byModule.get(mod) ?? [];
    arr.push({ section: g.ctdSection, title: g.ctdSection ? sectionByCode(g.ctdSection)?.title ?? null : null, count: g._count._all });
    byModule.set(mod, arr);
  }
  const documentsByModule: DossierModuleNode[] = [...byModule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, sections]) => ({
      module,
      total: sections.reduce((s, x) => s + x.count, 0),
      sections: sections.sort((a, b) => (a.section ?? "~").localeCompare(b.section ?? "~")),
    }));

  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let total = 0;
  for (const g of findingGroups) {
    bySeverity[g.severity] = (bySeverity[g.severity] ?? 0) + g._count._all;
    bySource[g.source] = (bySource[g.source] ?? 0) + g._count._all;
    total += g._count._all;
  }

  return {
    version: { id: version.id, versionNo: version.versionNo, fileCount: version.fileCount, totalBytes: version.totalBytes, createdAt: version.createdAt },
    dossier: version.dossier,
    assessment,
    facts,
    documentsByModule,
    findings: { total, bySeverity, bySource },
  };
}

/**
 * Faits d'une version, filtrables. `humanValidatedOnly` → seuls les faits CONFIRMÉS/CORRIGÉS
 * (utilisable tel quel pour PRÉ-REMPLIR un formulaire). Peu de faits → non paginé.
 */
export async function getDossierFacts(dossierVersionId: string, opts: { humanValidatedOnly?: boolean; factKeys?: string[] } = {}): Promise<DossierFact[]> {
  const rows = await prisma.regulatoryFact.findMany({
    where: {
      dossierVersionId,
      ...(opts.humanValidatedOnly ? { status: { in: HUMAN_VALIDATED } } : {}),
      ...(opts.factKeys && opts.factKeys.length > 0 ? { factKey: { in: opts.factKeys } } : {}),
    },
    orderBy: { factKey: "asc" },
    select: { id: true, factKey: true, label: true, value: true, unit: true, status: true, hasConflict: true, approvedValue: true, _count: { select: { occurrences: true } } },
  });
  return rows.map((f) => ({
    factKey: f.factKey, label: f.label, value: bestValue(f), unit: f.unit, status: f.status,
    hasConflict: f.hasConflict, humanValidated: HUMAN_VALIDATED.includes(f.status as "CONFIRMED" | "CORRECTED"),
    occurrences: f._count.occurrences,
  }));
}

/**
 * Table clé → valeur des faits HUMAINEMENT VALIDÉS, prête pour un pré-remplissage de formulaire
 * (présoumission) ou une préparation de dossier. Ne renvoie que ce sur quoi un humain s'est engagé.
 */
export async function getApprovedFactMap(dossierVersionId: string): Promise<Record<string, { value: string | null; unit: string | null; status: string }>> {
  const facts = await getDossierFacts(dossierVersionId, { humanValidatedOnly: true });
  const out: Record<string, { value: string | null; unit: string | null; status: string }> = {};
  for (const f of facts) out[f.factKey] = { value: f.value, unit: f.unit, status: f.status };
  return out;
}

export interface DossierDoc {
  id: string; originalFilename: string; suggestedFilename: string | null;
  ctdModule: string | null; ctdSection: string | null; sectionTitle: string | null;
  containedSections: string[]; // sous-sections détectées dans un PDF consolidé (« Module 3.pdf »)
  extractionStatus: string; securityStatus: string;
}

/** Documents d'une version, filtrables par module/section/statut, PAGINÉS (défaut 100). */
export async function getDossierDocuments(
  dossierVersionId: string,
  opts: { module?: string; section?: string; extractionStatus?: string; take?: number; skip?: number } = {},
): Promise<DossierDoc[]> {
  const take = Math.min(Math.max(1, opts.take ?? 100), 500);
  const rows = await prisma.regulatoryDocument.findMany({
    where: {
      dossierVersionId,
      ...(opts.module ? { ctdModule: opts.module } : {}),
      ...(opts.section ? { ctdSection: opts.section } : {}),
      ...(opts.extractionStatus ? { extractionStatus: opts.extractionStatus as never } : {}),
    },
    orderBy: [{ ctdModule: "asc" }, { ctdSection: "asc" }, { originalFilename: "asc" }],
    take, skip: opts.skip ?? 0,
    select: { id: true, originalFilename: true, suggestedFilename: true, ctdModule: true, ctdSection: true, containedSections: true, extractionStatus: true, securityStatus: true },
  });
  return rows.map((d) => ({ ...d, sectionTitle: d.ctdSection ? sectionByCode(d.ctdSection)?.title ?? null : null }));
}

export interface DossierTextHit { documentId: string; filename: string; ctdSection: string | null; snippet: string }

/**
 * Recherche plein texte DANS LES DOCUMENTS DU DOSSIER (texte natif + OCR). L'extrait est calculé
 * CÔTÉ BASE (substring autour de la 1ʳᵉ occurrence) → aucune ligne de contenu entier chargée en RAM.
 * Primitive d'interrogation du chatbot (« où est-il question de X dans ce dossier ? »).
 */
export async function searchDossierContent(dossierVersionId: string, query: string, opts: { take?: number } = {}): Promise<DossierTextHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const take = Math.min(Math.max(1, opts.take ?? 20), 100);
  const like = `%${q}%`;
  const rows = await prisma.$queryRaw<Array<{ documentid: string; filename: string; ctdsection: string | null; snippet: string }>>`
    SELECT d.id AS documentid, d."originalFilename" AS filename, d."ctdSection" AS ctdsection,
      substring(e.content FROM greatest(1, position(lower(${q}) IN lower(e.content)) - 120) FOR 320) AS snippet
    FROM "RegulatoryExtraction" e
    JOIN "RegulatoryDocument" d ON d.id = e."documentId"
    WHERE d."dossierVersionId" = ${dossierVersionId} AND e.content ILIKE ${like}
    ORDER BY d."ctdSection" ASC NULLS LAST
    LIMIT ${take}`;
  return rows.map((r) => ({ documentId: r.documentid, filename: r.filename, ctdSection: r.ctdsection, snippet: (r.snippet ?? "").trim() }));
}

export interface OcrPageMeta { page?: number; chars?: number }
export interface DossierPassage {
  documentId: string; filename: string; ctdSection: string | null; ctdModule: string | null;
  snippet: string; score: number; matchOffset: number; ocrPages: OcrPageMeta[] | null;
}

/**
 * Recherche MULTI-TERMES classée — le cœur « intelligent » du chatbot. Chaque document est scoré par
 * le NOMBRE de termes distincts qu'il contient (rappel bien meilleur qu'un ILIKE de la phrase entière) ;
 * l'extrait ET le décalage de caractère du 1ᵉʳ terme trouvé sont calculés CÔTÉ BASE (aucun contenu
 * entier chargé en RAM — tient face à un OCR de 10 000 pages). Le décalage sert à retrouver la PAGE
 * exacte via `ocrPages.chars` (cf. `pageForOffset`). Termes lowercasés/dédupliqués/plafonnés (8).
 */
export async function searchDossierPassages(dossierVersionId: string, terms: string[], opts: { take?: number } = {}): Promise<DossierPassage[]> {
  const clean = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2))].slice(0, 8);
  if (clean.length === 0) return [];
  const take = Math.min(Math.max(1, opts.take ?? 8), 40);
  const idx = clean.map((_, i) => i + 2); // $1 = versionId ; $2..$(n+1) = termes ; dernier = take
  const pos = (i: number) => `position(lower($${i}) IN lower(e.content))`;
  const scoreExpr = idx.map((i) => `(CASE WHEN ${pos(i)} > 0 THEN 1 ELSE 0 END)`).join(" + ");
  const firstExpr = `LEAST(${idx.map((i) => `NULLIF(${pos(i)}, 0)`).join(", ")})`; // LEAST ignore les NULL
  const limIdx = clean.length + 2;
  const sql = `
    SELECT d.id AS documentid, d."originalFilename" AS filename, d."ctdSection" AS ctdsection, d."ctdModule" AS ctdmodule,
      m.score, m.matchoffset, e."ocrPages" AS ocrpages,
      substring(e.content FROM greatest(1, m.matchoffset - 120) FOR 320) AS snippet
    FROM "RegulatoryExtraction" e
    JOIN "RegulatoryDocument" d ON d.id = e."documentId"
    CROSS JOIN LATERAL (SELECT (${scoreExpr}) AS score, (${firstExpr}) AS matchoffset) m
    WHERE d."dossierVersionId" = $1 AND m.matchoffset IS NOT NULL
    ORDER BY m.score DESC, m.matchoffset ASC
    LIMIT $${limIdx}`;
  let rows: Array<{ documentid: string; filename: string; ctdsection: string | null; ctdmodule: string | null; score: number | bigint; matchoffset: number | bigint | null; ocrpages: unknown; snippet: string | null }> = [];
  try {
    rows = await prisma.$queryRawUnsafe(sql, dossierVersionId, ...clean, take);
  } catch {
    rows = [];
  }
  return rows.map((r) => ({
    documentId: r.documentid, filename: r.filename, ctdSection: r.ctdsection, ctdModule: r.ctdmodule,
    snippet: (r.snippet ?? "").trim(), score: Number(r.score),
    matchOffset: r.matchoffset == null ? 0 : Number(r.matchoffset),
    ocrPages: Array.isArray(r.ocrpages) ? (r.ocrpages as OcrPageMeta[]) : null,
  }));
}

/**
 * PAGE exacte d'un décalage de caractère dans le texte OCR concaténé. Le contenu stocké est
 * `pages.map(p => p.text).join("\n\n")` : on reconstitue les bornes de chaque page par cumul de
 * `chars` (+2 pour le séparateur). Pur, sans I/O — retourne null si pas de pagination fiable
 * (texte natif sans `ocrPages`). C'est ce qui permet de citer « fichier · section · page N ».
 */
export function pageForOffset(ocrPages: OcrPageMeta[] | null | undefined, offset1Based: number): number | null {
  if (!Array.isArray(ocrPages) || ocrPages.length === 0 || !(offset1Based > 0)) return null;
  const off = offset1Based - 1; // 0-based
  let cum = 0;
  for (let i = 0; i < ocrPages.length; i++) {
    const chars = typeof ocrPages[i]?.chars === "number" ? (ocrPages[i].chars as number) : 0;
    if (off < cum + chars) return typeof ocrPages[i]?.page === "number" ? (ocrPages[i].page as number) : i + 1;
    cum += chars + 2; // séparateur « \n\n »
  }
  const last = ocrPages[ocrPages.length - 1];
  return typeof last?.page === "number" ? (last.page as number) : ocrPages.length;
}
