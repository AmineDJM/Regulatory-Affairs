import { describe, expect, it } from "vitest";
import { bargeInDecision, isNoiseTranscript, buildTurnDetection, BARGE_IN_SUSTAIN_MS, BARGE_IN_NOISE_MS } from "./voice-tuning";

/**
 * GOLDEN RÉGRESSION — FAILURE D (voix) : la réponse se coupait sur un clavier, une toux, une
 * porte — de faux « (intervention vocale) » en cascade. La politique est désormais un BARGE-IN
 * CONFIRMÉ, déterministe et testé : LOW FALSE INTERRUPTION + FAST TRUE INTERRUPTION.
 */

describe("bargeInDecision — le bruit ne coupe pas, la parole coupe vite", () => {
  it("GOLDEN FAUX BARGE-IN : toux / clic / porte (signal bref, aucun mot) → la réponse CONTINUE", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 120, hasTranscriptEvidence: false, speechStopped: true })).toBe("ignore");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_NOISE_MS - 1, hasTranscriptEvidence: false, speechStopped: true })).toBe("ignore");
  });

  it("GOLDEN VRAIE INTERRUPTION : « Stop. » — des mots transcrits coupent IMMÉDIATEMENT", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 80, hasTranscriptEvidence: true, speechStopped: false })).toBe("confirm");
  });

  it("parole SOUTENUE (sans transcription encore arrivée) → interruption confirmée", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_SUSTAIN_MS, hasTranscriptEvidence: false, speechStopped: false })).toBe("confirm");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 900, hasTranscriptEvidence: false, speechStopped: true })).toBe("confirm");
  });

  it("signal en cours, encore court, sans mots → on ATTEND (ni coupure ni rejet)", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 150, hasTranscriptEvidence: false, speechStopped: false })).toBe("wait");
  });

  it("assistant silencieux → rien à protéger, le tour suit son cours normal", () => {
    expect(bargeInDecision({ assistantBusy: false, sustainedMs: 0, hasTranscriptEvidence: false, speechStopped: false })).toBe("confirm");
  });

  it("les seuils gardent « Stop. » rapide : confirmation soutenue ≤ 400 ms", () => {
    expect(BARGE_IN_SUSTAIN_MS).toBeLessThanOrEqual(400);
    expect(BARGE_IN_NOISE_MS).toBeLessThanOrEqual(BARGE_IN_SUSTAIN_MS);
  });
});

describe("isNoiseTranscript — le transcript n'est pas la vérité terrain", () => {
  it("artefacts (vide, ponctuation, chiffres seuls, syllabe isolée) → bruit : ni fil, ni mémoire", () => {
    expect(isNoiseTranscript("")).toBe(true);
    expect(isNoiseTranscript("   ")).toBe(true);
    expect(isNoiseTranscript("…")).toBe(true);
    expect(isNoiseTranscript("((")).toBe(true);
    expect(isNoiseTranscript("3")).toBe(true);
    expect(isNoiseTranscript("m…")).toBe(true);
  });

  it("les VRAIES commandes courtes passent toujours (barge-in lexicon)", () => {
    for (const cmd of ["stop", "non", "oui", "attends", "continue", "fais court"]) {
      expect(isNoiseTranscript(cmd), cmd).toBe(false);
    }
    expect(isNoiseTranscript("Radia Kebir")).toBe(false);
    expect(isNoiseTranscript("Hallo?")).toBe(false); // de la parole, même étrange — conservateur
  });
});

describe("buildTurnDetection — VAD pilotée par l'environnement, benchmarkable sans redéployer", () => {
  it("défaut : semantic_vad, eagerness auto, interrupt_response FAUX (barge-in confirmé client)", () => {
    expect(buildTurnDetection({})).toEqual({ type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: false });
  });

  it("eagerness réglable ; valeur inconnue → auto", () => {
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_EAGERNESS: "low" })).toMatchObject({ eagerness: "low" });
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_EAGERNESS: "n'importe" })).toMatchObject({ eagerness: "auto" });
  });

  it("server_vad tuné (threshold / prefix / silence), avec replis sûrs sur valeurs invalides", () => {
    expect(buildTurnDetection({
      OPENAI_VOICE_VAD_MODE: "server_vad", OPENAI_VOICE_VAD_THRESHOLD: "0.75",
      OPENAI_VOICE_VAD_PREFIX_MS: "200", OPENAI_VOICE_VAD_SILENCE_MS: "700",
    })).toEqual({ type: "server_vad", threshold: 0.75, prefix_padding_ms: 200, silence_duration_ms: 700, create_response: true, interrupt_response: false });
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_MODE: "server_vad", OPENAI_VOICE_VAD_THRESHOLD: "12" })).toMatchObject({ threshold: 0.6 });
  });

  it("OPENAI_VOICE_INTERRUPT=server rend l'interruption au serveur (pour le benchmark A/B)", () => {
    expect(buildTurnDetection({ OPENAI_VOICE_INTERRUPT: "server" })).toMatchObject({ interrupt_response: true });
  });
});
