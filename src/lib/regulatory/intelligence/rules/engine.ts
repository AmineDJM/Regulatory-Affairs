import type { RegProcedureType } from "@prisma/client";
import { requirementsFor } from "./requirements";
import { sectionByCode } from "../ctd/taxonomy";

/**
 * MOTEUR DE RÈGLES DÉTERMINISTE (Phase 4) — pas d'IA sur les contrôles critiques.
 * À partir du « jumeau numérique » (documents classés + statuts), produit des CONSTATS
 * horodatables (avec preuve) et un BILAN de complétude/conformité.
 *
 * Principe cardinal — pas de fausse conformité : un score de complétude élevé NE rend PAS
 * le dossier conforme s'il subsiste un **bloqueur** (section obligatoire manquante, dossier
 * vide). La conformité = zéro bloqueur.
 */

export type Severity = "CRITICAL" | "MAJOR" | "MINOR" | "INFO";

export interface FindingInput {
  code: string;
  severity: Severity;
  category: "completeness" | "security" | "extraction" | "classification" | "content";
  title: string;
  detail: string;
  evidence?: string;
  sectionCode?: string;
  documentId?: string;
  blocker?: boolean;
}

export interface TwinDoc {
  id: string;
  originalFilename: string;
  ctdSection: string | null;
  ctdModule: string | null;
  securityStatus: string;
  extractionStatus: string;
  classificationMethod: string | null;
}

export interface AssessmentSummary {
  completeness: number; // 0..100
  conforme: boolean;
  blockers: number;
  criticals: number;
  majors: number;
  minors: number;
  requiredPresent: number;
  requiredTotal: number;
  expectedPresent: number;
  expectedTotal: number;
}

export interface AssessmentResult {
  findings: FindingInput[];
  summary: AssessmentSummary;
}

/**
 * Règle chargée depuis le pack ACTIF (G5) — forme minimale pour l'évaluation déterministe.
 * `citation` = référence corpus résolue (ex. « ANPP · Arrêté 2021-05-10 v1.0 · art. 4 »).
 */
export interface LoadedRule {
  code: string;
  kind: "SECTION_REQUIRED" | "SECTION_EXPECTED" | "DOCUMENT_PRESENT" | "FACT_REQUIRED" | "CUSTOM";
  sectionCode: string | null;
  factKey: string | null;
  severity: Severity;
  blocker: boolean;
  title: string;
  detail: string | null;
  remediation: string | null;
  citation: string | null;
}

export interface RuleContext {
  storableDocs: TwinDoc[];
  factKeys: Set<string>;
}

function ruleFinding(rule: LoadedRule): FindingInput {
  const detail = [rule.detail ?? rule.title, rule.remediation ? `Remédiation : ${rule.remediation}` : null, rule.citation ? `Source : ${rule.citation}` : null]
    .filter(Boolean)
    .join(" — ");
  return {
    code: rule.code,
    severity: rule.severity,
    category: "completeness",
    title: rule.title,
    detail,
    evidence: rule.citation ?? undefined,
    sectionCode: rule.sectionCode ?? undefined,
    blocker: rule.blocker,
  };
}

/**
 * Évalue UNE règle : renvoie un constat si elle échoue, sinon `null`. Déterministe, pur —
 * réutilisé par le moteur ET par le lanceur de tests golden (`runRuleTests`).
 */
export function evaluateRule(rule: LoadedRule, ctx: RuleContext): FindingInput | null {
  switch (rule.kind) {
    case "FACT_REQUIRED":
      return rule.factKey && ctx.factKeys.has(rule.factKey) ? null : ruleFinding(rule);
    case "SECTION_REQUIRED":
    case "SECTION_EXPECTED":
    case "DOCUMENT_PRESENT":
      return rule.sectionCode && covered(rule.sectionCode, ctx.storableDocs) ? null : ruleFinding(rule);
    default:
      return null; // CUSTOM : logique non exécutée par défaut (réservé)
  }
}

const isSectionKind = (k: LoadedRule["kind"]) => k === "SECTION_REQUIRED" || k === "SECTION_EXPECTED" || k === "DOCUMENT_PRESENT";

const isStorable = (s: string) => s === "SAFE" || s === "SUSPICIOUS";
const isBlockedSec = (s: string) => s.startsWith("BLOCKED") || s === "CORRUPTED";

/** Une section requise est « couverte » par un document classé sur elle ou une sous-section. */
function covered(code: string, docs: TwinDoc[]): boolean {
  return docs.some((d) => d.ctdSection && (d.ctdSection === code || d.ctdSection.startsWith(`${code}.`)));
}

const titleFor = (code: string) => sectionByCode(code)?.title ?? code;
const namesOf = (docs: TwinDoc[], max = 5) => {
  const names = docs.map((d) => d.originalFilename);
  return names.slice(0, max).join(", ") + (names.length > max ? `, … (+${names.length - max})` : "");
};

export function assessVersion(input: {
  procedureType: RegProcedureType;
  documents: TwinDoc[];
  rules?: LoadedRule[];
  factKeys?: Set<string>;
}): AssessmentResult {
  const { procedureType } = input;
  const all = input.documents;
  const storable = all.filter((d) => isStorable(d.securityStatus));
  const rules = input.rules ?? [];
  const useRules = rules.length > 0; // pack ACTIF → règles en base ; sinon repli profils codés
  const findings: FindingInput[] = [];

  // R0 — dossier vide (aucun fichier exploitable) : bloqueur critique.
  if (storable.length === 0) {
    findings.push({
      code: "EMPTY_DOSSIER", severity: "CRITICAL", category: "completeness", blocker: true,
      title: "Dossier sans fichier exploitable",
      detail: "Aucun document sûr n'a pu être conservé — impossible d'évaluer la complétude.",
    });
  }

  // R1/R2 — complétude par SECTIONS. Source : pack de règles ACTIF (data-driven) ou repli déterministe.
  let requiredPresent = 0, requiredTotal = 0, expectedPresent = 0, expectedTotal = 0;

  if (useRules) {
    const ctx: RuleContext = { storableDocs: storable, factKeys: input.factKeys ?? new Set() };
    for (const rule of rules) {
      const f = evaluateRule(rule, ctx);
      if (isSectionKind(rule.kind)) {
        if (rule.blocker) { requiredTotal++; if (!f) requiredPresent++; }
        else { expectedTotal++; if (!f) expectedPresent++; }
      }
      if (f) findings.push(f);
    }
  } else {
    const req = requirementsFor(procedureType);
    requiredTotal = req.required.length;
    expectedTotal = req.expected.length;
    // R1 — sections OBLIGATOIRES manquantes : bloqueurs critiques.
    for (const code of req.required) {
      if (covered(code, storable)) { requiredPresent++; continue; }
      findings.push({
        code: "MISSING_REQUIRED_SECTION", severity: "CRITICAL", category: "completeness", blocker: true,
        sectionCode: code, title: `Section obligatoire manquante : ${code}`,
        detail: `La section CTD ${code} — ${titleFor(code)} est requise pour cette procédure et n'a pas été trouvée.`,
        evidence: `Aucun document classé en ${code}.`,
      });
    }
    // R2 — sections ATTENDUES manquantes : majeures (non bloquantes).
    for (const code of req.expected) {
      if (covered(code, storable)) { expectedPresent++; continue; }
      findings.push({
        code: "MISSING_EXPECTED_SECTION", severity: "MAJOR", category: "completeness",
        sectionCode: code, title: `Section attendue manquante : ${code}`,
        detail: `La section CTD ${code} — ${titleFor(code)} est généralement attendue et semble absente.`,
      });
    }
  }

  // R3 — fichiers bloqués (exécutable/chiffré/corrompu dans l'archive) : majeur (sécurité).
  const blocked = all.filter((d) => isBlockedSec(d.securityStatus));
  if (blocked.length > 0) {
    findings.push({
      code: "SECURITY_BLOCKED_FILE", severity: "MAJOR", category: "security",
      title: `${blocked.length} fichier(s) refusé(s) à l'ingestion`,
      detail: "Des entrées de l'archive ont été refusées (exécutable/macro, chiffré, chemin non sûr ou corrompu). À investiguer auprès du fournisseur.",
      evidence: namesOf(blocked),
    });
  }

  // R4 — extraction impossible (corrompu / protégé) : majeur (contenu non vérifiable).
  const failed = storable.filter((d) => d.extractionStatus === "CORRUPTED" || d.extractionStatus === "PASSWORD_PROTECTED");
  if (failed.length > 0) {
    findings.push({
      code: "EXTRACTION_FAILED", severity: "MAJOR", category: "extraction",
      title: `${failed.length} fichier(s) illisibles`,
      detail: "Le contenu n'a pas pu être extrait (corrompu ou protégé par mot de passe) — vérification manuelle nécessaire.",
      evidence: namesOf(failed),
    });
  }

  // R5 — scans en attente d'OCR : mineur (information).
  const ocr = storable.filter((d) => d.extractionStatus === "OCR_REQUIRED");
  if (ocr.length > 0) {
    findings.push({
      code: "OCR_PENDING", severity: "MINOR", category: "extraction",
      title: `${ocr.length} document(s) scanné(s) à océriser`,
      detail: "Ces fichiers semblent être des scans (sans couche texte) : l'analyse de fond nécessitera un OCR.",
      evidence: namesOf(ocr),
    });
  }

  // R6 — fichiers non classés : mineur, ou majeur si proportion élevée.
  const unclassified = storable.filter((d) => !d.ctdSection && !d.ctdModule);
  if (unclassified.length > 0) {
    const ratio = unclassified.length / storable.length;
    findings.push({
      code: "UNCLASSIFIED_FILES", severity: ratio > 0.3 ? "MAJOR" : "MINOR", category: "classification",
      title: `${unclassified.length} fichier(s) non classé(s) CTD`,
      detail: "Ces documents n'ont pas pu être rattachés à une section CTD de façon fiable — classement manuel requis.",
      evidence: namesOf(unclassified),
    });
  }

  const criticals = findings.filter((f) => f.severity === "CRITICAL").length;
  const majors = findings.filter((f) => f.severity === "MAJOR").length;
  const minors = findings.filter((f) => f.severity === "MINOR").length;
  const blockers = findings.filter((f) => f.blocker).length;

  const denom = requiredTotal + 0.5 * expectedTotal;
  const completeness = denom > 0 ? Math.round((100 * (requiredPresent + 0.5 * expectedPresent)) / denom) : storable.length > 0 ? 100 : 0;

  return {
    findings,
    summary: {
      completeness,
      conforme: blockers === 0 && storable.length > 0, // pas de fausse conformité
      blockers, criticals, majors, minors,
      requiredPresent, requiredTotal, expectedPresent, expectedTotal,
    },
  };
}
