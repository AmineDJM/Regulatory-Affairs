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
 *   • BARGE-IN : la détection de tour serveur (semantic_vad) interrompt la réponse dès que
 *     l'utilisateur parle ; on vide EN PLUS le tampon audio local (`output_audio_buffer.clear`)
 *     pour que le son s'arrête net, sans rejouer de buffers périmés ;
 *   • chaque function call est exécuté par NOTRE backend authentifié (callTool) — jamais ici.
 *
 * Le secret utilisé est ÉPHÉMÈRE (fourni par /api/assistant/voice/session) : aucune clé longue
 * durée n'existe côté navigateur.
 */

import { bargeInDecision, isNoiseTranscript, BARGE_IN_SUSTAIN_MS } from "@/lib/assistant/voice-tuning";

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
  /** Métriques (premier audio, interruptions…) — à remonter au journal. */
  onMetric?: (
    name:
      | "first_audio_out" | "interruption" | "tool_call" | "tool_error"
      // Politique de barge-in CONFIRMÉ : signal possible → confirmé (latence en valeur) /
      // ignoré comme bruit — les DEUX métriques s'optimisent ensemble.
      | "possible_barge_in" | "barge_in_confirmed" | "false_barge_in_ignored",
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
  item?: { id?: string; type?: string };
  error?: { message?: string; code?: string };
  response?: { status?: string; output?: { type: string; name?: string; call_id?: string; arguments?: string }[] };
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
  // TRAVAIL PARALLÈLE : les outils s'exécutent SANS se bloquer mutuellement — une délégation
  // longue (analyse profonde) ne met pas en file la question rapide posée pendant qu'elle
  // tourne. Seul `response.create` se discipline : une seule réponse active à la fois — un
  // résultat qui arrive pendant que le modèle parle attend la fin de la réponse en cours.
  private activeResponse = false;
  private pendingResponseCreate = false;
  // BARGE-IN CONFIRMÉ : un début de signal pendant que l'assistant parle n'interrompt RIEN —
  // il ouvre une fenêtre d'évaluation (mots transcrits ? parole soutenue ? arrêt précoce ?).
  private pendingBargeInAt: number | null = null;
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (!res.ok) throw new Error(`SDP_${res.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });

    await opened;
    if (this.muted) this.setMuted(true);
    this.setState("LISTENING");
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
        // BARGE-IN À CONFIRMER : un début de signal pendant que l'assistant parle ne coupe
        // RIEN (toux, clavier, porte, choc = faux positifs observés en production). La parole
        // se confirme par des MOTS transcrits ou une durée soutenue — alors seulement on
        // annule. Un vrai « Stop. » reste rapide (mots ou ≥ BARGE_IN_SUSTAIN_MS).
        this.pendingBargeInAt = performance.now();
        cb.onMetric?.("possible_barge_in");
        if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
        this.bargeInTimer = setTimeout(() => {
          if (this.pendingBargeInAt !== null) this.confirmBargeIn();
        }, BARGE_IN_SUSTAIN_MS);
        break;
      }
      case "input_audio_buffer.speech_stopped": {
        if (this.pendingBargeInAt !== null) {
          const sustained = performance.now() - this.pendingBargeInAt;
          const verdict = bargeInDecision({ assistantBusy: true, sustainedMs: sustained, hasTranscriptEvidence: false, speechStopped: true });
          this.clearBargeInPending();
          if (verdict === "ignore") {
            // FAUX BARGE-IN (bruit bref) : la réponse CONTINUE, rien n'est coupé — tracé.
            cb.onMetric?.("false_barge_in_ignored");
            break;
          }
          // Signal soutenu qui se termine : vraie prise de parole — couper, puis traiter.
          this.confirmBargeIn(sustained);
        }
        this.setState("THINKING");
        break;
      }

      // ── Transcription de l'utilisateur (parallèle à l'audio) ──
      case "conversation.item.input_audio_transcription.delta":
        // Des MOTS pendant la fenêtre d'évaluation = parole humaine → barge-in confirmé.
        if (this.pendingBargeInAt !== null && e.delta && /\p{L}/u.test(e.delta)) this.confirmBargeIn();
        if (e.delta) cb.onUserTranscript(e.delta, false);
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (typeof e.transcript === "string") {
          const t = e.transcript.trim();
          // LE TRANSCRIPT N'EST PAS LA VÉRITÉ TERRAIN : une toux transcrite « … », un artefact
          // sans lettres n'entre ni dans le fil, ni dans la mémoire, ni dans les entités.
          if (isNoiseTranscript(t)) break;
          this.userText = t;
          cb.onUserTranscript(this.userText, true);
          this.maybeEmitTurn();
        }
        break;

      // ── La réponse de l'assistant ──
      case "response.created":
        this.activeResponse = true;
        this.setState("THINKING");
        break;
      // Transcript de l'audio de sortie — noms GA et hérité, pour survivre aux renommages.
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (e.delta) {
          this.assistantText += e.delta;
          cb.onAssistantTranscript(this.assistantText, false);
        }
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        if (typeof e.transcript === "string") this.assistantText = e.transcript.trim();
        cb.onAssistantTranscript(this.assistantText, true);
        break;

      // L'item de sortie en cours : son id sert au `truncate` du barge-in (synchroniser le
      // contexte serveur avec ce que l'utilisateur a RÉELLEMENT entendu).
      case "response.output_item.added":
        if (e.item?.type === "message" && typeof e.item.id === "string") this.currentItemId = e.item.id;
        break;

      // Le son : événements du tampon de sortie WebRTC — l'état SPEAKING suit le haut-parleur.
      case "output_audio_buffer.started":
        this.audioStartedAt = performance.now();
        if (this.firstAudioAt === null) {
          this.firstAudioAt = performance.now();
          cb.onMetric?.("first_audio_out", this.firstAudioAt);
        }
        this.setState("ASSISTANT_SPEAKING");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
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
        // PAS de file : chaque outil vit sa vie (call_id l'apparie). Une analyse déléguée de
        // deux minutes n'empêche pas « quelle est la masse salariale ? » de répondre tout de
        // suite — c'est le « travail parallèle » de l'appel.
        void (async () => {
          try {
            const r = await this.opts.callTool(name, args);
            if (r.ui) cb.onToolUi(r.ui);
            this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: r.output } });
          } catch {
            cb.onMetric?.("tool_error");
            this.send({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: callId, output: "L'outil a échoué (réseau) — le dire simplement, ne rien inventer." },
            });
          }
          this.requestResponse();
        })();
        break;
      }

      case "response.done":
        this.activeResponse = false;
        // Fin de réponse : si elle portait du texte parlé, le tour se clôt (la transcription
        // utilisateur peut être en retard de quelques centaines de ms — on lui laisse 3 s).
        if (this._state === "THINKING") this.setState("LISTENING");
        this.maybeEmitTurn(true);
        // Un résultat d'outil arrivé PENDANT cette réponse attendait son tour : maintenant.
        if (this.pendingResponseCreate) {
          this.pendingResponseCreate = false;
          this.requestResponse();
        }
        break;

      case "error":
        cb.onError(e.error?.message ?? "Erreur de session vocale.", e.error?.code);
        break;
    }
  }

  /** Émet le tour quand les DEUX moitiés sont là — ou après un délai de grâce côté réponse. */
  private maybeEmitTurn(fromResponseDone = false): void {
    const emit = () => {
      if (!this.assistantText) return;
      const turn = { user: this.userText || "(intervention vocale)", assistant: this.assistantText };
      this.userText = "";
      this.assistantText = "";
      this.opts.callbacks.onTurnComplete(turn);
    };
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (!this.assistantText) return;
    if (this.userText || !fromResponseDone) { emit(); return; }
    // Réponse finie mais transcription utilisateur pas encore arrivée : 3 s de grâce.
    this.turnTimer = setTimeout(emit, 3_000);
  }

  /** `response.create` DISCIPLINÉ : jamais deux réponses actives — sinon on file l'intention. */
  private requestResponse(): void {
    if (this.activeResponse) { this.pendingResponseCreate = true; return; }
    this.send({ type: "response.create" });
  }

  private clearBargeInPending(): void {
    this.pendingBargeInAt = null;
    if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
  }

  /**
   * VRAIE interruption confirmée : annuler la réponse (`response.cancel`), vider le tampon
   * audio (`output_audio_buffer.clear` — le son s'arrête net), et SYNCHRONISER le contexte
   * serveur (`conversation.item.truncate`) sur ce qui a réellement été joué — la partie jamais
   * entendue ne doit pas compter comme dite. Puis la parole de l'utilisateur prime.
   */
  private confirmBargeIn(sustainedMs?: number): void {
    const started = this.pendingBargeInAt;
    this.clearBargeInPending();
    if (started === null) return;
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    if (this.currentItemId && this.audioStartedAt !== null) {
      const heardMs = Math.max(0, Math.round(performance.now() - this.audioStartedAt));
      this.send({ type: "conversation.item.truncate", item_id: this.currentItemId, content_index: 0, audio_end_ms: heardMs });
    }
    const latency = sustainedMs ?? performance.now() - started;
    this.opts.callbacks.onMetric?.("barge_in_confirmed", Math.round(latency));
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
    this.clearBargeInPending();
    try { this.dc?.close(); } catch { /* déjà fermé */ }
    try { this.pc?.close(); } catch { /* déjà fermé */ }
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    if (this.audioEl) { this.audioEl.srcObject = null; this.audioEl = null; }
    this.dc = null; this.pc = null; this.mic = null;
    this._state = "ENDED";
    this.opts.callbacks.onState("ENDED");
  }
}
