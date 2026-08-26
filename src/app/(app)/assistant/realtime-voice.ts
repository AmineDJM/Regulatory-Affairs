"use client";

/**
 * COUCHE TRANSPORT DE L'APPEL VOCAL — l'abstraction `VoiceRealtimeProvider` et son
 * implémentation actuelle `OpenAIGptRealtime21Provider` (API Realtime OpenAI, WebRTC).
 *
 * Pourquoi une abstraction : le moteur vocal ÉVOLUERA (gpt-realtime-2.1 aujourd'hui, un
 * successeur type gpt-live demain). Toute la logique métier du Chief of Staff vit AILLEURS
 * (outils côté serveur, conversation persistée, cartes de confirmation) : remplacer le moteur
 * = réimplémenter CETTE interface, rien d'autre.
 *
 * Ce que fait l'implémentation WebRTC :
 *   • micro → piste WebRTC directe vers l'API Realtime (le média ne transite PAS par notre
 *     backend) ; la réponse revient en piste audio distante, jouée en continu (streaming) ;
 *   • un data channel (« oai-events ») porte les événements : transcriptions (utilisateur et
 *     assistant), débuts/fins de parole, appels d'outils, erreurs ;
 *   • chaque function call est exécuté par NOTRE backend authentifié (callTool) — jamais ici.
 *
 * Les deux invariants de FIABILITÉ de cette couche (pannes réelles de production) :
 *
 *   1. PROPRIÉTÉ DE LA RÉPONSE — « je vais analyser » puis silence infini. Chaque résultat
 *      d'outil crée une OBLIGATION DE RESTITUTION (`PendingDelivery`) qui ne s'éteint que
 *      lorsqu'une réponse a réellement PARLÉ. Poser le function_call_output dans la
 *      conversation ne suffit JAMAIS : la complétion RÉVEILLE la conversation
 *      (`requestResponse`), les collisions avec les réponses auto-créées par la VAD serveur
 *      (`conversation_already_has_active_response`) replanifient au lieu de perdre
 *      l'intention, un WATCHDOG déterministe rattrape tout create perdu (« dépendances
 *      complètes && aucune réponse en cours && l'utilisateur ne parle pas » — jamais un
 *      setTimeout aveugle), une réponse « muette » (complétée sans un mot) est détectée et
 *      relancée, et un résultat arrivé après la fin de session est PERSISTÉ dans le fil.
 *      Livraison EXACTLY-ONCE : l'obligation est portée par UNE réponse identifiée — jamais
 *      deux restitutions du même résultat.
 *
 *   2. ÉVÉNEMENTS PÉRIMÉS & BARGE-IN CONFIRMÉ — les interruptions fantômes
 *      « (intervention vocale) ». Chaque événement de contenu est LIÉ à la réponse
 *      (`response_id`) et au segment de parole (`item_id`) qui le portent : les deltas d'une
 *      réponse ANNULÉE ne polluent plus le transcript ni l'état, un delta d'un ANCIEN segment
 *      ne confirme jamais une nouvelle fenêtre de barge-in, et un segment ne produit qu'UNE
 *      confirmation (debounce). Pendant que le haut-parleur JOUE, la durée seule ne confirme
 *      rien (l'écho de la propre voix de l'assistant est un signal soutenu parfait) : seuls
 *      des MOTS transcrits coupent — voir `bargeInDecision`. En pièce silencieuse, un commit
 *      de bruit est SUPPRIMÉ de la conversation et la réponse auto qu'il a déclenchée est
 *      annulée avant d'avoir parlé : zéro fausse intervention.
 *
 * Le secret utilisé est ÉPHÉMÈRE (fourni par /api/assistant/voice/session) : aucune clé longue
 * durée n'existe côté navigateur.
 */

import {
  bargeInDecision, isNoiseTranscript, deliveryWatchdogAction, deliveryFallbackText,
  BARGE_IN_SUSTAIN_MS, DELIVERY_WATCHDOG_TICK_MS, DELIVERY_WATCHDOG_GRACE_MS,
} from "@/lib/assistant/voice-tuning";
import { parseRetryAfter, isRateLimitStatus } from "@/lib/assistant/voice-cooldown";

export type VoiceCallState =
  | "IDLE" | "CONNECTING" | "LISTENING" | "USER_SPEAKING" | "THINKING"
  | "ASSISTANT_SPEAKING" | "RECONNECTING" | "ERROR" | "ENDED";

export interface VoiceSessionGrant {
  clientSecret: string;
  model: string;
  callUrl: string;
  voice: string;
  threadId: string | null;
}

export interface VoiceToolUi {
  reply?: string | null;
  proposals?: unknown[] | null;
  trace?: string[];
  sources?: { label: string; href: string }[];
}

export interface VoiceProviderCallbacks {
  onState: (state: VoiceCallState) => void;
  /** Transcription de l'UTILISATEUR (finale quand `final`). */
  onUserTranscript: (text: string, final: boolean) => void;
  /** Transcription de l'ASSISTANT — deltas pendant qu'il parle, puis texte final. */
  onAssistantTranscript: (text: string, final: boolean) => void;
  /** Un TOUR complet (parole utilisateur + réponse) — à afficher et à persister. */
  onTurnComplete: (turn: { user: string; assistant: string }) => void;
  /** Charge utile UI d'un outil (cartes d'action, sources) — à afficher pendant que la voix parle. */
  onToolUi: (ui: VoiceToolUi) => void;
  onError: (message: string, reasonCode?: string) => void;
  /** État de la connexion WebRTC — le composant décide de la reconnexion. */
  onConnectionChange?: (state: RTCPeerConnectionState) => void;
  /** Métriques (premier audio, interruptions, restitutions…) — à remonter au journal. */
  onMetric?: (
    name:
      | "first_audio_out" | "interruption" | "tool_call" | "tool_error"
      // Politique de barge-in CONFIRMÉ : signal possible → confirmé (latence en valeur) /
      // ignoré comme bruit — les DEUX métriques s'optimisent ensemble.
      | "possible_barge_in" | "barge_in_confirmed" | "false_barge_in_ignored"
      // Propriété de la réponse : obligation créée → prête → RESTITUÉE (latence en valeur) ;
      // et les chemins de rattrapage — complétion muette, watchdog, échec terminal.
      | "pending_turn_created" | "pending_turn_ready" | "pending_turn_delivered"
      | "silent_completion_detected" | "watchdog_recovered" | "delivery_failed"
      // Hygiène des événements : périmés ignorés, réponse fantôme annulée avant d'avoir parlé.
      | "stale_event_ignored" | "phantom_response_cancelled",
    value?: number,
  ) => void;
}

export interface VoiceRealtimeProvider {
  connect(): Promise<void>;
  disconnect(): void;
  /** Message TEXTE dans la session vocale (« l'utilisateur tape pendant l'appel »). */
  sendText(text: string): void;
  /**
   * CONTEXTE D'ÉCRAN : informe la session de ce que l'utilisateur consulte (route/fiche) —
   * SANS déclencher de réponse. « Explique-moi ça » se résout alors tout seul.
   */
  sendContext(text: string): void;
  /** Coupe la réponse en cours (bouton, ou ceinture-bretelles du barge-in). */
  interrupt(): void;
  setMuted(muted: boolean): void;
  readonly state: VoiceCallState;
  readonly threadId: string | null;
}

interface ProviderOptions {
  getGrant: () => Promise<VoiceSessionGrant>;
  callTool: (name: string, input: Record<string, unknown>) => Promise<{ output: string; ui?: VoiceToolUi | null }>;
  callbacks: VoiceProviderCallbacks;
  /**
   * REPLI DE PERSISTANCE : un résultat d'analyse que la voix ne peut plus restituer (session
   * terminée pendant le job, restitution en échec terminal) est remis au fil de conversation —
   * « pas perdu » est un invariant, pas un vœu.
   */
  persistOrphanResult?: (text: string) => void;
}

/** Un événement du data channel — on ne type que ce qu'on lit, tout le reste est ignoré. */
interface RealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  text?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  /** Segment/élément porteur de l'événement — la clé de l'hygiène anti-périmé. */
  item_id?: string;
  /** Réponse porteuse d'un delta / d'un tampon audio — même hygiène. */
  response_id?: string;
  item?: { id?: string; type?: string };
  error?: { message?: string; code?: string };
  response?: { id?: string; status?: string; output?: { type: string; name?: string; call_id?: string; arguments?: string }[] };
}

/** L'obligation de restitution d'un résultat d'outil — le « propriétaire de la réponse ». */
interface PendingDelivery {
  callId: string;
  tool: string;
  /** WAITING_TOOL : l'outil tourne · READY : résultat posé, restitution due · DELIVERING : une réponse identifiée le porte. */
  state: "WAITING_TOOL" | "READY" | "DELIVERING";
  readyAt: number;
  attempts: number;
  /** La réponse qui porte la restitution (exactly-once : une seule à la fois). */
  deliveryResponseId: string | null;
  /** Texte de repli pour la persistance si la voix ne peut plus restituer. */
  resultText: string;
  /** Le rappel « restituer maintenant » n'est envoyé qu'UNE fois (pas de boucle de nudges). */
  nudged: boolean;
}

/**
 * LE REFUS DE L'ÉCHANGE SDP, AVEC CE QU'IL DIT.
 *
 * `message` reste `SDP_<statut>` : l'appelant historique teste `startsWith("SDP_")`, et on ne
 * casse pas ce contrat au passage. Ce qui est NOUVEAU, c'est tout le reste — le corps de la
 * réponse et l'en-tête `Retry-After`, qu'on jetait.
 *
 * POURQUOI LA DISTINCTION `rateLimited` COMPTE. Un 429 n'est pas une panne : c'est le serveur
 * qui dit « ralentis ». Y répondre en reconnectant aussitôt — ce que faisait la reconnexion
 * automatique — transforme un incident passager en incident qu'on entretient soi-même. Un 500,
 * lui, mérite un nouvel essai. Les traiter pareil, c'est se tromper dans les deux sens.
 */
export class SdpRejection extends Error {
  readonly status: number;
  readonly detail: string;
  /** Délai demandé par le serveur, en millisecondes. `null` s'il n'a rien précisé. */
  readonly retryAfterMs: number | null;

  constructor(status: number, body: string, retryAfterHeader: string | null) {
    super(`SDP_${status}`);
    this.name = "SdpRejection";
    this.status = status;
    this.detail = (body ?? "").slice(0, 500);
    this.retryAfterMs = parseRetryAfter(retryAfterHeader);
  }

  /** 429 : quota atteint. 503 : capacité momentanément absente — même conduite à tenir. */
  get rateLimited(): boolean {
    return isRateLimitStatus(this.status);
  }
}

export class OpenAIGptRealtime21Provider implements VoiceRealtimeProvider {
  private opts: ProviderOptions;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private _state: VoiceCallState = "IDLE";
  private _threadId: string | null = null;
  private alive = false;
  private muted = false;

  // Appariement des tours : la transcription utilisateur peut arriver APRÈS le début (voire la
  // fin) de la réponse — on garde les deux moitiés et on émet le tour quand elles sont là.
  private userText = "";
  private assistantText = "";
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private firstAudioAt: number | null = null;
  /** Le tour en cours est une RESTITUTION spontanée (résultat d'analyse) — pas une intervention. */
  private turnIsDelivery = false;

  // ── PROPRIÉTÉ DE LA RÉPONSE ──
  // La réponse active est identifiée (response.created → response.done), jamais devinée : les
  // réponses AUTO-créées par la VAD serveur passent par les mêmes événements, donc le même
  // suivi. `responseCreatePending` couvre la fenêtre « create envoyé, created pas encore vu ».
  private activeResponseId: string | null = null;
  private activeResponseSpoke = false;
  private responseCreatePending = false;
  private responseCreateSentAt = 0;
  /** Une réponse est due dès que l'active se termine (résultat arrivé pendant qu'elle parlait). */
  private pendingResponseCreate = false;
  private deliveries = new Map<string, PendingDelivery>();
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  /** Réponses annulées dont les événements résiduels doivent être IGNORÉS. */
  private cancelledResponseIds = new Set<string>();

  // ── BARGE-IN CONFIRMÉ ──
  // Un début de signal pendant que l'assistant parle n'interrompt RIEN — il ouvre une fenêtre
  // d'évaluation liée au SEGMENT (`item_id`) : mots transcrits ? durée ? haut-parleur actif ?
  private bargeWindow: { itemId: string | null; at: number } | null = null;
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;
  /** Segments déjà confirmés — UNE interruption par segment de parole (debounce). */
  private confirmedItemIds = new Set<string>();
  /** Segments ignorés pendant une réponse : la transcription TARDIVE avec mots peut encore
   *  les requalifier en vraie interruption si la MÊME réponse parle toujours. */
  private ignoredWindows = new Map<string, string | null>();
  // Synchronisation du contexte serveur au barge-in : l'item assistant en cours et le début
  // de son audio — pour `conversation.item.truncate` (ne pas considérer « entendu » ce qui
  // n'a jamais été joué).
  private currentItemId: string | null = null;
  private audioStartedAt: number | null = null;

  constructor(opts: ProviderOptions) { this.opts = opts; }

  get state(): VoiceCallState { return this._state; }
  get threadId(): string | null { return this._threadId; }

  private setState(s: VoiceCallState): void {
    if (!this.alive && s !== "ENDED" && s !== "ERROR") return;
    this._state = s;
    this.opts.callbacks.onState(s);
  }

  private send(event: Record<string, unknown>): void {
    if (this.dc?.readyState === "open") {
      try { this.dc.send(JSON.stringify(event)); } catch { /* canal en cours de fermeture */ }
    }
  }

  async connect(): Promise<void> {
    this.alive = true;
    this.setState("CONNECTING");

    // 1) Le secret éphémère — le SEUL credential côté navigateur.
    const grant = await this.opts.getGrant();
    this._threadId = grant.threadId;

    // 2) Micro — demandé UNE fois pour toute la session, avec l'hygiène audio du navigateur.
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("MIC_UNSUPPORTED");
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // 3) La connexion WebRTC directe vers l'API Realtime.
    const pc = new RTCPeerConnection();
    this.pc = pc;
    for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);

    // La voix de l'assistant : une piste distante, jouée EN CONTINU (pas de fichier attendu).
    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    pc.ontrack = (e) => {
      if (this.audioEl) this.audioEl.srcObject = e.streams[0];
      void this.audioEl?.play().catch(() => undefined); // iOS/Safari : play() après geste utilisateur
    };
    pc.onconnectionstatechange = () => {
      this.opts.callbacks.onConnectionChange?.(pc.connectionState);
    };

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handleEvent(e.data as string);

    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("DATA_CHANNEL_TIMEOUT")), 15_000);
      dc.onopen = () => { clearTimeout(t); resolve(); };
      dc.onerror = () => { clearTimeout(t); reject(new Error("DATA_CHANNEL_ERROR")); };
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 4) L'échange SDP officiel : l'offre part avec le secret ÉPHÉMÈRE, la réponse revient.
    const res = await fetch(`${grant.callUrl}?model=${encodeURIComponent(grant.model)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${grant.clientSecret}`, "Content-Type": "application/sdp" },
      body: offer.sdp,
    });
    if (!res.ok) {
      // ── CE QUE LE REFUS DIT, ON LE GARDE ──────────────────────────────────────────────
      //
      // Cette ligne jetait la réponse : `throw new Error("SDP_" + status)`, et rien d'autre.
      // Résultat en production, un soir de 429 : `detail: undefined` dans tous les journaux —
      // impossible de savoir si le compte avait atteint son plafond de sessions SIMULTANÉES ou
      // son quota par minute, deux incidents qui ne se traitent pas pareil. Et surtout, le
      // serveur DIT combien de temps attendre dans `Retry-After` : on l'ignorait pour
      // reconnecter aussitôt, ce qui est exactement la mauvaise réponse à « ralentis ».
      const body = await res.text().catch(() => "");
      const err = new SdpRejection(res.status, body, res.headers.get("retry-after"));
      throw err;
    }
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });

    await opened;
    if (this.muted) this.setMuted(true);
    this.setState("LISTENING");
  }

  /** Un événement de CONTENU appartient-il à une réponse annulée ou remplacée ?
   *  Les réponses annulées restent marquées APRÈS leur response.done : leurs événements de
   *  tampon audio traînent encore quelques instants derrière. */
  private isStaleResponseEvent(responseId: string | undefined): boolean {
    if (!responseId) return false; // pas d'étiquette : on reste permissif (anciens noms d'événements)
    if (this.cancelledResponseIds.has(responseId)) return true;
    if (this.activeResponseId === null) return true; // aucune réponse en cours : contenu forcément périmé
    return responseId !== this.activeResponseId;
  }

  /** Marque une réponse annulée — borné (les plus anciennes sortent, l'oubli est sans risque). */
  private rememberCancelled(responseId: string): void {
    this.cancelledResponseIds.add(responseId);
    if (this.cancelledResponseIds.size > 8) {
      const first = this.cancelledResponseIds.values().next().value;
      if (first !== undefined) this.cancelledResponseIds.delete(first);
    }
  }

  private handleEvent(raw: string): void {
    let e: RealtimeEvent;
    try { e = JSON.parse(raw) as RealtimeEvent; } catch { return; }
    const cb = this.opts.callbacks;

    switch (e.type) {
      // ── Tour de parole de l'utilisateur ──
      case "input_audio_buffer.speech_started": {
        const busy = this._state === "ASSISTANT_SPEAKING" || this._state === "THINKING";
        if (!busy) { this.setState("USER_SPEAKING"); break; }
        // DEBOUNCE : un segment déjà confirmé ne rouvre pas de fenêtre (une interruption par
        // segment de parole — jamais de double CONFIRMED sur le même souffle).
        if (e.item_id && this.confirmedItemIds.has(e.item_id)) break;
        // BARGE-IN À CONFIRMER : un début de signal pendant que l'assistant parle ne coupe
        // RIEN (toux, clavier, porte, ÉCHO = faux positifs observés en production). La parole
        // se confirme par des MOTS transcrits — ou par la durée seule quand le haut-parleur
        // est muet (aucune source d'écho). Un vrai « Stop. » reste rapide.
        this.bargeWindow = { itemId: e.item_id ?? null, at: performance.now() };
        cb.onMetric?.("possible_barge_in");
        if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
        this.bargeInTimer = setTimeout(() => {
          if (!this.bargeWindow) return;
          const verdict = bargeInDecision({
            assistantBusy: true,
            sustainedMs: performance.now() - this.bargeWindow.at,
            hasTranscriptEvidence: false,
            speechStopped: false,
            audioPlaying: this.audioStartedAt !== null,
          });
          if (verdict === "confirm") this.confirmBargeIn();
          // « wait » : haut-parleur actif — seuls des mots (delta / confirmation tardive)
          // ou la décision de fin de signal trancheront. Rien n'est coupé sur la durée seule.
        }, BARGE_IN_SUSTAIN_MS);
        break;
      }
      case "input_audio_buffer.speech_stopped": {
        if (this.bargeWindow) {
          const sustained = performance.now() - this.bargeWindow.at;
          const itemId = this.bargeWindow.itemId;
          const verdict = bargeInDecision({
            assistantBusy: true, sustainedMs: sustained, hasTranscriptEvidence: false,
            speechStopped: true, audioPlaying: this.audioStartedAt !== null,
          });
          this.clearBargeWindow();
          if (verdict === "ignore") {
            // FAUX BARGE-IN (bruit bref, ou signal sans mots pendant l'écho possible) : la
            // réponse CONTINUE — tracé. La transcription TARDIVE peut encore requalifier.
            if (itemId) this.ignoredWindows.set(itemId, this.activeResponseId);
            cb.onMetric?.("false_barge_in_ignored");
            break;
          }
          // Signal soutenu (haut-parleur muet) qui se termine : vraie prise de parole.
          this.confirmBargeIn(sustained);
        }
        this.setState("THINKING");
        break;
      }

      // ── Transcription de l'utilisateur (parallèle à l'audio) ──
      case "conversation.item.input_audio_transcription.delta":
        // Des MOTS pendant la fenêtre d'évaluation = parole humaine → barge-in confirmé.
        // Un delta d'un ANCIEN segment ne confirme JAMAIS la fenêtre d'un nouveau.
        if (this.bargeWindow && e.delta && /\p{L}/u.test(e.delta)) {
          const sameSegment = !e.item_id || !this.bargeWindow.itemId || e.item_id === this.bargeWindow.itemId;
          if (sameSegment) this.confirmBargeIn();
          else cb.onMetric?.("stale_event_ignored");
        }
        if (e.delta) cb.onUserTranscript(e.delta, false);
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (typeof e.transcript === "string") {
          const t = e.transcript.trim();
          // LE TRANSCRIPT N'EST PAS LA VÉRITÉ TERRAIN : une toux transcrite « … », un artefact
          // sans lettres n'entre ni dans le fil, ni dans la mémoire, ni dans les entités.
          if (isNoiseTranscript(t)) {
            this.handleNoiseCommit(e.item_id);
            break;
          }
          // CONFIRMATION TARDIVE : la fenêtre de ce segment avait été fermée « bruit » faute
          // de mots (transcription lente) — les mots sont là, la MÊME réponse parle toujours :
          // c'était une vraie interruption, elle s'exécute maintenant.
          if (e.item_id && this.ignoredWindows.has(e.item_id)) {
            const duringResponse = this.ignoredWindows.get(e.item_id);
            this.ignoredWindows.delete(e.item_id);
            if (duringResponse !== null && duringResponse === this.activeResponseId && this._state === "ASSISTANT_SPEAKING") {
              this.executeBargeInCut(0);
              if (e.item_id) this.rememberConfirmed(e.item_id);
            }
          }
          this.userText = t;
          cb.onUserTranscript(this.userText, true);
          this.maybeEmitTurn();
        }
        break;

      // ── La réponse de l'assistant ──
      case "response.created": {
        this.activeResponseId = e.response?.id ?? "r-inconnue";
        this.activeResponseSpoke = false;
        this.responseCreatePending = false;
        // La réponse qui démarre — la nôtre OU une auto-créée par la VAD — EST la réponse
        // attendue : l'intention en attente est absorbée (pas de réponse surnuméraire après).
        this.pendingResponseCreate = false;
        // EXACTLY-ONCE : la réponse qui démarre PORTE toutes les obligations prêtes — aucune
        // autre réponse ne sera demandée pour elles tant qu'elle vit.
        for (const d of this.deliveries.values()) {
          if (d.state === "READY") { d.state = "DELIVERING"; d.deliveryResponseId = this.activeResponseId; }
        }
        this.setState("THINKING");
        break;
      }
      // Transcript de l'audio de sortie — noms GA et hérité, pour survivre aux renommages.
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        // HYGIÈNE ANTI-PÉRIMÉ : les deltas d'une réponse ANNULÉE (barge-in) continuent
        // d'arriver quelques instants — ils ne polluent ni le transcript ni le tour suivant.
        if (this.isStaleResponseEvent(e.response_id)) { cb.onMetric?.("stale_event_ignored"); break; }
        if (e.delta) {
          this.activeResponseSpoke = true;
          this.assistantText += e.delta;
          cb.onAssistantTranscript(this.assistantText, false);
        }
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        // Même hygiène : le transcript FINAL d'une réponse annulée ne remplace pas la partie
        // réellement entendue par le texte complet jamais joué.
        if (this.isStaleResponseEvent(e.response_id)) { cb.onMetric?.("stale_event_ignored"); break; }
        if (typeof e.transcript === "string") this.assistantText = e.transcript.trim();
        cb.onAssistantTranscript(this.assistantText, true);
        break;

      // L'item de sortie en cours : son id sert au `truncate` du barge-in (synchroniser le
      // contexte serveur avec ce que l'utilisateur a RÉELLEMENT entendu).
      case "response.output_item.added":
        if (this.isStaleResponseEvent(e.response_id)) { cb.onMetric?.("stale_event_ignored"); break; }
        if (e.item?.type === "message" && typeof e.item.id === "string") this.currentItemId = e.item.id;
        break;

      // Le son : événements du tampon de sortie WebRTC — l'état SPEAKING suit le haut-parleur.
      case "output_audio_buffer.started":
        // Un démarrage audio d'une réponse ANNULÉE ne rebascule pas l'état en SPEAKING (les
        // événements de tampon traînent derrière le done — seul le marqueur « annulée » gate :
        // un démarrage légitime peut, lui, arriver juste après le done d'une réponse courte).
        if (e.response_id && this.cancelledResponseIds.has(e.response_id)) { cb.onMetric?.("stale_event_ignored"); break; }
        this.audioStartedAt = performance.now();
        this.activeResponseSpoke = true;
        if (this.firstAudioAt === null) {
          this.firstAudioAt = performance.now();
          cb.onMetric?.("first_audio_out", this.firstAudioAt);
        }
        this.setState("ASSISTANT_SPEAKING");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        // Couper court est TOUJOURS sûr (le haut-parleur s'est tu) — aucune condition d'id.
        this.audioStartedAt = null;
        if (this._state === "ASSISTANT_SPEAKING") this.setState("LISTENING");
        break;

      // ── Appels d'outils : exécutés par NOTRE backend, jamais ici — et EN PARALLÈLE ──
      case "response.function_call_arguments.done": {
        const name = e.name;
        const callId = e.call_id;
        if (!name || !callId) break;
        let args: Record<string, unknown> = {};
        try { args = e.arguments ? (JSON.parse(e.arguments) as Record<string, unknown>) : {}; } catch { /* args illisibles */ }
        cb.onMetric?.("tool_call");
        // L'OBLIGATION naît ICI : ce call_id a désormais un propriétaire de réponse. Elle ne
        // s'éteindra qu'une fois le résultat RESTITUÉ (ou persisté au fil en dernier recours).
        this.deliveries.set(callId, {
          callId, tool: name, state: "WAITING_TOOL", readyAt: 0, attempts: 0,
          deliveryResponseId: null, resultText: "", nudged: false,
        });
        cb.onMetric?.("pending_turn_created");
        // PAS de file : chaque outil vit sa vie (call_id l'apparie). Une analyse déléguée de
        // deux minutes n'empêche pas « quelle est la masse salariale ? » de répondre tout de
        // suite — c'est le « travail parallèle » de l'appel.
        void (async () => {
          let output: string;
          let uiReply: string | null = null;
          try {
            const r = await this.opts.callTool(name, args);
            if (r.ui) cb.onToolUi(r.ui);
            output = r.output;
            uiReply = r.ui?.reply ?? null;
          } catch {
            cb.onMetric?.("tool_error");
            // L'échec se DIT — jamais un silence : il suit le même chemin de restitution.
            output = "L'outil a échoué (réseau) — le dire simplement, ne rien inventer.";
          }
          this.completeDelivery(callId, output, uiReply);
        })();
        break;
      }

      case "response.done": {
        const rid = e.response?.id ?? this.activeResponseId ?? "r-inconnue";
        const status = e.response?.status ?? "completed";
        // Le marqueur « annulée » SURVIT au done : les événements de tampon audio de la
        // réponse annulée traînent encore derrière (c'est lui qui les fait ignorer).
        const wasCancelled = this.cancelledResponseIds.has(rid) || status === "cancelled";
        if (this.activeResponseId !== null && e.response?.id && e.response.id !== this.activeResponseId) {
          // done d'une réponse déjà remplacée dans notre suivi : régler ses obligations, sans
          // toucher à la réponse active actuelle.
          this.settleDeliveries(rid, status, false);
          break;
        }
        this.activeResponseId = null;
        this.settleDeliveries(rid, status, this.activeResponseSpoke && !wasCancelled);
        // Fin de réponse : si elle portait du texte parlé, le tour se clôt (la transcription
        // utilisateur peut être en retard de quelques centaines de ms — on lui laisse 3 s).
        if (this._state === "THINKING") this.setState("LISTENING");
        this.maybeEmitTurn(true);
        // Un résultat arrivé PENDANT cette réponse attendait son tour : maintenant.
        if (this.pendingResponseCreate) {
          this.pendingResponseCreate = false;
          this.requestResponse();
        }
        break;
      }

      case "error": {
        const code = e.error?.code ?? "";
        if (code === "conversation_already_has_active_response") {
          // Notre suivi était en retard sur une réponse AUTO-créée par la VAD serveur :
          // l'intention n'est PAS perdue — elle se replanifie. Si la réponse active est déjà
          // connue, son cycle couvre les obligations (DELIVERING) ; sinon son `created` qui
          // arrive absorbera l'attente, et le watchdog rattrape tout raté. C'était LA cause
          // du silence infini (« Je vais analyser… » puis plus rien).
          this.responseCreatePending = false;
          if (this.activeResponseId === null) {
            this.pendingResponseCreate = true;
            this.startWatchdog();
          }
          break;
        }
        if (code === "response_cancel_not_active") break; // cancel d'une réponse déjà finie — bénin
        cb.onError(e.error?.message ?? "Erreur de session vocale.", e.error?.code);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROPRIÉTÉ DE LA RÉPONSE — le cycle de vie d'une obligation de restitution.
  // ─────────────────────────────────────────────────────────────────────────

  /** Le résultat d'un outil est là : poser l'output, marquer PRÊT, RÉVEILLER la conversation. */
  private completeDelivery(callId: string, output: string, uiReply: string | null): void {
    const d = this.deliveries.get(callId);
    const resultText = deliveryFallbackText(output, uiReply);
    if (!this.alive || this.dc?.readyState !== "open") {
      // SESSION TERMINÉE PENDANT LE JOB : le résultat n'est pas perdu — il rejoint le fil.
      if (d) this.deliveries.delete(callId);
      if (resultText) this.opts.persistOrphanResult?.(resultText);
      return;
    }
    this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output } });
    if (d) {
      d.state = "READY";
      d.readyAt = performance.now();
      d.resultText = resultText;
      this.opts.callbacks.onMetric?.("pending_turn_ready");
    }
    this.requestResponse();
    this.startWatchdog();
  }

  /** Fin d'une réponse : les obligations qu'elle portait sont soit ÉTEINTES, soit replanifiées. */
  private settleDeliveries(responseId: string, status: string, spoke: boolean): void {
    const carried = [...this.deliveries.values()].filter((d) => d.state === "DELIVERING" && d.deliveryResponseId === responseId);
    if (!carried.length) return;
    if (status === "completed" && spoke) {
      // RESTITUÉ — exactly-once : l'obligation s'éteint, la latence job→voix se mesure.
      for (const d of carried) {
        this.opts.callbacks.onMetric?.("pending_turn_delivered", Math.max(0, Math.round(performance.now() - d.readyAt)));
        this.deliveries.delete(d.callId);
      }
      this.turnIsDelivery = true;
      return;
    }
    if (status === "completed" && !spoke) {
      // LE PIÈGE DE L'ACCUSÉ MUET : la réponse s'est « terminée » sans un mot — le résultat
      // n'a PAS été restitué. On le dit explicitement au modèle (une fois) et on relance.
      this.opts.callbacks.onMetric?.("silent_completion_detected");
      for (const d of carried) {
        d.state = "READY";
        d.deliveryResponseId = null;
        d.attempts += 1;
        if (!d.nudged) {
          d.nudged = true;
          this.send({
            type: "conversation.item.create",
            item: {
              type: "message", role: "system",
              content: [{ type: "input_text", text: "Un résultat d'outil ci-dessus attend sa RESTITUTION VOCALE : le restituer maintenant, en synthèse parlée — ne pas re-promettre, ne pas re-analyser." }],
            },
          });
        }
      }
      this.pendingResponseCreate = true;
      this.startWatchdog();
      return;
    }
    // Annulée (barge-in : la parole de l'utilisateur prime) ou échouée : l'obligation reste
    // due — elle repart PRÊTE et sera restituée au calme (fin du tour utilisateur / watchdog).
    for (const d of carried) {
      d.state = "READY";
      d.deliveryResponseId = null;
      if (status !== "cancelled") d.attempts += 1; // un échec compte, une interruption humaine non
    }
    this.startWatchdog();
  }

  /** `response.create` DISCIPLINÉ : jamais deux réponses demandées — l'intention se replanifie. */
  private requestResponse(): void {
    if (this.activeResponseId !== null || this.responseCreatePending) {
      this.pendingResponseCreate = true;
      return;
    }
    if (this._state === "USER_SPEAKING" || this.bargeWindow !== null) {
      // RESULT_READY pendant que l'utilisateur parle : ne JAMAIS parler par-dessus — la fin
      // de SON tour déclenche la réponse (VAD auto) ; le watchdog rattrape tout raté.
      this.pendingResponseCreate = true;
      this.startWatchdog();
      return;
    }
    this.responseCreatePending = true;
    this.responseCreateSentAt = performance.now();
    this.send({ type: "response.create" });
  }

  /** La garde déterministe de rattrapage — tourne SEULEMENT quand une restitution est due. */
  private startWatchdog(): void {
    if (this.watchdogTimer || !this.alive) return;
    this.watchdogTimer = setInterval(() => this.watchdogTick(), DELIVERY_WATCHDOG_TICK_MS);
  }

  private stopWatchdogIfIdle(): void {
    const dueDeliveries = [...this.deliveries.values()].some((d) => d.state !== "WAITING_TOOL");
    if (!dueDeliveries && !this.pendingResponseCreate && this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private watchdogTick(): void {
    if (!this.alive) return;
    const now = performance.now();
    const ready = [...this.deliveries.values()].filter((d) => d.state === "READY");
    if (!ready.length && !this.pendingResponseCreate) { this.stopWatchdogIfIdle(); return; }
    const shared = {
      activeResponse: this.activeResponseId !== null,
      createInFlightMs: this.responseCreatePending ? now - this.responseCreateSentAt : null,
      userSpeaking: this._state === "USER_SPEAKING" || this.bargeWindow !== null,
    };
    let wantCreate = false;
    for (const d of ready) {
      const action = deliveryWatchdogAction({ ...shared, readyForMs: now - d.readyAt, attempts: d.attempts });
      if (action === "give_up") {
        // ÉCHEC TERMINAL de la restitution vocale : il se DIT, et le résultat rejoint le
        // fil — jamais un résultat évaporé, jamais un échec silencieux.
        this.opts.callbacks.onMetric?.("delivery_failed");
        if (d.resultText) this.opts.persistOrphanResult?.(d.resultText);
        this.deliveries.delete(d.callId);
        this.opts.callbacks.onError(
          "La restitution vocale d'un résultat n'a pas abouti — le résultat est conservé dans le fil de conversation.",
          "DELIVERY_FAILED",
        );
      } else if (action === "create") {
        wantCreate = true;
      }
    }
    // `pendingResponseCreate` orphelin (sans obligation PRÊTE) : la même garde le rattrape.
    if (!wantCreate && this.pendingResponseCreate && !shared.activeResponse && !shared.userSpeaking
      && shared.createInFlightMs === null
      && (this.responseCreateSentAt === 0 || now - this.responseCreateSentAt >= DELIVERY_WATCHDOG_GRACE_MS)) {
      wantCreate = true;
    }
    if (wantCreate) {
      // Le create précédent s'est perdu (canal, collision VAD) — RELANCER, une seule fois par
      // tick, pour TOUTES les obligations prêtes (exactly-once : une réponse les couvrira).
      const remaining = [...this.deliveries.values()].filter((d) => d.state === "READY");
      for (const d of remaining) d.attempts += 1;
      this.opts.callbacks.onMetric?.("watchdog_recovered", remaining.length ? Math.max(...remaining.map((d) => d.attempts)) : 1);
      this.pendingResponseCreate = false;
      this.responseCreatePending = true;
      this.responseCreateSentAt = now;
      this.send({ type: "response.create" });
    }
    this.stopWatchdogIfIdle();
  }

  /** Émet le tour quand les DEUX moitiés sont là — ou après un délai de grâce côté réponse. */
  private maybeEmitTurn(fromResponseDone = false): void {
    const emit = () => {
      if (!this.assistantText) return;
      // Une RESTITUTION spontanée n'est pas une « intervention vocale » : le fil dit ce qui
      // s'est réellement passé (l'assistant a repris la parole pour livrer un résultat).
      const userHalf = this.userText || (this.turnIsDelivery ? "(restitution d'une analyse terminée)" : "(intervention vocale)");
      const turn = { user: userHalf, assistant: this.assistantText };
      this.userText = "";
      this.assistantText = "";
      this.turnIsDelivery = false;
      this.opts.callbacks.onTurnComplete(turn);
    };
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (!this.assistantText) return;
    if (this.userText || !fromResponseDone) { emit(); return; }
    // Réponse finie mais transcription utilisateur pas encore arrivée : 3 s de grâce.
    this.turnTimer = setTimeout(emit, 3_000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BARGE-IN CONFIRMÉ & HYGIÈNE DES SEGMENTS
  // ─────────────────────────────────────────────────────────────────────────

  private clearBargeWindow(): void {
    this.bargeWindow = null;
    if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
  }

  private rememberConfirmed(itemId: string): void {
    this.confirmedItemIds.add(itemId);
    if (this.confirmedItemIds.size > 16) {
      const first = this.confirmedItemIds.values().next().value;
      if (first !== undefined) this.confirmedItemIds.delete(first);
    }
  }

  /**
   * COMMIT DE BRUIT (pièce silencieuse) : la VAD a committé un segment dont la transcription
   * n'est que du bruit. Le segment est SUPPRIMÉ de la conversation (aucune pollution de
   * contexte, aucune dérive de langue), et la réponse auto qu'il a déclenchée — si elle n'a
   * encore RIEN joué et ne porte aucune restitution — est annulée : l'assistant ne dit pas
   * « Oui ? » à une porte qui claque. Zéro fausse intervention.
   */
  private handleNoiseCommit(itemId: string | undefined): void {
    if (itemId) {
      this.ignoredWindows.delete(itemId);
      this.send({ type: "conversation.item.delete", item_id: itemId });
    }
    const hasDeliveriesInFlight = [...this.deliveries.values()].some((d) => d.state !== "WAITING_TOOL");
    if (!this.userText && this.activeResponseId !== null && this.audioStartedAt === null && !hasDeliveriesInFlight) {
      this.rememberCancelled(this.activeResponseId);
      this.send({ type: "response.cancel" });
      this.opts.callbacks.onMetric?.("phantom_response_cancelled");
      if (this._state === "THINKING") this.setState("LISTENING");
    }
  }

  /** Confirmation via la FENÊTRE d'évaluation (mots, durée haut-parleur muet, fin de signal). */
  private confirmBargeIn(sustainedMs?: number): void {
    const window = this.bargeWindow;
    this.clearBargeWindow();
    if (!window) return;
    if (window.itemId) {
      if (this.confirmedItemIds.has(window.itemId)) return; // debounce : déjà coupé pour ce segment
      this.rememberConfirmed(window.itemId);
    }
    this.executeBargeInCut(sustainedMs ?? performance.now() - window.at);
  }

  /**
   * VRAIE interruption : annuler la réponse (`response.cancel`), vider le tampon audio
   * (`output_audio_buffer.clear` — le son s'arrête net), SYNCHRONISER le contexte serveur
   * (`conversation.item.truncate`) sur ce qui a réellement été joué, et MARQUER la réponse
   * annulée pour que ses événements résiduels soient ignorés. Puis la parole de l'utilisateur
   * prime. L'obligation de restitution portée par la réponse annulée redevient DUE
   * (settleDeliveries sur son response.done) — interrompre ne fait rien disparaître.
   */
  private executeBargeInCut(latencyMs: number): void {
    if (this.activeResponseId !== null) this.rememberCancelled(this.activeResponseId);
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    if (this.currentItemId && this.audioStartedAt !== null) {
      const heardMs = Math.max(0, Math.round(performance.now() - this.audioStartedAt));
      this.send({ type: "conversation.item.truncate", item_id: this.currentItemId, content_index: 0, audio_end_ms: heardMs });
    }
    this.opts.callbacks.onMetric?.("barge_in_confirmed", Math.max(0, Math.round(latencyMs)));
    this.opts.callbacks.onMetric?.("interruption");
    this.setState("USER_SPEAKING");
  }

  sendText(text: string): void {
    const t = text.trim();
    if (!t) return;
    this.userText = t; // le texte tapé EST la moitié utilisateur du tour
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: t }] } });
    this.requestResponse();
    this.setState("THINKING");
  }

  sendContext(text: string): void {
    const t = text.trim();
    if (!t) return;
    // Un item SYSTÈME, sans response.create : le contexte informe, il ne déclenche rien —
    // « explique-moi ça » se résoudra à la prochaine prise de parole.
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text: t.slice(0, 400) }] },
    });
  }

  interrupt(): void {
    if (this.activeResponseId !== null) this.rememberCancelled(this.activeResponseId);
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    if (this._state === "ASSISTANT_SPEAKING" || this._state === "THINKING") this.setState("LISTENING");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.mic?.getAudioTracks() ?? []) track.enabled = !muted;
  }

  disconnect(): void {
    this.alive = false;
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    this.clearBargeWindow();
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    // Des résultats PRÊTS jamais restitués au raccrochage : ils rejoignent le fil — pas perdus.
    for (const d of this.deliveries.values()) {
      if (d.state !== "WAITING_TOOL" && d.resultText) this.opts.persistOrphanResult?.(d.resultText);
    }
    this.deliveries.clear();
    try { this.dc?.close(); } catch { /* déjà fermé */ }
    try { this.pc?.close(); } catch { /* déjà fermé */ }
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    if (this.audioEl) { this.audioEl.srcObject = null; this.audioEl = null; }
    this.dc = null; this.pc = null; this.mic = null;
    this._state = "ENDED";
    this.opts.callbacks.onState("ENDED");
  }
}
