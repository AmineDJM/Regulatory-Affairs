/**
 * LE TOUR DE PAROLE, MESURÉ — pour cesser de régler à l'aveugle.
 *
 * LE PROBLÈME QUE CE MODULE EXISTE POUR RÉSOUDRE. Quand un appel se passe mal, tout le monde dit
 * la même chose : « ça n'a pas marché ». Mais « ça » recouvre six pannes qui n'ont RIEN à voir et
 * qui ne se réparent pas au même endroit :
 *
 *   AUDIO          — le micro n'a rien capté d'exploitable (niveau au plancher, saturation).
 *   TRANSCRIPTION  — le son était bon, les mots sont faux.
 *   TURN_DETECTION — les mots étaient bons, mais on a coupé le PDG au milieu d'une phrase.
 *   INTENT         — la phrase était juste, l'intention comprise est à côté.
 *   TOOL           — l'intention était juste, l'outil a échoué ou traîné.
 *   DELIVERY       — le résultat existait et n'est jamais sorti. (Le fameux « Alors ? ».)
 *
 * Régler la VAD parce qu'un micro sature, c'est perdre une semaine. D'où la règle de la mission :
 * INSTRUMENTER AVANT DE RÉGLER. Ce module ne corrige rien — il attribue.
 *
 * L'ATTRIBUTION EST ORDONNÉE, et c'est le cœur de sa justesse : on impute au PREMIER étage cassé.
 * Un outil qui part sur un mauvais mot n'a pas fauté — la transcription a fauté. Compter l'erreur
 * deux fois, c'est fabriquer un tableau de bord qui accuse toujours le dernier maillon.
 *
 * IL EST PUR. Aucune base, aucun réseau, aucun import lourd : il tourne dans le navigateur (où le
 * tour se déroule) comme sur le serveur (où il s'agrège), et il se teste sans décor.
 */

export type VoiceStage =
  | "AUDIO"
  | "TRANSCRIPTION"
  | "TURN_DETECTION"
  | "INTENT"
  | "TOOL"
  | "DELIVERY";

/** L'ordre des étages — il EST la règle d'attribution, pas une simple présentation. */
export const VOICE_STAGES: readonly VoiceStage[] = [
  "AUDIO", "TRANSCRIPTION", "TURN_DETECTION", "INTENT", "TOOL", "DELIVERY",
] as const;

export const STAGE_LABEL: Record<VoiceStage, string> = {
  AUDIO: "Audio (micro)",
  TRANSCRIPTION: "Transcription",
  TURN_DETECTION: "Détection de tour",
  INTENT: "Compréhension",
  TOOL: "Outil / donnée",
  DELIVERY: "Restitution",
};

/**
 * TOUT CE QU'UN TOUR PEUT DIRE DE LUI-MÊME.
 *
 * Les horodatages sont des millisecondes d'horloge monotone côté client (`performance.now()` +
 * origine) ou `Date.now()` côté serveur : seules les DIFFÉRENCES comptent, jamais la valeur
 * absolue. Tout est optionnel parce qu'un tour peut casser à n'importe quel étage — et un tour
 * cassé tôt est précisément celui qu'il faut pouvoir enregistrer.
 */
export interface VoiceTurnDraft {
  turnId: string;
  sessionId: string;

  // ── AUDIO ───────────────────────────────────────────────────────────────────────────────
  /** Début de parole détecté par la VAD. */
  speechStartedAt?: number;
  /** Fin de parole détectée par la VAD. */
  speechStoppedAt?: number;
  /** Crête du niveau d'entrée sur le tour, 0..1. En dessous du plancher, le micro est inaudible. */
  inputPeak?: number;
  /** Le signal a-t-il saturé (≥ 0.99) ? Un micro qui écrête produit des mots faux, pas du silence. */
  clipped?: boolean;
  /** Périphérique effectivement utilisé — « default » n'est pas une réponse, c'est un symptôme. */
  inputDevice?: string | null;

  // ── TRANSCRIPTION ───────────────────────────────────────────────────────────────────────
  /** Nombre de transcriptions partielles reçues — un tour à 0 partiel n'a rien entendu. */
  partialCount?: number;
  /** Instant de la transcription FINALE. */
  transcriptAt?: number;
  /** La transcription finale, telle que le fournisseur l'a rendue. */
  transcript?: string;
  /** Confiance 0..1 quand le fournisseur la donne. `undefined` ≠ 0 : inconnue, pas nulle. */
  transcriptConfidence?: number;

  // ── DÉTECTION DE TOUR ───────────────────────────────────────────────────────────────────
  /** Instant où le tour a été considéré comme terminé (fin de la VAD sémantique / serveur). */
  turnConfirmedAt?: number;
  /** Le PDG a-t-il repris la parole immédiatement après ? Indice fort d'une coupure prématurée. */
  followedByImmediateSpeech?: boolean;
  /** Barge-ins retenus (vrais) et ignorés (faux) sur ce tour. */
  interruptions?: number;
  falseBargeIns?: number;

  // ── COMPRÉHENSION ───────────────────────────────────────────────────────────────────────
  intentAt?: number;
  /** La route retenue (`VoiceRouteKind`) ou le nom de l'intention du modèle. */
  intentKind?: string | null;
  /** Le tour a-t-il évité la planification générique ? C'est la mesure de §7. */
  fastPath?: boolean;

  // ── OUTIL ───────────────────────────────────────────────────────────────────────────────
  toolName?: string | null;
  toolStartedAt?: number;
  toolEndedAt?: number;
  toolOk?: boolean;
  toolError?: string | null;
  /** Reprises internes (retry réseau, reconnexion du fournisseur) pendant le tour. */
  retries?: number;
  reconnects?: number;

  // ── RESTITUTION ─────────────────────────────────────────────────────────────────────────
  /** Le résultat était prêt à être dit. */
  resultReadyAt?: number;
  /** Premier octet d'audio sortant — l'instant que le PDG perçoit comme « il répond ». */
  audioOutStartedAt?: number;
  audioOutEndedAt?: number;
  /** Le résultat a bel et bien été livré (audio ou carte), sans que le PDG ait à le réclamer. */
  deliveredAt?: number;
  /** Le PDG a dû dire « Alors ? » — par construction, un échec de restitution. */
  nudged?: boolean;
  /** Longueur de ce qui a été DIT — §11 : une phrase courte par défaut. */
  spokenChars?: number;

  /** Le tour a été abandonné (raccroché, coupure) — on l'enregistre plutôt que de le perdre. */
  aborted?: boolean;
  abortReason?: string | null;
}

/** Les cinq segments de latence que la mission demande de mesurer séparément (§12). */
export interface VoiceLatency {
  /** Fin de parole → transcription finale. */
  transcriptMs: number | null;
  /** Transcription → intention retenue. */
  intentMs: number | null;
  /** Intention → départ de l'outil. */
  toolStartMs: number | null;
  /** Durée de l'outil. */
  toolMs: number | null;
  /** Résultat prêt → premier son sortant. */
  speakMs: number | null;
  /** LE CHIFFRE QUI COMPTE : fin de parole → premier son de réponse. */
  firstResponseMs: number | null;
  /** Durée de parole du PDG — sert à repérer les tours coupés (audio très court). */
  speechMs: number | null;
}

/**
 * LES SEUILS.
 *
 * `target` est ce qu'on vise (p50), `max` ce au-delà de quoi la conversation cesse d'en être une.
 * `firstResponse` porte la cible explicite de la mission pour une question de forme rapide :
 * une réponse utile en 1 à 1,5 seconde.
 */
export interface VoiceSlo {
  transcriptMs: { target: number; max: number };
  intentMs: { target: number; max: number };
  toolStartMs: { target: number; max: number };
  toolMs: { target: number; max: number };
  speakMs: { target: number; max: number };
  firstResponseFastMs: { target: number; max: number };
  firstResponseSlowMs: { target: number; max: number };
  /** Sous ce niveau de crête, le micro n'a rien donné d'exploitable. */
  minInputPeak: number;
  /** Sous cette confiance, la transcription est douteuse (cf. `uncertainty.ts` pour le sensible). */
  minConfidence: number;
  /** Une parole plus courte que cela n'est pas une phrase — c'est un bruit ou une coupure. */
  minSpeechMs: number;
  /** §11 : au-delà, Adam parle trop pour une réponse simple. */
  maxSpokenChars: number;
}

export const VOICE_SLO: VoiceSlo = {
  transcriptMs: { target: 400, max: 900 },
  intentMs: { target: 150, max: 400 },
  toolStartMs: { target: 150, max: 400 },
  toolMs: { target: 900, max: 2_500 },
  speakMs: { target: 300, max: 700 },
  // La cible nommée par la mission pour les formes rapides.
  firstResponseFastMs: { target: 1_200, max: 1_500 },
  // Une question qui exige une vraie recherche a droit à davantage — mais pas à l'infini.
  firstResponseSlowMs: { target: 2_500, max: 4_000 },
  minInputPeak: 0.02,
  minConfidence: 0.6,
  minSpeechMs: 250,
  maxSpokenChars: 240,
};

export interface VoiceTurnVerdict {
  /**
   * §16 — LE SUCCÈS VU PAR LE PDG, et rien d'autre. Un tour n'est réussi que s'il a été entendu,
   * compris, servi par la bonne source, restitué TOUT SEUL, et sans bavardage. « L'outil a fini
   * par rendre quelque chose » n'est pas un succès.
   */
  ok: boolean;
  /** Le PREMIER étage cassé — celui qu'il faut réparer. `null` si le tour est bon. */
  failedStage: VoiceStage | null;
  /** Ce qui cloche, en clair, pour le journal de débogage vocal. */
  reasons: string[];
  /** Les segments hors budget, même sur un tour par ailleurs correct. */
  slowLegs: string[];
  latency: VoiceLatency;
}

const ms = (from: number | undefined, to: number | undefined): number | null =>
  typeof from === "number" && typeof to === "number" && to >= from ? to - from : null;

export function turnLatency(t: VoiceTurnDraft): VoiceLatency {
  return {
    speechMs: ms(t.speechStartedAt, t.speechStoppedAt),
    transcriptMs: ms(t.speechStoppedAt, t.transcriptAt),
    intentMs: ms(t.transcriptAt, t.intentAt),
    toolStartMs: ms(t.intentAt, t.toolStartedAt),
    toolMs: ms(t.toolStartedAt, t.toolEndedAt),
    speakMs: ms(t.resultReadyAt, t.audioOutStartedAt),
    firstResponseMs: ms(t.speechStoppedAt, t.audioOutStartedAt),
  };
}

/**
 * L'ATTRIBUTION. On descend les étages dans l'ordre et on s'arrête au premier cassé.
 *
 * Ce « on s'arrête » est la décision d'ingénierie du fichier : sans lui, un micro saturé
 * produirait un échec d'AUDIO, un échec de TRANSCRIPTION, un échec d'INTENT et un échec de TOOL —
 * quatre lignes pour une panne, et un tableau de bord qui désigne toujours le coupable le plus
 * visible au lieu du coupable réel.
 */
export function evaluateTurn(t: VoiceTurnDraft, slo: VoiceSlo = VOICE_SLO): VoiceTurnVerdict {
  const latency = turnLatency(t);
  const reasons: string[] = [];
  let failedStage: VoiceStage | null = null;

  const fail = (stage: VoiceStage, why: string) => {
    if (!failedStage) failedStage = stage;
    reasons.push(why);
  };

  // Un tour abandonné n'est imputable à aucun étage métier : il est réseau, ou humain.
  if (t.aborted) {
    return {
      ok: false, failedStage: "DELIVERY", latency, slowLegs: [],
      reasons: [t.abortReason ? `Tour interrompu : ${t.abortReason}` : "Tour interrompu."],
    };
  }

  // ── AUDIO ─────────────────────────────────────────────────────────────────────────────────
  if (typeof t.inputPeak === "number" && t.inputPeak < slo.minInputPeak) {
    fail("AUDIO", `Niveau d'entrée au plancher (crête ${t.inputPeak.toFixed(3)}) — micro muet, mal choisi ou trop loin.`);
  } else if (t.clipped) {
    // La saturation ne fait pas taire : elle fait entendre DE TRAVERS. C'est un défaut d'audio,
    // même quand une transcription arrive — et surtout quand elle arrive.
    fail("AUDIO", "Signal saturé (écrêtage) — les mots transcrits ne sont pas fiables.");
  } else if (latency.speechMs !== null && latency.speechMs < slo.minSpeechMs) {
    fail("AUDIO", `Parole trop brève (${latency.speechMs} ms) — bruit capté comme un tour.`);
  }

  // ── TRANSCRIPTION ─────────────────────────────────────────────────────────────────────────
  const said = (t.transcript ?? "").trim();
  if (!said) {
    fail("TRANSCRIPTION", "Aucune transcription finale.");
  } else if (typeof t.transcriptConfidence === "number" && t.transcriptConfidence < slo.minConfidence) {
    fail("TRANSCRIPTION", `Confiance faible (${t.transcriptConfidence.toFixed(2)}) sur « ${said} ».`);
  }

  // ── DÉTECTION DE TOUR ─────────────────────────────────────────────────────────────────────
  // Une reprise de parole IMMÉDIATE après la clôture du tour est le signe le plus fiable d'une
  // coupure : le PDG n'avait pas fini. On le mesure au lieu de le deviner.
  if (t.followedByImmediateSpeech) {
    fail("TURN_DETECTION", "Le PDG a repris la parole aussitôt — tour probablement coupé trop tôt.");
  }
  if ((t.falseBargeIns ?? 0) > 0) {
    // Un faux barge-in n'invalide pas forcément le tour (il a pu être ignoré comme prévu), mais
    // il se compte : c'est la métrique d'écho de §13.
    reasons.push(`${t.falseBargeIns} fausse(s) interruption(s) ignorée(s).`);
  }

  // ── COMPRÉHENSION ─────────────────────────────────────────────────────────────────────────
  if (said && !t.intentKind) {
    fail("INTENT", "Aucune intention retenue pour un énoncé pourtant transcrit.");
  }

  // ── OUTIL ─────────────────────────────────────────────────────────────────────────────────
  if (t.toolName && t.toolOk === false) {
    fail("TOOL", `Outil « ${t.toolName} » en échec${t.toolError ? ` : ${t.toolError}` : ""}.`);
  }

  // ── RESTITUTION ───────────────────────────────────────────────────────────────────────────
  // Le cas qui a motivé toute la machine à obligations : le résultat EXISTAIT et n'est pas sorti.
  if (t.resultReadyAt && !t.deliveredAt) {
    fail("DELIVERY", "Résultat prêt mais jamais restitué.");
  }
  if (t.nudged) {
    fail("DELIVERY", "Le PDG a dû réclamer le résultat (« Alors ? »).");
  }

  // ── BUDGETS DE TEMPS (§12) ────────────────────────────────────────────────────────────────
  const slowLegs: string[] = [];
  const budget = (value: number | null, bound: { target: number; max: number }, label: string) => {
    if (value !== null && value > bound.max) slowLegs.push(`${label} ${value} ms (> ${bound.max} ms)`);
  };
  budget(latency.transcriptMs, slo.transcriptMs, "transcription");
  budget(latency.intentMs, slo.intentMs, "compréhension");
  budget(latency.toolStartMs, slo.toolStartMs, "départ outil");
  budget(latency.toolMs, slo.toolMs, "outil");
  budget(latency.speakMs, slo.speakMs, "mise en voix");
  budget(
    latency.firstResponseMs,
    t.fastPath ? slo.firstResponseFastMs : slo.firstResponseSlowMs,
    "première réponse",
  );

  // §11 — parler trop est un défaut de produit, pas un détail de style. Mais seulement sur une
  // réponse de forme rapide : un rapport demandé a le droit d'être long.
  const tooTalkative = t.fastPath === true && (t.spokenChars ?? 0) > slo.maxSpokenChars;
  if (tooTalkative) reasons.push(`Réponse bavarde (${t.spokenChars} caractères) sur une question simple.`);

  const ok = failedStage === null && slowLegs.length === 0 && !tooTalkative;
  return { ok, failedStage, reasons, slowLegs, latency };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// L'AGRÉGAT — ce qu'on regarde après cent tours, et ce que le rapport AVANT/APRÈS publie.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface VoiceAggregate {
  turns: number;
  /** §16 : la part de tours réussis DU POINT DE VUE DU PDG. */
  successRate: number;
  /** Où ça casse — le tableau qui dit sur quoi travailler la semaine prochaine. */
  failuresByStage: Record<VoiceStage, number>;
  /** p50 / p95 par segment, en ms. */
  p50: Partial<Record<keyof VoiceLatency, number>>;
  p95: Partial<Record<keyof VoiceLatency, number>>;
  /** Part de tours passés par une forme rapide. */
  fastPathRate: number;
  /** §13 : fausses interruptions rapportées au nombre de tours. */
  falseBargeInRate: number;
  /** §10 : part des résultats prêts qui ont effectivement été livrés. */
  deliveryRate: number;
  /** Part des tours où le PDG a dû réclamer. Doit tendre vers zéro. */
  nudgeRate: number;
  /** Longueur médiane de ce qui est dit, sur les tours de forme rapide (§11). */
  medianSpokenChars: number | null;
}

function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  // Rang le plus proche : sur de petits échantillons (un banc de 100 tours), il ne fabrique pas
  // de valeur qui n'a jamais été observée, contrairement à une interpolation.
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const LATENCY_KEYS: (keyof VoiceLatency)[] = [
  "speechMs", "transcriptMs", "intentMs", "toolStartMs", "toolMs", "speakMs", "firstResponseMs",
];

export function aggregateTurns(turns: VoiceTurnDraft[], slo: VoiceSlo = VOICE_SLO): VoiceAggregate {
  const failuresByStage = Object.fromEntries(VOICE_STAGES.map((s) => [s, 0])) as Record<VoiceStage, number>;
  const legs = Object.fromEntries(LATENCY_KEYS.map((k) => [k, [] as number[]])) as Record<keyof VoiceLatency, number[]>;

  let ok = 0;
  let fast = 0;
  let falseBargeIns = 0;
  let resultsReady = 0;
  let delivered = 0;
  let nudged = 0;
  const spoken: number[] = [];

  for (const t of turns) {
    const verdict = evaluateTurn(t, slo);
    if (verdict.ok) ok += 1;
    if (verdict.failedStage) failuresByStage[verdict.failedStage] += 1;
    if (t.fastPath) fast += 1;
    falseBargeIns += t.falseBargeIns ?? 0;
    if (t.resultReadyAt) resultsReady += 1;
    if (t.deliveredAt) delivered += 1;
    if (t.nudged) nudged += 1;
    if (t.fastPath && typeof t.spokenChars === "number") spoken.push(t.spokenChars);
    for (const k of LATENCY_KEYS) {
      const v = verdict.latency[k];
      if (v !== null) legs[k].push(v);
    }
  }

  const n = turns.length;
  const rate = (num: number) => (n === 0 ? 0 : num / n);
  const pick = (p: number) => {
    const out: Partial<Record<keyof VoiceLatency, number>> = {};
    for (const k of LATENCY_KEYS) {
      const v = percentile(legs[k], p);
      if (v !== undefined) out[k] = v;
    }
    return out;
  };

  return {
    turns: n,
    successRate: rate(ok),
    failuresByStage,
    p50: pick(50),
    p95: pick(95),
    fastPathRate: rate(fast),
    falseBargeInRate: rate(falseBargeIns),
    // Une restitution ne se juge que là où il Y AVAIT quelque chose à restituer : rapporter les
    // livraisons au nombre total de tours donnerait un taux flatteur et faux.
    deliveryRate: resultsReady === 0 ? 1 : delivered / resultsReady,
    nudgeRate: rate(nudged),
    medianSpokenChars: percentile(spoken, 50) ?? null,
  };
}
