import { describe, expect, it } from "vitest";
import {
  bargeInDecision, isNoiseTranscript, buildTurnDetection, deliveryWatchdogAction, deliveryFallbackText,
  BARGE_IN_SUSTAIN_MS, BARGE_IN_NOISE_MS, DELIVERY_WATCHDOG_GRACE_MS, DELIVERY_MAX_ATTEMPTS,
  stuckTurnAction, STUCK_TURN_MS, STUCK_TURN_MAX_ATTEMPTS,
} from "./voice-tuning";

/**
 * GOLDEN RÉGRESSION — BARGE-IN NATIF (audit voix 2026-08). Le geste est désormais : le serveur
 * coupe (interrupt_response), le client confirme VITE et STT-INDÉPENDANT. Objectif jumeau :
 * LOW FALSE INTERRUPTION (le bruit bref ne coupe pas) + FAST TRUE INTERRUPTION (une parole
 * soutenue de 180 ms coupe, avec ou sans mots — on n'attend plus la transcription).
 */

describe("bargeInDecision — le bruit bref ne coupe pas, la parole soutenue coupe vite (sans les mots)", () => {
  it("GOLDEN FAUX BARGE-IN : clic / écho résiduel bref (< 140 ms, aucun mot, terminé) → la réponse CONTINUE", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 120, hasTranscriptEvidence: false, speechStopped: true })).toBe("ignore");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_NOISE_MS - 1, hasTranscriptEvidence: false, speechStopped: true })).toBe("ignore");
  });

  it("GOLDEN VRAIE INTERRUPTION : « Stop. » — des mots transcrits coupent IMMÉDIATEMENT (accélérateur)", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 80, hasTranscriptEvidence: true, speechStopped: false })).toBe("confirm");
  });

  it("LE CORRECTIF « Adam continue de parler » : parole soutenue ≥ 180 ms coupe MÊME pendant que le haut-parleur joue, SANS attendre les mots", () => {
    // C'ÉTAIT la panne : l'ancienne politique renvoyait « wait » tant qu'aucun mot n'arrivait
    // pendant l'écho — donc l'interruption traînait jusqu'à la transcription (0,4–1,5 s). La
    // robustesse à l'écho revient maintenant à l'annulation d'écho du navigateur + semantic_vad.
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_SUSTAIN_MS, hasTranscriptEvidence: false, speechStopped: false, audioPlaying: true })).toBe("confirm");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 600, hasTranscriptEvidence: false, speechStopped: false, audioPlaying: true })).toBe("confirm");
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 900, hasTranscriptEvidence: false, speechStopped: true, audioPlaying: true })).toBe("confirm");
    // Haut-parleur MUET (réflexion) : idem, la durée soutenue confirme.
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: BARGE_IN_SUSTAIN_MS, hasTranscriptEvidence: false, speechStopped: false, audioPlaying: false })).toBe("confirm");
  });

  it("signal en cours, encore SOUS le seuil, sans mots → on ATTEND (ni coupure ni rejet)", () => {
    expect(bargeInDecision({ assistantBusy: true, sustainedMs: 150, hasTranscriptEvidence: false, speechStopped: false })).toBe("wait");
  });

  it("assistant silencieux → rien à protéger, le tour suit son cours normal", () => {
    expect(bargeInDecision({ assistantBusy: false, sustainedMs: 0, hasTranscriptEvidence: false, speechStopped: false })).toBe("confirm");
  });

  it("les seuils rendent « Stop. » quasi instantané : confirmation soutenue ≤ 200 ms, plancher de bruit en dessous", () => {
    expect(BARGE_IN_SUSTAIN_MS).toBeLessThanOrEqual(200);
    expect(BARGE_IN_NOISE_MS).toBeLessThanOrEqual(BARGE_IN_SUSTAIN_MS);
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

describe("buildTurnDetection — NATIVE par défaut, réglable par l'environnement", () => {
  it("défaut : semantic_vad, eagerness « low » (hésitations FR), interrupt_response VRAI (natif)", () => {
    expect(buildTurnDetection({})).toEqual({ type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true });
  });

  it("eagerness réglable ; valeur inconnue → low", () => {
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_EAGERNESS: "high" })).toMatchObject({ eagerness: "high" });
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_EAGERNESS: "n'importe" })).toMatchObject({ eagerness: "low" });
  });

  it("server_vad tuné (threshold / prefix / silence), avec replis sûrs sur valeurs invalides", () => {
    expect(buildTurnDetection({
      OPENAI_VOICE_VAD_MODE: "server_vad", OPENAI_VOICE_VAD_THRESHOLD: "0.75",
      OPENAI_VOICE_VAD_PREFIX_MS: "200", OPENAI_VOICE_VAD_SILENCE_MS: "700",
    })).toEqual({ type: "server_vad", threshold: 0.75, prefix_padding_ms: 200, silence_duration_ms: 700, create_response: true, interrupt_response: true });
    // Repli de silence : 600 ms par défaut (laisse respirer une hésitation courte).
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_MODE: "server_vad", OPENAI_VOICE_VAD_THRESHOLD: "12" })).toMatchObject({ threshold: 0.6, silence_duration_ms: 600 });
  });

  it("OPENAI_VOICE_INTERRUPT=client rend l'interruption au client (repli mesuré si l'écho coupait Adam)", () => {
    expect(buildTurnDetection({ OPENAI_VOICE_INTERRUPT: "client" })).toMatchObject({ interrupt_response: false });
    expect(buildTurnDetection({ OPENAI_VOICE_VAD_MODE: "server_vad", OPENAI_VOICE_INTERRUPT: "client" })).toMatchObject({ interrupt_response: false });
  });
});

describe("la garde du tour bloqué — le « Alors ? » du compte rendu", () => {
  const base = {
    awaiting: true, silentForMs: 10_000, activeResponse: false,
    userSpeaking: false, audioPlaying: false, attempts: 0,
  };

  it("relance un tour muet dont personne ne s'occupe", () => {
    expect(stuckTurnAction(base)).toBe("revive");
  });

  it("ne relance JAMAIS par-dessus l'utilisateur qui parle", () => {
    // Le pire défaut possible d'une telle garde : couper la parole pour cause de silence.
    expect(stuckTurnAction({ ...base, userSpeaking: true })).toBe("wait");
  });

  it("ne relance pas ce qui vit déjà — réponse active ou haut-parleur en train de jouer", () => {
    expect(stuckTurnAction({ ...base, activeResponse: true })).toBe("wait");
    expect(stuckTurnAction({ ...base, audioPlaying: true })).toBe("wait");
  });

  it("laisse au tour normal le temps d'arriver", () => {
    // Un premier son tombe typiquement entre 300 ms et 1,5 s : relancer avant, ce serait
    // fabriquer un bégaiement à chaque tour rapide.
    expect(stuckTurnAction({ ...base, silentForMs: 1_200 })).toBe("wait");
    expect(stuckTurnAction({ ...base, silentForMs: STUCK_TURN_MS - 1 })).toBe("wait");
    expect(stuckTurnAction({ ...base, silentForMs: STUCK_TURN_MS })).toBe("revive");
  });

  it("n'insiste pas indéfiniment : au bout du compte, il le DIT", () => {
    expect(stuckTurnAction({ ...base, attempts: STUCK_TURN_MAX_ATTEMPTS })).toBe("surface");
    expect(stuckTurnAction({ ...base, attempts: STUCK_TURN_MAX_ATTEMPTS + 5 })).toBe("surface");
  });

  it("ne fait rien quand le tour n'attend rien", () => {
    expect(stuckTurnAction({ ...base, awaiting: false, silentForMs: 999_999 })).toBe("wait");
  });
});
