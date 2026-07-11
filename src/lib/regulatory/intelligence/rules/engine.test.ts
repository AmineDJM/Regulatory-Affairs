import { describe, it, expect } from "vitest";
import { assessVersion, type TwinDoc } from "./engine";
import { requirementsFor } from "./requirements";

let uid = 0;
const doc = (section: string | null, over: Partial<TwinDoc> = {}): TwinDoc => ({
  id: `d${uid++}`,
  originalFilename: `${section ?? "x"}.pdf`,
  ctdSection: section,
  ctdModule: section ? (`M${section[0]}` as string) : null,
  securityStatus: "SAFE",
  extractionStatus: "TEXT_EXTRACTED",
  classificationMethod: section ? "code-path" : "none",
  ...over,
});

// Dossier « complet » = toutes les sections requises ET attendues (→ complétude 100 %).
const complete = (proc: "INITIAL_REGISTRATION") => {
  const r = requirementsFor(proc);
  return [...r.required, ...r.expected].map((c) => doc(c));
};

describe("assessVersion — moteur déterministe (pas de fausse conformité)", () => {
  it("dossier complet → conforme, complétude 100 %, aucun bloqueur", () => {
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: complete("INITIAL_REGISTRATION") });
    expect(r.summary.conforme).toBe(true);
    expect(r.summary.completeness).toBe(100);
    expect(r.summary.blockers).toBe(0);
    expect(r.findings.filter((f) => f.blocker)).toHaveLength(0);
  });

  it("une section OBLIGATOIRE manquante → bloqueur critique, NON conforme (le score ne sauve pas)", () => {
    const docs = complete("INITIAL_REGISTRATION").filter((d) => d.ctdSection !== "3.2.P.8");
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: docs });
    expect(r.summary.conforme).toBe(false);
    expect(r.summary.blockers).toBeGreaterThanOrEqual(1);
    expect(r.findings.some((f) => f.code === "MISSING_REQUIRED_SECTION" && f.sectionCode === "3.2.P.8" && f.blocker)).toBe(true);
    expect(r.summary.completeness).toBeLessThan(100);
  });

  it("dossier vide → EMPTY_DOSSIER (critique, bloqueur)", () => {
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: [] });
    expect(r.findings.some((f) => f.code === "EMPTY_DOSSIER" && f.blocker)).toBe(true);
    expect(r.summary.conforme).toBe(false);
  });

  it("une sous-section couvre sa section parente (3.2.P.8 couvre 3.2.P ; 3.2.S.4 couvre 3.2.S)", () => {
    const docs = complete("INITIAL_REGISTRATION")
      .filter((d) => d.ctdSection !== "3.2.P" && d.ctdSection !== "3.2.S")
      .concat(doc("3.2.P.8"), doc("3.2.S.4"));
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: docs });
    expect(r.findings.some((f) => f.sectionCode === "3.2.P")).toBe(false);
    expect(r.findings.some((f) => f.sectionCode === "3.2.S")).toBe(false);
  });

  it("fichier bloqué (exécutable) → MAJEUR (sécurité), NON bloquant pour la conformité", () => {
    const docs = complete("INITIAL_REGISTRATION").concat(
      doc(null, { securityStatus: "BLOCKED_EXECUTABLE", classificationMethod: null, extractionStatus: "UNSUPPORTED", originalFilename: "setup.exe" }),
    );
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: docs });
    expect(r.findings.some((f) => f.code === "SECURITY_BLOCKED_FILE" && f.severity === "MAJOR")).toBe(true);
    expect(r.summary.conforme).toBe(true); // toutes les sections obligatoires présentes → pas de bloqueur
  });

  it("fichier non classé → constat mineur de classification", () => {
    const docs = complete("INITIAL_REGISTRATION").concat(doc(null, { originalFilename: "divers.pdf" }));
    const r = assessVersion({ procedureType: "INITIAL_REGISTRATION", documents: docs });
    expect(r.findings.some((f) => f.code === "UNCLASSIFIED_FILES")).toBe(true);
  });

  it("générique : bioéquivalence (5.3) obligatoire — absente → bloqueur", () => {
    const r = assessVersion({ procedureType: "GENERIC", documents: complete("INITIAL_REGISTRATION") });
    expect(r.findings.some((f) => f.code === "MISSING_REQUIRED_SECTION" && f.sectionCode === "5.3")).toBe(true);
    expect(r.summary.conforme).toBe(false);
  });
});
