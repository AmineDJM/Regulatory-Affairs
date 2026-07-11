import type { RegProcedureType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateRule, type LoadedRule, type TwinDoc } from "./engine";

/**
 * MOTEUR DE RÈGLES ADMINISTRABLE (G5) — chargement des règles du/des pack(s) ACTIF(s) et
 * exécution déterministe. Tant qu'aucun pack actif ne couvre la procédure, `assessVersion`
 * retombe sur les profils codés (`requirements.ts`) : aucune régression, remplacement progressif.
 *
 * `sourceVersionId` d'une règle → citation corpus résolue (autorité · code v… · article).
 */

/**
 * Charge les règles APPLICABLES à une procédure (packs ACTIVE, règles actives, date d'effet
 * atteinte, applicabilité procédure/produit satisfaite), avec citation corpus résolue.
 */
export async function loadActiveRules(procedureType: RegProcedureType, productType?: string | null): Promise<LoadedRule[]> {
  const now = new Date();
  const rules = await prisma.regulatoryRule.findMany({
    where: {
      active: true,
      pack: { status: "ACTIVE" },
      OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }],
    },
    orderBy: [{ ordinal: "asc" }, { code: "asc" }],
    select: {
      code: true, kind: true, sectionCode: true, factKey: true, severity: true, blocker: true,
      title: true, detail: true, remediation: true, sourceVersionId: true, sourcePath: true,
      procedureTypes: true, productTypes: true,
    },
  });

  // Applicabilité (tableaux vides = applicable partout).
  const applicable = rules.filter(
    (r) =>
      (r.procedureTypes.length === 0 || r.procedureTypes.includes(procedureType)) &&
      (r.productTypes.length === 0 || (productType != null && r.productTypes.includes(productType))),
  );

  // Résolution des citations corpus en un seul appel.
  const versionIds = [...new Set(applicable.map((r) => r.sourceVersionId).filter((id): id is string => Boolean(id)))];
  const citations = new Map<string, string>();
  if (versionIds.length > 0) {
    const versions = await prisma.regulatorySourceVersion.findMany({
      where: { id: { in: versionIds } },
      select: { id: true, version: true, source: { select: { authority: true, code: true } } },
    });
    for (const v of versions) citations.set(v.id, `${v.source.authority} · ${v.source.code} v${v.version}`);
  }

  return applicable.map((r) => ({
    code: r.code,
    kind: r.kind,
    sectionCode: r.sectionCode,
    factKey: r.factKey,
    severity: r.severity,
    blocker: r.blocker,
    title: r.title,
    detail: r.detail,
    remediation: r.remediation,
    citation: r.sourceVersionId
      ? [citations.get(r.sourceVersionId), r.sourcePath].filter(Boolean).join(" · ") || null
      : r.sourcePath ?? null,
  }));
}

/** Clés de faits « renseignées » du jumeau numérique (valeur non vide, non rejetées) — pour FACT_REQUIRED. */
export async function loadPresentFactKeys(dossierVersionId: string): Promise<Set<string>> {
  const facts = await prisma.regulatoryFact.findMany({
    where: { dossierVersionId, status: { not: "REJECTED" } },
    select: { factKey: true, value: true, approvedValue: true },
  });
  return new Set(facts.filter((f) => (f.approvedValue ?? f.value ?? "").trim().length > 0).map((f) => f.factKey));
}

/** Nombre de règles dans les packs ACTIFS (diagnostic UI / décision de repli). */
export async function activeRuleCount(): Promise<number> {
  try {
    return await prisma.regulatoryRule.count({ where: { active: true, pack: { status: "ACTIVE" } } });
  } catch {
    return 0;
  }
}

// ---- Tests golden par règle (item 7 : chaque règle porte ses cas de test) ----

export interface RuleTestCase {
  name: string;
  sections?: string[]; // sections CTD présentes dans le dossier fictif
  facts?: string[]; // clés de faits renseignées
  expectPass: boolean; // true = la règle doit PASSER (aucun constat)
}

export interface RuleTestResult {
  name: string;
  expectPass: boolean;
  actualPass: boolean;
  ok: boolean;
}

/** Parse le champ JSON `tests` d'une règle en cas de test typés (tolérant). */
export function parseRuleTests(tests: unknown): RuleTestCase[] {
  if (!Array.isArray(tests)) return [];
  const out: RuleTestCase[] = [];
  for (const t of tests) {
    if (t && typeof t === "object" && typeof (t as RuleTestCase).name === "string" && typeof (t as RuleTestCase).expectPass === "boolean") {
      const c = t as RuleTestCase;
      out.push({ name: c.name, sections: Array.isArray(c.sections) ? c.sections : [], facts: Array.isArray(c.facts) ? c.facts : [], expectPass: c.expectPass });
    }
  }
  return out;
}

/** Exécute les cas de test golden d'une règle (déterministe, sans base). */
export function runRuleTests(rule: LoadedRule, cases: RuleTestCase[]): RuleTestResult[] {
  return cases.map((c) => {
    const docs: TwinDoc[] = (c.sections ?? []).map((section, i) => ({
      id: `t${i}`, originalFilename: `${section}.pdf`, ctdSection: section, ctdModule: null,
      securityStatus: "SAFE", extractionStatus: "TEXT_EXTRACTED", classificationMethod: "TEST",
    }));
    const finding = evaluateRule(rule, { storableDocs: docs, factKeys: new Set(c.facts ?? []) });
    const actualPass = finding === null;
    return { name: c.name, expectPass: c.expectPass, actualPass, ok: actualPass === c.expectPass };
  });
}
