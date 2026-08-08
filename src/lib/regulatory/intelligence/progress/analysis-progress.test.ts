import { describe, it, expect } from "vitest";
import { computeAnalysisProgress, formatEta, type AnalysisProgressInput } from "./analysis-progress";

/**
 * La barre de progression est ce que le pharmacien REGARDE pendant qu'il attend. Elle doit être
 * honnête (jamais 100 % avant la fin, jamais figée à 0 % en pleine lecture), monotone dans les
 * grandes lignes, et donner un temps restant crédible. Ces tests figent ces promesses.
 */
const base: AnalysisProgressInput = {
  dossierStatus: "ANALYSING",
  docsTotal: 100, docsResolved: 0, docsPending: 100,
  ocrTotal: 0, ocrDone: 0,
  factsDone: false, rulesDone: false,
  aiInPipeline: true, aiReviewDone: false, aiBatchPending: false,
  startedAtMs: 0, nowMs: 60_000,
};

describe("computeAnalysisProgress — pourcentage honnête", () => {
  it("ne montre jamais 0 % ni 100 % en pleine lecture", () => {
    const p = computeAnalysisProgress({ ...base, docsResolved: 50, docsPending: 50 });
    expect(p.percent).toBeGreaterThan(1);
    expect(p.percent).toBeLessThan(100);
    expect(p.complete).toBe(false);
  });

  it("progresse quand des fichiers de plus sont lus", () => {
    const a = computeAnalysisProgress({ ...base, docsResolved: 20, docsPending: 80 });
    const b = computeAnalysisProgress({ ...base, docsResolved: 70, docsPending: 30 });
    expect(b.percent).toBeGreaterThan(a.percent);
  });

  it("la phase courante est la lecture des fichiers tant qu'il reste des fichiers", () => {
    const p = computeAnalysisProgress({ ...base, docsResolved: 30, docsPending: 70 });
    expect(p.phaseKey).toBe("EXTRACTION");
    expect(p.phases.find((x) => x.key === "EXTRACTION")?.detail).toBe("30 / 100 fichiers lus");
  });

  it("atteint 100 % seulement quand règles ET revue IA sont finies", () => {
    const p = computeAnalysisProgress({
      ...base, docsResolved: 100, docsPending: 0, factsDone: true, rulesDone: true,
      aiReviewDone: true, dossierStatus: "IN_REVIEW",
    });
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.phaseKey).toBe("DONE");
  });
});

describe("computeAnalysisProgress — phases sautées", () => {
  it("sans scan, la phase OCR n'apparaît pas", () => {
    const p = computeAnalysisProgress({ ...base, ocrTotal: 0 });
    expect(p.phases.find((x) => x.key === "OCR")).toBeUndefined();
  });

  it("avec des scans, la phase OCR apparaît et compte son avancement", () => {
    const p = computeAnalysisProgress({ ...base, docsResolved: 100, docsPending: 0, ocrTotal: 10, ocrDone: 4, factsDone: false });
    const ocr = p.phases.find((x) => x.key === "OCR");
    expect(ocr).toBeDefined();
    expect(ocr?.detail).toBe("4 / 10 scans reconnus");
  });

  it("sans clé IA, la revue IA n'est pas attendue — 100 % dès les contrôles finis", () => {
    const p = computeAnalysisProgress({
      ...base, docsResolved: 100, docsPending: 0, factsDone: true, rulesDone: true,
      aiInPipeline: false, dossierStatus: "IN_REVIEW",
    });
    expect(p.phases.find((x) => x.key === "AI_REVIEW")).toBeUndefined();
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });
});

describe("computeAnalysisProgress — revue différée", () => {
  it("signale l'attente du lot différé sans bloquer à un faux 100 %", () => {
    const p = computeAnalysisProgress({
      ...base, docsResolved: 100, docsPending: 0, factsDone: true, rulesDone: true,
      aiBatchPending: true, dossierStatus: "IN_REVIEW",
    });
    expect(p.awaitingDeferred).toBe(true);
    expect(p.complete).toBe(false);
    expect(p.percent).toBeLessThan(100);
    expect(p.etaSeconds).toBeNull(); // « sous 24 h » se dit en texte, pas en compte à rebours
  });
});

describe("ETA", () => {
  it("projette un temps restant depuis le débit de lecture réel", () => {
    // 20 fichiers lus en 60 s → 3 s/fichier ; 80 restants → ~240 s + forfait.
    const p = computeAnalysisProgress({ ...base, docsResolved: 20, docsPending: 80, startedAtMs: 0, nowMs: 60_000 });
    expect(p.etaSeconds).not.toBeNull();
    expect(p.etaSeconds!).toBeGreaterThan(200);
    expect(p.etaSeconds!).toBeLessThan(400);
  });

  it("plus on avance, plus l'ETA se réduit", () => {
    const early = computeAnalysisProgress({ ...base, docsResolved: 10, docsPending: 90, nowMs: 30_000 });
    const late = computeAnalysisProgress({ ...base, docsResolved: 90, docsPending: 10, nowMs: 270_000 });
    expect(late.etaSeconds!).toBeLessThan(early.etaSeconds!);
  });
});

describe("formatEta — lisible sans conversion mentale", () => {
  it("rend un texte humain", () => {
    expect(formatEta(null)).toBeNull();
    expect(formatEta(8)).toBe("quelques secondes");
    expect(formatEta(240)).toBe("~4 min");
    expect(formatEta(4200)).toBe("~1 h 10 min");
    expect(formatEta(7200)).toBe("~2 h");
  });
});
