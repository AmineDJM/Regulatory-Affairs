import { describe, it, expect } from "vitest";
import {
  evaluateTurn, turnLatency, aggregateTurns, VOICE_SLO, VOICE_STAGES,
  type VoiceTurnDraft,
} from "./turn-metrics";

/**
 * CE BANC VÉRIFIE UNE SEULE CHOSE, MAIS C'EST LA PLUS IMPORTANTE : que la mesure DÉSIGNE LE BON
 * COUPABLE.
 *
 * Un tableau de bord qui se trompe d'étage est pire qu'aucun tableau de bord : il envoie régler
 * la VAD pendant qu'un micro sature. Les cas ci-dessous sont donc surtout des cas de CONFUSION —
 * une panne d'audio qui produit aussi une transcription vide et un outil absent doit être imputée
 * à l'audio, une fois, et pas trois.
 */

const base = (over: Partial<VoiceTurnDraft> = {}): VoiceTurnDraft => ({
  turnId: "t1", sessionId: "s1",
  speechStartedAt: 0, speechStoppedAt: 1_000,
  inputPeak: 0.4, clipped: false, partialCount: 4,
  transcriptAt: 1_300, transcript: "des mails aujourd'hui", transcriptConfidence: 0.93,
  turnConfirmedAt: 1_050,
  intentAt: 1_380, intentKind: "GMAIL_INBOX", fastPath: true,
  toolName: "gmail_search", toolStartedAt: 1_450, toolEndedAt: 1_900, toolOk: true,
  resultReadyAt: 1_950, audioOutStartedAt: 2_100, deliveredAt: 2_100,
  spokenChars: 38,
  ...over,
});

describe("les segments de latence", () => {
  it("découpe le tour en cinq temps mesurables + la première réponse", () => {
    const l = turnLatency(base());
    expect(l.speechMs).toBe(1_000);
    expect(l.transcriptMs).toBe(300);
    expect(l.intentMs).toBe(80);
    expect(l.toolStartMs).toBe(70);
    expect(l.toolMs).toBe(450);
    expect(l.speakMs).toBe(150);
    // LE chiffre de la mission : fin de parole → premier son de réponse.
    expect(l.firstResponseMs).toBe(1_100);
  });

  it("rend null plutôt que zéro quand un jalon manque — un trou n'est pas un instant", () => {
    const l = turnLatency({ turnId: "t", sessionId: "s" });
    expect(l.transcriptMs).toBeNull();
    expect(l.firstResponseMs).toBeNull();
  });
});

describe("un bon tour est reconnu comme bon", () => {
  it("§16 : entendu, compris, bonne source, restitué seul, sans bavardage", () => {
    const v = evaluateTurn(base());
    expect(v.ok).toBe(true);
    expect(v.failedStage).toBeNull();
    expect(v.slowLegs).toEqual([]);
  });

  it("la cible de première réponse rapide de la mission (≤ 1,5 s) est bien celle appliquée", () => {
    expect(VOICE_SLO.firstResponseFastMs.max).toBeLessThanOrEqual(1_500);
    // Fin de parole à 1 000 ms : une première réponse à 2 400 ms fait 1,4 s — DANS le budget.
    expect(evaluateTurn(base({ audioOutStartedAt: 2_400, deliveredAt: 2_400 })).slowLegs.join(" ")).not.toMatch(/première réponse/);
    // À 2 700 ms elle fait 1,7 s — la conversation a décroché.
    expect(evaluateTurn(base({ audioOutStartedAt: 2_700, deliveredAt: 2_700 })).slowLegs.join(" ")).toMatch(/première réponse/);
  });
});

/**
 * L'ATTRIBUTION ORDONNÉE — le cœur du module. Chaque cas casse UN étage et vérifie qu'aucun étage
 * postérieur ne se fait accuser à sa place.
 */
describe("attribution : le premier étage cassé, et lui seul", () => {
  it("AUDIO — micro au plancher : ni la transcription ni l'outil ne sont accusés", () => {
    const v = evaluateTurn(base({ inputPeak: 0.005, transcript: "", intentKind: null, toolName: null, resultReadyAt: undefined, deliveredAt: undefined }));
    expect(v.failedStage).toBe("AUDIO");
    expect(v.reasons[0]).toMatch(/plancher/);
  });

  it("AUDIO — saturation : accusée MÊME quand une transcription arrive", () => {
    // C'est le cas piège : le micro écrête, les mots sortent quand même — mais faux. Un tableau
    // qui ne regarde que « y a-t-il un texte ? » déclarerait ce tour parfait.
    const v = evaluateTurn(base({ clipped: true, transcript: "efface les mails" }));
    expect(v.failedStage).toBe("AUDIO");
    expect(v.ok).toBe(false);
  });

  it("AUDIO — un claquement de porte n'est pas un tour de parole", () => {
    expect(evaluateTurn(base({ speechStartedAt: 0, speechStoppedAt: 90 })).failedStage).toBe("AUDIO");
  });

  it("TRANSCRIPTION — signal bon, texte absent", () => {
    const v = evaluateTurn(base({ transcript: "", intentKind: null }));
    expect(v.failedStage).toBe("TRANSCRIPTION");
  });

  it("TRANSCRIPTION — confiance sous le plancher", () => {
    const v = evaluateTurn(base({ transcriptConfidence: 0.31 }));
    expect(v.failedStage).toBe("TRANSCRIPTION");
    expect(v.reasons[0]).toMatch(/Confiance faible/);
  });

  it("TURN_DETECTION — le PDG reprend la parole aussitôt : on l'a coupé", () => {
    const v = evaluateTurn(base({ followedByImmediateSpeech: true }));
    expect(v.failedStage).toBe("TURN_DETECTION");
  });

  it("INTENT — la phrase est juste, aucune intention retenue", () => {
    const v = evaluateTurn(base({ intentKind: null }));
    expect(v.failedStage).toBe("INTENT");
  });

  it("TOOL — l'intention est juste, l'outil échoue", () => {
    const v = evaluateTurn(base({ toolOk: false, toolError: "gmail 401" }));
    expect(v.failedStage).toBe("TOOL");
    expect(v.reasons[0]).toMatch(/gmail 401/);
  });

  it("DELIVERY — le résultat existait et n'est jamais sorti", () => {
    // Le défaut fondateur de §10 : tout est vert en amont, et le PDG n'entend rien.
    const v = evaluateTurn(base({ deliveredAt: undefined, audioOutStartedAt: undefined }));
    expect(v.failedStage).toBe("DELIVERY");
    expect(v.reasons[0]).toMatch(/jamais restitué/);
  });

  it("DELIVERY — « Alors ? » est par construction un échec de restitution", () => {
    const v = evaluateTurn(base({ nudged: true }));
    expect(v.failedStage).toBe("DELIVERY");
    expect(v.ok).toBe(false);
  });

  it("une panne d'audio ne compte qu'UNE fois, à l'audio", () => {
    // Sans l'arrêt au premier étage, ce tour serait imputé à AUDIO, TRANSCRIPTION, INTENT et
    // DELIVERY à la fois — et le tableau désignerait toujours le dernier maillon.
    const v = evaluateTurn(base({
      inputPeak: 0.001, transcript: "", transcriptConfidence: 0.1,
      intentKind: null, toolName: null, toolOk: false,
      resultReadyAt: 1_950, deliveredAt: undefined,
    }));
    expect(v.failedStage).toBe("AUDIO");
    const attributions = VOICE_STAGES.filter((s) => s === v.failedStage);
    expect(attributions).toHaveLength(1);
  });
});

describe("les budgets de temps (§12)", () => {
  it("un tour juste mais lent n'est PAS un succès", () => {
    const v = evaluateTurn(base({ toolEndedAt: 6_000, resultReadyAt: 6_100, audioOutStartedAt: 6_300, deliveredAt: 6_300 }));
    expect(v.failedStage).toBeNull();   // rien n'est cassé…
    expect(v.ok).toBe(false);           // …et pourtant le PDG a attendu.
    expect(v.slowLegs.length).toBeGreaterThan(0);
  });

  it("une question complexe a droit à plus de temps qu'une forme rapide", () => {
    const lent = { toolEndedAt: 3_000, resultReadyAt: 3_050, audioOutStartedAt: 3_200, deliveredAt: 3_200 };
    expect(evaluateTurn(base({ ...lent, fastPath: true })).slowLegs.join(" ")).toMatch(/première réponse/);
    expect(evaluateTurn(base({ ...lent, fastPath: false })).slowLegs.join(" ")).not.toMatch(/première réponse/);
  });
});

describe("§11 parler moins", () => {
  it("un monologue sur une question simple est un défaut", () => {
    const v = evaluateTurn(base({ spokenChars: 900 }));
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/bavarde/);
  });

  it("mais une réponse longue à une demande complexe ne l'est pas", () => {
    expect(evaluateTurn(base({ spokenChars: 900, fastPath: false })).reasons.join(" ")).not.toMatch(/bavarde/);
  });
});

describe("le tour abandonné", () => {
  it("s'enregistre au lieu de disparaître", () => {
    const v = evaluateTurn(base({ aborted: true, abortReason: "WebRTC coupé" }));
    expect(v.ok).toBe(false);
    expect(v.reasons[0]).toMatch(/WebRTC coupé/);
  });
});

describe("l'agrégat — ce que publie le rapport avant/après", () => {
  const turns: VoiceTurnDraft[] = [
    base(),
    base({ turnId: "t2" }),
    base({ turnId: "t3", inputPeak: 0.001, transcript: "" }),
    base({ turnId: "t4", nudged: true }),
    base({ turnId: "t5", toolOk: false, toolError: "timeout" }),
  ];

  it("compte les succès du point de vue du PDG, pas des outils", () => {
    const a = aggregateTurns(turns);
    expect(a.turns).toBe(5);
    expect(a.successRate).toBeCloseTo(2 / 5, 5);
  });

  it("range les pannes par étage — le tableau qui dit sur quoi travailler", () => {
    const a = aggregateTurns(turns);
    expect(a.failuresByStage.AUDIO).toBe(1);
    expect(a.failuresByStage.TOOL).toBe(1);
    expect(a.failuresByStage.DELIVERY).toBe(1);
    expect(a.failuresByStage.TURN_DETECTION).toBe(0);
  });

  it("rapporte la restitution aux résultats PRÊTS, pas au nombre de tours", () => {
    // Rapporter au total donnerait un taux flatteur : les tours sans résultat compteraient
    // comme des livraisons réussies.
    const a = aggregateTurns([
      base({ turnId: "a", resultReadyAt: 100, deliveredAt: 200 }),
      base({ turnId: "b", resultReadyAt: 100, deliveredAt: undefined }),
      base({ turnId: "c", resultReadyAt: undefined, deliveredAt: undefined }),
    ]);
    expect(a.deliveryRate).toBeCloseTo(1 / 2, 5);
  });

  it("donne p50 et p95 par segment", () => {
    const a = aggregateTurns(turns);
    expect(a.p50.firstResponseMs).toBeGreaterThan(0);
    expect(a.p95.firstResponseMs).toBeGreaterThanOrEqual(a.p50.firstResponseMs!);
  });

  it("mesure le taux de forme rapide, de fausse interruption et de relance", () => {
    const a = aggregateTurns([base({ falseBargeIns: 2 }), base({ turnId: "x", fastPath: false })]);
    expect(a.fastPathRate).toBeCloseTo(0.5, 5);
    expect(a.falseBargeInRate).toBeCloseTo(1, 5);
    expect(a.nudgeRate).toBe(0);
  });

  it("ne divise jamais par zéro sur un échantillon vide", () => {
    const a = aggregateTurns([]);
    expect(a.turns).toBe(0);
    expect(a.successRate).toBe(0);
    expect(a.deliveryRate).toBe(1);
    expect(a.medianSpokenChars).toBeNull();
  });
});
