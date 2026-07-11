import type { RegProcedureType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirementsFor } from "./requirements";
import { sectionByCode } from "../ctd/taxonomy";
import type { RuleTestCase } from "./rule-engine";

/**
 * AMORÇAGE DES RULE PACKS (G5) — matérialise les profils de complétude codés (`requirements.ts`)
 * en packs de règles ADMINISTRABLES et versionnés, activés d'emblée. À partir de là, les contrôles
 * de complétude sont pilotés par la base (éditables, traçables, sourçables) — plus par du code figé.
 * Idempotent : ne recrée pas un pack déjà présent.
 */

interface ScenarioSpec {
  code: string;
  name: string;
  procedure: RegProcedureType;
  description: string;
  /** Faits du jumeau numérique exigés (FACT_REQUIRED) en plus des sections. */
  requiredFacts?: { key: string; label: string }[];
}

// Les scénarios demandés (importé / fabrication locale / générique / biosimilaire / pré-soumission /
// enregistrement initial / renouvellement / modification) — chacun devient un pack éditable.
const SCENARIOS: ScenarioSpec[] = [
  { code: "ANPP-PRESUBMISSION", name: "Pré-soumission (ANPP)", procedure: "PRESUBMISSION", description: "Recevabilité avant dépôt : pièces minimales du module 1." },
  {
    code: "ANPP-INITIAL", name: "Enregistrement initial (ANPP)", procedure: "INITIAL_REGISTRATION",
    description: "Dossier CTD complet pour un enregistrement initial de médicament.",
    requiredFacts: [{ key: "INN", label: "DCI / substance active" }, { key: "PRODUCT_NAME", label: "Nom du produit" }],
  },
  {
    code: "ANPP-IMPORTED", name: "Produit importé (ANPP)", procedure: "IMPORTED",
    description: "Enregistrement d'un produit importé : CTD complet + certificat de libre vente / statut.",
    requiredFacts: [{ key: "INN", label: "DCI / substance active" }, { key: "MAH", label: "Détenteur de l'AMM" }],
  },
  {
    code: "ANPP-LOCAL", name: "Fabrication locale (ANPP)", procedure: "LOCAL_MANUFACTURING",
    description: "Enregistrement d'un produit fabriqué localement : CTD complet + justificatif de fabrication locale.",
    requiredFacts: [{ key: "INN", label: "DCI / substance active" }, { key: "MANUFACTURER", label: "Fabricant" }],
  },
  {
    code: "ANPP-GENERIC", name: "Générique (ANPP)", procedure: "GENERIC",
    description: "Générique : CTD complet + preuves de bioéquivalence (module 5.3).",
    requiredFacts: [{ key: "INN", label: "DCI / substance active" }, { key: "REFERENCE_PRODUCT", label: "Produit de référence" }],
  },
  {
    code: "ANPP-BIOSIMILAR", name: "Biosimilaire (ANPP)", procedure: "BIOSIMILAR",
    description: "Biosimilaire : CTD complet + données non cliniques (4.2) et cliniques comparatives (5.3).",
    requiredFacts: [{ key: "INN", label: "DCI / substance active" }, { key: "REFERENCE_PRODUCT", label: "Produit de référence" }],
  },
  { code: "ANPP-RENEWAL", name: "Renouvellement (ANPP)", procedure: "RENEWAL", description: "Renouvellement quinquennal : pièces administratives + données de suivi." },
  { code: "ANPP-VARIATION", name: "Modification / Variation (ANPP)", procedure: "VARIATION", description: "Modification post-AMM : pièces impactées par le changement déclaré." },
];

const titleFor = (code: string) => sectionByCode(code)?.title ?? code;

/** Cas de test golden d'une règle de section : présente → passe ; absente → échoue. */
function sectionTests(sectionCode: string): RuleTestCase[] {
  return [
    { name: `${sectionCode} présente → conforme`, sections: [sectionCode], expectPass: true },
    { name: `${sectionCode} absente → constat`, sections: [], expectPass: false },
  ];
}

function factTests(factKey: string): RuleTestCase[] {
  return [
    { name: `${factKey} renseigné → conforme`, facts: [factKey], expectPass: true },
    { name: `${factKey} manquant → constat`, facts: [], expectPass: false },
  ];
}

/**
 * Crée (si absents) les packs de règles ANPP à partir des profils. Retourne le nombre de packs
 * et de règles créés. Lie les règles à la version ACTIVE du corpus ANPP si elle existe (citation).
 */
export async function seedRulePacks(createdById: string): Promise<{ packs: number; rules: number; skipped: number }> {
  // Citation corpus : version ACTIVE de la source ANPP legacy, si amorcée.
  const anppVersion = await prisma.regulatorySourceVersion.findFirst({
    where: { status: "ACTIVE", source: { authority: "ANPP" } },
    orderBy: { approvedAt: "desc" },
    select: { id: true },
  });
  const sourceVersionId = anppVersion?.id ?? null;

  let packs = 0, rules = 0, skipped = 0;

  for (const sc of SCENARIOS) {
    const existing = await prisma.regulatoryRulePack.findUnique({ where: { code: sc.code }, select: { id: true } });
    if (existing) { skipped++; continue; }

    const req = requirementsFor(sc.procedure);
    const ruleData: Prisma.RegulatoryRuleCreateManyPackInput[] = [];
    let ordinal = 0;

    for (const code of req.required) {
      ruleData.push({
        code: `SEC-REQ-${code}`, kind: "SECTION_REQUIRED", sectionCode: code, severity: "CRITICAL", blocker: true,
        title: `Section obligatoire : ${code} — ${titleFor(code)}`,
        detail: `La section CTD ${code} (${titleFor(code)}) est obligatoire pour « ${sc.name} ».`,
        remediation: `Fournir un document rattaché à la section ${code}.`,
        procedureTypes: [sc.procedure], productTypes: [], sourceVersionId, sourcePath: sourceVersionId ? "Référentiel de complétude CTD" : null,
        tests: sectionTests(code) as unknown as Prisma.InputJsonValue, ordinal: ordinal++,
      });
    }
    for (const code of req.expected) {
      ruleData.push({
        code: `SEC-EXP-${code}`, kind: "SECTION_EXPECTED", sectionCode: code, severity: "MAJOR", blocker: false,
        title: `Section attendue : ${code} — ${titleFor(code)}`,
        detail: `La section CTD ${code} (${titleFor(code)}) est généralement attendue pour « ${sc.name} ».`,
        remediation: `Fournir, si applicable, un document rattaché à la section ${code}.`,
        procedureTypes: [sc.procedure], productTypes: [], sourceVersionId, sourcePath: sourceVersionId ? "Référentiel de complétude CTD" : null,
        tests: sectionTests(code) as unknown as Prisma.InputJsonValue, ordinal: ordinal++,
      });
    }
    for (const f of sc.requiredFacts ?? []) {
      ruleData.push({
        code: `FACT-${f.key}`, kind: "FACT_REQUIRED", factKey: f.key, severity: "MAJOR", blocker: false,
        title: `Donnée requise : ${f.label}`,
        detail: `Le fait « ${f.label} » (${f.key}) doit être identifié dans le jumeau numérique pour « ${sc.name} ».`,
        remediation: `Vérifier l'extraction du fait ${f.key} ou le renseigner manuellement.`,
        procedureTypes: [sc.procedure], productTypes: [], sourceVersionId, sourcePath: null,
        tests: factTests(f.key) as unknown as Prisma.InputJsonValue, ordinal: ordinal++,
      });
    }

    await prisma.regulatoryRulePack.create({
      data: {
        code: sc.code, name: sc.name, description: sc.description, jurisdiction: "DZ", version: "1.0",
        status: "ACTIVE", createdById, approvedById: createdById, approvedAt: new Date(),
        rules: { createMany: { data: ruleData } },
      },
    });
    packs++;
    rules += ruleData.length;
  }

  return { packs, rules, skipped };
}
