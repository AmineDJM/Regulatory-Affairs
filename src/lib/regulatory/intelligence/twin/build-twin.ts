import type { RegProcedureType } from "@prisma/client";
import { requirementsFor } from "../rules/requirements";
import { sectionByCode, CTD_SECTIONS, type CtdModule } from "../ctd/taxonomy";

/**
 * JUMEAU NUMÉRIQUE (vue) — Phase 4. Représentation structurée du dossier pour l'UI :
 *  - COUVERTURE CTD : pour la procédure, quelles sections requises/attendues sont présentes ;
 *  - REGROUPEMENT par module des documents réellement classés.
 * Déterministe, pur (ne touche pas la base).
 */

export interface CoverageRow {
  code: string;
  title: string;
  module: string;
  kind: "required" | "expected";
  present: boolean;
  docCount: number;
}

export interface TwinDocLite {
  id: string;
  originalFilename: string;
  ctdSection: string | null;
  ctdModule: string | null;
}

function coveredBy(code: string, docs: TwinDocLite[]): TwinDocLite[] {
  return docs.filter((d) => d.ctdSection && (d.ctdSection === code || d.ctdSection.startsWith(`${code}.`)));
}

export function buildCoverage(procedureType: RegProcedureType, docs: TwinDocLite[]): CoverageRow[] {
  const req = requirementsFor(procedureType);
  const row = (code: string, kind: "required" | "expected"): CoverageRow => {
    const hits = coveredBy(code, docs);
    const sec = sectionByCode(code);
    return { code, title: sec?.title ?? code, module: sec?.module ?? "—", kind, present: hits.length > 0, docCount: hits.length };
  };
  return [...req.required.map((c) => row(c, "required")), ...req.expected.map((c) => row(c, "expected"))];
}

export interface TwinModuleGroup {
  module: CtdModule;
  title: string;
  documents: TwinDocLite[];
}

/** Documents regroupés par module CTD (M1→M5) + non classés. */
export function groupByModule(docs: TwinDocLite[]): { modules: TwinModuleGroup[]; unclassified: TwinDocLite[] } {
  const modules: TwinModuleGroup[] = (["M1", "M2", "M3", "M4", "M5"] as CtdModule[]).map((m) => ({
    module: m,
    title: `Module ${m.slice(1)}`,
    documents: docs.filter((d) => d.ctdModule === m),
  })).filter((g) => g.documents.length > 0);
  const unclassified = docs.filter((d) => !d.ctdModule);
  return { modules, unclassified };
}

export const ALL_CTD_CODES = CTD_SECTIONS.map((s) => s.code);
