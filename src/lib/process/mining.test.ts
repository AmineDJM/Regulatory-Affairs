import { describe, expect, it } from "vitest";
import {
  analyzeCircuit, CORRECTION_STEP, formatJours, lenteur, median, motifLePlusFrequent, percentile, responseTimesByActor, segmentsOf,
  type MiningCase, type MiningEvent,
} from "./mining";

const J = 86_400_000;
const T0 = new Date("2026-09-01T08:00:00Z");
const at = (d: number) => new Date(T0.getTime() + d * J);
const ev = (d: number, step: string, kind: MiningEvent["kind"], extra: Partial<MiningEvent> = {}): MiningEvent => ({ at: at(d), step, stepLabel: step.toUpperCase(), kind, ...extra });

function dossier(id: string, events: MiningEvent[], fin: number | null, extra: Partial<MiningCase> = {}): MiningCase {
  return { id, circuit: "WF:TEST", label: `Dossier ${id}`, href: `/x/${id}`, startedAt: at(0), endedAt: fin === null ? null : at(fin), events, ...extra };
}

describe("segmentsOf — le temps réellement passé à chaque étape", () => {
  it("attribue à chaque étape le temps écoulé depuis le mouvement précédent", () => {
    const c = dossier("a", [ev(2, "n1", "advance"), ev(5, "dg", "advance"), ev(6, "final", "end")], 6);
    const { segments, waiting, returned } = segmentsOf(c, at(10));
    expect(segments.map((s) => [s.step, s.days])).toEqual([["n1", 2], ["dg", 3], ["final", 1]]);
    expect(waiting).toBeNull();
    expect(returned).toBe(false);
  });

  it("un commentaire ne remet PAS le compteur à zéro (le défaut de l'ancien « updatedAt »)", () => {
    const c = dossier("b", [ev(1, "n1", "other"), ev(3, "n1", "other"), ev(4, "n1", "advance")], null, { currentStep: "dg", currentStepLabel: "DG" });
    const { segments, waiting } = segmentsOf(c, at(9));
    expect(segments).toHaveLength(1);
    expect(segments[0].days).toBe(4);
    expect(waiting).toMatchObject({ step: "dg", label: "DG", days: 5 });
  });

  it("l'événement « start » recale le départ ; un dossier ouvert attend depuis le dernier mouvement", () => {
    const c = dossier("c", [ev(1, "x", "start"), ev(3, "n1", "advance")], null, { currentStep: "n2" });
    const { segments, waiting } = segmentsOf(c, at(7));
    expect(segments[0].days).toBe(2);
    expect(waiting?.days).toBe(4);
  });

  it("un renvoi ouvre « Correction (demandeur) », fermée par la resoumission, et compte comme retour", () => {
    const c = dossier("d", [
      ev(1, "n1", "advance"),
      ev(3, "dg", "return", { note: "Liste des médecins incomplète" }),
      ev(6, "dg", "resubmit"),
      ev(7, "dg", "advance"),
    ], 7);
    const { segments, returned, returnNotes } = segmentsOf(c, at(8));
    expect(segments.map((s) => [s.step, s.days])).toEqual([["n1", 1], ["dg", 2], [CORRECTION_STEP, 3], ["dg", 1]]);
    expect(returned).toBe(true);
    expect(returnNotes).toEqual(["Liste des médecins incomplète"]);
  });

  it("un dossier renvoyé et pas encore resoumis attend chez le demandeur", () => {
    const c = dossier("e", [ev(2, "n1", "return", { note: "pièce manquante" })], null, { currentStep: "n1" });
    expect(segmentsOf(c, at(5)).waiting).toMatchObject({ step: CORRECTION_STEP, days: 3 });
  });

  it("revenir à une étape déjà franchie (journal de statuts) est un retour en arrière", () => {
    const c = dossier("f", [ev(1, "PENDING", "advance"), ev(2, "APPROVED", "advance"), ev(4, "PENDING", "advance")], null);
    expect(segmentsOf(c, at(5)).returned).toBe(true);
  });

  it("les événements sont relus dans l'ordre chronologique, quel que soit l'ordre reçu", () => {
    const c = dossier("g", [ev(5, "dg", "advance"), ev(2, "n1", "advance")], 5);
    expect(segmentsOf(c).segments.map((s) => s.step)).toEqual(["n1", "dg"]);
  });
});

describe("percentile / médiane", () => {
  it("interpole et rend null sur une série vide", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    expect(percentile([5], 0.9)).toBe(5);
  });
});

describe("analyzeCircuit — les chiffres d'un circuit", () => {
  const since = at(-30);
  const cases: MiningCase[] = [
    dossier("1", [ev(1, "n1", "advance", { actor: "Brahim" }), ev(9, "devis", "advance", { actor: "Nadia" }), ev(10, "final", "end", { actor: "Brahim" })], 10),
    dossier("2", [ev(1, "n1", "advance", { actor: "Brahim" }), ev(7, "devis", "advance", { actor: "Nadia" }), ev(8, "final", "end", { actor: "Brahim" })], 8),
    dossier("3", [ev(2, "n1", "advance", { actor: "Brahim" }), ev(3, "devis", "return", { actor: "Nadia", note: "Devis illisible" }), ev(4, "devis", "resubmit"), ev(12, "devis", "advance", { actor: "Nadia" }), ev(13, "final", "end", { actor: "Brahim" })], 13),
    dossier("4", [ev(1, "n1", "advance", { actor: "Brahim" })], null, { currentStep: "devis", currentStepLabel: "DEVIS" }),
    dossier("5", [], null, { currentStep: "n1", currentStepLabel: "N1" }),
  ];

  it("compte, médiane, 9 sur 10, étape la plus lente, renvois, bloqués", () => {
    const s = analyzeCircuit("WF:TEST", "Test", cases, { since, now: at(20), stuckDays: 14, minClosedForP90: 3 });
    expect(s.cases).toBe(5);
    expect(s.closed).toBe(3);
    expect(s.medianDays).toBe(10);
    expect(s.p90Days).toBeCloseTo(12.4);
    expect(s.slowest?.step).toBe("devis");
    // « devis » : 8, 6, 1 (avant renvoi), 8 → médiane 7.
    expect(s.slowest?.medianDays).toBe(7);
    expect(s.returnRate).toBeCloseTo(1 / 4); // 4 dossiers ont une histoire, 1 est revenu
    expect(s.topReturnReason).toBe("Devis illisible");
    // Dossier 4 : à « devis » depuis le jour 1 → 19 j > 14 ; dossier 5 : ouvert depuis 20 j.
    expect(s.stuck.map((x) => x.id)).toEqual(["5", "4"]);
    expect(s.steps.map((x) => x.step)).toEqual(["n1", "devis", CORRECTION_STEP, "final"]);
  });

  it("le délai fixé pour une étape remplace la limite par défaut", () => {
    const sla = new Map([["devis", 30], ["n1", 5]]);
    const s = analyzeCircuit("WF:TEST", "Test", cases, { since, now: at(20), stuckDays: 14, sla });
    expect(s.stuck.map((x) => [x.id, x.sla, x.limitDays])).toEqual([["5", true, 5]]);
    expect(s.steps.find((x) => x.step === "devis")?.slaDays).toBe(30);
  });

  it("« 9 sur 10 » n'est pas affiché sous le minimum de dossiers clos", () => {
    expect(analyzeCircuit("WF:TEST", "Test", cases, { since, now: at(20) }).p90Days).toBeNull();
  });

  it("un dossier clos avant la période n'est pas compté", () => {
    const vieux = dossier("v", [ev(1, "n1", "end")], 1, { startedAt: at(-100), endedAt: at(-90) });
    expect(analyzeCircuit("WF:TEST", "Test", [vieux], { since, now: at(20) }).cases).toBe(0);
  });

  it("« Ce que ça dit » : part de l'étape lente, renvois avec motif, contrepartie lente", () => {
    const s = analyzeCircuit("WF:TEST", "Test", cases, { since, now: at(20), minClosedForP90: 3 });
    expect(s.insights.length).toBeGreaterThan(0);
    expect(s.insights.length).toBeLessThanOrEqual(3);
    expect(s.insights[0].title).toMatch(/« DEVIS » prend \d+ % du temps/);
    expect(s.insights.some((i) => i.detail.includes("Devis illisible"))).toBe(true);
    expect(s.insights.some((i) => i.title.startsWith("Nadia répond en"))).toBe(true);
  });
});

describe("responseTimesByActor", () => {
  it("chaque segment fermé par une personne est une réponse (la correction n'en est pas une)", () => {
    const c = dossier("r", [ev(1, "n1", "advance", { actor: "A" }), ev(2, "dg", "return", { actor: "B" }), ev(5, "dg", "resubmit", { actor: "Demandeur" }), ev(6, "dg", "advance", { actor: "B" })], 6);
    const m = responseTimesByActor([c], at(-1), at(10));
    expect(m.get("A")).toEqual([1]);
    expect(m.get("B")).toEqual([1, 1]);
    expect(m.has("Demandeur")).toBe(false);
  });
});

describe("motifs, formats, lenteur", () => {
  it("le motif le plus fréquent ignore la casse et la ponctuation finale", () => {
    expect(motifLePlusFrequent(["Pièce manquante.", "pièce manquante", "Autre"])).toBe("pièce manquante");
    expect(motifLePlusFrequent([" ", ""])).toBeNull();
  });
  it("formatJours", () => {
    expect(formatJours(null)).toBe("—");
    expect(formatJours(0.25)).toBe("6 h");
    expect(formatJours(4.84)).toBe("4,8 j");
    expect(formatJours(11.4)).toBe("11 j");
  });
  it("lenteur relative, et toujours « lent » au-delà du délai fixé", () => {
    expect(lenteur(9, 9)).toBe("lent");
    expect(lenteur(3.6, 9)).toBe("moyen");
    expect(lenteur(1, 9)).toBe("normal");
    expect(lenteur(2, 9, 1)).toBe("lent");
  });
});
