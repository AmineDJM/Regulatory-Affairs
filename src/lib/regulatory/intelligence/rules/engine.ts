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

export function assessVersion(input: { procedureType: RegProcedureType; documents: TwinDoc[] }): AssessmentResult {
  const { procedureType } = input;
  const all = input.documents;
  const storable = all.filter((d) => isStorable(d.securityStatus));
  const req = requirementsFor(procedureType);
  const findings: FindingInput[] = [];

  // R0 — dossier vide (aucun fichier exploitable) : bloqueur critique.
  if (storable.length === 0) {
    findings.push({
      code: "EMPTY_DOSSIER", severity: "CRITICAL", category: "completeness", blocker: true,
      title: "Dossier sans fichier exploitable",
      detail: "Aucun document sûr n'a pu être conservé — impossible d'évaluer la complétude.",
    });
  }

  // R1 — sections OBLIGATOIRES manquantes : bloqueurs critiques.
  let requiredPresent = 0;
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
  let expectedPresent = 0;
  for (const code of req.expected) {
    if (covered(code, storable)) { expectedPresent++; continue; }
    findings.push({
      code: "MISSING_EXPECTED_SECTION", severity: "MAJOR", category: "completeness",
      sectionCode: code, title: `Section attendue manquante : ${code}`,
      detail: `La section CTD ${code} — ${titleFor(code)} est généralement attendue et semble absente.`,
    });
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

  const reqTotal = req.required.length;
  const expTotal = req.expected.length;
  const denom = reqTotal + 0.5 * expTotal;
  const completeness = denom > 0 ? Math.round((100 * (requiredPresent + 0.5 * expectedPresent)) / denom) : storable.length > 0 ? 100 : 0;

  return {
    findings,
    summary: {
      completeness,
      conforme: blockers === 0 && storable.length > 0, // pas de fausse conformité
      blockers, criticals, majors, minors,
      requiredPresent, requiredTotal: reqTotal, expectedPresent, expectedTotal: expTotal,
    },
  };
}
