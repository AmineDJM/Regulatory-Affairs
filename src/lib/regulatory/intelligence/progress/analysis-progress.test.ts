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
  aiJobActive: false, aiFailed: false, aiDocsReviewed: 0, aiDocsTotal: 0, aiStartedAtMs: null,
  startedAtMs: 0, nowMs: 60_000,
};

/** Tout le déterministe est fini ; seule la revue de fond reste. */
const afterRules: AnalysisProgressInput = {
  ...base, docsResolved: 100, docsPending: 0, factsDone: true, rulesDone: true, dossierStatus: "IN_REVIEW",
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
    const p = computeAnalysisProgress({ ...afterRules, aiBatchPending: true });
    expect(p.awaitingDeferred).toBe(true);
    expect(p.complete).toBe(false);
    expect(p.percent).toBeLessThan(100);
    expect(p.etaSeconds).toBeNull(); // « sous 24 h » se dit en texte, pas en compte à rebours
  });
});

/**
 * BUG VÉCU : la barre restait figée à 87 % en affichant « différé, sous 24 h » alors qu'une revue
 * IMMÉDIATE tournait — un vieux lot fantôme suffisait à faire mentir l'écran, sans temps restant.
 */
describe("revue de fond en cours (voie immédiate)", () => {
  const running: AnalysisProgressInput = {
    ...afterRules, aiJobActive: true, aiBatchPending: false,
    aiDocsTotal: 100, aiDocsReviewed: 40, aiStartedAtMs: 0, nowMs: 200_000,
  };

  it("ne dit JAMAIS « différé » quand une revue immédiate travaille", () => {
    expect(running.aiBatchPending).toBe(false);
    const p = computeAnalysisProgress(running);
    expect(p.awaitingDeferred).toBe(false);
    expect(p.phases.find((x) => x.key === "AI_REVIEW")?.detail).toBe("40 / 100 fichiers relus en profondeur");
  });

  it("la barre AVANCE avec les fichiers relus au lieu de rester figée", () => {
    const early = computeAnalysisProgress({ ...running, aiDocsReviewed: 5 });
    const late = computeAnalysisProgress({ ...running, aiDocsReviewed: 80 });
    expect(late.percent).toBeGreaterThan(early.percent);
    expect(late.percent).toBeLessThan(100); // toujours pas fini tant que le job n'est pas DONE
  });

  it("donne un temps restant pendant la revue de fond (c'est la phase la plus longue)", () => {
    // 40 fichiers en 200 s → 5 s/fichier ; 60 restants → ~300 s.
    const p = computeAnalysisProgress(running);
    expect(p.etaSeconds).not.toBeNull();
    expect(p.etaSeconds!).toBeGreaterThan(250);
    expect(p.etaSeconds!).toBeLessThan(350);
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

describe("revue de fond en ÉCHEC — la barre ne recule pas et l'écran ne ment pas", () => {
  /**
   * Cas réel : la revue avait relu 87 % des fichiers (98 % global), puis a échoué. La phase
   * retombait alors à zéro — 98 % → 85 % — et le dossier restait « en revue » indéfiniment.
   * Un échec est un ABOUTISSEMENT : il solde la phase, il ne la rembobine pas.
   */
  const nearlyDone: AnalysisProgressInput = {
    ...afterRules, aiJobActive: true, aiDocsTotal: 100, aiDocsReviewed: 87,
  };

  it("le pourcentage ne redescend jamais quand la revue échoue", () => {
    const before = computeAnalysisProgress(nearlyDone);
    const after = computeAnalysisProgress({ ...nearlyDone, aiJobActive: false, aiDocsReviewed: 0, aiDocsTotal: 0, aiFailed: true });
    expect(before.percent).toBeGreaterThanOrEqual(95); // la revue était presque au bout
    expect(after.percent).toBeGreaterThanOrEqual(before.percent); // …et surtout : plus jamais en arrière
    expect(after.percent).toBe(100); // plus rien à attendre de la machine
  });

  it("l'étape est marquée en ÉCHEC, pas « faite », et le dit en clair", () => {
    const p = computeAnalysisProgress({ ...afterRules, aiFailed: true });
    const ai = p.phases.find((x) => x.key === "AI_REVIEW")!;
    expect(ai.state).toBe("failed");
    expect(ai.detail).toContain("IMPOSSIBLE");
    expect(p.complete).toBe(true); // l'analyse est terminée — incomplète, mais terminée
  });

  it("une revue RÉUSSIE reste marquée faite (l'échec ne contamine pas le cas normal)", () => {
    const p = computeAnalysisProgress({ ...afterRules, aiReviewDone: true });
    expect(p.phases.find((x) => x.key === "AI_REVIEW")!.state).toBe("done");
    expect(p.percent).toBe(100);
  });
});
