import { describe, it, expect } from "vitest";
import { rankCaseDocs, OUTCOME_LABELS } from "./for-section";

/**
 * Le rang des précédents est une décision MÉTIER : injecter le mauvais précédent dans le prompt,
 * c'est apprendre à l'analyseur la mauvaise leçon. On fige donc les priorités par des tests.
 */
const base = { sections: [] as string[], hasLesson: false, createdAt: new Date("2026-01-01") };
const doc = (over: Partial<Parameters<typeof rankCaseDocs>[0][number]> & { id: string }) => ({
  ...base, ctdSection: null, outcome: "UNKNOWN" as const, ...over,
});

describe("rankCaseDocs", () => {
  it("la correspondance de section exacte prime tout le reste", () => {
    const r = rankCaseDocs([
      doc({ id: "prefix", ctdSection: "3.2.P", outcome: "REJECTED" }),
      doc({ id: "exact", ctdSection: "3.2.P.8", outcome: "UNKNOWN" }),
    ], "3.2.P.8");
    expect(r.map((d) => d.id)).toEqual(["exact", "prefix"]);
  });

  it("à correspondance égale, l'issue qui porte une leçon (réserves/rejet) passe devant", () => {
    const r = rankCaseDocs([
      doc({ id: "ok", ctdSection: "3.2.P.8", outcome: "ACCEPTED" }),
      doc({ id: "reserves", ctdSection: "3.2.P.8", outcome: "ACCEPTED_WITH_RESERVES" }),
    ], "3.2.P.8");
    expect(r[0].id).toBe("reserves");
  });

  it("un document sans AUCUN lien avec la section est écarté — jamais de précédent hors sujet", () => {
    const r = rankCaseDocs([doc({ id: "clinique", ctdSection: "5.3.1" })], "3.2.P.8");
    expect(r).toHaveLength(0);
  });

  it("les sections DÉTECTÉES dans un PDF consolidé comptent aussi", () => {
    const r = rankCaseDocs([doc({ id: "consolide", ctdSection: "2.3", sections: ["3.2.P.8", "3.2.S"] })], "3.2.P.8");
    expect(r.map((d) => d.id)).toEqual(["consolide"]);
  });

  it("sans section demandée, tout est éligible (tri par issue puis récence)", () => {
    const r = rankCaseDocs([
      doc({ id: "vieux", outcome: "REJECTED", createdAt: new Date("2025-01-01") }),
      doc({ id: "recent", outcome: "REJECTED", createdAt: new Date("2026-06-01") }),
    ], null);
    expect(r.map((d) => d.id)).toEqual(["recent", "vieux"]);
  });

  it("chaque issue a un libellé français", () => {
    for (const label of Object.values(OUTCOME_LABELS)) expect(label.length).toBeGreaterThan(3);
  });
});
