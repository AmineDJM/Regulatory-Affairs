/**
 * RÉGLAGES VOIX — le module PUR partagé serveur / navigateur : la politique d'interruption
 * (barge-in CONFIRMÉ), le filtre de bruit sur les transcriptions, et la configuration de
 * détection de tour (VAD) pilotée par variables d'environnement pour le benchmark.
 *
 * La panne réelle qui a tout motivé : la réponse vocale se coupait sur un bruit de clavier,
 * une toux, une porte — de faux « (intervention vocale) » en cascade, des répétitions, un
 * contexte dégradé. La correction est au niveau AUDIO/VAD, pas dans le prompt :
 *
 *   possible_voice_start → l'assistant parle ? → évaluer le signal
 *   (parole soutenue + mots transcrits + arrêt précoce) → VRAIE interruption ?
 *   OUI → cancel + clear + truncate.  NON → la réponse CONTINUE.
 *
 * Objectif jumeau, mesuré ensemble : LOW FALSE INTERRUPTION + FAST TRUE INTERRUPTION.
 * Aucun import lourd ici : le fichier est embarqué dans le bundle client.
 */

/** Parole soutenue au-delà de ce seuil pendant que l'assistant parle → interruption CONFIRMÉE.
 *  Assez court pour qu'un vrai « Stop. » coupe vite ; assez long pour qu'un clic ne coupe rien. */
export const BARGE_IN_SUSTAIN_MS = 400;

/** Signal terminé AVANT ce seuil, sans aucun mot transcrit → bruit (toux, porte, clavier). */
export const BARGE_IN_NOISE_MS = 350;

export type BargeInVerdict = "confirm" | "ignore" | "wait";

/**
 * La décision de barge-in — DÉTERMINISTE et testable :
 *   • des MOTS transcrits pendant le signal = parole humaine → confirmer immédiatement
 *     (c'est ce qui garde « Stop. » / « Attends. » rapides) ;
 *   • AUTO-PROTECTION ÉCHO : pendant que le HAUT-PARLEUR joue (`audioPlaying`), l'écho de la
 *     propre voix de l'assistant est un « signal de parole » parfaitement soutenu — la durée
 *     seule ne prouve donc RIEN. Seuls des mots transcrits confirment ; un signal sans mots
 *     qui s'arrête est ignoré, quelle que soit sa durée. (C'était LA source des interruptions
 *     fantômes « (intervention vocale) » persistantes : sustained ≥ 400 ms sur de l'écho.)
 *   • haut-parleur muet (réflexion en cours) : un signal SOUTENU (≥ BARGE_IN_SUSTAIN_MS)
 *     confirme même sans transcription — il n'y a aucune source d'écho possible ;
 *   • un signal bref qui s'arrête sans mots → IGNORER (la réponse continue) ;
 *   • sinon → attendre la suite du signal.
 * Le vrai « Stop. » pendant la voix reste rapide : la transcription temps réel livre ses
 * premiers mots en quelques centaines de ms, et un retard est rattrapé par la CONFIRMATION
 * TARDIVE (transcription finale avec mots pendant la même réponse → coupure immédiate).
 */
export function bargeInDecision(s: {
  assistantBusy: boolean;
  sustainedMs: number;
  hasTranscriptEvidence: boolean;
  speechStopped: boolean;
  /** Le haut-parleur émet RÉELLEMENT du son (fenêtre d'écho possible). Défaut : non. */
  audioPlaying?: boolean;
}): BargeInVerdict {
  if (!s.assistantBusy) return "confirm"; // rien à protéger : l'état de tour suit normalement
  if (s.hasTranscriptEvidence) return "confirm";
  if (s.audioPlaying) return s.speechStopped ? "ignore" : "wait";
  if (s.sustainedMs >= BARGE_IN_SUSTAIN_MS) return "confirm";
  if (s.speechStopped && s.sustainedMs < BARGE_IN_NOISE_MS) return "ignore";
  return "wait";
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPRIÉTÉ DE LA RÉPONSE (BUG « analyse terminée, jamais restituée ») — chaque résultat
// d'outil crée une OBLIGATION DE RESTITUTION qui ne s'éteint que lorsqu'une réponse a
// réellement PARLÉ. Le watchdog ci-dessous est la garde déterministe de rattrapage : il ne
// « rejoue au bout de N secondes » que si TOUTES les conditions d'une livraison possible sont
// réunies et qu'aucune réponse n'est en cours — jamais un setTimeout aveugle.
// ─────────────────────────────────────────────────────────────────────────────

/** Délai de grâce avant que le watchdog considère qu'un `response.create` s'est perdu. */
export const DELIVERY_WATCHDOG_GRACE_MS = 1_500;
/** Cadence de la vérification (uniquement quand des obligations existent). */
export const DELIVERY_WATCHDOG_TICK_MS = 600;
/** Au-delà : la restitution vocale a échoué — on le DIT et on persiste dans le fil. */
export const DELIVERY_MAX_ATTEMPTS = 3;

export type DeliveryWatchdogAction = "create" | "wait" | "give_up";

/**
 * La garde du watchdog — PURE et testable : « dépendances complètes && aucune réponse en
 * cours && l'utilisateur ne parle pas && la grâce est écoulée → déclencher la réponse ».
 */
export function deliveryWatchdogAction(s: {
  /** ms depuis que le résultat est prêt (function_call_output posé dans la conversation). */
  readyForMs: number;
  /** Une réponse est active (response.created vu, response.done pas encore). */
  activeResponse: boolean;
  /** Un response.create est parti sans response.created en face — ms depuis l'envoi, sinon null. */
  createInFlightMs: number | null;
  /** L'utilisateur parle (ou une fenêtre de barge-in est ouverte) : livrer en fin de tour. */
  userSpeaking: boolean;
  attempts: number;
}): DeliveryWatchdogAction {
  if (s.attempts >= DELIVERY_MAX_ATTEMPTS) return "give_up";
  if (s.activeResponse) return "wait"; // elle couvrira l'obligation (ou sa fin la replanifie)
  if (s.userSpeaking) return "wait"; // RESULT_READY : la fin du tour utilisateur déclenche
  if (s.createInFlightMs !== null && s.createInFlightMs < DELIVERY_WATCHDOG_GRACE_MS) return "wait";
  if (s.readyForMs < DELIVERY_WATCHDOG_GRACE_MS) return "wait";
  return "create";
}

/**
 * Le TEXTE de repli d'une restitution : ce qui est persisté dans le fil quand la session s'est
 * terminée avant la restitution vocale (raccroché pendant l'analyse) ou quand la voix n'a pas
 * pu parler. On préfère la réponse UI détaillée ; sinon le champ `reponse` du JSON d'outil ;
 * sinon la sortie brute — bornée.
 */
export function deliveryFallbackText(output: string, uiReply?: string | null): string {
  const cap = (s: string) => (s.length > 6_000 ? `${s.slice(0, 6_000)}\n[… tronqué]` : s);
  const ui = (uiReply ?? "").trim();
  if (ui) return cap(ui);
  const raw = (output ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { reponse?: unknown };
      if (typeof parsed.reponse === "string" && parsed.reponse.trim()) return cap(parsed.reponse.trim());
    } catch { /* sortie non-JSON : brute */ }
  }
  return cap(raw);
}

/**
 * Le TRANSCRIPT n'est pas la vérité terrain : une toux transcrite « … », un artefact sans
 * lettres, une syllabe isolée ne doivent entrer ni dans le fil, ni dans la mémoire, ni dans la
 * résolution d'entités. Filtre CONSERVATEUR : « stop », « non », « oui » (vraies commandes
 * courtes) passent toujours.
 */
export function isNoiseTranscript(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  const letters = t.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return true; // ponctuation, chiffres seuls, artefacts
  if (letters === 1 && t.length <= 3) return true; // « e. », « m… »
  return false;
}

/**
 * La configuration `turn_detection` de la session Realtime — pilotée par l'environnement pour
 * pouvoir BENCHMARKER (semantic_vad auto/low/medium/high vs server_vad tuné) sans redéployer :
 *
 *   OPENAI_VOICE_VAD_MODE       semantic_vad (défaut) | server_vad
 *   OPENAI_VOICE_VAD_EAGERNESS  auto (défaut) | low | medium | high        (semantic_vad)
 *   OPENAI_VOICE_VAD_THRESHOLD  0..1, défaut 0.6 (plus haut = moins sensible au bruit)
 *   OPENAI_VOICE_VAD_PREFIX_MS  défaut 300                                  (server_vad)
 *   OPENAI_VOICE_VAD_SILENCE_MS défaut 500                                  (server_vad)
 *   OPENAI_VOICE_INTERRUPT      "server" pour rendre l'interruption au serveur (défaut : client)
 *
 * `interrupt_response` est FAUX par défaut : le premier speech-start bruité ne tue plus la
 * réponse — le client confirme le barge-in (bargeInDecision) puis annule PROPREMENT
 * (response.cancel + output_audio_buffer.clear + conversation.item.truncate).
 */
export function buildTurnDetection(env: Record<string, string | undefined> = process.env): Record<string, unknown> {
  const interrupt = env.OPENAI_VOICE_INTERRUPT === "server";
  if (env.OPENAI_VOICE_VAD_MODE === "server_vad") {
    const threshold = Number.parseFloat(env.OPENAI_VOICE_VAD_THRESHOLD ?? "");
    const prefix = Number.parseInt(env.OPENAI_VOICE_VAD_PREFIX_MS ?? "", 10);
    const silence = Number.parseInt(env.OPENAI_VOICE_VAD_SILENCE_MS ?? "", 10);
    return {
      type: "server_vad",
      threshold: Number.isFinite(threshold) && threshold >= 0 && threshold <= 1 ? threshold : 0.6,
      prefix_padding_ms: Number.isFinite(prefix) && prefix >= 0 ? prefix : 300,
      silence_duration_ms: Number.isFinite(silence) && silence >= 0 ? silence : 500,
      create_response: true,
      interrupt_response: interrupt,
    };
  }
  const eagerness = ["low", "medium", "high", "auto"].includes(env.OPENAI_VOICE_VAD_EAGERNESS ?? "")
    ? env.OPENAI_VOICE_VAD_EAGERNESS
    : "auto";
  return { type: "semantic_vad", eagerness, create_response: true, interrupt_response: interrupt };
}
