import { describe, expect, it } from "vitest";
import {
  bargeInDecision, isNoiseTranscript, buildTurnDetection, deliveryWatchdogAction, deliveryFallbackText,
  BARGE_IN_SUSTAIN_MS, BARGE_IN_NOISE_MS, DELIVERY_WATCHDOG_GRACE_MS, DELIVERY_MAX_ATTEMPTS,
} from "./voice-tuning";

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

  it("AUTO-PROTECTION ÉCHO : haut-parleur ACTIF → la durée seule ne confirme JAMAIS (fantômes persistants)", () => {
    // L'écho de la propre voix de l'assistant est un « signal soutenu » parfait : 600, 2000 ms…
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 600, hasTranscriptEvidence: false, speechStopped: false, audioPlaying: true })).toBe("wait");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 2_000, hasTranscriptEvidence: false, speechStopped: true, audioPlaying: true })).toBe("ignore");
    // Des MOTS transcrits restent le témoignage recevable — la vraie interruption coupe.
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 200, hasTranscriptEvidence: true, speechStopped: false, audioPlaying: true })).toBe("confirm");
    // Haut-parleur MUET (réflexion) : aucune source d'écho — la durée seule confirme encore.
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_SUSTAIN_MS, hasTranscriptEvidence: false, speechStopped: false, audioPlaying: false })).toBe("confirm");
  });
});

describe("deliveryWatchdogAction — la garde déterministe de restitution (jamais un setTimeout aveugle)", () => {
  const base = { readyForMs: DELIVERY_WATCHDOG_GRACE_MS, activeResponse: false, createInFlightMs: null, userSpeaking: false, attempts: 0 };

  it("dépendances complètes && rien en cours && grâce écoulée → CRÉER la réponse", () => {
    expect(deliveryWatchdogAction(base)).toBe("create");
  });

  it("une réponse ACTIVE couvre déjà l'obligation → attendre (elle restituera ou sa fin replanifie)", () => {
    expect(deliveryWatchdogAction({ ...base, activeResponse: true })).toBe("wait");
  });

  it("l'UTILISATEUR parle → RESULT_READY : jamais par-dessus, la fin de son tour déclenche", () => {
    expect(deliveryWatchdogAction({ ...base, userSpeaking: true })).toBe("wait");
  });

  it("un create encore en vol (sous la grâce) → attendre sa réponse, pas le doubler", () => {
    expect(deliveryWatchdogAction({ ...base, createInFlightMs: 300 })).toBe("wait");
    expect(deliveryWatchdogAction({ ...base, createInFlightMs: DELIVERY_WATCHDOG_GRACE_MS })).toBe("create");
  });

  it("résultat frais (sous la grâce) → laisser le chemin nominal agir d'abord", () => {
    expect(deliveryWatchdogAction({ ...base, readyForMs: 200 })).toBe("wait");
  });

  it("relances plafonnées → abandon HONNÊTE (dit + persisté), jamais une boucle infinie", () => {
    expect(deliveryWatchdogAction({ ...base, attempts: DELIVERY_MAX_ATTEMPTS })).toBe("give_up");
  });
});

describe("deliveryFallbackText — le texte persisté quand la voix ne peut plus restituer", () => {
  it("préfère la réponse UI détaillée, sinon le champ `reponse` du JSON, sinon la sortie brute — borné", () => {
    expect(deliveryFallbackText("{\"reponse\":\"Synthèse.\"}", "Analyse détaillée.")).toBe("Analyse détaillée.");
    expect(deliveryFallbackText("{\"reponse\":\"Synthèse.\"}", null)).toBe("Synthèse.");
    expect(deliveryFallbackText("Texte brut.", null)).toBe("Texte brut.");
    expect(deliveryFallbackText("{pas du json", null)).toBe("{pas du json");
    expect(deliveryFallbackText("x".repeat(10_000), null).length).toBeLessThan(6_100);
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
